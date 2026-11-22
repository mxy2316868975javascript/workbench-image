/**
 * 提示词模板对话框：选择模板 → 填字段 → 实时预览 Prompt → 填入生成面板。
 * 内置模板（如 ecom-pdp）由代码构建；自定义模板存 IndexedDB，正文用 {{key}} 占位。
 */
import { useMemo, useState } from 'react'
import { BarChart3, BookMarked, BookOpen, Check, Library, Palette, Pencil, Plus, ShoppingBag, Sparkles, Trash2 } from 'lucide-react'
import { store, useStore } from '../store/store'
import { getAllTemplates, renderCustomTemplate } from '../lib/templates'
import {
  parseShuixianArguments,
  renderShuixianPrompt,
  shuixianImageUrl,
  type ShuixianPrompt,
} from '../lib/shuixian'
import type { CustomTemplate, TemplateField } from '../lib/types'
import { uid } from '../lib/image-utils'
import { Button, Modal, Select } from './ui'
import { HandDrawnBrowser } from './HandDrawnBrowser'
import { VividChartBrowser } from './VividChartBrowser'
import { EcomSkinsBrowser } from './EcomSkinsBrowser'
import { Cc2LibraryBrowser } from './Cc2LibraryBrowser'
import { WyGalleryBrowser } from './WyGalleryBrowser'

