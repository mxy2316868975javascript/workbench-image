/**
 * 漫画工作室 Store：与主 store 同模式（单例 class + useSyncExternalStore）。
 * 项目整体（含角色参考图、设定表、分镜图 Blob）作为一条记录存 IndexedDB，
 * 变更防抖落库；图片生成走独立轻量队列（并发复用主设置），不进主任务看板。
 */
import { useSyncExternalStore } from 'react'
import {
  deleteMangaProject,
  listMangaProjects,
  loadMangaSettings,
  putMangaProject,
  saveMangaSettings,
  sweepStaleManga,
} from '../lib/db'
import { buildCharacterSheetPrompt, buildScenePrompt, generateMangaImage, resolveStyle } from '../lib/manga-artist'
import { scenesFromScriptDoc, streamScriptDoc } from '../lib/manga-writer'
import { downloadBlobAs, makeThumbBlob, uid } from '../lib/image-utils'
import type { MangaCharacter, MangaProject, MangaScene, MangaSettings } from '../lib/types'
import { DEFAULT_MANGA_SETTINGS, STYLE_PRESETS } from '../lib/types'
import { store as mainStore } from './store'

type MangaStep = 'script' | 'characters' | 'storyboard'

export interface MangaAppState {
  loaded: boolean
  projects: Record<string, MangaProject>
  projectOrder: string[]
  activeProjectId: string | null
  /** 宽屏中栏步骤；窄屏下作为页签互斥显示 */
  activeStep: MangaStep
  /** AI 正在流式写剧本 */
  scriptStreaming: boolean
  /** 推理模型思考中的已产出字数（0 = 未在思考 / 无思考输出） */
  scriptThinkingChars: number
  /** 正在从剧本切分分镜 */
  scenesFromDocBusy: boolean
  scriptError?: string
  lightbox: { sceneIds: string[]; index: number } | null
  mangaSettings: MangaSettings
  mangaSettingsOpen: boolean
}

interface Internal {
  aborts: Map<string, AbortController>   // key: `c:<charId>` / `s:<sceneId>`
  running: number
  queue: Array<() => void>
}

/** 单个持久化项目的兜底结构（旧版本缺字段时补齐；旧 summary 迁移为剧本文档） */
function normalizeProject(raw: MangaProject): MangaProject {
  return {
    ...raw,
    characters: raw.characters ?? [],
    scenes: raw.scenes ?? [],
    scriptDoc: raw.scriptDoc ?? raw.summary,
    bubbleDialogue: raw.bubbleDialogue ?? true,
    colorMode: raw.colorMode ?? 'color',
    size: raw.size ?? '1536x1024',
    styleId: raw.styleId ?? 'shonen',
  }
}

class MangaStore {
  private state: MangaAppState = {
    loaded: false,
    projects: {},
    projectOrder: [],
    activeProjectId: null,
    activeStep: 'script',
    scriptStreaming: false,
    scriptThinkingChars: 0,
    scenesFromDocBusy: false,
    lightbox: null,
    mangaSettings: { ...DEFAULT_MANGA_SETTINGS },
    mangaSettingsOpen: false,
  }

  private internal: Internal = { aborts: new Map(), running: 0, queue: [] }
  private listeners = new Set<() => void>()
  private persistTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private initPromise: Promise<void> | null = null

