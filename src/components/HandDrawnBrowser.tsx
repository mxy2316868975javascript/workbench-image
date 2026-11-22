/**
 * 手绘风格配方库浏览面板：23 个编号画风，选风格 → 填【主体】【文字】/比例 → 产出配方 Prompt。
 * 数据按需从 GitHub 拉取（双源回退）并缓存到 IndexedDB，之后本地可用。
 */
import { useEffect, useMemo, useState } from 'react'
import { Check, Palette } from 'lucide-react'
import { store } from '../store/store'
import {
  fetchHandDrawnLibrary,
  handDrawnPlaceholders,
  HANDDRAWN_KV_KEY,
  renderHandDrawnPrompt,
  type HandDrawnStyle,
} from '../lib/handdrawn'
import { getKV, setKV } from '../lib/db'
import { Button, Select } from './ui'

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; styles: HandDrawnStyle[] }
  | { status: 'error'; error: string }

const ASPECT_OPTIONS = [
  { value: '', label: '不注入比例（按协议默认）' },
  { value: '1:1', label: '方图 1:1' },
  { value: '3:4', label: '竖版 3:4' },
  { value: '4:3', label: '横版 4:3' },
  { value: '9:16', label: '竖版 9:16' },
  { value: '16:9', label: '横版 16:9' },
]

