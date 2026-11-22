/**
 * 科研图表配方库浏览面板：148 个数据图配方（按标签 / 关键词检索），
 * 选配方 → 填数据 → 产出「示意版数据图表」生图 Prompt（明确标注非精确数据图）。
 * 数据按需拉取 catalog/cards.json 并缓存到 IndexedDB。
 */
import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Check } from 'lucide-react'
import { store } from '../store/store'
import {
  fetchVividCards,
  VIVID_KV_KEY,
  vividThumbnail,
  buildVividPrompt,
  type VividCard,
} from '../lib/vivid'
import { getKV, setKV } from '../lib/db'
import { Button, Select } from './ui'

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; cards: VividCard[] }
  | { status: 'error'; error: string }

const TAG_FILTERS = ['比较', '组合', '趋势', '分布', '误差', '矩阵', '关联', '组成', '诊断', '排序', '预测', '优化']

export function VividChartBrowser() {
  const [state, setState] = useState<LoadState>({ status: 'idle' })
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState('')
  const [limit, setLimit] = useState(30)
  const [selectedCard, setSelectedCard] = useState<VividCard | null>(null)
  const [dataText, setDataText] = useState('')
  const [title, setTitle] = useState('')
  const [vivid, setVivid] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)

  // 打开时从 IndexedDB 缓存预热
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const cached = await getKV<VividCard[]>(VIVID_KV_KEY)
        if (alive && cached?.length) setState({ status: 'loaded', cards: cached })
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
    try {
      const cards = await fetchVividCards()
      await setKV(VIVID_KV_KEY, cards)
      setState({ status: 'loaded', cards })
      store.log('success', `科研图表配方库已加载并缓存：${cards.length} 个配方`)
    } catch (err) {
      setState({ status: 'error', error: err instanceof Error ? err.message : String(err) })
    }
  }

  const cards = state.status === 'loaded' ? state.cards : []
  const tagCounts = useMemo(() => {
    const c = new Map<string, number>()
    for (const card of cards) for (const t of card.tags) c.set(t, (c.get(t) ?? 0) + 1)
    return TAG_FILTERS.map((t) => ({ tag: t, n: c.get(t) ?? 0 })).filter((x) => x.n > 0)
  }, [cards])

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase()
    return cards.filter((c) => {
      if (tag && !c.tags.includes(tag)) return false
      if (kw && !(c.display_name.toLowerCase().includes(kw) || (c.purpose ?? '').toLowerCase().includes(kw))) return false
      return true
    })
  }, [cards, search, tag])

  const selected = filtered.find((c) => c.id === selectedCard?.id) ?? cards.find((c) => c.id === selectedCard?.id) ?? null
  const prompt = selected
    ? buildVividPrompt(selected, { data: dataText, title, vivid })
    : ''
  const thumb = selected ? vividThumbnail(selected) : null
  const thumbSrc = selected && !imgFailed ? thumb : null

  const pick = (c: VividCard) => {
    setSelectedCard(c)
    setImgFailed(false)
  }

  return (
    <div className="flex min-h-0 gap-4" style={{ height: '62vh' }}>
      {/* 左：检索 + 配方列表 */}
      <div className="flex w-72 shrink-0 flex-col gap-2.5">
        {state.status === 'loaded' ? (
          <>
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setLimit(30)
              }}
              placeholder="搜索图表名称 / 用途…"
              className="h-8 w-full px-2.5 text-xs"
            />
            <Select
              size="sm"
              value={tag}
              options={[{ value: '', label: `全部标签（${cards.length}）` }, ...tagCounts.map((x) => ({ value: x.tag, label: `${x.tag}（${x.n}）` }))]}
              onChange={(v) => {
                setTag(v)
                setLimit(30)
              }}
            />
            <div className="text-[11px] text-ink-3">{filtered.length} 个配方</div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {filtered.slice(0, limit).map((c) => (
                <button
                  key={c.id}
                  onClick={() => pick(c)}
                  className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors cursor-pointer ${
                    selectedCard?.id === c.id ? 'border-accent bg-accent-soft' : 'border-line hover:bg-hover'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-ink">{c.display_name}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-ink-3">{c.purpose}</span>
                  </span>
                </button>
              ))}
              {filtered.length > limit && (
                <button
                  onClick={() => setLimit((l) => l + 30)}
                  className="w-full rounded-lg border border-line py-2 text-xs text-ink-2 hover:bg-hover cursor-pointer"
                >
                  加载更多（还有 {filtered.length - limit} 个）
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line px-4 text-center">
            {state.status === 'loading' ? (
              <>
                <div className="text-xs text-ink-2">正在拉取科研图表配方库…</div>
                <div className="text-[11px] text-ink-3">catalog/cards.json，拉取后本地缓存</div>
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
                <BarChart3 className="h-6 w-6 text-ink-3" />
                <div className="text-xs leading-relaxed text-ink-2">
                  拉取「科研图表配方库」148 个数据图配方（含构图 / 视觉特征 / 配色），
                  一次性下载后本地缓存，产出示意版数据图表生图 Prompt。
                </div>
                <Button variant="primary" size="sm" onClick={() => void load()}>
                  拉取配方库
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 右：配方详情 + 填数据 + Prompt */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {selectedCard ? (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink">{selectedCard.display_name}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-ink-3">{selectedCard.purpose}</div>
                {selectedCard.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {selectedCard.tags.slice(0, 6).map((t) => (
                      <span key={t} className="rounded bg-subtle px-1.5 py-0.5 text-[10px] text-ink-3">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  store.applyPromptFill(prompt, '1536x1024')
                  store.closeTemplateDialog()
                }}
              >
                <Check className="h-3.5 w-3.5" /> 填入提示词
              </Button>
            </div>

            {/* 配方示例图（目标设计参考） */}
            {thumbSrc && (
              <div className="flex justify-center rounded-lg border border-line bg-subtle/50 p-2">
                <img
                  src={thumbSrc}
                  alt="配方示例图"
                  onError={() => setImgFailed(true)}
                  className="max-h-52 rounded-md object-contain"
                  loading="lazy"
                />
              </div>
            )}

            {/* 数据填写 */}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-2">
                数据要点 *<span className="ml-1.5 font-normal text-ink-3">示意呈现：比例与标签近似即可，精确图请用原仓库 matplotlib 源码</span>
              </span>
              <textarea
                value={dataText}
                onChange={(e) => setDataText(e.target.value)}
                placeholder={'例：A 方法 85 分、B 方法 78 分、C 方法 92 分；B 组波动更大'}
                className="min-h-20 w-full resize-y p-2.5 text-[13px] leading-relaxed placeholder:text-ink-3"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-2">图表标题（可选）</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={selectedCard.display_name}
                className="h-9 w-full px-3 text-[13px]"
              />
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-2">
              <input type="checkbox" checked={vivid} onChange={(e) => setVivid(e.target.checked)} className="accent-[var(--accent)]" />
              配色鲜艳（不勾则稳重低饱和）
            </label>

            {selectedCard.data_requirements?.length > 0 && (
              <div className="rounded-lg bg-subtle/60 px-3 py-2 text-[11px] leading-relaxed text-ink-3">
                数据形态参考：{selectedCard.data_requirements.join('；')}
              </div>
            )}

            {/* 最终 Prompt 预览 */}
            <div className="rounded-lg border border-line">
              <div className="border-b border-line px-3 py-1.5 text-[11px] font-medium text-ink-2">示意版 Prompt</div>
              <pre className="log-font max-h-52 overflow-y-auto whitespace-pre-wrap px-3 py-2.5 text-ink-2">{prompt}</pre>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-3">
            <BarChart3 className="h-6 w-6" />
            <p className="text-xs">{state.status === 'loaded' ? '从左侧选择一个图表配方' : '先拉取配方库，再从左侧选择'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
