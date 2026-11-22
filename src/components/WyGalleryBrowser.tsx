/**
 * GPT Image 2 精选画廊浏览面板：31 分类 × 171 条编号案例（完整 Prompt + 示例图），
 * 外加 craft.md 的 18 条提示词工艺原则。选案例 → 可编辑 → 按案例画幅填入提示词。
 * 数据按需拉取 GitHub 分类文件并缓存到 IndexedDB。
 */
import { useEffect, useMemo, useState } from 'react'
import { Check, Images, Lightbulb } from 'lucide-react'
import { store } from '../store/store'
import {
  fetchWyGallery,
  wyImageCdnUrl,
  WY_KV_KEY,
  type WyCraftPrinciple,
  type WyEntry,
  type WyGalleryData,
} from '../lib/wygallery'
import { getKV, setKV } from '../lib/db'
import { Button, Select } from './ui'

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; data: WyGalleryData }
  | { status: 'error'; error: string }

/** 示例图：raw 源失败自动切 jsDelivr，再失败则隐藏 */
function WyPreview({ url }: { url: string }) {
  const [src, setSrc] = useState(url)
  useEffect(() => setSrc(url), [url])
  if (!src) return null
  return (
    <div className="flex justify-center rounded-lg border border-line bg-subtle/50 p-2">
      <img
        src={src}
        alt="案例示例图"
        loading="lazy"
        onError={() => {
          const cdn = wyImageCdnUrl(src)
          setSrc(cdn !== src ? cdn : '')
        }}
        className="max-h-56 rounded-md object-contain"
      />
    </div>
  )
}

