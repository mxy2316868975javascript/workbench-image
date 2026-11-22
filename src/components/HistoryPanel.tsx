/** 右栏：历史任务记录，支持搜索 / 筛选 / 展开详情 / 增删改查 */
import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  History,
  ListChecks,
  Pencil,
  RefreshCcw,
  Search,
  Trash2,
  Wand2,
} from 'lucide-react'
import { store, useStore } from '../store/store'
import { Badge, Button, SelectBox } from './ui'
import type { ImageRecord, TaskRecord, TaskStatus } from '../lib/types'
import { formatDuration } from '../lib/image-utils'

const STATUS_FILTERS: Array<{ value: TaskStatus | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'running', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'partial', label: '部分完成' },
  { value: 'failed', label: '失败' },
  { value: 'cancelled', label: '已取消' },
]

const STATUS_TONE: Record<TaskStatus, 'accent' | 'success' | 'warn' | 'danger' | 'muted'> = {
  running: 'accent',
  completed: 'success',
  partial: 'warn',
  failed: 'danger',
  cancelled: 'muted',
}

const STATUS_TEXT: Record<TaskStatus, string> = {
  running: '进行中',
  completed: '已完成',
  partial: '部分完成',
  failed: '失败',
  cancelled: '已取消',
}

export function HistoryPanel() {
  const { taskOrder, tasks, images } = useStore()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<TaskStatus | 'all'>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase()
    return taskOrder.filter((id) => {
      const t = tasks[id]
      if (!t) return false
      if (status !== 'all' && t.status !== status) return false
      if (kw && !t.prompt.toLowerCase().includes(kw)) return false
      return true
    })
  }, [taskOrder, tasks, search, status])

  const toggle = (id: string) => {
    setExpanded((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const enterSelectMode = () => {
    setSelectedIds(new Set())
    setExpanded(new Set())
    setSelectMode(true)
  }
  const exitSelectMode = () => {
    setSelectedIds(new Set())
    setSelectMode(false)
  }
  const selectedImageCount = [...selectedIds].reduce((n, id) => n + (tasks[id]?.imageIds.length ?? 0), 0)
  const allVisibleSelected = filtered.length > 0 && filtered.every((id) => selectedIds.has(id))

  const confirmBatchDelete = () => {
    const ids = [...selectedIds]
    store.requestConfirm({
      title: '批量删除任务',
      message: `将永久删除选中的 ${ids.length} 个任务及其共 ${selectedImageCount} 张图片，不可恢复。`,
      confirmText: '删除',
      run: async () => {
        await store.deleteTasksBatch(ids)
        setSelectedIds(new Set())
        setSelectMode(false)
      },
    })
  }

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-line bg-panel">
      {/* 工具栏 */}
      <div className="shrink-0 space-y-2.5 border-b border-line px-3.5 py-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 shrink-0 text-ink-3" />
          <h2 className="text-[13px] font-semibold text-ink">历史记录</h2>
          <span className="ml-auto text-[11px] text-ink-3">{filtered.length} 个任务</span>
          <button
            onClick={() => (selectMode ? exitSelectMode() : enterSelectMode())}
            title={selectMode ? '退出批量管理' : '批量管理（多选删除）'}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors cursor-pointer ${
              selectMode ? 'bg-accent text-white' : 'text-ink-3 hover:bg-hover hover:text-ink'
            }`}
          >
            <ListChecks className="h-4 w-4" />
          </button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索提示词…"
            className="h-8 w-full pl-8 pr-2.5 text-xs"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatus(f.value)}
              className={`rounded-md px-2 py-1 text-[11px] transition-colors cursor-pointer ${
                status === f.value ? 'bg-accent text-white' : 'bg-subtle text-ink-2 hover:bg-hover'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {selectMode && (
          <div className="flex items-center gap-2 rounded-lg bg-accent-soft px-2.5 py-2 text-xs text-ink-2">
            <label className="flex cursor-pointer items-center gap-1.5">
              <SelectBox
                checked={allVisibleSelected}
                onClick={() =>
                  setSelectedIds(allVisibleSelected ? new Set() : new Set(filtered))
                }
              />
              全选
            </label>
            <span className="text-ink-3">已选 {selectedIds.size}</span>
            <Button
              variant="danger"
              size="xs"
              className="ml-auto"
              disabled={selectedIds.size === 0}
              onClick={confirmBatchDelete}
            >
              <Trash2 className="h-3 w-3" /> 删除所选
            </Button>
          </div>
        )}
      </div>

      {/* 任务列表 */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-3">
            <History className="h-6 w-6" />
            <p className="text-xs">{taskOrder.length === 0 ? '暂无历史记录' : '没有匹配的任务'}</p>
          </div>
        ) : (
          filtered.map((id) => {
            const t = tasks[id]
            if (!t) return null
            const isOpen = expanded.has(id) && !selectMode
            const isSelected = selectedIds.has(id)
            const stats = countStats(t, images)
            // 封面可直接预览：定位到该图在已完成序列里的位置
            const doneIds = t.imageIds.filter((i) => images[i]?.status === 'done')
            const coverIndex = stats.coverId ? doneIds.indexOf(stats.coverId) : -1
            const rowClick = () => (selectMode ? toggleSelect(id) : toggle(id))
            return (
              <div key={id} className={`border-b border-line last:border-b-0 ${selectMode && isSelected ? 'bg-accent-soft/60' : ''}`}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={rowClick}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      rowClick()
                    }
                  }}
                  className={`flex w-full items-center gap-2 px-3.5 py-2.5 text-left transition-colors ${
                    selectMode ? (isSelected ? 'bg-accent-soft/60 hover:bg-accent-soft' : 'hover:bg-hover') : 'hover:bg-hover'
                  } cursor-pointer`}
                >
                  {selectMode ? (
                    <SelectBox checked={isSelected} onClick={() => toggleSelect(id)} />
                  ) : (
                    <span className="shrink-0 text-ink-3">
                      {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </span>
                  )}
                  {stats.coverId && coverIndex >= 0 && !selectMode ? (
                    <button
                      title="预览封面大图"
                      onClick={(e) => {
                        e.stopPropagation()
                        store.openLightbox(doneIds, coverIndex)
                      }}
                      className="shrink-0 cursor-zoom-in rounded-md transition-shadow hover:shadow-[0_0_0_2px_var(--accent)]"
                    >
                      <ThumbImg image={images[stats.coverId]} className="h-10 w-10 rounded-md" />
                    </button>
                  ) : (
                    <ThumbImg image={stats.coverId ? images[stats.coverId] : undefined} className="h-10 w-10 shrink-0 rounded-md" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-ink">{t.prompt}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-3">
                      <Badge tone={STATUS_TONE[t.status]}>{STATUS_TEXT[t.status]}</Badge>
                      {t.refImages?.length ? <Badge tone="accent">图生图</Badge> : null}
                      <span className="tabular-nums">{stats.done}/{t.imageIds.length} 张</span>
                      {stats.failed > 0 && <span className="text-danger">· {stats.failed} 失败</span>}
                      <span>· {formatRelative(t.createdAt)}</span>
                    </span>
                  </span>
                </div>

                {isOpen && (
                  <HistoryDetail task={t} images={t.imageIds.map((i) => images[i]).filter(Boolean) as ImageRecord[]} />
                )}
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}

function countStats(t: TaskRecord, images: Record<string, ImageRecord>) {
  let done = 0
  let failed = 0
  let coverId: string | undefined
  for (const id of t.imageIds) {
    const img = images[id]
    if (!img) continue
    if (img.status === 'done') {
      done++
      if (!coverId) coverId = id
    }
    if (img.status === 'failed') failed++
  }
  return { done, failed, coverId }
}

/** 缩略图（对象 URL 管理） */
function ThumbImg({ image, className }: { image: ImageRecord | undefined; className?: string }) {
  const [url, setUrl] = useState<string>()

  useEffect(() => {
    const blob = image?.thumbBlob
    if (!blob) {
      setUrl(undefined)
      return
    }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [image?.thumbBlob])

  if (!image || !url) {
    return <div className={`${className} flex items-center justify-center bg-subtle text-[10px] text-ink-3`}>{image?.status === 'failed' ? '!' : '…'}</div>
  }
  return <img src={url} alt="" className={`${className} bg-subtle object-cover`} draggable={false} />
}

/* ---------------- 展开详情 ---------------- */

function HistoryDetail({ task, images }: { task: TaskRecord; images: ImageRecord[] }) {
  const { images: allImages } = useStore()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(task.prompt)
  const [copied, setCopied] = useState(false)

  const doneImages = images.filter((i) => i.status === 'done')

  return (
    <div className="space-y-3 bg-subtle/50 px-3.5 pb-3.5 pt-1">
      {/* 提示词（可编辑） */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-medium text-ink-2">提示词</span>
          <div className="flex items-center gap-1">
            {editing ? (
              <>
                <Button size="xs" variant="primary" onClick={async () => { await store.updateTaskPrompt(task.id, draft); setEditing(false) }}>保存</Button>
                <Button size="xs" variant="ghost" onClick={() => { setDraft(task.prompt); setEditing(false) }}>取消</Button>
              </>
            ) : (
              <>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(task.prompt).then(() => {
                      setCopied(true)
                      setTimeout(() => setCopied(false), 1200)
                    })
                  }}
                >
                  <ClipboardCopy className="h-3 w-3" /> {copied ? '已复制' : '复制'}
                </Button>
                <Button size="xs" variant="ghost" onClick={() => { setDraft(task.prompt); setEditing(true) }}>
                  <Pencil className="h-3 w-3" /> 编辑
                </Button>
              </>
            )}
          </div>
        </div>
        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-20 w-full p-2.5 text-xs leading-relaxed"
          />
        ) : (
          <p className="rounded-lg border border-line bg-panel px-2.5 py-2 text-xs leading-relaxed text-ink-2 break-words">
            {task.prompt}
          </p>
        )}
      </div>

      {/* 参数 */}
      <div className="flex flex-wrap gap-1.5 text-[11px] text-ink-2">
        {task.refImages?.length ? (
          <span className="rounded-md bg-accent-soft border border-accent/30 px-1.5 py-0.5 text-accent">
            图生图 · {task.refImages.length} 张参考
          </span>
        ) : null}
        <span className="rounded-md bg-panel border border-line px-1.5 py-0.5">{task.params.size}</span>
        <span className="rounded-md bg-panel border border-line px-1.5 py-0.5">{task.params.quality}</span>
        <span className="rounded-md bg-panel border border-line px-1.5 py-0.5">{task.params.background}</span>
        <span className="rounded-md bg-panel border border-line px-1.5 py-0.5">{task.params.output_format.toUpperCase()}</span>
        {images.filter((i) => i.durationMs).length > 0 && (
          <span className="rounded-md bg-panel border border-line px-1.5 py-0.5">
            均耗时 {formatDuration(Math.round(images.filter((i) => i.durationMs).reduce((s, i) => s + (i.durationMs ?? 0), 0) / images.filter((i) => i.durationMs).length))}
          </span>
        )}
      </div>

      {/* 参考图缩略（图生图任务） */}
      {task.refImages?.length ? <RefThumbs blobs={task.refImages} /> : null}

      {/* 图片网格 */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-1.5">
        {images.map((img) => {
          const viewable = img.status === 'done'
          return (
            <div
              key={img.id}
              className="relative"
              onClick={() => {
                if (!viewable) return
                const doneIds = doneImages.map((d) => d.id)
                store.openLightbox(doneIds, doneIds.indexOf(img.id))
              }}
            >
              <ThumbImg
                image={allImages[img.id]}
                className={`aspect-square w-full rounded-md ring-1 ring-line ${img.status === 'failed' ? 'opacity-50' : ''} ${viewable ? 'cursor-zoom-in hover:ring-accent' : ''}`}
              />
              {viewable && (
                <span className="pointer-events-none absolute right-1 top-1 rounded bg-black/55 px-1 text-[10px] text-white">
                  {img.width}×{img.height}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* 操作 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          variant="subtle"
          onClick={() => store.requestPrefill(task)}
          title="把这条提示词和参数填回左侧生成面板"
        >
          <Wand2 className="h-3.5 w-3.5" /> 回填生成
        </Button>
        <Button
          size="sm"
          variant="default"
          onClick={() => store.submitTask(task.prompt, task.params, task.imageIds.length || task.count, task.refImages)}
        >
          <RefreshCcw className="h-3.5 w-3.5" /> 重新生成
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            store.requestConfirm({
              title: '删除任务',
              message: `将永久删除该任务及其 ${task.imageIds.length} 张图片，不可恢复。`,
              confirmText: '删除',
              run: () => store.deleteTask(task.id),
            })
          }}
        >
          <Trash2 className="h-3.5 w-3.5" /> 删除任务
        </Button>
      </div>
    </div>
  )
}

/** 图生图参考图缩略行 */
function RefThumbs({ blobs }: { blobs: Blob[] }) {
  const [urls, setUrls] = useState<string[]>([])
  useEffect(() => {
    const us = blobs.map((b) => URL.createObjectURL(b))
    setUrls(us)
    return () => us.forEach((u) => URL.revokeObjectURL(u))
  }, [blobs])
  if (blobs.length === 0) return null
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] text-ink-3">参考图</span>
      {urls.map((u, i) => (
        <img key={i} src={u} alt={`参考图 ${i + 1}`} className="h-10 w-10 rounded-md border border-line object-cover" draggable={false} />
      ))}
    </div>
  )
}

function formatRelative(t: number): string {
  const diff = Date.now() - t
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  const d = new Date(t)
  return `${d.getMonth() + 1}-${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
