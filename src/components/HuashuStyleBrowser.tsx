/**
 * 花叔 Design 风格库浏览面板：92 种设计风格（6 个分组）+ 9 款 AI 生图专用风格，
 * 按官方「生图提示词心法（Mood, Not Layout）」产出短提示词——描述情绪与内容，不堆布局。
 * 数据按需拉取 references/design-styles.md 并缓存到 IndexedDB。
 */
import { useEffect, useMemo, useState } from 'react'
import { Check, Wand2 } from 'lucide-react'
import { store } from '../store/store'
import {
  buildHuashuPrompt,
  fetchHuashuStyles,
  HUASHU_KV_KEY,
  type HuashuStyle,
} from '../lib/huashu'
import { getKV, setKV } from '../lib/db'
import { Button, Select } from './ui'

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; styles: HuashuStyle[] }
  | { status: 'error'; error: string }

export function HuashuStyleBrowser() {
  const [state, setState] = useState<LoadState>({ status: 'idle' })
  const [group, setGroup] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<HuashuStyle | null>(null)
  const [topic, setTopic] = useState('')
  const [mood, setMood] = useState('')
  const [feel, setFeel] = useState('')
  const [ratio, setRatio] = useState<string>('16:9')
  const [limit, setLimit] = useState(30)

  // 打开时从 IndexedDB 缓存预热
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const cached = await getKV<HuashuStyle[]>(HUASHU_KV_KEY)
        if (alive && cached?.length) setState({ status: 'loaded', styles: cached })
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
      const styles = await fetchHuashuStyles()
      await setKV(HUASHU_KV_KEY, styles)
      setState({ status: 'loaded', styles })
      store.log('success', `花叔风格库已加载并缓存：${styles.length} 种设计风格`)
    } catch (err) {
      setState({ status: 'error', error: err instanceof Error ? err.message : String(err) })
    }
  }

  const styles = state.status === 'loaded' ? state.styles : []

  const groups = useMemo(() => {
    const seen = new Map<string, number>()
    for (const s of styles) seen.set(s.group, (seen.get(s.group) ?? 0) + 1)
    return Array.from(seen.entries())
  }, [styles])

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase()
    return styles.filter((s) => {
      if (group && s.group !== group) return false
      if (kw && !(s.name.toLowerCase().includes(kw) || s.dna.toLowerCase().includes(kw) || s.fit.toLowerCase().includes(kw))) return false
      return true
    })
  }, [styles, group, search])

  const prompt = selected
    ? buildHuashuPrompt(selected, { topic: topic || selected.fit.slice(0, 30), mood, feel, ratio: ratio as '16:9' | '3:4' | '1:1' })
    : ''

  return (
    <div className="flex min-h-0 gap-4" style={{ height: '62vh' }}>
      {/* 左：分组 + 检索 + 风格列表 */}
      <div className="flex w-72 shrink-0 flex-col gap-2.5">
        {state.status === 'loaded' ? (
          <>
            <Select
              size="sm"
              value={group}
              options={[{ value: '', label: `全部分组（${styles.length}）` }, ...groups.map(([g, n]) => ({ value: g, label: `${g}（${n}）` }))]}
              onChange={(v) => {
                setGroup(v)
                setLimit(30)
              }}
            />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setLimit(30)
              }}
              placeholder="搜索风格 / 视觉DNA / 适配…"
              className="h-8 w-full px-2.5 text-xs"
            />
            <div className="text-[11px] text-ink-3">{filtered.length} 种风格</div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {filtered.slice(0, limit).map((s) => (
                <button
                  key={s.group + s.name}
                  onClick={() => setSelected(s)}
                  className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors cursor-pointer ${
                    selected?.name === s.name ? 'border-accent bg-accent-soft' : 'border-line hover:bg-hover'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-ink">
                      {s.name}
                      {s.aiNative && <span className="ml-1 rounded bg-accent px-1 text-[9px] text-white">生图</span>}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-ink-3">
                      {s.tag} · {s.sub || s.group}
                    </span>
                  </span>
                </button>
              ))}
              {filtered.length > limit && (
                <button
                  onClick={() => setLimit((l) => l + 30)}
                  className="w-full rounded-lg border border-line py-2 text-xs text-ink-2 hover:bg-hover cursor-pointer"
                >
                  加载更多（还有 {filtered.length - limit} 种）
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line px-4 text-center">
            {state.status === 'loading' ? (
              <>
                <div className="text-xs text-ink-2">正在拉取风格库（92 种，约 108KB）…</div>
                <div className="text-[11px] text-ink-3">拉取后本地缓存，离线可用</div>
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
                <Wand2 className="h-6 w-6 text-ink-3" />
                <div className="text-xs leading-relaxed text-ink-2">
                  拉取「花叔 Design 风格库」92 种设计风格（网页 / PPT / 信息图 / App / 中文东亚 / 小红书，
                  含 9 款 AI 生图专用风格），按官方生图心法产出设计稿示意 Prompt。
                </div>
                <Button variant="primary" size="sm" onClick={() => void load()}>
                  拉取风格库
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 右：风格详情 + Mood 填写 + Prompt */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {selected ? (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink">{selected.name}</div>
                <div className="mt-0.5 text-[11px] text-ink-3">
                  {selected.tag} · {selected.group}
                  {selected.sub ? ` · ${selected.sub}` : ''}
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  store.applyPromptFill(prompt, ratio === '3:4' ? '1024x1536' : ratio === '1:1' ? '1024x1024' : '1536x1024')
                  store.closeTemplateDialog()
                }}
              >
                <Check className="h-3.5 w-3.5" /> 填入提示词
              </Button>
            </div>

            {/* 风格 DNA 详情 */}
            <div className="rounded-lg border border-line px-3 py-2.5">
              <div className="text-[11px] leading-relaxed text-ink-2">
                <span className="font-medium text-ink">视觉DNA：</span>
                {selected.dna || '（未提取）'}
              </div>
              {selected.fit && <div className="mt-1 text-[11px] text-ink-3">适配：{selected.fit}</div>}
              {selected.ref && <div className="mt-1 text-[11px] text-ink-3">参考：{selected.ref}</div>}
              {selected.aiNative && (
                <div className="mt-1.5 rounded bg-accent-soft px-2 py-1 text-[10px] text-accent">
                  AI 生图专用风格——灵魂在直出图的光影 / 手作 / 生成质感
                </div>
              )}
            </div>

            {/* Mood, Not Layout 表单 */}
            <div className="space-y-2.5">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink-2">设计主题 *</span>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="例：AI 笔记产品的落地页"
                  className="h-9 w-full px-3 text-[13px]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink-2">
                  情绪（Mood）<span className="ml-1 font-normal text-ink-3">短提示词 &gt; 长提示词：描述情绪，不堆布局</span>
                </span>
                <input
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  placeholder="例：warm like Sunday morning"
                  className="h-9 w-full px-3 text-[13px]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink-2">观众应该感受到（可选）</span>
                <input
                  value={feel}
                  onChange={(e) => setFeel(e.target.value)}
                  placeholder="例：克制的高级感，像翻一本独立杂志"
                  className="h-9 w-full px-3 text-[13px]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink-2">画幅比例</span>
                <Select
                  value={ratio}
                  options={[
                    { value: '16:9', label: '16:9 横版' },
                    { value: '3:4', label: '3:4 竖版' },
                    { value: '1:1', label: '1:1 方形' },
                  ]}
                  onChange={setRatio}
                />
              </label>
            </div>

            {/* 最终 Prompt 预览 */}
            <div className="rounded-lg border border-line">
              <div className="border-b border-line px-3 py-1.5 text-[11px] font-medium text-ink-2">Mood 版 Prompt</div>
              <pre className="log-font max-h-44 overflow-y-auto whitespace-pre-wrap px-3 py-2.5 text-ink-2">{prompt}</pre>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-3">
            <Wand2 className="h-6 w-6" />
            <p className="text-xs">{state.status === 'loaded' ? '从左侧选择一种风格' : '先拉取风格库，再从左侧选择'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
