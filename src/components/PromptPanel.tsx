/** 左栏：提示词 + 参考图（图生图） + 模板 + 生成参数 + 批量张数 / 并发数 + 提交 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, BookMarked, CheckCircle2, ImagePlus, Loader2, Sparkles, X } from 'lucide-react'
import { store, useStore } from '../store/store'
import {
  BACKGROUND_OPTIONS,
  FORMAT_OPTIONS,
  QUALITY_OPTIONS,
  SIZE_OPTIONS,
  type ComposerDraft,
  type GenParams,
  type PreflightFixKind,
} from '../lib/types'
import {
  draftHasContent,
  flushDraft,
  formatDraftTime,
  markDraftEmpty,
  persistDraft,
  readLocalDraft,
  readStoredDraft,
} from '../lib/draft'
import { ACCEPTED_REF_TYPES, MAX_REF_COUNT, normalizeRefFiles } from '../lib/refs'
import { preflightGeneration } from '../lib/preflight'
import { Field, Select } from './ui'

type DraftStatus = 'idle' | 'saving' | 'saved' | 'error'

function emptyDraft(prompt: string, params: GenParams, count: number, refs: Blob[]): ComposerDraft {
  return { version: 1, prompt, params, count, refImages: refs, updatedAt: Date.now() }
}

export function PromptPanel() {
  const { settings, prefill, tasks, taskOrder, images, connection, storageUsage, demo } = useStore()

  // 首次渲染同步读 localStorage 镜像，避免异步恢复时输入框先闪空
  const [initialDraft] = useState(() => (demo ? null : readLocalDraft()))
  const [prompt, setPrompt] = useState(initialDraft?.draft.prompt ?? '')
  const [params, setParams] = useState<GenParams>(initialDraft?.draft.params ?? settings.defaultParams)
  const [count, setCount] = useState(initialDraft?.draft.count ?? 1)
  const [refs, setRefs] = useState<Blob[]>(initialDraft?.draft.refImages ?? [])
  const [dragging, setDragging] = useState(false)
  const [pasteHint, setPasteHint] = useState(false)

  const [hydrated, setHydrated] = useState(false)
  const [draftStatus, setDraftStatus] = useState<DraftStatus>(
    initialDraft && draftHasContent(initialDraft.draft) ? 'saved' : 'idle',
  )
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(initialDraft?.draft.updatedAt ?? null)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [restoredAt, setRestoredAt] = useState<number | null>(
    initialDraft && draftHasContent(initialDraft.draft) ? initialDraft.draft.updatedAt : null,
  )
  const [restoreDismissed, setRestoreDismissed] = useState(false)
  const [refsDropped, setRefsDropped] = useState(initialDraft?.droppedRefs ?? 0)
  const [refNotice, setRefNotice] = useState<string | null>(null)
  const [undoDraft, setUndoDraft] = useState<ComposerDraft | null>(null)
  const [lastSubmittedAt, setLastSubmittedAt] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitNotice, setSubmitNotice] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const refsRef = useRef(refs)
  refsRef.current = refs
  const hasEditedRef = useRef(false)
  // 有内容的草稿视为用户已明确选择过参数，刷新后不再被设置默认值覆盖
  const paramsTouchedRef = useRef(!!initialDraft && draftHasContent(initialDraft.draft))
  const submittingRef = useRef(false)
  const undoTimerRef = useRef<number | null>(null)

  const markEdited = () => {
    hasEditedRef.current = true
    setRestoredAt(null)
    setLastSubmittedAt(null)
    setSubmitError(null)
  }

  // 异步补参考图；若 localStorage 没有镜像，则用 IndexedDB 完整恢复
  useEffect(() => {
    let cancelled = false
    void (async () => {
      // 演示模式不读取真实草稿，避免把访客本机数据带进示例
      if (demo) {
        if (!cancelled) setHydrated(true)
        return
      }
      try {
        const stored = await readStoredDraft()
        if (cancelled || !stored) return
        const local = initialDraft?.draft
        const localHasContent = !!local && draftHasContent(local)

        if (!local) {
          setPrompt(stored.draft.prompt)
          setParams(stored.draft.params)
          setCount(stored.draft.count)
          setRefs(stored.draft.refImages)
          if (draftHasContent(stored.draft)) {
            paramsTouchedRef.current = true
            setRestoredAt(stored.draft.updatedAt)
            setDraftSavedAt(stored.draft.updatedAt)
            setDraftStatus('saved')
          }
        } else {
          // 文字以同步镜像为准；只有用户尚未编辑且 IDB 明显更新时才覆盖
          if (!hasEditedRef.current && stored.draft.updatedAt > local.updatedAt + 500) {
            setPrompt(stored.draft.prompt)
            setParams(stored.draft.params)
            setCount(stored.draft.count)
            if (draftHasContent(stored.draft)) paramsTouchedRef.current = true
            setDraftSavedAt(stored.draft.updatedAt)
          }
          // 本地是"已清空"的空镜像时，不再把旧参考图补回来
          if (localHasContent && refsRef.current.length === 0 && stored.draft.refImages.length > 0) {
            setRefs(stored.draft.refImages)
          }
        }
        if (stored.droppedRefs > 0 && (!local || localHasContent)) {
          setRefsDropped(stored.droppedRefs)
        }
      } finally {
        if (!cancelled) setHydrated(true)
      }
    })()
    return () => {
      cancelled = true
    }
    // initialDraft 在组件生命周期内不变
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 历史任务「回填生成」（连参考图一起回填）；模板填入只改提示词与尺寸，保留参考图
  useEffect(() => {
    if (!prefill) return
    markEdited()
    paramsTouchedRef.current = true
    setPrompt(prefill.prompt)
    setParams(prefill.params)
    if (!prefill.keepRefs) setRefs(prefill.refImages ?? [])
    store.consumePrefill()
    textareaRef.current?.focus()
  }, [prefill])

  // 参数默认值跟随设置：仅在用户未改过参数时生效
  useEffect(() => {
    if (paramsTouchedRef.current) return
    setParams(settings.defaultParams)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(settings.defaultParams)])

  // 参考图对象 URL 管理：每次列表变化重建全部 URL
  const [refUrls, setRefUrls] = useState<string[]>([])
  useEffect(() => {
    const urls = refs.map((b) => URL.createObjectURL(b))
    setRefUrls(urls)
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [refs])

  // 草稿自动保存：400ms 防抖；清空后删除草稿
  useEffect(() => {
    if (!hydrated) return
    // 演示模式不落草稿
    if (demo) return
    const isEmpty = !prompt.trim() && refs.length === 0 && count === 1
    if (isEmpty) {
      markDraftEmpty()
      setDraftStatus('idle')
      setDraftSavedAt(null)
      setDraftError(null)
      return
    }
    setDraftStatus('saving')
    const timer = window.setTimeout(() => {
      const draft = emptyDraft(prompt, params, count, refs)
      void persistDraft(draft).then(({ local, idb }) => {
        if (!local && !idb) {
          setDraftStatus('error')
          setDraftError('草稿无法保存：本地存储不可用或空间不足')
          return
        }
        setDraftStatus('saved')
        setDraftSavedAt(draft.updatedAt)
        setDraftError(!idb && refs.length > 0 ? '参考图未能写入本地数据库，刷新后可能丢失' : null)
      })
    }, 400)
    return () => window.clearTimeout(timer)
  }, [hydrated, prompt, params, count, refs, demo])

  // 页面隐藏/卸载时立即落盘，避免最后一次防抖没跑完
  useEffect(() => {
    if (!hydrated || demo) return
    const flush = () => {
      const isEmpty = !prompt.trim() && refs.length === 0 && count === 1
      if (isEmpty) {
        markDraftEmpty()
        return
      }
      flushDraft(emptyDraft(prompt, params, count, refs))
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [hydrated, prompt, params, count, refs, demo])

  useEffect(() => {
    if (!refNotice) return
    const timer = window.setTimeout(() => setRefNotice(null), 6000)
    return () => window.clearTimeout(timer)
  }, [refNotice])

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current)
    }
  }, [])

  const handleFiles = (files: FileList | File[]) => {
    const { accepted, rejected } = normalizeRefFiles(files, refs)
    if (accepted.length > 0) {
      markEdited()
      setRefs((prev) => [...prev, ...accepted].slice(0, MAX_REF_COUNT))
      setRefsDropped(0)
      setPasteHint(true)
      window.setTimeout(() => setPasteHint(false), 1500)
    }
    if (rejected.length > 0) {
      const first = rejected[0]
      setRefNotice(
        `${first.name}：${first.reason}${rejected.length > 1 ? `（另有 ${rejected.length - 1} 个文件被忽略）` : ''}`,
      )
    } else {
      setRefNotice(null)
    }
  }

  const clearAll = () => {
    const snapshot = emptyDraft(prompt, params, count, refs)
    setUndoDraft(snapshot)
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current)
    undoTimerRef.current = window.setTimeout(() => setUndoDraft(null), 5000)

    hasEditedRef.current = true
    paramsTouchedRef.current = false
    setPrompt('')
    setParams(settings.defaultParams)
    setCount(1)
    setRefs([])
    setRestoredAt(null)
    setRestoreDismissed(true)
    setLastSubmittedAt(null)
    setRefsDropped(0)
    setRefNotice(null)
    setDraftStatus('idle')
    setDraftSavedAt(null)
    setDraftError(null)
    setSubmitError(null)
    if (!demo) markDraftEmpty()
  }

  const undoClear = () => {
    if (!undoDraft) return
    hasEditedRef.current = true
    paramsTouchedRef.current = true
    setPrompt(undoDraft.prompt)
    setParams(undoDraft.params)
    setCount(undoDraft.count)
    setRefs(undoDraft.refImages)
    setUndoDraft(null)
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current)
    setDraftStatus('saving')
  }

  // 近期同模型/同尺寸成功任务的耗时，用于预估（毫秒）
  const durations = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 3600 * 1000
    return Object.values(images)
      .filter((i) => i.status === 'done' && typeof i.durationMs === 'number' && i.durationMs > 0)
      .filter((i) => !i.model || i.model === settings.model)
      .filter((i) => i.params.size === params.size)
      .filter((i) => (i.doneAt ?? 0) > cutoff)
      .sort((a, b) => (a.doneAt ?? 0) - (b.doneAt ?? 0))
      .slice(-20)
      .map((i) => i.durationMs!)
  }, [images, settings.model, params.size])

  const preflight = useMemo(
    () =>
      preflightGeneration({
        prompt,
        params,
        count,
        refs,
        settings,
        connection,
        storage: storageUsage,
        durations,
        concurrency: settings.concurrency,
      }),
    [prompt, params, count, refs, settings, connection, storageUsage, durations],
  )

  const errors = preflight.issues.filter((i) => i.level === 'error')
  // 提示词为空由按钮禁用态与状态行表达，不再占一条红色 banner
  const bannerErrors = errors.filter((e) => e.id !== 'prompt-empty')
  const warnings = preflight.issues.filter((i) => i.level === 'warn')
  const canSubmit = preflight.ok && !submitting && !demo
  const hasContent = !!prompt.trim() || refs.length > 0 || count !== 1
  const storageWarn = warnings.some((w) => w.id === 'storage-full')

  const applyFix = (kind: PreflightFixKind) => {
    if (kind === 'settings' || kind === 'open-storage') store.openSettings()
    else if (kind === 'set-png') {
      markEdited()
      paramsTouchedRef.current = true
      setParams((p) => ({ ...p, output_format: 'png' }))
    } else if (kind === 'clear-refs') {
      markEdited()
      setRefs([])
    }
  }

  const submit = () => {
    if (submittingRef.current) return
    if (!preflight.ok) {
      if (errors.some((e) => e.id === 'prompt-empty')) textareaRef.current?.focus()
      return
    }
    submittingRef.current = true
    setSubmitting(true)
    setSubmitError(null)
    const result = store.submitTask(prompt, params, count, refs.length ? refs : undefined)
    if (result.ok && result.taskId) {
      const snapshot = emptyDraft(prompt, params, count, refs)
      flushDraft(snapshot)
      setDraftStatus('saved')
      setDraftSavedAt(snapshot.updatedAt)
      setLastSubmittedAt(Date.now())
      const state = store.getState()
      const ahead = Object.values(state.images).filter(
        (i) =>
          i.taskId !== result.taskId &&
          (i.status === 'pending' || i.status === 'generating' || i.status === 'downloading'),
      ).length
      setSubmitNotice(`已提交 · ${count} 张${ahead > 0 ? ` · 前面还有约 ${ahead} 张` : ' · 已开始排队'}`)
      window.setTimeout(() => setSubmitNotice(null), 4000)
    } else {
      setSubmitError(result.error ?? '提交失败，请重试')
    }
    window.setTimeout(() => {
      submittingRef.current = false
      setSubmitting(false)
    }, 600)
  }

  const runningCount = taskOrder.filter((id) => tasks[id]?.status === 'running').length

  const draftLine =
    draftError ??
    (draftStatus === 'saving'
      ? '保存中…'
      : draftStatus === 'error'
        ? '草稿保存失败'
        : draftStatus === 'saved' && draftSavedAt
          ? `草稿已保存 ${formatDraftTime(draftSavedAt)}`
          : '')
  const draftTone = draftStatus === 'error' ? 'text-danger' : draftError ? 'text-warn' : 'text-ink-3'

  const statusDot = errors.length
    ? 'bg-danger'
    : connection.status === 'checking'
      ? 'bg-ink-3 animate-pulse'
      : connection.status === 'fail' || storageWarn
        ? 'bg-warn'
        : connection.status === 'ok'
          ? 'bg-success'
          : 'bg-ink-3'
  const statusText = errors.length
    ? bannerErrors.length === 0
      ? errors[0].message
      : `还有 ${errors.length} 项待处理`
    : connection.status === 'checking'
      ? `正在检查连接… · ${preflight.estimate.label}`
      : connection.status === 'ok'
        ? `已连接 · ${settings.model} · ${preflight.estimate.label}`
        : connection.status === 'fail'
          ? `上次连接失败，仍可尝试 · ${preflight.estimate.label}`
          : storageWarn
            ? warnings[0].message
            : `${settings.model || '未设置模型'} · ${preflight.estimate.label}`

  return (
    <aside
      className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto border-r border-line bg-panel p-4 [&>*]:shrink-0"
      onDragOver={(e) => {
        e.preventDefault()
        if (e.dataTransfer.types.includes('Files')) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        handleFiles(e.dataTransfer.files)
      }}
      onPaste={(e) => {
        const files = e.clipboardData?.files
        if (!files || files.length === 0) return
        // 只有剪贴板里确实有图片时才拦截粘贴，避免吞掉普通文本粘贴
        const hasImage = Array.from(files).some((f) => f.type.startsWith('image/'))
        if (!hasImage) return
        e.preventDefault()
        handleFiles(files)
      }}
    >
      {restoredAt && !restoreDismissed && (
        <div className="flex items-start justify-between gap-2 rounded-lg bg-accent-soft px-2.5 py-2 text-[11px] text-accent">
          <div className="min-w-0">
            已恢复上次草稿（{formatDraftTime(restoredAt)}）
            {refsDropped > 0 && (
              <div className="mt-0.5 text-warn">{refsDropped} 张参考图未能恢复，请重新添加</div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={clearAll} className="cursor-pointer hover:underline">
              清空
            </button>
            <button
              onClick={() => setRestoreDismissed(true)}
              aria-label="关闭恢复提示"
              title="关闭恢复提示"
              className="cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {undoDraft && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-warn-soft px-2.5 py-2 text-[11px] text-warn">
          <span>草稿已清空</span>
          <button onClick={undoClear} className="cursor-pointer font-medium underline underline-offset-2">
            撤销
          </button>
        </div>
      )}

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-xs font-medium text-ink-2">提示词</span>
          <button
            onClick={() => store.openTemplateDialog()}
            className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md bg-accent-soft px-2 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-accent hover:text-white cursor-pointer"
          >
            <BookMarked className="h-3.5 w-3.5" /> 模板
          </button>
        </div>
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => {
            markEdited()
            setPrompt(e.target.value)
          }}
          onKeyDown={(e) => {
            if (!(e.metaKey || e.ctrlKey) || e.key !== 'Enter') return
            if (e.nativeEvent.isComposing) return
            e.preventDefault()
            submit()
          }}
          placeholder="描述你想生成的画面，越具体越好…"
          title="Ctrl/⌘ + Enter 生成"
          className="min-h-36 w-full resize-y p-3 text-[13px] leading-relaxed placeholder:text-ink-3"
        />
        <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
          <span className={`min-w-0 truncate ${draftTone}`}>
            {draftLine || '\u00A0'}
            {lastSubmittedAt && (
              <span className="ml-2 text-ink-3">上次提交 {formatDraftTime(lastSubmittedAt)}</span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {prompt.length > 0 && <span className="text-ink-3">{prompt.length} 字符</span>}
            {hasContent && (
              <button onClick={clearAll} className="cursor-pointer text-ink-3 hover:text-danger">
                清空
              </button>
            )}
          </span>
        </div>
      </div>

      {/* 参考图（图生图） */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium text-ink-2">
            参考图
            {refs.length > 0 && (
              <span className="ml-1.5 text-ink-3">
                {refs.length}/{MAX_REF_COUNT} · 图生图模式
              </span>
            )}
          </span>
          {refs.length > 0 && (
            <button
              onClick={() => {
                markEdited()
                setRefs([])
              }}
              className="cursor-pointer text-xs text-ink-3 hover:text-danger"
            >
              清空
            </button>
          )}
        </div>
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-3 py-2.5 transition-colors ${
            dragging ? 'border-accent bg-accent-soft' : 'border-line hover:border-accent hover:bg-hover'
          }`}
        >
          <ImagePlus className="h-4.5 w-4.5 shrink-0 text-ink-3" />
          <span className="text-xs leading-snug text-ink-3">
            {dragging ? '松手添加参考图' : '点击选择 / 拖拽 / 粘贴图片，最多 4 张'}
          </span>
          {pasteHint && <span className="ml-auto text-xs text-success">已添加</span>}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_REF_TYPES.join(',')}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
        {refs.length > 0 && (
          <div className="mt-2 flex gap-2">
            {refs.map((_, i) => (
              <div key={i} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-line">
                {refUrls[i] && (
                  <img src={refUrls[i]} alt={`参考图 ${i + 1}`} className="h-full w-full object-cover" />
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    markEdited()
                    setRefs((prev) => prev.filter((_, j) => j !== i))
                  }}
                  className="absolute right-0.5 top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-danger cursor-pointer"
                  title="移除"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {(refNotice || refsDropped > 0) && (
          <div className="mt-1 text-[11px] text-warn">
            {refNotice ?? `${refsDropped} 张参考图未能恢复，请重新添加`}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="尺寸">
          <Select
            value={params.size}
            options={SIZE_OPTIONS}
            onChange={(v) => {
              markEdited()
              paramsTouchedRef.current = true
              setParams({ ...params, size: v })
            }}
          />
        </Field>
        <Field label="质量">
          <Select
            value={params.quality}
            options={QUALITY_OPTIONS}
            onChange={(v) => {
              markEdited()
              paramsTouchedRef.current = true
              setParams({ ...params, quality: v })
            }}
          />
        </Field>
        <Field label="背景">
          <Select
            value={params.background}
            options={BACKGROUND_OPTIONS}
            onChange={(v) => {
              markEdited()
              paramsTouchedRef.current = true
              setParams((p) => ({
                ...p,
                background: v,
                // 透明背景不支持 JPEG，自动回退 PNG
                output_format: v === 'transparent' && p.output_format === 'jpeg' ? 'png' : p.output_format,
              }))
            }}
          />
        </Field>
        <Field label="格式">
          <Select
            value={params.output_format}
            options={FORMAT_OPTIONS}
            onChange={(v) => {
              markEdited()
              paramsTouchedRef.current = true
              setParams({ ...params, output_format: v })
            }}
          />
        </Field>
      </div>

      {params.background === 'transparent' && (
        <div className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
          透明背景仅在 PNG / WebP 格式下生效
        </div>
      )}

      <Field label="批量张数" hint="每张独立请求，互不影响">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={10}
            value={count}
            onChange={(e) => {
              markEdited()
              setCount(Number(e.target.value))
            }}
            className="h-9 flex-1 cursor-pointer accent-[var(--accent)]"
          />
          <span className="w-9 text-center text-lg font-semibold text-accent">{count}</span>
        </div>
      </Field>

      <Field label="并发数" hint="全局同时进行的请求">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={6}
            value={settings.concurrency}
            onChange={(e) => store.setConcurrency(Number(e.target.value))}
            className="h-9 flex-1 cursor-pointer accent-[var(--accent)]"
          />
          <span className="w-9 text-center text-lg font-semibold text-accent">{settings.concurrency}</span>
        </div>
      </Field>

      {runningCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {runningCount} 个任务进行中，新任务自动排队
        </div>
      )}

      {bannerErrors.length > 0 && (
        <div className="space-y-1 rounded-lg border border-danger/25 bg-danger-soft px-2.5 py-2 text-[11px] text-danger">
          {bannerErrors.slice(0, 3).map((e) => (
            <div key={e.id} className="flex items-start justify-between gap-2">
              <span className="min-w-0">{e.message}</span>
              {e.fix && (
                <button
                  onClick={() => applyFix(e.fix!.kind)}
                  className="shrink-0 cursor-pointer underline underline-offset-2 hover:no-underline"
                >
                  {e.fix.label}
                </button>
              )}
            </div>
          ))}
          {bannerErrors.length > 3 && <div className="text-danger/80">还有 {bannerErrors.length - 3} 项待处理</div>}
        </div>
      )}

      {warnings.length > 0 && errors.length === 0 && (
        <div className="space-y-1 rounded-lg bg-warn-soft px-2.5 py-2 text-[11px] text-warn">
          {warnings.slice(0, 2).map((w) => (
            <div key={w.id} className="flex items-start justify-between gap-2">
              <span className="flex min-w-0 items-start gap-1.5">
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                <span className="min-w-0">{w.message}</span>
              </span>
              {w.fix && (
                <button
                  onClick={() => applyFix(w.fix!.kind)}
                  className="shrink-0 cursor-pointer underline underline-offset-2 hover:no-underline"
                >
                  {w.fix.label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 提交区：预检状态、生成按钮与提交结果放在一起，滚到底即可提交 */}
      <div className="space-y-2 border-t border-line pt-3">
        <div className="flex items-center gap-1.5 text-[11px] text-ink-3" title={connection.error}>
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDot}`} />
          <span className="min-w-0 truncate">{statusText}</span>
        </div>

        <button
          onClick={submit}
          disabled={!canSubmit}
          title={demo ? '演示模式不会调用真实 API；下载仓库后可配置端点' : undefined}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : refs.length > 0 ? (
            <ImagePlus className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {demo
            ? '演示模式 · 不可生成'
            : submitting
              ? '提交中…'
              : refs.length > 0
                ? `以图生图 · 生成 ${count} 张`
                : `生成 ${count} 张`}
        </button>

        {submitNotice && (
          <div className="flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-xs text-success">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0">{submitNotice}</span>
          </div>
        )}

        {submitError && (
          <div className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{submitError}</div>
        )}
      </div>
    </aside>
  )
}
