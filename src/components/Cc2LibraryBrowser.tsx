/**
 * cc2image 模板大全浏览面板：13 分类 × 46 个模板（常规模板 + JSON 进阶 + 防坑指南），
 * 按分类 / 关键词检索，选模板 → 编辑 [] 占位符 → 填入提示词。
 * 数据按需拉取 docs/templates.md 并缓存到 IndexedDB。
 */
import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Check } from 'lucide-react'
import { store } from '../store/store'
import { fetchCookbook, CC2LIB_KV_KEY, type CookbookCategory, type CookbookTemplate } from '../lib/cc2lib'
import { getKV, setKV } from '../lib/db'
import { Button, Select } from './ui'

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; categories: CookbookCategory[] }
  | { status: 'error'; error: string }

export function Cc2LibraryBrowser() {
  const [state, setState] = useState<LoadState>({ status: 'idle' })
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<(CookbookTemplate & { category?: string }) | null>(null)
  const [editedBody, setEditedBody] = useState('')
  const [limit, setLimit] = useState(30)

  // 打开时从 IndexedDB 缓存预热
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const cached = await getKV<CookbookCategory[]>(CC2LIB_KV_KEY)
        if (alive && cached?.length) setState({ status: 'loaded', categories: cached })
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
      const categories = await fetchCookbook()
      await setKV(CC2LIB_KV_KEY, categories)
      setState({ status: 'loaded', categories })
      const total = categories.reduce((s, c) => s + c.templates.length, 0)
      store.log('success', `cc2image 模板大全已加载并缓存：${categories.length} 个分类 ${total} 个模板`)
    } catch (err) {
      setState({ status: 'error', error: err instanceof Error ? err.message : String(err) })
    }
  }

  interface TaggedTemplate extends CookbookTemplate { category: string }
  const allTemplates = useMemo((): TaggedTemplate[] => {
    return state.status === 'loaded'
      ? state.categories.flatMap((c) => c.templates.map((t) => ({ ...t, category: c.name })))
      : []
  }, [state])

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase()
    if (!kw) return allTemplates
    return allTemplates.filter(
      (t) => t.title.toLowerCase().includes(kw) || t.body.toLowerCase().includes(kw) || t.category.toLowerCase().includes(kw),
    )
  }, [allTemplates, search])

  const categories = useMemo(() => {
    const seen = new Map<string, number>()
    for (const t of allTemplates) seen.set(t.category, (seen.get(t.category) ?? 0) + 1)
    return Array.from(seen.entries())
  }, [allTemplates])

  const pick = (t: CookbookTemplate) => {
    setSelected(t)
    setEditedBody(t.body)
  }

  return (
    <div className="flex min-h-0 gap-4" style={{ height: '62vh' }}>
      {/* 左：分类 + 检索 + 模板列表 */}
      <div className="flex w-72 shrink-0 flex-col gap-2.5">
        {state.status === 'loaded' ? (
          <>
            <Select
              size="sm"
              value={category}
              options={[{ value: '', label: `全部分类（${allTemplates.length}）` }, ...categories.map(([name, n]) => ({ value: name, label: `${name}（${n}）` }))]}
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
              placeholder="搜索模板标题 / 内容…"
              className="h-8 w-full px-2.5 text-xs"
            />
            <div className="text-[11px] text-ink-3">{filtered.length} 个模板</div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {filtered.slice(0, limit).map((t, i) => (
                <button
                  key={i}
                  onClick={() => pick(t)}
                  className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors cursor-pointer ${
                    selected?.title === t.title && selected?.body === t.body ? 'border-accent bg-accent-soft' : 'border-line hover:bg-hover'
                  }`}
                >
                  <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-ink">{t.title}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-ink-3">{t.category} · {t.type.toUpperCase()}</span>
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
                <div className="text-xs text-ink-2">正在拉取模板大全（13 分类 46 模板）…</div>
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
                <BookOpen className="h-6 w-6 text-ink-3" />
                <div className="text-xs leading-relaxed text-ink-2">
                  拉取「cc2image 模板大全」13 分类 46 模板（UI / 信息图 / 海报 / 电商 / 品牌 / 建筑 / 摄影 / 插画 / 角色 / 场景 / 古风 / 出版物…），
                  一次性下载后本地缓存。
                </div>
                <Button variant="primary" size="sm" onClick={() => void load()}>
                  拉取模板大全
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 右：模板编辑 + 填入 */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {selected ? (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink">{selected.title}</div>
                <div className="mt-0.5 text-[11px] text-ink-3">{selected.category} · {selected.type.toUpperCase()}</div>
              </div>
              <Button
                variant="primary"
                size="sm"
                disabled={!editedBody.trim()}
                onClick={() => {
                  store.applyPromptFill(editedBody)
                  store.closeTemplateDialog()
                }}
              >
                <Check className="h-3.5 w-3.5" /> 填入提示词
              </Button>
            </div>
            <textarea
              value={editedBody}
              onChange={(e) => setEditedBody(e.target.value)}
              className="log-font min-h-0 w-full flex-1 resize-none rounded-lg border border-line p-3 text-[12px] leading-relaxed text-ink-2"
            />
            <div className="rounded-lg bg-subtle/60 px-3 py-2 text-[11px] leading-relaxed text-ink-3">
              编辑 [方括号] 占位符为实际内容后填入。提示词原样使用，不需要额外包装。
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-3">
            <BookOpen className="h-6 w-6" />
            <p className="text-xs">{state.status === 'loaded' ? '从左侧选择一个模板' : '先拉取模板大全，再从左侧选择'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
