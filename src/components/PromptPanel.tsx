/** 左栏：提示词 + 参考图（图生图） + 模板 + 生成参数 + 批量张数 / 并发数 + 提交 */
import { useEffect, useRef, useState } from 'react'
import { BookMarked, ImagePlus, Loader2, Sparkles, X } from 'lucide-react'
import { store, useStore } from '../store/store'
import {
  BACKGROUND_OPTIONS,
  FORMAT_OPTIONS,
  QUALITY_OPTIONS,
  SIZE_OPTIONS,
  type GenParams,
} from '../lib/types'
import { Field, Select } from './ui'

const MAX_REFS = 4
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp']

function normalizeFiles(files: FileList | File[] | DataTransferItemList): Blob[] {
  const out: Blob[] = []
  const list = Array.from(files as ArrayLike<File>)
  for (const f of list) {
    if (ACCEPTED.includes(f.type) && out.length < MAX_REFS) out.push(f)
  }
  return out
}

export function PromptPanel() {
  const { settings, prefill, tasks, taskOrder } = useStore()
  const [prompt, setPrompt] = useState('')
  const [params, setParams] = useState<GenParams>(settings.defaultParams)
  const [count, setCount] = useState(1)
  const [refs, setRefs] = useState<Blob[]>([])
  const [dragging, setDragging] = useState(false)
  const [pasteHint, setPasteHint] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 历史任务「回填生成」（连参考图一起回填）；模板填入只改提示词与尺寸，保留参考图
  useEffect(() => {
    if (!prefill) return
    setPrompt(prefill.prompt)
    setParams(prefill.params)
    if (!prefill.keepRefs) setRefs(prefill.refImages ?? [])
    store.consumePrefill()
    textareaRef.current?.focus()
  }, [prefill])

  // 参数默认值跟随设置
  useEffect(() => {
    setParams((p) => ({ ...settings.defaultParams, ...p }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(settings.defaultParams)])

  // 参考图对象 URL 管理：每次列表变化重建全部 URL
  const [refUrls, setRefUrls] = useState<string[]>([])
  useEffect(() => {
    const urls = refs.map((b) => URL.createObjectURL(b))
    setRefUrls(urls)
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [refs])

  const addRefs = (blobs: Blob[]) => {
    setRefs((prev) => [...prev, ...blobs].slice(0, MAX_REFS))
    if (blobs.length > 0) {
      setPasteHint(true)
      setTimeout(() => setPasteHint(false), 1500)
    }
  }

  const runningCount = taskOrder.filter((id) => tasks[id]?.status === 'running').length
  const canSubmit = prompt.trim().length > 0

  const submit = () => {
    if (!canSubmit) return
    store.submitTask(prompt, params, count, refs.length ? refs : undefined)
  }

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
        const blobs = normalizeFiles(e.dataTransfer.files)
        if (blobs.length) addRefs(blobs)
      }}
      onPaste={(e) => {
        const blobs = e.clipboardData?.files ? normalizeFiles(e.clipboardData.files) : []
        if (blobs.length) {
          e.preventDefault()
          addRefs(blobs)
        }
      }}
    >
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span
            className="min-w-0 truncate text-xs font-medium text-ink-2"
            title={`提示词 ${prompt.length} 字符 · Ctrl/⌘ + Enter 生成`}
          >
            提示词
            <span className="ml-1.5 font-normal text-ink-3">{prompt.length} 字符 · Ctrl/⌘ + Enter 生成</span>
          </span>
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
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit()
          }}
          placeholder="描述你想生成的画面，越具体越好…"
          className="min-h-36 w-full resize-y p-3 text-[13px] leading-relaxed placeholder:text-ink-3"
        />
      </div>

      {/* 参考图（图生图） */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium text-ink-2">
            参考图
            {refs.length > 0 && <span className="ml-1.5 text-ink-3">{refs.length}/{MAX_REFS} · 图生图模式</span>}
          </span>
          {refs.length > 0 && (
            <button onClick={() => setRefs([])} className="text-xs text-ink-3 hover:text-danger cursor-pointer">
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
          accept={ACCEPTED.join(',')}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addRefs(normalizeFiles(e.target.files))
            e.target.value = ''
          }}
        />
        {refs.length > 0 && (
          <div className="mt-2 flex gap-2">
            {refs.map((_, i) => (
              <div key={i} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-line">
                {refUrls[i] && <img src={refUrls[i]} alt={`参考图 ${i + 1}`} className="h-full w-full object-cover" />}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
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
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="尺寸">
          <Select value={params.size} options={SIZE_OPTIONS} onChange={(v) => setParams({ ...params, size: v })} />
        </Field>
        <Field label="质量">
          <Select value={params.quality} options={QUALITY_OPTIONS} onChange={(v) => setParams({ ...params, quality: v })} />
        </Field>
        <Field label="背景">
          <Select
            value={params.background}
            options={BACKGROUND_OPTIONS}
            onChange={(v) => {
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
            onChange={(v) => setParams({ ...params, output_format: v })}
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
            onChange={(e) => setCount(Number(e.target.value))}
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

      <button
        onClick={submit}
        disabled={!canSubmit}
        className="flex h-11 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
      >
        {refs.length > 0 ? <ImagePlus className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        {refs.length > 0 ? `以图生图 · 生成 ${count} 张` : `生成 ${count} 张`}
      </button>

      {runningCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {runningCount} 个任务进行中，新任务自动排队
        </div>
      )}
    </aside>
  )
}