export function WyGalleryBrowser() {
  const [state, setState] = useState<LoadState>({ status: 'idle' })
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [tab, setTab] = useState<'gallery' | 'craft'>('gallery')

  // 画廊筛选
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<WyEntry | null>(null)
  const [variantIdx, setVariantIdx] = useState(-1)
  const [editedPrompt, setEditedPrompt] = useState('')
  const [limit, setLimit] = useState(30)

  // 工艺页签
  const [principle, setPrinciple] = useState<WyCraftPrinciple | null>(null)

  // 打开时从 IndexedDB 缓存预热
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const cached = await getKV<WyGalleryData>(WY_KV_KEY)
        if (alive && cached?.entries?.length) setState({ status: 'loaded', data: cached })
      } catch {
        /* 缓存读取失败则保持 idle */
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const load = async () => {
    setState({ status: 'loading' })
    setProgress({ done: 0, total: 0 })
    try {
      const data = await fetchWyGallery((done, total) => setProgress({ done, total }))
      await setKV(WY_KV_KEY, data)
      setState({ status: 'loaded', data })
      store.log('success', `GPT Image 2 画廊已加载并缓存：${data.entries.length} 条案例、${data.principles.length} 条工艺原则`)
    } catch (err) {
      setState({ status: 'error', error: err instanceof Error ? err.message : String(err) })
    }
  }

  const entries = state.status === 'loaded' ? state.data.entries : []
  const principles = state.status === 'loaded' ? state.data.principles : []

  const categories = useMemo(() => {
    const seen = new Map<string, number>()
    for (const e of entries) seen.set(e.category, (seen.get(e.category) ?? 0) + 1)
    return Array.from(seen.entries())
  }, [entries])

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase()
    return entries.filter((e) => {
      if (category && e.category !== category) return false
      if (kw && !(e.title.toLowerCase().includes(kw) || e.prompt.toLowerCase().includes(kw) || e.meta.toLowerCase().includes(kw))) return false
      return true
    })
  }, [entries, category, search])

  const pick = (e: WyEntry) => {
    setSelected(e)
    setVariantIdx(-1)
    setEditedPrompt(e.prompt)
  }

  const pickVariant = (i: number) => {
    if (!selected) return
    setVariantIdx(i)
    setEditedPrompt(i < 0 ? selected.prompt : (selected.variants[i]?.prompt ?? selected.prompt))
  }

  return (
    <div className="flex min-h-0 flex-col gap-3" style={{ height: '62vh' }}>
      {/* 页签 */}
      <div className="flex shrink-0 items-center gap-2">
        <div className="flex rounded-lg border border-line p-0.5">
          <button
            onClick={() => setTab('gallery')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors cursor-pointer ${
              tab === 'gallery' ? 'bg-accent text-white' : 'text-ink-2 hover:bg-hover'
            }`}
          >
            <Images className="h-3.5 w-3.5" /> 精选案例
            {state.status === 'loaded' && <span className="opacity-80">（{entries.length}）</span>}
          </button>
          <button
            onClick={() => setTab('craft')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors cursor-pointer ${
              tab === 'craft' ? 'bg-accent text-white' : 'text-ink-2 hover:bg-hover'
            }`}
          >
            <Lightbulb className="h-3.5 w-3.5" /> 工艺原则
            {state.status === 'loaded' && <span className="opacity-80">（{principles.length}）</span>}
          </button>
        </div>
        <span className="min-w-0 truncate text-[11px] text-ink-3">来自 wuyoscar/GPT-Image2-Skill · 提示词为英文原文</span>
      </div>

      {state.status !== 'loaded' ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line px-4 text-center">
          {state.status === 'loading' ? (
            <>
              <div className="text-xs text-ink-2">
                正在拉取画廊 {progress.total > 0 ? `${progress.done}/${progress.total}` : ''} …
              </div>
              <div className="text-[11px] text-ink-3">31 个分类文件 + 工艺原则，拉取后本地缓存、离线可用</div>
            </>
          ) : state.status === 'error' ? (
            <>
              <div className="text-xs text-danger break-all">拉取失败：{state.error}</div>
              <Button variant="default" size="sm" onClick={() => void load()}>
                重试
              </Button>
            </>
          ) : (
            <>
              <Images className="h-6 w-6 text-ink-3" />
              <div className="max-w-md text-xs leading-relaxed text-ink-2">
                拉取「GPT Image 2 精选画廊」171 条编号案例（Anime / 摄影 / 海报 / 科研图表 / UI / 产品 / 建筑 / 信息图…），
                每条含完整英文 Prompt、画幅与示例图；另附 18 条提示词工艺原则。
              </div>
              <Button variant="primary" size="sm" onClick={() => void load()}>
                拉取画廊
              </Button>
            </>
          )}
        </div>
      ) : tab === 'craft' ? (
        /* 工艺原则页签 */
        <div className="flex min-h-0 flex-1 gap-4">
          <div className="flex w-72 shrink-0 flex-col gap-2.5">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索工艺原则…"
              className="h-8 w-full px-2.5 text-xs"
            />
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {principles
                .filter((p) => {
                  const kw = search.trim().toLowerCase()
                  return !kw || p.title.toLowerCase().includes(kw) || p.body.toLowerCase().includes(kw)
                })
                .map((p) => (
                  <button
                    key={p.no}
                    onClick={() => setPrinciple(p)}
                    className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors cursor-pointer ${
                      principle?.no === p.no ? 'border-accent bg-accent-soft' : 'border-line hover:bg-hover'
                    }`}
                  >
                    <span className="mt-px w-5 shrink-0 text-center text-[10px] font-medium text-accent">{p.no}</span>
                    <span className="min-w-0 flex-1 text-xs font-medium leading-snug text-ink">{p.title}</span>
                  </button>
                ))}
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
            {principle ? (
              <>
                <div className="text-sm font-medium text-ink">
                  {principle.no}. {principle.title}
                </div>
                <pre className="log-font whitespace-pre-wrap rounded-lg border border-line px-3 py-2.5 text-[12px] leading-relaxed text-ink-2">
                  {principle.body}
                </pre>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-3">
                <Lightbulb className="h-6 w-6" />
                <p className="text-xs">从左侧选择一条工艺原则</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* 精选案例页签 */
        <div className="flex min-h-0 flex-1 gap-4">
          {/* 左：分类 + 检索 + 案例列表 */}
          <div className="flex w-64 shrink-0 flex-col gap-2.5">
            <Select
              size="sm"
              value={category}
              options={[{ value: '', label: `全部分类（${entries.length}）` }, ...categories.map(([name, n]) => ({ value: name, label: `${name}（${n}）` }))]}
              onChange={(v) => {
                setCategory(v)
                setLimit(30)
              }}
            />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setLimit(30)
              }}
              placeholder="搜索标题 / Prompt / 来源…"
              className="h-8 w-full px-2.5 text-xs"
            />
            <div className="text-[11px] text-ink-3">{filtered.length} 条案例</div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {filtered.slice(0, limit).map((e) => (
                <button
                  key={e.id}
                  onClick={() => pick(e)}
                  className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors cursor-pointer ${
                    selected?.id === e.id ? 'border-accent bg-accent-soft' : 'border-line hover:bg-hover'
                  }`}
                >
                  <span className="mt-px w-7 shrink-0 text-center text-[10px] font-medium text-ink-3">No.{e.no}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-ink">{e.title}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-ink-3">
                      {e.category} · {e.size}
                    </span>
                  </span>
                </button>
              ))}
              {filtered.length > limit && (
                <button
                  onClick={() => setLimit((l) => l + 30)}
                  className="w-full rounded-lg border border-line py-2 text-xs text-ink-2 hover:bg-hover cursor-pointer"
                >
                  加载更多（还有 {filtered.length - limit} 条）
                </button>
              )}
            </div>
          </div>

          {/* 右：案例详情 + 编辑 + 填入 */}
          <div className="flex min-w-0 flex-1 flex-col gap-2.5 overflow-y-auto pr-1 [&>*]:shrink-0">
            {selected ? (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink">
                      No.{selected.no} · {selected.title}
                    </div>
                    <div className="mt-0.5 break-words text-[10px] leading-relaxed text-ink-3">{selected.meta || selected.category}</div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!editedPrompt.trim()}
                    onClick={() => {
                      store.applyPromptFill(editedPrompt, selected.size)
                      store.closeTemplateDialog()
                    }}
                  >
                    <Check className="h-3.5 w-3.5" /> 填入提示词
                  </Button>
                </div>

                {selected.imageUrl && <WyPreview url={selected.imageUrl} />}

                {selected.variants.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-ink-3">变体：</span>
                    <button
                      onClick={() => pickVariant(-1)}
                      className={`rounded-md border px-2 py-1 text-[11px] cursor-pointer ${
                        variantIdx === -1 ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-2 hover:bg-hover'
                      }`}
                    >
                      原始 Prompt
                    </button>
                    {selected.variants.map((v, i) => (
                      <button
                        key={i}
                        onClick={() => pickVariant(i)}
                        title="变体通常需要参考图，直接填空可能得到不同结果"
                        className={`rounded-md border px-2 py-1 text-[11px] cursor-pointer ${
                          variantIdx === i ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-2 hover:bg-hover'
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                )}

                <textarea
                  value={editedPrompt}
                  onChange={(e) => setEditedPrompt(e.target.value)}
                  className="log-font min-h-52 w-full flex-1 resize-y rounded-lg border border-line p-3 text-[12px] leading-relaxed text-ink-2"
                />
                <div className="rounded-lg bg-subtle/60 px-3 py-2 text-[11px] leading-relaxed text-ink-3">
                  填入时尺寸联动为 {selected.size}。示例 Prompt 可直接用，也可以替换画面主体后再生成。
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-3">
                <Images className="h-6 w-6" />
                <p className="text-xs">从左侧选择一条案例</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
