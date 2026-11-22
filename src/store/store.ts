/**
 * 全局状态存储：单例 store + useSyncExternalStore。
 * 内存态：当前任务图片实时进度/日志；持久态：IndexedDB（tasks/images/settings）。
 * 历史图片在内存里只保留元数据 + 缩略 Blob，完整 Blob 按需从库里取。
 */
import { useSyncExternalStore } from 'react'
import type {
  CustomTemplate,
  GenParams,
  ImageRecord,
  LogLine,
  LogLevel,
  Settings,
  TaskRecord,
  StorageUsage,
} from '../lib/types'
import type { ShuixianCategory, ShuixianPrompt } from '../lib/shuixian'
import {
  clearAllData,
  deleteImage as dbDeleteImage,
  deleteTask as dbDeleteTask,
  estimateStorage,
  getImage as dbGetImage,
  getImagesByTask,
  listTasks,
  loadSettings,
  putImage,
  putTask,
  saveSettings as dbSaveSettings,
  sweepStaleImages,
} from '../lib/db'
import { generateOne } from '../lib/generator'
import { makeThumbBlob, uid } from '../lib/image-utils'

const LOG_RING_MAX = 3000
const IMAGE_LOG_MAX = 500

/* ---------------- 面板展开/收起偏好（localStorage 记忆） ---------------- */

const PANELS_KEY = 'image-workbench-panels'

interface PanelPrefs {
  leftOpen: boolean
  historyOpen: boolean
  workspace: 'image' | 'manga'
  mangaLeftOpen: boolean
}

function loadPanelPrefs(): PanelPrefs {
  try {
    const raw = localStorage.getItem(PANELS_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      return {
        leftOpen: p.leftOpen !== false,
        historyOpen: p.historyOpen === true,
        workspace: p.workspace === 'manga' ? 'manga' : 'image',
        mangaLeftOpen: p.mangaLeftOpen !== false,
      }
    }
  } catch {
    /* 忽略损坏的数据 */
  }
  // 首次访问：左栏展开，宽屏默认展开历史
  return { leftOpen: true, historyOpen: window.innerWidth >= 1280, workspace: 'image', mangaLeftOpen: true }
}

function persistPanelPrefs(prefs: PanelPrefs) {
  try {
    localStorage.setItem(PANELS_KEY, JSON.stringify(prefs))
  } catch {
    /* 存储不可用时忽略 */
  }
}

/** 工作区切换（生图工作台 / 漫画工作室），选择持久化在面板偏好里 */
export function persistWorkspace(workspace: PanelPrefs['workspace']) {
  const raw = localStorage.getItem(PANELS_KEY)
  let prefs: PanelPrefs
  try {
    prefs = raw ? JSON.parse(raw) : { leftOpen: true, historyOpen: false, workspace: 'image', mangaLeftOpen: true }
  } catch {
    prefs = { leftOpen: true, historyOpen: false, workspace: 'image', mangaLeftOpen: true }
  }
  prefs.workspace = workspace
  localStorage.setItem(PANELS_KEY, JSON.stringify(prefs))
}

export interface AppState {
  settings: Settings
  settingsLoaded: boolean
  images: Record<string, ImageRecord>
  tasks: Record<string, TaskRecord>
  taskOrder: string[]
  logs: LogLine[]
  activeTaskId: string | null
  logFilterImageId: string | null
  settingsOpen: boolean
  lightbox: { imageIds: string[]; index: number } | null
  storageUsage: StorageUsage | null
  prefill: { prompt: string; params: GenParams; refImages?: Blob[]; keepRefs?: boolean; nonce: number } | null
  logDrawer: 'collapsed' | 'open' | 'full'
  historyOpen: boolean
  leftOpen: boolean
  /** 漫画工作室左栏（项目列表）展开状态 */
  mangaLeftOpen: boolean
  /** 当前工作区：生图工作台 / 漫画工作室 */
  workspace: 'image' | 'manga'
  /** 窄屏（<lg）下的页签：生成面板 / 任务看板 */
  narrowView: 'generate' | 'board'
  customTemplates: CustomTemplate[]
  templateDialogOpen: boolean
  /** 水仙提示词库：按需拉取后缓存于 IndexedDB */
  shuixian: { status: 'idle' | 'loading' | 'loaded' | 'error'; error?: string; prompts: ShuixianPrompt[]; categories: Record<string, ShuixianCategory> }
  /** 删除类操作的统一确认请求（App 挂载 ConfirmDialog 渲染） */
  confirmRequest: { title: string; message: string; confirmText?: string; run: () => void | Promise<void> } | null
}

