/**
 * 电商场景模板库浏览面板：25 个编号场景模板（白底主图 / 场景 / 平铺 / UGC / 直播…），
 * 选模板 → 填产品描述 / 变体 / 三层文字 → 产出符合 GPT-Image 铁律的英文 Prompt。
 * 数据按需拉取 references/templates/*.json（25 个文件并行）并缓存到 IndexedDB。
 */
import { useEffect, useMemo, useState } from 'react'
import { Check, ShoppingBag } from 'lucide-react'
import { store } from '../store/store'
import {
  buildEcomSkinPrompt,
  ECOSKINS_KV_KEY,
  fetchEcomSkins,
  type EcomSkin,
} from '../lib/ecoskins'
import { getKV, setKV } from '../lib/db'
import { Button, Select } from './ui'

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; skins: EcomSkin[] }
  | { status: 'error'; error: string }

export function EcomSkinsBrowser() {
  const [state, setState] = useState<LoadState>({ status: 'idle' })
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [product, setProduct] = useState('')
  const [variant, setVariant] = useState<Record<string, string>>({})
  const [corePromise, setCorePromise] = useState('')
  const [evidence, setEvidence] = useState('')
  const [cta, setCta] = useState('')
  const [bgHex, setBgHex] = useState('')

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const cached = await getKV<EcomSkin[]>(ECOSKINS_KV_KEY)
        if (alive && cached?.length) setState({ status: 'loaded', skins: cached })
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
      const skins = await fetchEcomSkins()
      await setKV(ECOSKINS_KV_KEY, skins)
      setState({ status: 'loaded', skins })
      store.log('success', `电商场景模板库已加载并缓存：${skins.length} 个场景模板`)
    } catch (err) {
      setState({ status: 'error', error: err instanceof Error ? err.message : String(err) })
    }
  }

  const skins = state.status === 'loaded' ? state.skins : []
  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase()
    if (!kw) return skins
    return skins.filter(
      (s) =>
        s.name.toLowerCase().includes(kw) ||
        s.id.includes(kw) ||
        s.keywords.some((k) => k.toLowerCase().includes(kw)),
    )
  }, [skins, search])

  const selected = skins.find((s) => s.id === selectedId) ?? skins[0] ?? null
  const variants = selected ? Object.entries(selected.variants ?? {}) : []
  const variantValue = variant[selected?.id ?? ''] ?? ''
  const prompt = selected
    ? buildEcomSkinPrompt(selected, { product, variant: variantValue, corePromise, evidence, cta, bgHex })
    : ''

  return (
    <div className="flex min-h-0 gap-4" style={{ height: '62vh' }}>
      {/* 左：检索 + 模板列表 */}
      <div className="flex w-72 shrink-0 flex-col gap-2.5">
        {state.status === 'loaded' ? (
          <>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索场景模板 / 关键词…"
              className="h-8 w-full px-2.5 text-xs"
            />
            <div className="text-[11px] text-ink-3">{filtered.length} 个场景模板</div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {filtered.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors cursor-pointer ${
                    selected?.id === s.id ? 'border-accent bg-accent-soft' : 'border-line hover:bg-hover'
                  }`}
                >
                  <ShoppingBag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-ink">{s.name}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-ink-3">{s.keywords.slice(0, 3).join(' / ')}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line px-4 text-center">
            {state.status === 'loading' ? (
              <>
                <div className="text-xs text-ink-2">正在拉取 25 个场景模板…</div>
                <div className="text-[11px] text-ink-3">并行拉取后本地缓存</div>
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
                <ShoppingBag className="h-6 w-6 text-ink-3" />
                <div className="text-xs leading-relaxed text-ink-2">
                  拉取「电商场景模板库」25 个场景模板（白底主图 / 场景图 / 平铺图 / UGC / 直播…），
                  每个模板含构图结构、命名变体与品类建议。
                </div>
                <Button variant="primary" size="sm" onClick={() => void load()}>
                  拉取模板库
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 右：模板详情 + 填充 + Prompt */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {selected ? (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink">{selected.name}</div>
                <div className="mt-0.5 text-[11px] text-ink-3">模板 ID：{selected.id}</div>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  store.applyPromptFill(prompt)
                  store.closeTemplateDialog()
                }}
              >
                <Check className="h-3.5 w-3.5" /> 填入提示词
              </Button>
            </div>

            {/* 产品描述 */}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-2">
                产品描述 *<span className="ml-1.5 font-normal text-ink-3">以真实产品为准，不擅自改包装 / 口味 / 规格</span>
              </span>
              <textarea
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="例：500ml 双层不锈钢保温杯，哑光白色杯身，木质杯盖"
                className="min-h-16 w-full resize-y p-2.5 text-[13px] leading-relaxed placeholder:text-ink-3"
              />
            </label>

            {/* 变体 */}
            {variants.length > 0 && (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink-2">风格变体</span>
                <Select
                  value={variantValue}
                  options={[
                    { value: '', label: '默认（按模板 defaults）' },
                    ...variants.map(([k, v]) => ({ value: k, label: `${k} · ${v.description}` })),
                  ]}
                  onChange={(v) => setVariant((m) => ({ ...m, [selected.id]: v }))}
                />
              </label>
            )}

            {/* 三层文字（可选） */}
            <div className="rounded-lg border border-line px-3 py-2.5">
              <div className="text-xs font-medium text-ink-2">
                三层信息架构（可选）<span className="ml-1.5 font-normal text-ink-3">核心承诺 ≤15 字 · 证据 2-3 个 · CTA ≤8 字；中文用「」引号渲染更准</span>
              </div>
              <div className="mt-2 space-y-2">
                <input
                  value={corePromise}
                  onChange={(e) => setCorePromise(e.target.value)}
                  placeholder="核心承诺，例：24 小时长效保温"
                  className="h-8 w-full px-2.5 text-xs"
                />
                <input
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  placeholder="关键证据，例：食品级材质、316 不锈钢内胆"
                  className="h-8 w-full px-2.5 text-xs"
                />
                <input
                  value={cta}
                  onChange={(e) => setCta(e.target.value)}
                  placeholder="行动指令，例：立即带走"
                  className="h-8 w-full px-2.5 text-xs"
                />
              </div>
            </div>

            {/* 背景 hex */}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-2">
                背景色（hex）<span className="ml-1.5 font-normal text-ink-3">铁律 1：颜色用 hex 码，不用形容词</span>
              </span>
              <input
                value={bgHex}
                onChange={(e) => setBgHex(e.target.value)}
                placeholder="例：#FFFFFF / #F5F1E8"
                className="h-9 w-full px-3 text-[13px]"
              />
            </label>

            {/* Prompt 预览 */}
            <div className="rounded-lg border border-line">
              <div className="border-b border-line px-3 py-1.5 text-[11px] font-medium text-ink-2">英文 Prompt（含铁律注入）</div>
              <pre className="log-font max-h-52 overflow-y-auto whitespace-pre-wrap px-3 py-2.5 text-ink-2">{prompt}</pre>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-3">
            <ShoppingBag className="h-6 w-6" />
            <p className="text-xs">{state.status === 'loaded' ? '从左侧选择一个场景模板' : '先拉取模板库，再从左侧选择'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