  subscribe = (cb: () => void) => {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  getState = () => this.state

  private set(patch: Partial<MangaAppState>) {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((cb) => cb())
  }

  /* ---------------- 初始化 ---------------- */

  init() {
    this.initPromise ??= this.doInit()
    return this.initPromise
  }

  private async doInit() {
    try {
      const [mangaSettings] = await Promise.all([loadMangaSettings(), sweepStaleManga()])
      const projects = await listMangaProjects()
      const map: Record<string, MangaProject> = {}
      for (const p of projects) map[p.id] = normalizeProject(p)
      this.set({
        loaded: true,
        projects: map,
        projectOrder: projects.map((p) => p.id),
        activeProjectId: projects[0]?.id ?? null,
        mangaSettings,
      })
    } catch (err) {
      // 初始化失败也要结束加载态（空列表兜底），避免永久卡在加载中
      const msg = err instanceof Error ? err.message : String(err)
      this.set({ loaded: true })
      mainStore.log('error', `漫画项目加载失败：${msg}（可刷新页面重试）`)
    }
  }

  /* ---------------- 项目管理 ---------------- */

  createProject() {
    const now = Date.now()
    const project: MangaProject = {
      id: uid('mp_'),
      title: '未命名漫画',
      idea: '',
      styleId: 'shonen',
      colorMode: 'color',
      bubbleDialogue: true,
      size: '1536x1024',
      characters: [],
      scenes: [],
      createdAt: now,
      updatedAt: now,
    }
    this.set({
      projects: { ...this.state.projects, [project.id]: project },
      projectOrder: [project.id, ...this.state.projectOrder],
      activeProjectId: project.id,
      activeStep: 'script',
    })
    void putMangaProject(project)
    mainStore.log('info', '新建漫画项目')
  }

  /** 删除项目（UI 通过主 store 的 requestConfirm 发起），进行中的生成一并中止 */
  async deleteProject(id: string) {
    const project = this.state.projects[id]
    if (project) {
      for (const c of project.characters) this.internal.aborts.get(`c:${c.id}`)?.abort()
      for (const s of project.scenes) this.internal.aborts.get(`s:${s.id}`)?.abort()
    }
    await deleteMangaProject(id)
    const projects = { ...this.state.projects }
    delete projects[id]
    const order = this.state.projectOrder.filter((p) => p !== id)
    this.set({
      projects,
      projectOrder: order,
      activeProjectId: this.state.activeProjectId === id ? order[0] ?? null : this.state.activeProjectId,
    })
    mainStore.log('warn', '漫画项目已删除')
  }

  setActiveProject(id: string) {
    this.set({ activeProjectId: id })
  }

  setActiveStep(step: MangaStep) {
    this.set({ activeStep: step })
  }

  activeProject(): MangaProject | null {
    return this.state.activeProjectId ? this.state.projects[this.state.activeProjectId] ?? null : null
  }

  /** 项目级更新：立即改内存，防抖落库（record 含多个 Blob，写整条较重） */
  private updateProject(id: string, mutator: (p: MangaProject) => MangaProject, opts: { persistNow?: boolean } = {}) {
    const current = this.state.projects[id]
    if (!current) return
    const updated = { ...mutator(current), updatedAt: Date.now() }
    this.set({ projects: { ...this.state.projects, [id]: updated } })
    const existing = this.persistTimers.get(id)
    if (existing) clearTimeout(existing)
    if (opts.persistNow) {
      this.persistTimers.delete(id)
      void putMangaProject(updated)
    } else {
      this.persistTimers.set(
        id,
        setTimeout(() => {
          this.persistTimers.delete(id)
          void putMangaProject(this.state.projects[id] ?? updated)
        }, 800),
      )
    }
  }

  private styleNameOf(project: MangaProject): string {
    return STYLE_PRESETS.find((p) => p.id === project.styleId)?.name ?? project.styleId
  }

  /** 项目级文本字段更新（标题 / 创意 / 剧本文档 / 提示词 / 画风 / 画幅等，编辑表单通用入口） */
  updateProjectText(
    projectId: string,
    patch: Partial<Pick<MangaProject, 'title' | 'idea' | 'scriptDoc' | 'scriptPrompt' | 'styleId' | 'customStyle' | 'colorMode' | 'bubbleDialogue' | 'size'>>,
  ) {
    this.updateProject(projectId, (p) => ({ ...p, ...patch }))
  }

  /* ---------------- 脚本创作（剧本文档） ---------------- */

  /** 流式生成 Markdown 剧本文档：onDelta 实时写入 scriptDoc，落库沿用防抖 */
  async streamScript() {
    const project = this.activeProject()
    if (!project || this.state.scriptStreaming) return
    this.set({ scriptStreaming: true, scriptError: undefined, scriptThinkingChars: 0 })
    mainStore.log('info', `开始创作剧本（模型 ${this.state.mangaSettings.textModel}）`)
    const controller = new AbortController()
    this.internal.aborts.set('script', controller)
    try {
      // 显示采用替换式：流式期间只显示本次生成内容（与最终结果一致，避免与旧文档叠加）
      let acc = ''
      const doc = await streamScriptDoc({
        textSettings: this.state.mangaSettings,
        idea: project.idea,
        styleName: this.styleNameOf(project),
        colorMode: project.colorMode,
        characters: project.characters,
        userPrompt: project.scriptPrompt,
        currentDoc: project.scriptDoc,
        signal: controller.signal,
        onReasoning: (delta) => {
          // 思考阶段只在内存计数，不落库
          this.set({ scriptThinkingChars: this.state.scriptThinkingChars + delta.length })
        },
        onDelta: (delta) => {
          acc += delta
          if (this.state.scriptThinkingChars > 0) this.set({ scriptThinkingChars: 0 })
          const current = this.state.projects[project.id]
          if (!current) return
          // 内存即时替换，落库走 updateProject 的防抖
          this.updateProject(project.id, (p) => ({ ...p, scriptDoc: acc }))
        },
      })
      // 收尾强制落库一次
      this.updateProject(project.id, (p) => ({ ...p, scriptDoc: doc }), { persistNow: true })
      mainStore.log('success', `剧本创作完成（${doc.length} 字）`)
    } catch (err) {
      const aborted = (err as Error)?.name === 'AbortError'
      const msg = aborted ? '已停止' : err instanceof Error ? err.message : String(err)
      if (!aborted) {
        this.set({ scriptError: msg })
        mainStore.log('error', `剧本创作失败：${msg}`)
      } else {
        mainStore.log('warn', '剧本创作已停止，已生成部分保留')
        this.updateProject(project.id, (p) => p, { persistNow: true })
      }
    } finally {
      this.internal.aborts.delete('script')
      this.set({ scriptStreaming: false, scriptThinkingChars: 0 })
    }
  }

  stopScriptStream() {
    this.internal.aborts.get('script')?.abort()
  }

  /** 从剧本文档切分结构化分镜：替换当前全部分镜格 */
  async generateScenesFromDoc(panelCount: number) {
    const project = this.activeProject()
    if (!project || this.state.scenesFromDocBusy) return
    if (!project.scriptDoc?.trim()) {
      mainStore.log('warn', '剧本文档还是空的，先创作剧本再切分分镜')
      return
    }
    this.set({ scenesFromDocBusy: true, scriptError: undefined })
    mainStore.log('info', `从剧本切分分镜（${panelCount} 格，模型 ${this.state.mangaSettings.textModel}）`)
    try {
      const draft = await scenesFromScriptDoc({
        textSettings: this.state.mangaSettings,
        idea: project.idea,
        styleName: this.styleNameOf(project),
        colorMode: project.colorMode,
        panelCount,
        characters: project.characters,
        scriptDoc: project.scriptDoc,
      })
      // 角色名 → 已有角色 id；模型新造的角色名跳过（不自动建角色）
      const nameToId = new Map(project.characters.map((c) => [c.name, c.id]))
      const scenes: MangaScene[] = draft.scenes.map((s) => ({
        id: uid('sc_'),
        description: s.description,
        dialogue: s.dialogue,
        narration: s.narration,
        shotType: s.shotType,
        characterIds: s.characters.map((n) => nameToId.get(n)).filter((v): v is string => !!v),
        status: 'draft',
      }))
      this.updateProject(project.id, (p) => ({ ...p, scenes }), { persistNow: true })
      mainStore.log('success', `分镜切分完成：${scenes.length} 格`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.set({ scriptError: msg })
      mainStore.log('error', `分镜切分失败：${msg}`)
    } finally {
      this.set({ scenesFromDocBusy: false })
    }
  }

  /* ---------------- 分镜编辑 ---------------- */

  addScene() {
    const project = this.activeProject()
    if (!project) return
    this.updateProject(project.id, (p) => ({
      ...p,
      scenes: [
        ...p.scenes,
        { id: uid('sc_'), description: '', shotType: 'medium', characterIds: [], status: 'draft' },
      ],
    }))
  }

  updateScene(sceneId: string, patch: Partial<MangaScene>) {
    const project = this.activeProject()
    if (!project) return
    this.updateProject(project.id, (p) => ({
      ...p,
      scenes: p.scenes.map((s) => (s.id === sceneId ? { ...s, ...patch } : s)),
    }))
  }

  removeScene(sceneId: string) {
    const project = this.activeProject()
    if (!project) return
    this.internal.aborts.get(`s:${sceneId}`)?.abort()
    this.updateProject(project.id, (p) => ({
      ...p,
      scenes: p.scenes.filter((s) => s.id !== sceneId),
    }))
  }

  moveScene(sceneId: string, delta: number) {
    const project = this.activeProject()
    if (!project) return
    this.updateProject(project.id, (p) => {
      const idx = p.scenes.findIndex((s) => s.id === sceneId)
      const next = idx + delta
      if (idx < 0 || next < 0 || next >= p.scenes.length) return p
      const scenes = [...p.scenes]
      ;[scenes[idx], scenes[next]] = [scenes[next], scenes[idx]]
      return { ...p, scenes }
    })
  }

  /* ---------------- 角色管理 ---------------- */

  addCharacter() {
    const project = this.activeProject()
    if (!project) return
    this.updateProject(project.id, (p) => ({
      ...p,
      characters: [
        ...p.characters,
        { id: uid('mc_'), name: `角色 ${p.characters.length + 1}`, description: '', status: 'draft' },
      ],
    }))
  }

  updateCharacter(charId: string, patch: Partial<MangaCharacter>) {
    const project = this.activeProject()
    if (!project) return
    this.updateProject(project.id, (p) => ({
      ...p,
      characters: p.characters.map((c) => (c.id === charId ? { ...c, ...patch } : c)),
    }))
  }

  removeCharacter(charId: string) {
    const project = this.activeProject()
    if (!project) return
    this.internal.aborts.get(`c:${charId}`)?.abort()
    this.updateProject(project.id, (p) => ({
      ...p,
      characters: p.characters.filter((c) => c.id !== charId),
      // 分镜格里同步摘除该角色
      scenes: p.scenes.map((s) => ({ ...s, characterIds: s.characterIds.filter((id) => id !== charId) })),
    }))
  }

  /* ---------------- 生成调度 ---------------- */

  private pump() {
    const max = Math.max(1, mainStore.getState().settings.concurrency)
    while (this.internal.running < max && this.internal.queue.length > 0) {
      const job = this.internal.queue.shift()!
      this.internal.running++
      void job()
    }
  }

  private releaseSlot() {
    this.internal.running--
    this.pump()
  }

  /** 生成角色设定表（六宫格）；参考图 = 用户上传图 */
  generateCharacterSheet(charId: string) {
    const project = this.activeProject()
    const character = project?.characters.find((c) => c.id === charId)
    if (!project || !character || character.status === 'generating') return
    if (!character.name.trim() && !character.description.trim()) {
      mainStore.log('warn', '角色还没有名字和外观描述，先填写再生成')
      return
    }
    this.updateProject(project.id, (p) => ({
      ...p,
      characters: p.characters.map((c) =>
        c.id === charId ? { ...c, status: 'generating', error: undefined, sheetBlob: undefined, sheetThumb: undefined } : c,
      ),
    }))
    this.internal.queue.push(() => this.runCharacterSheetJob(project.id, charId))
    this.pump()
  }

  private async runCharacterSheetJob(projectId: string, charId: string) {
    const controller = new AbortController()
    this.internal.aborts.set(`c:${charId}`, controller)
    const project = this.state.projects[projectId]
    const character = project?.characters.find((c) => c.id === charId)
    // 排队期间被取消 / 项目被删：直接跳过
    if (!project || !character || character.status !== 'generating') {
      this.releaseSlot()
      return
    }
    mainStore.log('info', `开始生成角色设定表：${character.name}`)
    try {
      const style = resolveStyle(project)
      const result = await generateMangaImage({
        settings: mainStore.getState().settings,
        prompt: buildCharacterSheetPrompt(character, style),
        size: '1024x1024',
        signal: controller.signal,
        referenceImages: character.refBlobs?.length ? character.refBlobs : undefined,
        log: (level, text) => mainStore.log(level, text),
        onProgress: () => { /* 生成期间 UI 显示 spinner */ },
      })
      const thumb = await makeThumbBlob(result.blob)
      this.updateProject(
        projectId,
        (p) => ({
          ...p,
          characters: p.characters.map((c) =>
            c.id === charId ? { ...c, status: 'done', sheetBlob: result.blob, sheetThumb: thumb, error: undefined } : c,
          ),
        }),
        { persistNow: true },
      )
      mainStore.log('success', `角色设定表完成：${character.name}`)
    } catch (err) {
      const aborted = (err as Error)?.name === 'AbortError'
      const msg = aborted ? '已取消' : err instanceof Error ? err.message : String(err)
      this.updateProject(
        projectId,
        (p) => ({
          ...p,
          characters: p.characters.map((c) =>
            c.id === charId ? { ...c, status: aborted ? 'draft' : 'failed', error: aborted ? undefined : msg } : c,
          ),
        }),
        { persistNow: true },
      )
      mainStore.log(aborted ? 'warn' : 'error', `角色设定表${aborted ? '已取消' : `失败：${msg}`}：${character.name}`)
    } finally {
      this.internal.aborts.delete(`c:${charId}`)
      this.releaseSlot()
    }
  }

  cancelCharacterSheet(charId: string) {
    const project = this.activeProject()
    const character = project?.characters.find((c) => c.id === charId)
    if (character?.status === 'generating') {
      this.internal.aborts.get(`c:${charId}`)?.abort()
    } else if (project && character?.status !== 'done') {
      // 排队中：直接回草稿，job 开跑时按状态跳过
      this.updateProject(project.id, (p) => ({
        ...p,
        characters: p.characters.map((c) => (c.id === charId ? { ...c, status: 'draft' } : c)),
      }))
    }
  }

  /** 生成单格分镜；出场角色的设定表作为参考图 */
  generateScene(sceneId: string) {
    const project = this.activeProject()
    if (!project) return
    const scene = project.scenes.find((s) => s.id === sceneId)
    if (!scene || scene.status === 'generating' || scene.status === 'queued') return
    if (!scene.description.trim()) {
      mainStore.log('warn', '该分镜还没有画面描述，先填写再生成')
      return
    }
    const missingSheet = scene.characterIds
      .map((id) => project.characters.find((c) => c.id === id))
      .filter((c) => c && c.status !== 'done')
    if (missingSheet.length > 0) {
      mainStore.log('warn', `角色「${missingSheet.map((c) => c!.name).join('、')}」还没有设定表，将仅以文字描述锁定外观`)
    }
    this.updateProject(project.id, (p) => ({
      ...p,
      scenes: p.scenes.map((s) =>
        s.id === sceneId ? { ...s, status: 'queued', error: undefined, imageBlob: undefined, thumbBlob: undefined } : s,
      ),
    }))
    this.internal.queue.push(() => this.runSceneJob(project.id, sceneId))
    this.pump()
  }

  /** 批量生成：全部 draft / failed 的格按顺序入队 */
  generateAllScenes() {
    const project = this.activeProject()
    if (!project) return
    const targets = project.scenes.filter((s) => s.status === 'draft' || s.status === 'failed')
    for (const s of targets) this.generateScene(s.id)
    if (targets.length > 0) mainStore.log('info', `批量生成：${targets.length} 格已入队`)
  }

  private async runSceneJob(projectId: string, sceneId: string) {
    const controller = new AbortController()
    this.internal.aborts.set(`s:${sceneId}`, controller)
    const project = this.state.projects[projectId]
    const scene = project?.scenes.find((s) => s.id === sceneId)
    // 排队期间被取消 / 项目被删：直接跳过
    if (!project || !scene || scene.status !== 'queued') {
      this.releaseSlot()
      return
    }
    const ordinal = project.scenes.findIndex((s) => s.id === sceneId) + 1
    this.updateProject(projectId, (p) => ({
      ...p,
      scenes: p.scenes.map((s) => (s.id === sceneId ? { ...s, status: 'generating' } : s)),
    }))
    try {
      const { prompt, referenceImages } = buildScenePrompt(scene, project, project.characters)
      const result = await generateMangaImage({
        settings: mainStore.getState().settings,
        prompt,
        size: project.size,
        signal: controller.signal,
        referenceImages: referenceImages.length ? referenceImages : undefined,
        log: (level, text) => mainStore.log(level, text),
        onProgress: () => { /* 生成期间 UI 显示 shimmer */ },
      })
      const thumb = await makeThumbBlob(result.blob)
      this.updateProject(
        projectId,
        (p) => ({
          ...p,
          scenes: p.scenes.map((s) =>
            s.id === sceneId ? { ...s, status: 'done', imageBlob: result.blob, thumbBlob: thumb, error: undefined } : s,
          ),
        }),
        { persistNow: true },
      )
      mainStore.log('success', `分镜生成完成（第 ${ordinal} 格）`)
    } catch (err) {
      const aborted = (err as Error)?.name === 'AbortError'
      const msg = aborted ? '已取消' : err instanceof Error ? err.message : String(err)
      this.updateProject(
        projectId,
        (p) => ({
          ...p,
          scenes: p.scenes.map((s) =>
            s.id === sceneId ? { ...s, status: aborted ? 'draft' : 'failed', error: aborted ? undefined : msg } : s,
          ),
        }),
        { persistNow: true },
      )
      mainStore.log(aborted ? 'warn' : 'error', `分镜生成${aborted ? '已取消' : `失败：${msg}`}（第 ${ordinal} 格）`)
    } finally {
      this.internal.aborts.delete(`s:${sceneId}`)
      this.releaseSlot()
    }
  }

  cancelScene(sceneId: string) {
    const project = this.activeProject()
    const scene = project?.scenes.find((s) => s.id === sceneId)
    if (scene?.status === 'generating') {
      this.internal.aborts.get(`s:${sceneId}`)?.abort()
    } else if (project && scene?.status === 'queued') {
      // 排队中：直接回草稿，job 开跑时按状态跳过
      this.updateProject(project.id, (p) => ({
        ...p,
        scenes: p.scenes.map((s) => (s.id === sceneId ? { ...s, status: 'draft' } : s)),
      }))
    }
  }

  /* ---------------- 导出 ---------------- */

  /** 把全部完成格纵向拼接成长图下载（canvas，无额外依赖） */
  async exportLongStrip() {
    const project = this.activeProject()
    if (!project) return
    const done = project.scenes.filter((s) => s.status === 'done' && s.imageBlob)
    if (done.length === 0) {
      mainStore.log('warn', '还没有完成的分镜格可导出')
      return
    }
    try {
      const bitmaps = await Promise.all(done.map((s) => createImageBitmap(s.imageBlob!)))
      const width = Math.max(...bitmaps.map((b) => b.width))
      const gap = 12
      const height =
        bitmaps.reduce((sum, b) => sum + Math.round(b.height * (width / b.width)), 0) + gap * (bitmaps.length - 1)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('无法创建画布')
      let y = 0
      for (const b of bitmaps) {
        const h = Math.round(b.height * (width / b.width))
        ctx.drawImage(b, 0, y, width, h)
        y += h + gap
        b.close()
      }
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('编码失败'))), 'image/png'),
      )
      downloadBlobAs(blob, `${project.title || '漫画'}-长图-${done.length}格.png`)
      mainStore.log('success', `长图导出完成：${done.length} 格，${width}×${height}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      mainStore.log('error', `长图导出失败：${msg}`)
    }
  }

  /* ---------------- 灯箱 / 设置 ---------------- */

  openLightbox(sceneIds: string[], index: number) {
    this.set({ lightbox: { sceneIds, index } })
  }

  lightboxNav(delta: number) {
    const lb = this.state.lightbox
    if (!lb) return
    const next = (lb.index + delta + lb.sceneIds.length) % lb.sceneIds.length
    this.set({ lightbox: { ...lb, index: next } })
  }

  closeLightbox() {
    this.set({ lightbox: null })
  }

  openMangaSettings() {
    this.set({ mangaSettingsOpen: true })
  }

  closeMangaSettings() {
    this.set({ mangaSettingsOpen: false })
  }

  async updateMangaSettings(settings: MangaSettings) {
    await saveMangaSettings(settings)
    this.set({ mangaSettings: settings, mangaSettingsOpen: false })
    mainStore.log('info', `漫画设置已保存（LLM 模型=${settings.textModel}）`)
  }
}

export const mangaStore = new MangaStore()

export function useMangaStore(): MangaAppState {
  return useSyncExternalStore(mangaStore.subscribe, mangaStore.getState)
}