interface Internal {
  aborts: Map<string, AbortController>
  running: number
  queue: Array<() => void>
}

class Store {
  private state: AppState = (() => {
    const prefs = loadPanelPrefs()
    return {
      settings: {
        baseUrl: '/api/relay/v1',
        apiKey: '',
        model: 'gpt-image-1',
        concurrency: 2,
        autoRetry: true,
        defaultParams: { size: '1024x1024', quality: 'high', background: 'auto', output_format: 'png' },
      },
      settingsLoaded: false,
      images: {},
      tasks: {},
      taskOrder: [],
      logs: [],
      activeTaskId: null,
      logFilterImageId: null,
      settingsOpen: false,
      lightbox: null,
      storageUsage: null,
      prefill: null,
      logDrawer: 'collapsed' as const,
      leftOpen: prefs.leftOpen,
      historyOpen: prefs.historyOpen,
      workspace: prefs.workspace,
      mangaLeftOpen: prefs.mangaLeftOpen,
      narrowView: 'generate' as const,
      confirmRequest: null,
      customTemplates: [],
      templateDialogOpen: false,
      shuixian: { status: 'idle', prompts: [], categories: {} },
    }
  })()

  private internal: Internal = { aborts: new Map(), running: 0, queue: [] }
  private listeners = new Set<() => void>()

