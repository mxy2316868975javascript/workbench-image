/**
 * 提示词模板对话框：选择模板 → 填字段 → 实时预览 Prompt → 填入生成面板。
 * 内置模板（如 ecom-pdp）由代码构建；自定义模板存 IndexedDB，正文用 {{key}} 占位。
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { BookMarked, BookOpen, Brush, Check, Palette, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import { store, useStore } from '../store/store'
import { getAllTemplates, renderCustomTemplate } from '../lib/templates'
import type { CustomTemplate, TemplateField } from '../lib/types'
import { uid } from '../lib/image-utils'
import { Button, Modal, Select } from './ui'
import { HandDrawnBrowser } from './HandDrawnBrowser'
import { HuashuStyleBrowser } from './HuashuStyleBrowser'
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

  // 关闭后回到模板列表，避免下次打开仍停在某个库
  useEffect(() => {
    if (!templateDialogOpen) setSelectedId(templates[0]?.id)
  }, [templateDialogOpen, templates])

  // 库浏览页统一带返回箭头，返回时回到模板列表
  const libraryShell = (child: ReactNode) => (
    <Modal
      open
      onClose={() => store.closeTemplateDialog()}
      onBack={() => setSelectedId(templates[0]?.id)}
      title="提示词模板"
      width="max-w-4xl"
    >
      {child}
    </Modal>
  )

  // 自定义模板编辑器（新建 / 编辑）
  if (templateDialogOpen && editing) {
    return <TemplateEditor draft={editing} onClose={() => setEditing(null)} />
  }

  // 手绘风格配方库浏览模式
  if (templateDialogOpen && selectedId === 'builtin-handdrawn') return libraryShell(<HandDrawnBrowser />)

  // 花叔 Design 风格库浏览模式
  if (templateDialogOpen && selectedId === 'builtin-huashu') return libraryShell(<HuashuStyleBrowser />)

  // cc2image 模板大全浏览模式
  if (templateDialogOpen && selectedId === 'builtin-cc2lib') return libraryShell(<Cc2LibraryBrowser />)

  // GPT Image 2 精选画廊浏览模式
  if (templateDialogOpen && selectedId === 'builtin-wy-gallery') return libraryShell(<WyGalleryBrowser />)

  if (!templateDialogOpen) return null

  return (
    <Modal open onClose={() => store.closeTemplateDialog()} title="提示词模板" width="max-w-4xl">
      <div className="flex min-h-0 gap-4" style={{ height: '62vh' }}>
        {/* 模板列表 */}
        <div className="flex w-52 shrink-0 flex-col gap-1 overflow-y-auto">
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
          {/* 花叔 Design 风格库入口 */}
          <button
            onClick={() => setSelectedId('builtin-huashu')}
            className={`rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer ${
              selectedId === 'builtin-huashu' ? 'border-accent bg-accent-soft' : 'border-line hover:bg-hover'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Brush className="h-3.5 w-3.5 shrink-0 text-accent" />
              <span className="truncate text-xs font-medium text-ink">花叔 Design 风格库</span>
            </div>
            <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-ink-3">
              92 种设计风格 + 9 款 AI 生图风格，按「Mood, Not Layout」产出短 Prompt
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
              <div className="border-t border-line pt-2 text-[10px] leading-relaxed text-ink-3">
                内置模板整理自第三方开源项目，版权归原作者所有。
                <a
                  href="https://github.com/mxy2316868975javascript/workbench-image/blob/main/THIRD_PARTY_NOTICES.md"
                  target="_blank"
                  rel="noreferrer"
                  className="ml-1 underline decoration-line underline-offset-2 hover:text-accent"
                >
                  来源与许可
                </a>
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
