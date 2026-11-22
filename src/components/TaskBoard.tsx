/** 中央看板：聚焦任务的卡片网格 + 整批进度 + 批量管理模式 + 最近任务分区（多任务并行同屏，完成的持续可见） */
import { useMemo, useState } from 'react'
import { Ban, ChevronDown, ChevronRight, Images, ListChecks, Maximize2, RotateCcw, Trash2, X } from 'lucide-react'
import { store, useStore } from '../store/store'
import { Badge, Button, ProgressBar, SelectBox } from './ui'
import { ImageCard } from './ImageCard'
import type { TaskRecord } from '../lib/types'

export function TaskBoard() {
  const { activeTaskId, tasks, images, taskOrder } = useStore()
  const task = activeTaskId ? tasks[activeTaskId] : undefined
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  /** 非聚焦分区折叠状态（进行中的分区不允许折叠） */
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const imgs = task ? task.imageIds.map((id) => images[id]).filter(Boolean) : []
  const doneN = imgs.filter((i) => i!.status === 'done').length
  const failedN = imgs.filter((i) => i!.status === 'failed').length
  const runningN = imgs.filter((i) => ['pending', 'generating', 'downloading'].includes(i!.status)).length
  const avgProgress = imgs.length
    ? Math.round(imgs.reduce((s, i) => s + (i!.status === 'done' ? 100 : i!.progress), 0) / imgs.length)
    : 0
  const doneIds = imgs.filter((i) => i!.status === 'done').map((i) => i!.id)
  const allSelected = imgs.length > 0 && imgs.every((i) => selectedIds.has(i!.id))

  const enterSelectMode = () => {
    setSelectedIds(new Set())
    setSelectMode(true)
  }
  const exitSelectMode = () => {
    setSelectedIds(new Set())
    setSelectMode(false)
  }
  const toggleSelect = (id: string) => {
    setSelectedIds((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const confirmBatchDelete = () => {
    const ids = [...selectedIds]
    store.requestConfirm({
      title: '批量删除图片',
      message: `将永久删除选中的 ${ids.length} 张图片，不可恢复。若任务内图片被全部删除，对应任务会一并移除。`,
      confirmText: '删除',
      run: async () => {
        await store.deleteImagesBatch(ids)
        setSelectedIds(new Set())
        setSelectMode(false)
      },
    })
  }

  if (!task) return <EmptyBoard />

  // 看板分区 = 进行中的任务全部 + 最近 6 个任务（含已完成的，生成的卡片持续留在中间）
  const RECENT_LIMIT = 6
  const sectionIds = new Set<string>(taskOrder.slice(0, RECENT_LIMIT))
  for (const id of taskOrder) {
    if (tasks[id]?.status === 'running') sectionIds.add(id)
  }
  sectionIds.add(task.id)
  // 聚焦任务置顶，其余按提交时间倒序
  const sections = taskOrder.filter((id) => sectionIds.has(id))
  sections.sort((a, b) => (a === task.id ? -1 : b === task.id ? 1 : 0))

  return (
    <section className="flex h-full min-h-0 flex-col">
      {/* 聚焦任务头 */}
      <div className="shrink-0 border-b border-line px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm text-ink" title={task.prompt}>{task.prompt}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-3">
              <TaskStatusBadge task={task} />
              {task.refImages?.length ? (
                <Badge tone="accent">图生图 · {task.refImages.length} 张参考</Badge>
              ) : null}
              <span>{task.params.size}</span>
              <span>·</span>
              <span>{task.params.quality}</span>
              <span>·</span>
              <span>{task.params.output_format.toUpperCase()}</span>
              <span>·</span>
              <span>{doneN}/{imgs.length} 完成</span>
              {failedN > 0 && <span className="text-danger">· {failedN} 失败</span>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {selectMode ? (
              <>
                <label className="mr-1 flex cursor-pointer items-center gap-1.5 text-xs text-ink-2">
                  <SelectBox
                    checked={allSelected}
                    onClick={() =>
                      setSelectedIds(allSelected ? new Set() : new Set(imgs.map((i) => i!.id)))
                    }
                  />
                  全选
                </label>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={selectedIds.size === 0}
                  onClick={confirmBatchDelete}
                >
                  <Trash2 className="h-3.5 w-3.5" /> 删除所选{selectedIds.size > 0 ? `（${selectedIds.size}）` : ''}
                </Button>
                <Button variant="ghost" size="sm" onClick={exitSelectMode}>退出</Button>
              </>
            ) : (
              <>
                {failedN > 0 && runningN === 0 && (
                  <Button variant="subtle" size="sm" onClick={() => store.retryTaskFailed(task.id)}>
                    <RotateCcw className="h-3.5 w-3.5" /> 重试失败
                  </Button>
                )}
                {runningN > 0 && (
                  <Button variant="danger" size="sm" onClick={() => store.cancelTask(task.id)}>
                    <Ban className="h-3.5 w-3.5" /> 全部取消
                  </Button>
                )}
                <Button variant="ghost" size="sm" title="批量管理" onClick={enterSelectMode}>
                  <ListChecks className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" title="关闭看板（历史中仍可查看）" onClick={() => store.setActiveTask(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="mt-2.5 flex items-center gap-3">
          <ProgressBar value={avgProgress} />
          <span className="shrink-0 text-xs font-semibold tabular-nums text-ink-2">{avgProgress}%</span>
        </div>
      </div>

      {/* 滚动区：聚焦任务卡片 + 最近任务分区（含已完成的，生成的卡片持续留在中间） */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {imgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-ink-3">
            <Images className="h-6 w-6" />
            <p className="text-xs">任务里的图片已全部删除</p>
          </div>
        ) : (
          <div className="p-4">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3 xl:grid-cols-[repeat(auto-fill,minmax(230px,1fr))]">
              {imgs.map((img, i) => (
                <ImageCard
                  key={img!.id}
                  image={img!}
                  index={i + 1}
                  selectionMode={selectMode}
                  selected={selectedIds.has(img!.id)}
                  onToggleSelect={() => toggleSelect(img!.id)}
                  onPreview={() => {
                    const idx = doneIds.indexOf(img!.id)
                    if (idx >= 0) store.openLightbox(doneIds, idx)
                  }}
                  onShowLog={() => {
                    store.setLogFilterImageId(img!.id)
                    store.expandLogs()
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* 其他最近任务分区（非聚焦）：可折叠，生成的结果持续可见 */}
        {!selectMode &&
          sections
            .filter((id) => id !== task.id)
            .map((id) => {
              const t = tasks[id]
              if (!t) return null
              const tImgs = t.imageIds.map((imgId) => images[imgId]).filter(Boolean)
              const tDone = tImgs.filter((i) => i!.status === 'done').length
              const tFailed = tImgs.filter((i) => i!.status === 'failed').length
              const tRunningN = tImgs.filter((i) => ['pending', 'generating', 'downloading'].includes(i!.status)).length
              const tAvg = tImgs.length
                ? Math.round(tImgs.reduce((s, i) => s + (i!.status === 'done' ? 100 : i!.progress), 0) / tImgs.length)
                : 0
              const tDoneIds = tImgs.filter((i) => i!.status === 'done').map((i) => i!.id)
              const isCollapsed = collapsed[id] && t.status !== 'running'
              return (
                <div key={id} className="border-t-2 border-line/70">
                  {/* 分区头：点击聚焦，箭头折叠 */}
                  <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <button
                        onClick={() => setCollapsed((m) => ({ ...m, [id]: !m[id] }))}
                        title={isCollapsed ? '展开卡片' : '折叠卡片'}
                        className="shrink-0 text-ink-3 hover:text-ink cursor-pointer"
                      >
                        {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => store.setActiveTask(id)}
                        title="点击聚焦此任务（可用批量管理 / 完整操作）"
                        className="group/bt flex min-w-0 items-center gap-1.5 text-left cursor-pointer"
                      >
                        <TaskStatusBadge task={t} />
                        <span className="truncate text-xs text-ink group-hover/bt:text-accent">{t.prompt}</span>
                        <span className="shrink-0 text-[11px] tabular-nums text-ink-3">
                          {tDone}/{tImgs.length} 完成 · {tAvg}%{tFailed > 0 ? ` · ${tFailed} 失败` : ''}
                        </span>
                      </button>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {tRunningN > 0 && (
                        <Button
                          variant="ghost"
                          size="xs"
                          title="取消此任务全部图片"
                          onClick={() => store.cancelTask(id)}
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="xs"
                        title="聚焦此任务"
                        onClick={() => store.setActiveTask(id)}
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="px-4 pb-1.5">
                    <ProgressBar value={tAvg} />
                  </div>
                  {!isCollapsed && (
                    <div className="px-4 pb-4 pt-3">
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3 xl:grid-cols-[repeat(auto-fill,minmax(230px,1fr))]">
                        {tImgs.map((img, i) => (
                          <ImageCard
                            key={img!.id}
                            image={img!}
                            index={i + 1}
                            onPreview={() => {
                              const idx = tDoneIds.indexOf(img!.id)
                              if (idx >= 0) store.openLightbox(tDoneIds, idx)
                            }}
                            onShowLog={() => {
                              store.setLogFilterImageId(img!.id)
                              store.expandLogs()
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
      </div>
    </section>
  )
}

function TaskStatusBadge({ task }: { task: TaskRecord }) {
  const map = {
    running: { tone: 'accent', text: '进行中' },
    completed: { tone: 'success', text: '已完成' },
    partial: { tone: 'warn', text: '部分完成' },
    failed: { tone: 'danger', text: '失败' },
    cancelled: { tone: 'muted', text: '已取消' },
  } as const
  const { tone, text } = map[task.status]
  return <Badge tone={tone}>{text}</Badge>
}

function EmptyBoard() {
  const { taskOrder, tasks } = useStore()
  const recent = useMemo(() => taskOrder.slice(0, 3).map((id) => tasks[id]).filter(Boolean), [taskOrder, tasks])

  return (
    <section className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-subtle text-ink-3">
        <Images className="h-7 w-7" />
      </div>
      <div>
        <p className="text-sm font-medium text-ink">还没有进行中的任务</p>
        <p className="mt-1 text-xs text-ink-3">在左侧输入提示词，选择张数，点击生成</p>
      </div>
      {recent.length > 0 && (
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[11px] text-ink-3">最近任务</span>
          <div className="flex flex-wrap justify-center gap-1.5">
            {recent.map((t) => (
              <button
                key={t!.id}
                onClick={() => store.setActiveTask(t!.id)}
                className="max-w-56 truncate rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink-2 hover:bg-hover hover:text-ink cursor-pointer"
              >
                {t!.prompt}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