export function HandDrawnBrowser() {
  const [state, setState] = useState<LoadState>({ status: 'idle' })
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [subject, setSubject] = useState('')
  const [texts, setTexts] = useState<Record<string, string>>({})
  const [aspects, setAspects] = useState<Record<string, string>>({})
  const [limit, setLimit] = useState(30)

  // 打开时先从 IndexedDB 缓存预热
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const cached = await getKV<HandDrawnStyle[]>(HANDDRAWN_KV_KEY)
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
      const styles = await fetchHandDrawnLibrary()
      await setKV(HANDDRAWN_KV_KEY, styles)
      setState({ status: 'loaded', styles })
      store.log('success', `手绘风格配方库已加载并缓存：${styles.length} 个画风`)
    } catch (err) {
      setState({ status: 'error', error: err instanceof Error ? err.message : String(err) })
    }
  }

  const styles = state.status === 'loaded' ? state.styles : []
  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase()
    if (!kw) return styles
    return styles.filter(
      (s) => s.name.toLowerCase().includes(kw) || s.id.includes(kw) || s.aliases.some((a) => a.toLowerCase().includes(kw)) || s.cue.toLowerCase().includes(kw),
    )
  }, [styles, search])

  const selected = styles.find((s) => s.id === selectedId) ?? null
  const placeholders = selected ? handDrawnPlaceholders(selected.body) : []
  const aspect = aspects[selected?.id ?? ''] ?? ''
  const rendered = selected
    ? renderHandDrawnPrompt(selected, {
        subject,
        text: texts[selected?.id ?? ''],
        aspect: aspect || undefined,
      })
    : ''

  return (
    <div className="flex min-h-0 gap-4" style={{ height: '62vh' }}>
      {/* 左：检索 + 画风列表 */}
      <div className="flex w-72 shrink-0 flex-col gap-2.5">
        {state.status === 'loaded' ? (
          <>
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setLimit(30)
              }}
              placeholder="搜索画风编号 / 名称 / 别名…"
              className="h-8 w-full px-2.5 text-xs"
            />
            <div className="text-[11px] text-ink-3">
              {filtered.length} 个画风（共 {styles.length}）
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {filtered.slice(0, limit).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors cursor-pointer ${
                    selectedId === s.id ? 'border-accent bg-accent-soft' : 'border-line hover:bg-hover'
                  }`}
                >
                  <Palette className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-ink">
                      {s.id} {s.name}
                    </span>
                    {s.cue && <span className="mt-0.5 block truncate text-[10px] text-ink-3">{s.cue}</span>}
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
                <div className="text-xs text-ink-2">正在拉取画风配方库…</div>
                <div className="text-[11px] text-ink-3">STYLES.md + 选型指导，拉取后本地缓存</div>
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
                <Palette className="h-6 w-6 text-ink-3" />
                <div className="text-xs leading-relaxed text-ink-2">
                  拉取「手绘风格配方库」23 个编号画风的中文 Prompt 配方
                  （儿童涂色、蜡笔童涂、吉卜力、水墨、像素、皮影…），拉取后本地缓存。
                </div>
                <Button variant="primary" size="sm" onClick={() => void load()}>
                  拉取配方库
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 右：配方详情 + 填充 */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {selected ? (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink">
                  {selected.id} {selected.name}
                </div>
                {selected.cue && <div className="mt-0.5 text-[11px] text-ink-3">{selected.cue}</div>}
                {selected.aliases.length > 0 && (
                  <div className="mt-0.5 truncate text-[10px] text-ink-3">别名：{selected.aliases.join('、')}</div>
                )}
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  store.applyPromptFill(rendered)
                  store.closeTemplateDialog()
                }}
              >
                <Check className="h-3.5 w-3.5" /> 填入提示词
              </Button>
            </div>

            {/* 占位符字段 */}
            <div className="space-y-2.5">
              {placeholders.map((ph) => {
                if (ph === '主体') {
                  return (
                    <label key={ph} className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-ink-2">
                        【主体】<span className="ml-1 text-danger">*</span>
                        <span className="ml-1.5 font-normal text-ink-3">人物 / 物件 / 场景内容，不混入画风词</span>
                      </span>
                      <textarea
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="例：爸爸和孩子一起搭一个歪歪的积木塔"
                        className="min-h-16 w-full resize-y p-2.5 text-[13px] leading-relaxed placeholder:text-ink-3"
                      />
                    </label>
                  )
                }
                if (ph === '文字') {
                  const fallback = selected.id === '18' || selected.id === '19' || selected.id === '20' ? 'No text anywhere.' : '不加任何文字。'
                  return (
                    <label key={ph} className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-ink-2">
                        【文字】<span className="ml-1.5 font-normal text-ink-3">留空用默认：{fallback}</span>
                      </span>
                      <input
                        value={texts[selected.id] ?? ''}
                        onChange={(e) => setTexts((m) => ({ ...m, [selected.id]: e.target.value }))}
                        placeholder={fallback}
                        className="h-9 w-full px-3 text-[13px]"
                      />
                    </label>
                  )
                }
                return (
                  <label key={ph} className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-ink-2">【{ph}】</span>
                    <input
                      value={texts[`${selected.id}:${ph}`] ?? ''}
                      onChange={(e) => setTexts((m) => ({ ...m, [`${selected.id}:${ph}`]: e.target.value }))}
                      className="h-9 w-full px-3 text-[13px]"
                    />
                  </label>
                )
              })}
            </div>

            {/* 比例 */}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-2">
                画幅比例
                <span className="ml-1.5 font-normal text-ink-3">按协议：纯风格默认不注入；1/4 号为版式风格只注入软提示；选了就用你的</span>
              </span>
              <Select
                value={aspect}
                options={ASPECT_OPTIONS}
                onChange={(v) => setAspects((m) => ({ ...m, [selected.id]: v }))}
              />
            </label>

            {/* 特殊画风提示 */}
            {['3.1', '19', '20', '22', '23'].includes(selected.id) && (
              <div className="rounded-lg bg-warn-soft px-3 py-2 text-[11px] leading-relaxed text-warn">
                该画风在原仓库有正式生产工作流（画风锚点参考图、多阶段修正或机读验收），本工作台产出的是
                Prompt 文本；正式批量生产请参考原仓库 PROTOCOL.md。
              </div>
            )}

            {/* 最终 Prompt 预览 */}
            <div className="rounded-lg border border-line">
              <div className="border-b border-line px-3 py-1.5 text-[11px] font-medium text-ink-2">最终 Prompt</div>
              <pre className="log-font max-h-52 overflow-y-auto whitespace-pre-wrap px-3 py-2.5 text-ink-2">{rendered}</pre>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-3">
            <Palette className="h-6 w-6" />
            <p className="text-xs">{state.status === 'loaded' ? '从左侧选择一个画风' : '先拉取配方库，再从左侧选择画风'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