export function TemplateDialog() {
  const { templateDialogOpen, customTemplates } = useStore()
  const templates = useMemo(() => getAllTemplates(customTemplates), [customTemplates])

  const [selectedId, setSelectedId] = useState(templates[0]?.id)
  const [valuesByTemplate, setValuesByTemplate] = useState<Record<string, Record<string, string>>>({})
  const [editing, setEditing] = useState<CustomTemplate | 'new' | null>(null)

  const selected = templates.find((t) => t.id === selectedId) ?? templates[0]
  const values = valuesByTemplate[selected.id] ?? {}

  const setValue = (key: string, v: string) => {
    setValuesByTemplate((m) => ({ ...m, [selected.id]: { ...(m[selected.id] ?? {}), [key]: v } }))
  }

  const result = useMemo(() => {
    if (!selected) return null
    if (selected.builtin) return selected.build(values)
    return { prompt: renderCustomTemplate(selected, values) }
  }, [selected, values])

  // 动态字段：fields 可以是函数（如 vane 玩法合集按玩法切换表单）
  const resolvedFields = useMemo(() => {
    if (!selected) return []
    return typeof selected.fields === 'function' ? selected.fields(values) : selected.fields
  }, [selected, values])

  const note = useMemo(() => {
    if (!selected || !selected.builtin || !selected.note) return null
    return typeof selected.note === 'function' ? selected.note(values) : selected.note
  }, [selected, values])

  const missing = resolvedFields.filter((f) => f.required && !values[f.key]?.trim())
  const sizeNote = result?.params?.size

  // 自定义模板编辑器（新建 / 编辑）
  if (templateDialogOpen && editing) {
    return <TemplateEditor draft={editing} onClose={() => setEditing(null)} />
  }

  // 水仙提示词库浏览模式
  if (templateDialogOpen && selectedId === 'builtin-shuixian') {
    return (
      <Modal open onClose={() => store.closeTemplateDialog()} title="提示词模板" width="max-w-4xl">
        <ShuixianBrowser />
      </Modal>
    )
  }

  // 手绘风格配方库浏览模式
  if (templateDialogOpen && selectedId === 'builtin-handdrawn') {
    return (
      <Modal open onClose={() => store.closeTemplateDialog()} title="提示词模板" width="max-w-4xl">
        <HandDrawnBrowser />
      </Modal>
    )
  }

  // 科研图表配方库浏览模式
  if (templateDialogOpen && selectedId === 'builtin-vivid-chart') {
    return (
      <Modal open onClose={() => store.closeTemplateDialog()} title="提示词模板" width="max-w-4xl">
        <VividChartBrowser />
      </Modal>
    )
  }

  // 电商场景模板库浏览模式
  if (templateDialogOpen && selectedId === 'builtin-ecoskins') {
    return (
      <Modal open onClose={() => store.closeTemplateDialog()} title="提示词模板" width="max-w-4xl">
        <EcomSkinsBrowser />
      </Modal>
    )
  }

  // cc2image 模板大全浏览模式
  if (templateDialogOpen && selectedId === 'builtin-cc2lib') {
    return (
      <Modal open onClose={() => store.closeTemplateDialog()} title="提示词模板" width="max-w-4xl">
        <Cc2LibraryBrowser />
      </Modal>
    )
  }

  // GPT Image 2 精选画廊浏览模式
  if (templateDialogOpen && selectedId === 'builtin-wy-gallery') {
    return (
      <Modal open onClose={() => store.closeTemplateDialog()} title="提示词模板" width="max-w-4xl">
        <WyGalleryBrowser />
      </Modal>
    )
  }

  if (!templateDialogOpen) return null

  return (
    <Modal open onClose={() => store.closeTemplateDialog()} title="提示词模板" width="max-w-4xl">
      <div className="flex min-h-0 gap-4" style={{ height: '62vh' }}>
        {/* 模板列表 */}
        <div className="flex w-52 shrink-0 flex-col gap-1 overflow-y-auto">
          {/* 水仙提示词库入口 */}
          <button
            onClick={() => setSelectedId('builtin-shuixian')}
            className={`rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer ${
              selectedId === 'builtin-shuixian' ? 'border-accent bg-accent-soft' : 'border-line hover:bg-hover'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Library className="h-3.5 w-3.5 shrink-0 text-accent" />
              <span className="truncate text-xs font-medium text-ink">水仙提示词库</span>
            </div>
            <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-ink-3">
              6600+ 中文生图提示词，按分类检索、填参数即用（来自 shuixian-prompts 开源库）
            </div>
          </button>
          {/* 手绘风格配方库入口 */}
          <button
            onClick={() => setSelectedId('builtin-handdrawn')}
            className={`rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer ${
              selectedId === 'builtin-handdrawn' ? 'border-accent bg-accent-soft' : 'border-line hover:bg-hover'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5 shrink-0 text-accent" />
              <span className="truncate text-xs font-medium text-ink">手绘风格配方库</span>
            </div>
            <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-ink-3">
              23 个编号手绘画风配方（儿童涂色、蜡笔童涂、吉卜力、水墨、像素、皮影…），填主体即出中文 Prompt
            </div>
          </button>
          {/* cc2image 模板大全入口 */}
          <button
            onClick={() => setSelectedId('builtin-cc2lib')}
            className={`rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer ${
              selectedId === 'builtin-cc2lib' ? 'border-accent bg-accent-soft' : 'border-line hover:bg-hover'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 shrink-0 text-accent" />
              <span className="truncate text-xs font-medium text-ink">cc2image 模板大全</span>
            </div>
            <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-ink-3">
              13 分类 46 模板（UI / 信息图 / 海报 / 电商 / 品牌 / 摄影 / 插画…），编辑 [] 占位符即出 Prompt
            </div>
          </button>
          {/* GPT Image 2 精选画廊入口 */}
          <button
            onClick={() => setSelectedId('builtin-wy-gallery')}
            className={`rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer ${
              selectedId === 'builtin-wy-gallery' ? 'border-accent bg-accent-soft' : 'border-line hover:bg-hover'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent" />
              <span className="truncate text-xs font-medium text-ink">GPT Image 2 画廊</span>
            </div>
            <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-ink-3">
              171 条精选案例（动漫 / 摄影 / 海报 / 科研图表 / UI…）+ 18 条工艺原则，改主体即用
            </div>
          </button>
          {/* 电商场景模板库入口 */}
          <button
            onClick={() => setSelectedId('builtin-ecoskins')}
            className={`rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer ${
              selectedId === 'builtin-ecoskins' ? 'border-accent bg-accent-soft' : 'border-line hover:bg-hover'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <ShoppingBag className="h-3.5 w-3.5 shrink-0 text-accent" />
              <span className="truncate text-xs font-medium text-ink">电商场景模板库</span>
            </div>
            <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-ink-3">
              25 个电商场景模板（白底主图 / 场景图 / UGC / 直播…），hex 色 + 占比 + 留白铁律自动注入英文 Prompt
            </div>
          </button>
          {/* 科研图表配方库入口 */}
          <button
            onClick={() => setSelectedId('builtin-vivid-chart')}
            className={`rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer ${
              selectedId === 'builtin-vivid-chart' ? 'border-accent bg-accent-soft' : 'border-line hover:bg-hover'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5 shrink-0 text-accent" />
              <span className="truncate text-xs font-medium text-ink">科研图表配方库</span>
            </div>
            <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-ink-3">
              148 个数据图配方（构图 / 视觉特征 / 配色），填数据产出示意版图表生图 Prompt
            </div>
          </button>
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer ${
                t.id === selected.id ? 'border-accent bg-accent-soft' : 'border-line hover:bg-hover'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <BookMarked className="h-3.5 w-3.5 shrink-0 text-accent" />
                <span className="truncate text-xs font-medium text-ink">{t.name}</span>
              </div>
              <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-ink-3">{t.description}</div>
            </button>
          ))}
          <button
            onClick={() => setEditing('new')}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-2.5 text-xs text-ink-2 transition-colors hover:border-accent hover:text-accent cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" /> 新建自定义模板
          </button>
        </div>

        {/* 表单 + 预览 */}
        <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto pr-1 [&>*]:shrink-0">
          {selected && (
            <>
              {resolvedFields.map((f) => (
                <FieldRow key={f.key} field={f} value={values[f.key] ?? ''} onChange={(v) => setValue(f.key, v)} />
              ))}

              {/* 预览 */}
              <div className="rounded-lg border border-line">
                <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
                  <span className="text-[11px] font-medium text-ink-2">Prompt 预览</span>
                  {sizeNote && <span className="text-[11px] text-accent">填入后尺寸联动为 {sizeNote}</span>}
                </div>
                <pre className="log-font max-h-52 overflow-y-auto whitespace-pre-wrap px-3 py-2.5 text-ink-2">
                  {result?.prompt}
                </pre>
              </div>

              {/* 说明 */}
              {note && (
                <div className="rounded-lg bg-warn-soft px-3 py-2 text-[11px] leading-relaxed text-warn">{note}</div>
              )}

              {/* 操作 */}
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 text-[11px] text-ink-3">
                  {missing.length > 0
                    ? `待填写必填项：${missing.map((f) => f.label).join('、')}`
                    : '必填项已齐，可直接填入'}
                </div>
                <div className="flex shrink-0 gap-2">
                  {!selected.builtin && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setEditing(selected)}>
                        <Pencil className="h-3.5 w-3.5" /> 编辑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (window.confirm(`删除自定义模板「${selected.name}」？`)) {
                            void store.removeCustomTemplate(selected.id)
                            setSelectedId('builtin-ecom-pdp')
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> 删除
                      </Button>
                    </>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={missing.length > 0 || !result?.prompt.trim()}
                    onClick={() => {
                      if (result) store.applyPromptFill(result.prompt, result.params?.size)
                      store.closeTemplateDialog()
                    }}
                  >
                    <Check className="h-3.5 w-3.5" /> 填入提示词
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

function FieldRow({ field, value, onChange }: { field: TemplateField; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between gap-2">
        <span className="shrink-0 text-xs font-medium text-ink-2">
          {field.label}
          {field.required && <span className="ml-1 text-danger">*</span>}
        </span>
      </span>
      {field.type === 'textarea' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="min-h-16 w-full resize-y p-2.5 text-[13px] leading-relaxed placeholder:text-ink-3"
        />
      ) : field.type === 'select' ? (
        <Select value={value || (typeof field.options?.[0] === 'string' ? field.options[0] : field.options?.[0]?.value) || ''} options={(field.options ?? []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o))} onChange={onChange} />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="h-9 w-full px-3 text-[13px]"
        />
      )}
    </label>
  )
}

/* ---------------- 自定义模板编辑器 ---------------- */

const EMPTY_DRAFT = {
  name: '',
  description: '',
  fieldsDef: 'headline|图内主文案|text\nscene|画面场景描述|textarea',
  body:
    'Photorealistic image. Scene: {{scene}}.\nOn-image headline: "{{headline}}".\nClean layout with short readable text, concise labels only, uncluttered composition.',
}

export function TemplateEditor({ draft, onClose }: { draft: CustomTemplate | 'new'; onClose: () => void }) {
  const isNew = draft === 'new'
  const [form, setForm] = useState(() =>
    isNew
      ? { ...EMPTY_DRAFT }
      : {
          name: draft.name,
          description: draft.description,
          fieldsDef: draft.fields.map((f) => `${f.key}|${f.label}|${f.type}`).join('\n'),
          body: draft.body,
        },
  )
  const [error, setError] = useState<string | null>(null)

  const parseFields = (def: string): TemplateField[] | null => {
    const fields: TemplateField[] = []
    for (const line of def.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const [key, label, type, options] = trimmed.split('|').map((s) => s.trim())
      if (!key || !label) {
        setError(`字段行格式错误：${line}`)
        return null
      }
      if (!['text', 'textarea', 'select'].includes(type)) {
        setError(`字段 ${key} 的类型必须是 text / textarea / select`)
        return null
      }
      fields.push({
        key, label, type: type as TemplateField['type'],
        options: options ? options.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      })
    }
    if (fields.length === 0) {
      setError('至少定义一个字段')
      return null
    }
    setError(null)
    return fields
  }

  const preview = useMemo(() => {
    const fields = parseFields(form.fieldsDef)
    if (!fields) return null
    const values: Record<string, string> = {}
    for (const f of fields) values[f.key] = `【${f.label}】`
    return form.body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => values[key] ?? `{{${key}}}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.fieldsDef, form.body])

  const save = async () => {
    const fields = parseFields(form.fieldsDef)
    if (!fields) return
    if (!form.name.trim()) {
      setError('请填写模板名称')
      return
    }
    // 校验正文占位符都有对应字段
    const keys = new Set(fields.map((f) => f.key))
    const orphans = [...form.body.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).filter((k) => !keys.has(k))
    if (orphans.length > 0) {
      setError(`正文中存在未定义的占位符：{{${orphans.join('}} {{')}}}`)
      return
    }
    const t: CustomTemplate = {
      id: isNew ? uid('tpl_') : (draft as CustomTemplate).id,
      name: form.name.trim(),
      description: form.description.trim(),
      fields,
      body: form.body,
      builtin: false,
      createdAt: isNew ? Date.now() : (draft as CustomTemplate).createdAt,
    }
    await store.saveCustomTemplate(t)
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={isNew ? '新建自定义模板' : '编辑自定义模板'} width="max-w-2xl">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-2">模板名称 *</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9 w-full px-3 text-[13px]" placeholder="例：小红书种草图" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-2">一句话描述</span>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="h-9 w-full px-3 text-[13px]" placeholder="模板用途说明" />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-2">
            字段定义 * <span className="font-normal text-ink-3">每行一个：key|标签|类型[,选项1,选项2]（类型：text / textarea / select）</span>
          </span>
          <textarea
            value={form.fieldsDef}
            onChange={(e) => setForm({ ...form, fieldsDef: e.target.value })}
            className="log-font min-h-16 w-full resize-y p-2.5"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-2">
            模板正文 * <span className="font-normal text-ink-3">用 {'{{key}}'} 引用字段，产出即最终提示词</span>
          </span>
          <textarea
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            className="log-font min-h-32 w-full resize-y p-2.5"
          />
        </label>

        {preview && (
          <div className="rounded-lg border border-line">
            <div className="border-b border-line px-3 py-1.5 text-[11px] font-medium text-ink-2">预览（占位符示例值）</div>
            <pre className="log-font max-h-28 overflow-y-auto whitespace-pre-wrap px-3 py-2 text-ink-2">{preview}</pre>
          </div>
        )}
        {error && <div className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{error}</div>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button variant="primary" onClick={() => void save()}>
            <Check className="h-3.5 w-3.5" /> 保存模板
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/* ---------------- 水仙提示词库浏览 ---------------- */

const PAGE_SIZE = 60

function ShuixianBrowser() {
  const { shuixian } = useStore()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [selected, setSelected] = useState<ShuixianPrompt | null>(null)
  const [argValues, setArgValues] = useState<Record<string, Record<string, string>>>({})
  const [imgFailed, setImgFailed] = useState(false)

  const categoryOptions = useMemo(() => {
    const entries = Object.entries(shuixian.categories)
    entries.sort((a, b) => b[1].count - a[1].count)
    return entries.map(([name, meta]) => ({ value: name, label: `${name}（${meta.count}）` }))
  }, [shuixian.categories])

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase()
    return shuixian.prompts.filter((p) => {
      if (category && p.category !== category) return false
      if (kw && !(p.title.toLowerCase().includes(kw) || p.prompt.toLowerCase().includes(kw))) return false
      return true
    })
  }, [shuixian.prompts, search, category])

  const args = selected ? parseShuixianArguments(selected.prompt) : []
  const selValues = selected ? (argValues[String(selected.id)] ?? {}) : {}
  const setArg = (name: string, v: string) => {
    if (!selected) return
    setArgValues((m) => ({ ...m, [String(selected.id)]: { ...(m[String(selected.id)] ?? {}), [name]: v } }))
  }
  const rendered = selected ? renderShuixianPrompt(selected.prompt, selValues) : ''
  const selectedImg = selected && !imgFailed ? shuixianImageUrl(selected.id) : null

  // 切换提示词时重置示例图状态
  const pickPrompt = (p: ShuixianPrompt) => {
    setSelected(p)
    setImgFailed(false)
  }

  return (
    <div className="flex min-h-0 gap-4" style={{ height: '62vh' }}>
      {/* 左：检索 + 列表 */}
      <div className="flex w-72 shrink-0 flex-col gap-2.5">
        {shuixian.status === 'loaded' ? (
          <>
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setLimit(PAGE_SIZE)
              }}
              placeholder="搜索标题或提示词…"
              className="h-8 w-full px-2.5 text-xs"
            />
            <Select
              size="sm"
              value={category}
              options={[{ value: '', label: `全部分类（${shuixian.prompts.length}）` }, ...categoryOptions]}
              onChange={(v) => {
                setCategory(v)
                setLimit(PAGE_SIZE)
              }}
            />
            <div className="text-[11px] text-ink-3">
              {filtered.length} 条结果{filtered.length > limit ? '，仅显示前 ' + limit + ' 条' : ''}
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {filtered.slice(0, limit).map((p) => (
                <button
                  key={p.id}
                  onClick={() => pickPrompt(p)}
                  className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors cursor-pointer ${
                    selected?.id === p.id ? 'border-accent bg-accent-soft' : 'border-line hover:bg-hover'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-ink">{p.title}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-ink-3">
                      <span className="rounded bg-subtle px-1 py-px">{p.category}</span>
                      {p.likes > 0 && <span>♥ {p.likes}</span>}
                    </span>
                  </span>
                </button>
              ))}
              {filtered.length > limit && (
                <button
                  onClick={() => setLimit((l) => l + PAGE_SIZE)}
                  className="w-full rounded-lg border border-line py-2 text-xs text-ink-2 hover:bg-hover cursor-pointer"
                >
                  加载更多（还有 {filtered.length - limit} 条）
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line px-4 text-center">
            {shuixian.status === 'loading' ? (
              <>
                <div className="text-xs text-ink-2">正在拉取提示词库（约 14MB，一次性）…</div>
                <div className="text-[11px] text-ink-3">来源 raw.githubusercontent / jsDelivr 双源回退，完成后本地缓存</div>
              </>
            ) : shuixian.status === 'error' ? (
              <>
                <div className="text-xs text-danger break-all">拉取失败：{shuixian.error}</div>
                <Button variant="default" size="sm" onClick={() => void store.loadShuixianLibrary()}>重试</Button>
              </>
            ) : (
              <>
                <Library className="h-6 w-6 text-ink-3" />
                <div className="text-xs leading-relaxed text-ink-2">
                  拉取「水仙提示词库」6600+ 条中文生图提示词（含分类与示例图），
                  一次性下载后缓存到本浏览器，之后离线可用。
                </div>
                <Button variant="primary" size="sm" onClick={() => void store.loadShuixianLibrary()}>
                  拉取提示词库
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 右：详情 + 填参 */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto pr-1 [&>*]:shrink-0">
        {selected ? (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-ink">{selected.title}</div>
                <div className="mt-0.5 text-[11px] text-ink-3">
                  分类：{selected.category}
                  {selected.likes > 0 ? ` · ♥ ${selected.likes}` : ''}
                </div>
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

            {/* 示例图（懒加载单张） */}
            {selectedImg && (
              <div className="flex justify-center rounded-lg border border-line bg-subtle/50 p-2">
                <img
                  src={selectedImg}
                  alt="示例图"
                  onError={() => setImgFailed(true)}
                  className="max-h-64 rounded-md object-contain"
                  loading="lazy"
                />
              </div>
            )}

            {/* 可填参数 */}
            {args.length > 0 && (
              <div className="space-y-2.5">
                <div className="text-xs font-medium text-ink-2">可填参数（留空用默认值）</div>
                {args.map((a) => (
                  <label key={a.name} className="flex flex-col gap-1.5">
                    <span className="text-[11px] text-ink-3">
                      {a.name}
                      {a.defaultValue && <span className="ml-1">默认：{a.defaultValue.slice(0, 30)}{a.defaultValue.length > 30 ? '…' : ''}</span>}
                    </span>
                    {a.defaultValue.length > 40 ? (
                      <textarea
                        value={selValues[a.name] ?? ''}
                        onChange={(e) => setArg(a.name, e.target.value)}
                        placeholder={a.defaultValue}
                        className="min-h-14 w-full resize-y p-2.5 text-[13px] leading-relaxed placeholder:text-ink-3"
                      />
                    ) : (
                      <input
                        value={selValues[a.name] ?? ''}
                        onChange={(e) => setArg(a.name, e.target.value)}
                        placeholder={a.defaultValue}
                        className="h-9 w-full px-3 text-[13px]"
                      />
                    )}
                  </label>
                ))}
              </div>
            )}

            {/* 最终提示词预览 */}
            <div className="rounded-lg border border-line">
              <div className="border-b border-line px-3 py-1.5 text-[11px] font-medium text-ink-2">最终提示词</div>
              <pre className="log-font max-h-52 overflow-y-auto whitespace-pre-wrap px-3 py-2.5 text-ink-2">{rendered}</pre>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-3">
            <Library className="h-6 w-6" />
            <p className="text-xs">{shuixian.status === 'loaded' ? '从左侧选择一条提示词' : '先拉取提示词库，再从左侧选择'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