  subscribe = (cb: () => void) => {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  getState = () => this.state

  private notify() {
    this.listeners.forEach((cb) => cb())
  }

  private set(patch: Partial<AppState>) {
    this.state = { ...this.state, ...patch }
    this.notify()
  }

  /* ---------------- 初始化 ---------------- */

  private initPromise: Promise<void> | null = null

  init() {
    this.initPromise ??= this.doInit()
    return this.initPromise
  }

  private async doInit() {
    const settings = await loadSettings()
    void this.loadCustomTemplates()
    const swept = await sweepStaleImages()
    await this.loadHistoryFromDB()
    this.set({ settings, settingsLoaded: true, storageUsage: await estimateStorage() })
    if (swept > 0) {
      this.log('warn', `启动清扫：${swept} 张上次会话遗留的图片标记为失败，可重试`)
    }
    if (!settings.apiKey || !settings.baseUrl) {
      this.set({ settingsOpen: true })
    }
    // 任务状态收敛：把 running 任务按图片实际状态重算
    for (const taskId of this.state.taskOrder) {
      this.refreshTaskStatus(taskId, { silent: true })
    }
  }

  private async loadHistoryFromDB() {
    // 读取任务 + 图片（内存只保留缩略图，完整 Blob 留在库里）
    const tasks = await listTasks(200)
    const images: Record<string, ImageRecord> = {}
    const taskMap: Record<string, TaskRecord> = {}
    for (const task of tasks) {
      taskMap[task.id] = task
      const imgs = await getImagesByTask(task.id)
      for (const img of imgs) {
        images[img.id] = { ...img, blob: undefined } // 完整 Blob 不进内存
      }
    }
    this.set({
      images: { ...this.state.images, ...images },
      tasks: { ...this.state.tasks, ...taskMap },
      taskOrder: tasks.map((t) => t.id),
    })
  }

  /* ---------------- 日志 ---------------- */

  log(level: LogLevel, text: string, imageId?: string) {
    const line: LogLine = { t: Date.now(), level, text, imageId }
    const logs = [...this.state.logs, line]
    if (logs.length > LOG_RING_MAX) logs.splice(0, logs.length - LOG_RING_MAX)
    const image = imageId ? this.state.images[imageId] : undefined
    const images = { ...this.state.images }
    if (image && imageId) {
      const imgLogs = [...image.logs, line]
      if (imgLogs.length > IMAGE_LOG_MAX) imgLogs.splice(0, imgLogs.length - IMAGE_LOG_MAX)
      images[imageId] = { ...image, logs: imgLogs }
    }
    this.set({ logs, images })
  }

  clearLogs() {
    this.set({ logs: [] })
  }

  setLogDrawer(mode: AppState['logDrawer']) {
    this.set({ logDrawer: mode })
  }

  expandLogs() {
    this.set({ logDrawer: 'open' })
  }

  toggleHistoryPanel(force?: boolean) {
    const historyOpen = force ?? !this.state.historyOpen
    this.set({ historyOpen })
    persistPanelPrefs({ leftOpen: this.state.leftOpen, historyOpen, workspace: this.state.workspace, mangaLeftOpen: this.state.mangaLeftOpen })
  }

  toggleLeftPanel(force?: boolean) {
    const leftOpen = force ?? !this.state.leftOpen
    this.set({ leftOpen })
    persistPanelPrefs({ leftOpen, historyOpen: this.state.historyOpen, workspace: this.state.workspace, mangaLeftOpen: this.state.mangaLeftOpen })
  }

  toggleMangaLeftPanel(force?: boolean) {
    const mangaLeftOpen = force ?? !this.state.mangaLeftOpen
    this.set({ mangaLeftOpen })
    persistPanelPrefs({ leftOpen: this.state.leftOpen, historyOpen: this.state.historyOpen, workspace: this.state.workspace, mangaLeftOpen })
  }

  setNarrowView(view: AppState['narrowView']) {
    this.set({ narrowView: view })
  }

  /** 切换工作区（生图 / 漫画），持久化到面板偏好 */
  setWorkspace(workspace: AppState['workspace']) {
    this.set({ workspace })
    persistWorkspace(workspace)
  }

  /** 清空数据库：删除全部任务与图片，保留设置；进行中的生成一并中止 */
  async clearDatabase() {
    for (const c of this.internal.aborts.values()) c.abort()
    this.internal.aborts.clear()
    this.internal.queue = []
    await clearAllData()
    this.set({
      images: {},
      tasks: {},
      taskOrder: [],
      activeTaskId: null,
      lightbox: null,
      prefill: null,
      logFilterImageId: null,
    })
    this.log('warn', '数据库已清空：全部任务与图片已删除，设置与密钥保留')
    this.refreshStorage()
  }

  setLogFilterImageId(id: string | null) {
    this.set({ logFilterImageId: id })
  }

  /* ---------------- 设置 ---------------- */

  async updateSettings(settings: Settings) {
    await dbSaveSettings(settings)
    this.set({ settings, settingsOpen: false })
    this.pump() // 并发数可能变化
    this.log('info', `设置已保存（并发=${settings.concurrency}，自动重试=${settings.autoRetry ? '开' : '关'}）`)
  }

  /** 拖拽调整并发：内存即时生效，持久化防抖 */
  private settingsPersistTimer: ReturnType<typeof setTimeout> | null = null
  setConcurrency(n: number) {
    const settings = { ...this.state.settings, concurrency: Math.min(6, Math.max(1, n)) }
    this.set({ settings })
    this.pump()
    if (this.settingsPersistTimer) clearTimeout(this.settingsPersistTimer)
    this.settingsPersistTimer = setTimeout(() => void dbSaveSettings(this.state.settings), 600)
  }

  openSettings() { this.set({ settingsOpen: true }) }
  closeSettings() { this.set({ settingsOpen: false }) }

  /* ---------------- 提示词模板 ---------------- */

  async loadCustomTemplates() {
    const { listCustomTemplates } = await import('../lib/db')
    this.set({ customTemplates: await listCustomTemplates() })
  }

  async saveCustomTemplate(t: CustomTemplate) {
    const { putCustomTemplate } = await import('../lib/db')
    await putCustomTemplate(t)
    await this.loadCustomTemplates()
  }

  async removeCustomTemplate(id: string) {
    const { deleteCustomTemplate } = await import('../lib/db')
    await deleteCustomTemplate(id)
    await this.loadCustomTemplates()
  }

  openTemplateDialog() {
    this.set({ templateDialogOpen: true })
    void this.hydrateShuixianFromCache()
  }
  closeTemplateDialog() { this.set({ templateDialogOpen: false }) }

  /** 模板产出填入生成面板：覆盖提示词与尺寸，保留已添加的参考图 */
  applyPromptFill(prompt: string, size?: string) {
    const params = { ...this.state.settings.defaultParams, ...(size ? { size } : {}) }
    this.set({ prefill: { prompt, params, keepRefs: true, nonce: Date.now() } })
  }

  /* ---------------- 水仙提示词库 ---------------- */

  /** 打开模板对话框时顺带从缓存预热（不发网络请求） */
  async hydrateShuixianFromCache() {
    if (this.state.shuixian.status !== 'idle') return
    try {
      const { getKV } = await import('../lib/db')
      const cached = await getKV<{ prompts: ShuixianPrompt[]; categories: Record<string, ShuixianCategory> }>(
        'shuixian-library',
      )
      if (cached?.prompts?.length) {
        this.set({ shuixian: { status: 'loaded', prompts: cached.prompts, categories: cached.categories ?? {} } })
      }
    } catch {
      /* 缓存读取失败不影响使用 */
    }
  }

  /** 从 GitHub 拉取水仙提示词库并缓存（约 14MB，一次性） */
  async loadShuixianLibrary() {
    if (this.state.shuixian.status === 'loading' || this.state.shuixian.status === 'loaded') return
    this.set({ shuixian: { ...this.state.shuixian, status: 'loading', error: undefined } })
    try {
      const { fetchShuixianLibrary } = await import('../lib/shuixian')
      const { prompts, categories } = await fetchShuixianLibrary()
      const { setKV } = await import('../lib/db')
      await setKV('shuixian-library', { prompts, categories })
      this.set({ shuixian: { status: 'loaded', prompts, categories } })
      this.log('success', `水仙提示词库已加载并缓存：${prompts.length} 条`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.set({ shuixian: { ...this.state.shuixian, status: 'error', error: msg } })
    }
  }

  async refreshStorage() {
    this.set({ storageUsage: await estimateStorage() })
  }

  /* ---------------- 提交与调度 ---------------- */

  submitTask(prompt: string, params: GenParams, count: number, refImages?: Blob[]) {
    const trimmed = prompt.trim()
    if (!trimmed) return
    const refs = refImages?.length ? refImages : undefined
    const now = Date.now()
    const taskId = uid('t_')
    const imageIds: string[] = []
    const images = { ...this.state.images }
    for (let i = 0; i < count; i++) {
      const id = uid('i_')
      imageIds.push(id)
      images[id] = {
        id,
        taskId,
        prompt: trimmed,
        params,
        status: 'pending',
        progress: 0,
        phase: '排队中',
        isEdit: !!refs,
        retryCount: 0,
        createdAt: now,
        logs: [],
      }
    }
    const task: TaskRecord = {
      id: taskId,
      prompt: trimmed,
      params,
      count,
      status: 'running',
      createdAt: now,
      imageIds,
      refImages: refs,
    }
    // 先更新内存，再持久化（图片含完整字段但无 Blob）
    this.set({
      images,
      tasks: { ...this.state.tasks, [taskId]: task },
      taskOrder: [taskId, ...this.state.taskOrder],
      activeTaskId: taskId,
    })
    this.log('info', `提交任务：${count} 张图${refs ? '（图生图）' : ''}（并发上限 ${this.state.settings.concurrency}）·「${excerpt(trimmed, 24)}」`)
    // 窄屏下提交后自动切到看板，便于观察进度
    if (window.innerWidth < 1024) this.set({ narrowView: 'board' })
    // 先持久化，再入队，避免 pending/generating 写库乱序
    void (async () => {
      await putTask(task)
      for (const id of imageIds) {
        if (this.state.images[id]) await putImage(this.state.images[id])
      }
      for (const id of imageIds) this.enqueueImage(id)
      this.refreshStorage()
    })()
  }

  private enqueueImage(imageId: string, attempt = 1) {
    this.internal.queue.push(() => this.runImageJob(imageId, attempt))
    this.pump()
  }

  private pump() {
    const max = Math.max(1, this.state.settings.concurrency)
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

  private async runImageJob(imageId: string, attempt: number) {
    const rec = this.state.images[imageId]
    if (!rec || rec.status === 'cancelled' || rec.status === 'done') {
      this.releaseSlot()
      return
    }
    const task = this.state.tasks[rec.taskId]
    const startedAt = Date.now()
    const controller = new AbortController()
    this.internal.aborts.set(imageId, controller)

    // 更新为生成中（内存 + 落库）
    const generating: ImageRecord = {
      ...rec,
      status: 'generating',
      progress: 2,
      phase: '连接中',
      error: undefined,
    }
    this.patchImage(generating)
    void putImage(generating)
    this.log('info', `#${ordinal(rec)} 开始生成（第 ${attempt} 次尝试）`, imageId)

    try {
      const result = await generateOne({
        settings: this.state.settings,
        prompt: rec.prompt,
        params: rec.params,
        signal: controller.signal,
        referenceImages: task?.refImages,
        log: (level, text) => this.log(level, text, imageId),
        onProgress: (progress, phase) => this.updateProgress(imageId, progress, phase),
        onPartial: () => { /* 当前端点无局部帧，预留 */ },
      })

      if (!this.state.images[imageId]) return // 运行中被删除
      const thumbBlob = await makeThumbBlob(result.blob)
      const done: ImageRecord = {
        ...this.state.images[imageId],
        status: 'done',
        progress: 100,
        phase: '完成',
        blob: result.blob,
        thumbBlob,
        mime: result.mime,
        width: result.width,
        height: result.height,
        revisedPrompt: result.revisedPrompt,
        usage: result.usage,
        remoteUrl: result.remoteUrl,
        durationMs: Date.now() - startedAt,
        doneAt: Date.now(),
        error: undefined,
      }
      // 内存里剥离完整 Blob（缩略图足够渲染），完整 Blob 只存 IndexedDB
      this.patchImage({ ...done, blob: undefined })
      void (async () => {
        await putImage(done)
        this.refreshTaskStatus(rec.taskId)
        this.refreshStorage()
      })()
    } catch (err) {
      if (!this.state.images[imageId]) return // 运行中被删除
      const aborted = (err as Error)?.name === 'AbortError'
      if (aborted) {
        const cancelled: ImageRecord = {
          ...this.state.images[imageId],
          status: 'cancelled',
          phase: '已取消',
          doneAt: Date.now(),
          durationMs: Date.now() - startedAt,
        }
        this.patchImage(cancelled)
        void putImage(cancelled).then(() => this.refreshTaskStatus(rec.taskId))
      } else {
        const canAutoRetry = this.state.settings.autoRetry && attempt === 1
        if (canAutoRetry) {
          const msg = err instanceof Error ? err.message : String(err)
          this.log('warn', `失败，将自动重试（1.5s 后）：${msg}`, imageId)
          const retrying: ImageRecord = {
            ...this.state.images[imageId],
            status: 'pending',
            progress: 0,
            phase: '等待重试',
            retryCount: attempt,
            error: msg,
          }
          this.patchImage(retrying)
          void putImage(retrying)
          setTimeout(() => {
            if (this.state.images[imageId]?.status === 'pending') this.enqueueImage(imageId, attempt + 1)
          }, 1500)
        } else {
          const msg = err instanceof Error ? err.message : String(err)
          const failed: ImageRecord = {
            ...this.state.images[imageId],
            status: 'failed',
            phase: '失败',
            error: msg,
            doneAt: Date.now(),
            durationMs: Date.now() - startedAt,
          }
          this.patchImage(failed)
          void putImage(failed).then(() => this.refreshTaskStatus(rec.taskId))
        }
      }
    } finally {
      this.internal.aborts.delete(imageId)
      this.releaseSlot()
    }
  }

  private patchImage(rec: ImageRecord) {
    this.set({ images: { ...this.state.images, [rec.id]: rec } })
  }

  private updateProgress(imageId: string, progress: number, phase: string) {
    const rec = this.state.images[imageId]
    if (!rec) return
    this.patchImage({ ...rec, progress, phase })
  }

  /* ---------------- 任务状态收敛 ---------------- */

  private refreshTaskStatus(taskId: string, opts: { silent?: boolean } = {}) {
    const task = this.state.tasks[taskId]
    if (!task) return
    const imgs = task.imageIds
      .map((id) => this.state.images[id])
      .filter(Boolean)
    if (imgs.length === 0) return
    const active = imgs.filter((i) => ['pending', 'generating', 'downloading'].includes(i.status))
    const doneN = imgs.filter((i) => i.status === 'done').length
    const failedN = imgs.filter((i) => i.status === 'failed').length
    const cancelledN = imgs.filter((i) => i.status === 'cancelled').length

    let status: TaskRecord['status']
    if (active.length > 0) status = 'running'
    else if (doneN === imgs.length) status = 'completed'
    else if (doneN === 0 && failedN === 0) status = 'cancelled'
    else if (doneN === 0) status = 'failed'
    else status = 'partial'

    const finishedAt = active.length === 0 ? (task.finishedAt ?? Date.now()) : undefined
    if (status !== task.status || finishedAt !== task.finishedAt) {
      const updated = { ...task, status, finishedAt }
      this.set({ tasks: { ...this.state.tasks, [taskId]: updated } })
      if (!opts.silent && active.length === 0) {
        void putTask(updated)
        this.log(
          doneN > 0 ? 'success' : 'error',
          `任务结束：成功 ${doneN}/${imgs.length}${failedN ? `，失败 ${failedN}` : ''}${cancelledN ? `，取消 ${cancelledN}` : ''}`,
        )
        this.refreshStorage()
      }
    }
  }

  /* ---------------- 取消 / 重试 / 删除 ---------------- */

  cancelImage(imageId: string) {
    const rec = this.state.images[imageId]
    if (!rec) return
    if (rec.status === 'pending') {
      // 未开跑：直接标记取消；队列里的 job 执行时会检测状态并跳过
      const cancelled: ImageRecord = { ...rec, status: 'cancelled', phase: '已取消', doneAt: Date.now() }
      this.patchImage(cancelled)
      void putImage(cancelled).then(() => this.refreshTaskStatus(rec.taskId))
      this.log('warn', '已取消（尚未开始）', imageId)
      return
    }
    const controller = this.internal.aborts.get(imageId)
    if (controller) controller.abort()
  }

  cancelTask(taskId: string) {
    const task = this.state.tasks[taskId]
    if (!task) return
    let n = 0
    for (const id of task.imageIds) {
      const rec = this.state.images[id]
      if (!rec) continue
      if (['pending', 'generating', 'downloading'].includes(rec.status)) {
        this.cancelImage(id)
        n++
      }
    }
    this.log('warn', `取消任务：中止 ${n} 张图片`, undefined)
  }

  retryImage(imageId: string) {
    const rec = this.state.images[imageId]
    if (!rec || ['pending', 'generating', 'downloading'].includes(rec.status)) return
    const retry: ImageRecord = {
      ...rec,
      status: 'pending',
      progress: 0,
      phase: '排队中',
      error: undefined,
      retryCount: 0,
      blob: undefined,
      thumbBlob: undefined,
      doneAt: undefined,
      durationMs: undefined,
    }
    this.patchImage(retry)
    void putImage(retry)
    this.log('info', '手动重试', imageId)
    this.refreshTaskStatus(rec.taskId, { silent: true })
    this.enqueueImage(imageId)
  }

  retryTaskFailed(taskId: string) {
    const task = this.state.tasks[taskId]
    if (!task) return
    for (const id of task.imageIds) {
      const rec = this.state.images[id]
      if (rec?.status === 'failed') this.retryImage(id)
    }
  }

  async deleteImage(imageId: string) {
    const rec = this.state.images[imageId]
    if (!rec) return
    this.internal.aborts.get(imageId)?.abort()
    this.internal.aborts.delete(imageId)
    // 先清内存：进行中请求的收尾逻辑检查内存后跳过落库
    const images = { ...this.state.images }
    delete images[imageId]
    const tasks = { ...this.state.tasks }
    const task = tasks[rec.taskId]
    if (task) {
      tasks[rec.taskId] = { ...task, imageIds: task.imageIds.filter((i) => i !== imageId) }
    }
    this.set({
      images,
      tasks,
      logFilterImageId: this.state.logFilterImageId === imageId ? null : this.state.logFilterImageId,
      lightbox: null,
    })
    if (task) void putTask(tasks[rec.taskId])
    await dbDeleteImage(imageId)
    await this.pruneEmptyTask(rec.taskId)
    if (this.state.tasks[rec.taskId]) this.refreshTaskStatus(rec.taskId)
    this.refreshStorage()
  }

  /** 任务图片删空后移除空壳任务 */
  private async pruneEmptyTask(taskId: string) {
    const task = this.state.tasks[taskId]
    if (!task || task.imageIds.length > 0) return
    await dbDeleteTask(taskId)
    const tasks = { ...this.state.tasks }
    delete tasks[taskId]
    this.set({
      tasks,
      taskOrder: this.state.taskOrder.filter((t) => t !== taskId),
      activeTaskId: this.state.activeTaskId === taskId ? null : this.state.activeTaskId,
    })
    this.refreshStorage()
  }

  /** 批量删除图片：中止进行中的生成，任务图片删空后移除空壳任务 */
  async deleteImagesBatch(imageIds: string[]) {
    const ids = imageIds.filter((id) => this.state.images[id])
    if (ids.length === 0) return
    const images = { ...this.state.images }
    const tasks = { ...this.state.tasks }
    const affectedTasks = new Set<string>()
    for (const id of ids) {
      const rec = images[id]
      if (!rec) continue
      affectedTasks.add(rec.taskId)
      const task = tasks[rec.taskId]
      if (task) {
        tasks[rec.taskId] = { ...task, imageIds: task.imageIds.filter((i) => i !== id) }
      }
      delete images[id]
      this.internal.aborts.get(id)?.abort()
      this.internal.aborts.delete(id)
    }
    this.set({
      images,
      tasks,
      logFilterImageId: ids.includes(this.state.logFilterImageId ?? '') ? null : this.state.logFilterImageId,
      lightbox: null,
    })
    for (const taskId of affectedTasks) {
      const t = this.state.tasks[taskId]
      if (t) void putTask(t)
    }
    await Promise.all(ids.map((id) => dbDeleteImage(id)))
    for (const taskId of affectedTasks) {
      await this.pruneEmptyTask(taskId)
    }
    for (const taskId of affectedTasks) {
      if (this.state.tasks[taskId]) this.refreshTaskStatus(taskId, { silent: true })
    }
    this.log('warn', `批量删除 ${ids.length} 张图片`)
    this.refreshStorage()
  }

  /** 批量删除任务（级联删除图片） */
  async deleteTasksBatch(taskIds: string[]) {
    const ids = taskIds.filter((id) => this.state.tasks[id])
    if (ids.length === 0) return
    const images = { ...this.state.images }
    const tasks = { ...this.state.tasks }
    let imageCount = 0
    for (const taskId of ids) {
      const task = tasks[taskId]
      if (!task) continue
      for (const imgId of task.imageIds) {
        if (images[imgId]) { delete images[imgId]; imageCount++ }
        this.internal.aborts.get(imgId)?.abort()
        this.internal.aborts.delete(imgId)
      }
      delete tasks[taskId]
    }
    this.set({
      images,
      tasks,
      taskOrder: this.state.taskOrder.filter((t) => !ids.includes(t)),
      activeTaskId: this.state.activeTaskId && ids.includes(this.state.activeTaskId) ? null : this.state.activeTaskId,
      lightbox: null,
    })
    await Promise.all(ids.map((id) => dbDeleteTask(id)))
    this.log('warn', `批量删除 ${ids.length} 个任务（含 ${imageCount} 张图片）`)
    this.refreshStorage()
  }

  async deleteTask(taskId: string) {
    const task = this.state.tasks[taskId]
    if (!task) return
    for (const id of task.imageIds) {
      this.internal.aborts.get(id)?.abort()
    }
    await dbDeleteTask(taskId)
    const images = { ...this.state.images }
    for (const id of task.imageIds) delete images[id]
    const tasks = { ...this.state.tasks }
    delete tasks[taskId]
    this.set({
      images,
      tasks,
      taskOrder: this.state.taskOrder.filter((t) => t !== taskId),
      activeTaskId: this.state.activeTaskId === taskId ? null : this.state.activeTaskId,
      lightbox: null,
    })
    this.log('info', `删除任务及 ${task.imageIds.length} 张图片`)
    this.refreshStorage()
  }

  /* ---------------- 统一确认弹窗（删除类操作） ---------------- */

  requestConfirm(cfg: NonNullable<AppState['confirmRequest']>) {
    this.set({ confirmRequest: cfg })
  }

  cancelConfirm() {
    this.set({ confirmRequest: null })
  }

  async acceptConfirm() {
    const req = this.state.confirmRequest
    if (!req) return
    this.set({ confirmRequest: null })
    await req.run()
  }

  /* ---------------- 历史编辑 ---------------- */

  async updateTaskPrompt(taskId: string, prompt: string) {
    const task = this.state.tasks[taskId]
    if (!task) return
    const updated = { ...task, prompt: prompt.trim() }
    this.set({ tasks: { ...this.state.tasks, [taskId]: updated } })
    void putTask(updated)
    this.log('info', `提示词已更新 ·「${excerpt(updated.prompt, 24)}」`)
  }

  /** 用历史任务的提示词与参数回填生成面板（图生图任务连参考图一起回填） */
  requestPrefill(task: TaskRecord) {
    this.set({
      prefill: {
        prompt: task.prompt,
        params: task.params,
        refImages: task.refImages,
        nonce: Date.now(),
      },
    })
  }
  consumePrefill() {
    if (this.state.prefill) this.set({ prefill: null })
  }

  /* ---------------- 看板 / 灯箱 ---------------- */

  setActiveTask(taskId: string | null) {
    this.set({ activeTaskId: taskId })
  }

  openLightbox(imageIds: string[], index: number) {
    this.set({ lightbox: { imageIds, index } })
  }
  lightboxNav(delta: number) {
    const lb = this.state.lightbox
    if (!lb) return
    const next = (lb.index + delta + lb.imageIds.length) % lb.imageIds.length
    this.set({ lightbox: { ...lb, index: next } })
  }
  closeLightbox() {
    this.set({ lightbox: null })
  }

  /** 从库里取完整图片记录（含 Blob），供灯箱/下载 */
  async getFullImage(imageId: string): Promise<ImageRecord | undefined> {
    const mem = this.state.images[imageId]
    if (mem?.blob) return mem
    const full = await dbGetImage(imageId)
    if (full && this.state.images[imageId]) {
      // 更新内存的缩略图字段（可能有新值）
      this.set({ images: { ...this.state.images, [imageId]: { ...this.state.images[imageId], thumbBlob: full.thumbBlob } } })
    }
    return full
  }
}

function excerpt(text: string, n: number) {
  return text.length > n ? text.slice(0, n) + '…' : text
}

function ordinal(rec: ImageRecord) {
  return `i_${rec.id.slice(-6)}`
}

export const store = new Store()

/* ---------------- React 绑定 ---------------- */

export function useStore(): AppState {
  return useSyncExternalStore(store.subscribe, store.getState)
}
