/**
 * 脚本创作（参考 Toonflow textNode 体验）：
 * 故事创意（素材）→ 剧本文档（Markdown 编辑/预览 + 提示词卡片 + 流式 AI 写剧本）→ 从剧本生成分镜。
 * 剧本文档是分镜的唯一来源；提示词与正文分离存储。
 */
import { useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Eye,
  Loader2,
  PencilLine,
  Scissors,
  Sparkles,
  Square,
  Trash2,
  Users,
} from 'lucide-react'
import { mangaStore, useMangaStore } from '../../store/mangaStore'
import { store } from '../../store/store'
import { renderMarkdown } from '../../lib/markdown'
import { SHOT_OPTIONS } from '../../lib/types'
import type { MangaScene } from '../../lib/types'
import { Badge, Button, Field, Select } from '../ui'

const PANEL_COUNT_OPTIONS = [
  { value: '4', label: '4 格' },
  { value: '6', label: '6 格' },
  { value: '8', label: '8 格' },
  { value: '12', label: '12 格' },
]

export function ScriptStep() {
  const { activeProjectId, projects, scriptStreaming, scriptThinkingChars, scenesFromDocBusy, scriptError } = useMangaStore()
  const [panelCount, setPanelCount] = useState(6)
  const [docMode, setDocMode] = useState<'edit' | 'preview'>('edit')
  const [promptOpen, setPromptOpen] = useState(false)
  const project = activeProjectId ? projects[activeProjectId] : undefined
  if (!project) return null

  const doc = project.scriptDoc ?? ''
  const streaming = scriptStreaming

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      {/* 标题 + 创意素材 */}
      <Field label="项目标题">
        <input
          value={project.title}
          onChange={(e) => mangaStore.updateProjectText(project.id, { title: e.target.value })}
          placeholder="给这部漫画起个名字"
          className="p-2.5 text-[13px]"
        />
      </Field>
      <Field label="故事创意" hint="AI 写剧本的素材，越具体越好">
        <textarea
          value={project.idea}
          onChange={(e) => mangaStore.updateProjectText(project.id, { idea: e.target.value })}
          placeholder="例如：深夜便利店里，店员发现每晚 3 点都会来买同一个饭团的高中女生，其实已经消失很多年了…"
          className="min-h-24 w-full resize-y p-3 text-[13px] leading-relaxed placeholder:text-ink-3"
        />
      </Field>

      {/* 剧本文档 */}
      <div className="rounded-xl border border-line bg-panel">
        {/* 卡头：标题 + 字数 + 编辑/预览切换 */}
        <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
          <span className="text-xs font-medium text-ink-2">剧本文档</span>
          <span className="text-[11px] text-ink-3">{doc.length} 字</span>
          <div className="ml-auto flex rounded-lg border border-line p-0.5">
            <button
              onClick={() => setDocMode('edit')}
              title="编辑"
              className={`flex h-6.5 w-8 items-center justify-center rounded-md transition-colors cursor-pointer ${
                docMode === 'edit' ? 'bg-accent-soft text-accent' : 'text-ink-3 hover:text-ink'
              }`}
            >
              <PencilLine className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setDocMode('preview')}
              title="预览"
              className={`flex h-6.5 w-8 items-center justify-center rounded-md transition-colors cursor-pointer ${
                docMode === 'preview' ? 'bg-accent-soft text-accent' : 'text-ink-3 hover:text-ink'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* 正文：编辑态 textarea / 预览态 Markdown 渲染 */}
        {docMode === 'edit' ? (
          <textarea
            value={doc}
            onChange={(e) => mangaStore.updateProjectText(project.id, { scriptDoc: e.target.value || undefined })}
            placeholder={
              '# 剧本标题\n> 一句话梗概\n\n## 第 1 格 · 小标题\n- **画面**：可绘制的具体画面…\n- **对白**：角色名：台词\n- **旁白**：旁白内容\n\n（可直接粘贴小说文本，或点下方「AI 写剧本」让 AI 起稿）'
            }
            className="min-h-64 w-full resize-y border-0 bg-transparent p-3 font-mono text-[12.5px] leading-relaxed placeholder:text-ink-3 focus:ring-0"
          />
        ) : doc.trim() ? (
          <div
            className="md-doc min-h-64 max-h-[480px] overflow-y-auto p-4"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(doc) }}
          />
        ) : (
          <div className="flex min-h-40 items-center justify-center text-xs text-ink-3">
            剧本还是空的。填写创意后点「AI 写剧本」，或直接在此粘贴小说文本。
          </div>
        )}

        {/* AI 提示词卡（可折叠，与正文分离存储） */}
        <div className="border-t border-line px-3 py-2.5">
          <button
            onClick={() => setPromptOpen((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] text-ink-3 transition-colors hover:text-accent cursor-pointer"
          >
            <Sparkles className="h-3 w-3" />
            AI 创作要求{project.scriptPrompt ? '（已自定义）' : '（默认：按三幕式改编）'}
          </button>
          {promptOpen && (
            <textarea
              value={project.scriptPrompt ?? ''}
              onChange={(e) => mangaStore.updateProjectText(project.id, { scriptPrompt: e.target.value || undefined })}
              placeholder="默认：按三幕式把故事创意改编成漫画剧本：先一句梗概，再逐格展开。节奏紧凑，每格画面都可被直接绘制。可改成你自己的要求，如「悬疑冷色调，少对白多旁白」…"
              className="mt-2 min-h-16 w-full resize-y p-2.5 text-[12.5px] leading-relaxed placeholder:text-ink-3"
            />
          )}
        </div>

        {/* 操作行：AI 写剧本（流式）+ 从剧本生成分镜（格数只约束切分） */}
        <div className="flex flex-wrap items-center gap-3 border-t border-line px-3 py-3">
          {streaming ? (
            <Button variant="danger" onClick={() => mangaStore.stopScriptStream()}>
              <Square className="h-3.5 w-3.5" /> 停止
            </Button>
          ) : (
            <Button variant="primary" onClick={() => void mangaStore.streamScript()}>
              <Sparkles className="h-4 w-4" /> AI 写剧本
            </Button>
          )}
          <div className="w-28">
            <Select
              value={String(panelCount)}
              options={PANEL_COUNT_OPTIONS}
              size="sm"
              onChange={(v) => setPanelCount(Number(v))}
            />
          </div>
          <Button
            onClick={() => void mangaStore.generateScenesFromDoc(panelCount)}
            disabled={!doc.trim() || scenesFromDocBusy || streaming}
            title={doc.trim() ? '把剧本文档切分为下方分镜格（覆盖现有分镜）' : '先创作剧本文档'}
          >
            {scenesFromDocBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}
            {scenesFromDocBusy ? '切分中…' : '从剧本生成分镜'}
          </Button>
          {streaming && (
            <span className="flex items-center gap-1.5 text-xs text-accent">
              <Loader2 className="h-3 w-3 animate-spin" />
              {scriptThinkingChars > 0 ? `构思中… 已思考 ${scriptThinkingChars} 字` : '正在书写…'}
            </span>
          )}
          {!streaming && doc.trim() && project.scenes.length > 0 && (
            <span className="text-xs text-ink-3">重新生成分镜会覆盖现有 {project.scenes.length} 格</span>
          )}
        </div>
      </div>

      {scriptError && (
        <div className="rounded-lg bg-danger-soft px-3 py-2.5 text-xs leading-relaxed text-danger">
          操作失败：{scriptError}。可在顶栏「漫画设置」里更换 LLM 模型重试。
        </div>
      )}

      {project.characters.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
          <Users className="h-3.5 w-3.5 shrink-0" />
          还没有角色。先到「角色风格」页创建角色并生成设定表，分镜生成时才能锁定外观一致性。
        </div>
      )}

      {/* 分镜列表 */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-2">分镜脚本 · {project.scenes.length} 格</span>
        <Button size="sm" onClick={() => mangaStore.addScene()}>
          添加分镜
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {project.scenes.map((scene, i) => (
          <SceneCard key={scene.id} scene={scene} index={i} total={project.scenes.length} />
        ))}
        {project.scenes.length === 0 && (
          <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-xs text-ink-3">
            还没有分镜。用「AI 写剧本」完成剧本文档后，点「从剧本生成分镜」。
          </div>
        )}
      </div>
    </div>
  )
}

/** 单格脚本卡：镜头 / 角色 / 描述 / 对白 / 旁白 + 排序删除 */
function SceneCard({ scene, index, total }: { scene: MangaScene; index: number; total: number }) {
  const { activeProjectId, projects } = useMangaStore()
  const project = activeProjectId ? projects[activeProjectId] : undefined
  if (!project) return null
  const characters = project.characters

  const toggleCharacter = (id: string) => {
    const has = scene.characterIds.includes(id)
    mangaStore.updateScene(scene.id, {
      characterIds: has ? scene.characterIds.filter((c) => c !== id) : [...scene.characterIds, id],
    })
  }

  return (
    <div className="rounded-xl border border-line bg-panel p-3">
      <div className="mb-2.5 flex items-center gap-2">
        <Badge tone="accent">第 {index + 1} 格</Badge>
        <div className="w-44">
          <Select
            value={scene.shotType}
            options={SHOT_OPTIONS}
            size="sm"
            onChange={(v) => mangaStore.updateScene(scene.id, { shotType: v })}
          />
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            onClick={() => mangaStore.moveScene(scene.id, -1)}
            disabled={index === 0}
            title="上移"
            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-3 hover:bg-hover hover:text-ink disabled:opacity-30 cursor-pointer"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => mangaStore.moveScene(scene.id, 1)}
            disabled={index === total - 1}
            title="下移"
            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-3 hover:bg-hover hover:text-ink disabled:opacity-30 cursor-pointer"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() =>
              store.requestConfirm({
                title: '删除分镜',
                message: `删除第 ${index + 1} 格分镜？对应的分镜图会一并移除。`,
                confirmText: '删除',
                run: () => mangaStore.removeScene(scene.id),
              })
            }
            title="删除"
            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-3 hover:bg-danger-soft hover:text-danger cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 出场角色 chips：点击切换；✓ 表示已有 AI 设定表 */}
      {characters.length > 0 && (
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-ink-3">出场角色：</span>
          {characters.map((c) => {
            const active = scene.characterIds.includes(c.id)
            return (
              <button
                key={c.id}
                onClick={() => toggleCharacter(c.id)}
                className={`rounded-md border px-2 py-0.5 text-[11px] transition-colors cursor-pointer ${
                  active
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line text-ink-3 hover:border-accent hover:text-accent'
                }`}
              >
                {c.name}
                {c.sheetBlob ? ' ✓' : ''}
              </button>
            )
          })}
        </div>
      )}

      <textarea
        value={scene.description}
        onChange={(e) => mangaStore.updateScene(scene.id, { description: e.target.value })}
        placeholder="画面描述：谁在哪、做什么、构图与情绪（AI 绘制的核心文本）"
        className="mb-2 min-h-20 w-full resize-y p-2.5 text-[13px] leading-relaxed placeholder:text-ink-3"
      />
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Field label="对白" hint="分镜页可切换是否画进气泡">
          <input
            value={scene.dialogue ?? ''}
            onChange={(e) => mangaStore.updateScene(scene.id, { dialogue: e.target.value || undefined })}
            placeholder="角色台词（可选）"
            className="p-2.5 text-[13px]"
          />
        </Field>
        <Field label="旁白">
          <input
            value={scene.narration ?? ''}
            onChange={(e) => mangaStore.updateScene(scene.id, { narration: e.target.value || undefined })}
            placeholder="旁白 / 独白（可选）"
            className="p-2.5 text-[13px]"
          />
        </Field>
      </div>
    </div>
  )
}
