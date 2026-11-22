/**
 * 分镜设计：每格一张图的生成与重生成（角色设定表作参考图）、气泡对白开关、
 * 画幅切换、批量生成、导出长图。编辑回到「脚本创作」页做。
 */
import { Download, ImageOff, Layers, Loader2, MessageSquareDashed, RefreshCw, Square, Wand2, X } from 'lucide-react'
import { mangaStore, useMangaStore } from '../../store/mangaStore'
import { downloadBlobAs } from '../../lib/image-utils'
import { SHOT_OPTIONS } from '../../lib/types'
import type { MangaScene } from '../../lib/types'
import { Badge, Button } from '../ui'
import { BlobImage } from './blob-image'

export function StoryboardStep() {
  const { activeProjectId, projects } = useMangaStore()
  const project = activeProjectId ? projects[activeProjectId] : undefined
  if (!project) return null

  const doneCount = project.scenes.filter((s) => s.status === 'done').length
  const pendingCount = project.scenes.filter((s) => s.status === 'draft' || s.status === 'failed').length

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
      {/* 操作条 */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => mangaStore.generateAllScenes()} disabled={pendingCount === 0}>
          <Wand2 className="h-4 w-4" /> 生成全部（{pendingCount}）
        </Button>
        <Button onClick={() => void mangaStore.exportLongStrip()} disabled={doneCount === 0}>
          <Layers className="h-4 w-4" /> 导出长图（{doneCount}）
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {/* 气泡对白开关 */}
          <button
            onClick={() => mangaStore.updateProjectText(project.id, { bubbleDialogue: !project.bubbleDialogue })}
            title="开启后对白会由 AI 写进气泡；关闭则画空气泡，对白只显示在卡片下方"
            className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors cursor-pointer ${
              project.bubbleDialogue ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-3 hover:text-ink'
            }`}
          >
            <MessageSquareDashed className="h-3.5 w-3.5" /> 气泡内嵌对白
          </button>
          {/* 画幅切换 */}
          <button
            onClick={() => mangaStore.updateProjectText(project.id, { size: project.size === '1536x1024' ? '1024x1536' : '1536x1024' })}
            title="切换分镜画幅（横版 / 竖版）"
            className="flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs text-ink-3 transition-colors hover:text-ink cursor-pointer"
          >
            <Square className="h-3.5 w-3.5" /> {project.size === '1536x1024' ? '横版' : '竖版'}
          </button>
        </div>
      </div>

      {project.characters.some((c) => c.status !== 'done') && project.scenes.some((s) => s.characterIds.length > 0) && (
        <div className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
          部分出场角色还没有设定表，对应分镜将仅靠文字描述锁定外观。建议先在「角色风格」页完成全部设定表。
        </div>
      )}

      {/* 分镜网格 */}
      {project.scenes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-4 py-12 text-center text-xs text-ink-3">
          还没有分镜。先到「脚本创作」页生成或手动添加分镜。
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {project.scenes.map((scene, i) => (
            <SceneTile key={scene.id} scene={scene} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}

/** 单格分镜卡：图（或占位/进度）+ 镜头角色信息 + 生成按钮 */
function SceneTile({ scene, index }: { scene: MangaScene; index: number }) {
  const { activeProjectId, projects } = useMangaStore()
  const project = activeProjectId ? projects[activeProjectId] : undefined
  if (!project) return null

  const shotLabel = SHOT_OPTIONS.find((o) => o.value === scene.shotType)?.label ?? scene.shotType
  const characters = scene.characterIds
    .map((id) => project.characters.find((c) => c.id === id)?.name)
    .filter(Boolean)
  const busy = scene.status === 'generating' || scene.status === 'queued'
  const openIds = project.scenes.filter((s) => s.status === 'done').map((s) => s.id)

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-line bg-panel">
      {/* 图区 */}
      <button
        onClick={() => scene.status === 'done' && mangaStore.openLightbox(openIds, openIds.indexOf(scene.id))}
        className={`relative aspect-[3/2] w-full bg-subtle ${scene.status === 'done' ? 'cursor-zoom-in' : 'cursor-default'}`}
      >
        {scene.status === 'done' ? (
          <BlobImage blob={scene.thumbBlob ?? scene.imageBlob} alt={`分镜 ${index + 1}`} className="h-full w-full object-cover" />
        ) : busy ? (
          <div className="shimmer absolute inset-0 flex flex-col items-center justify-center gap-2 text-accent">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-xs">{scene.status === 'queued' ? '排队中' : '生成中…'}</span>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-ink-3">
            <ImageOff className="h-5 w-5" />
            <span className="text-[11px]">
              {scene.status === 'failed' ? '生成失败，可重试' : '尚未生成'}
            </span>
          </div>
        )}
        <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-[11px] font-semibold text-white">
          {index + 1}
        </span>
      </button>

      {/* 信息区 */}
      <div className="flex min-h-16 flex-1 flex-col gap-2 p-2.5">
        <div className="flex flex-wrap items-center gap-1">
          <Badge tone="accent">{shotLabel}</Badge>
          {characters.map((n) => (
            <Badge key={n} tone="muted">
              {n}
            </Badge>
          ))}
        </div>
        {(scene.dialogue || scene.narration) && (
          <div className="text-[11px] leading-relaxed text-ink-2">
            {scene.dialogue && <div>「{scene.dialogue}」</div>}
            {scene.narration && <div className="text-ink-3">（旁白：{scene.narration}）</div>}
          </div>
        )}
        {scene.status === 'failed' && scene.error && (
          <div className="rounded-md bg-danger-soft px-2 py-1.5 text-[11px] leading-snug text-danger">{scene.error}</div>
        )}
        {/* 操作行 */}
        <div className="mt-auto flex items-center gap-1.5 pt-1">
          {busy ? (
            <Button size="xs" onClick={() => mangaStore.cancelScene(scene.id)}>
              <X className="h-3 w-3" /> 取消
            </Button>
          ) : (
            <>
              <Button size="xs" onClick={() => mangaStore.generateScene(scene.id)}>
                {scene.status === 'done' ? (
                  <>
                    <RefreshCw className="h-3 w-3" /> 重生成
                  </>
                ) : (
                  <>
                    <Wand2 className="h-3 w-3" /> {scene.status === 'failed' ? '重试' : '生成'}
                  </>
                )}
              </Button>
              {scene.status === 'done' && (
                <Button
                  size="xs"
                  onClick={() => {
                    if (scene.imageBlob) downloadBlobAs(scene.imageBlob, `${project.title}-第${index + 1}格.png`)
                  }}
                >
                  <Download className="h-3 w-3" /> 下载
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
