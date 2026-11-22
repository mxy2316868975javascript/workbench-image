/**
 * 左栏草稿：文字/参数同步镜像到 localStorage，参考图 Blob 存 IndexedDB。
 * 目的：刷新、误关标签页、存储异常时尽量不丢用户输入。
 */
import { deleteComposerDraft, getComposerDraft, putComposerDraft } from './db'
import {
  BACKGROUND_OPTIONS,
  DEFAULT_PARAMS,
  FORMAT_OPTIONS,
  QUALITY_OPTIONS,
  SIZE_OPTIONS,
  type ComposerDraft,
  type GenParams,
} from './types'
import { MAX_REF_BYTES, MAX_REF_COUNT, MAX_REF_TOTAL_BYTES, isAcceptedRefType } from './refs'

const LS_KEY = 'image-workbench-composer'
const DRAFT_VERSION = 1 as const

const SIZES = new Set(SIZE_OPTIONS.map((o) => o.value))
const QUALITIES = new Set(QUALITY_OPTIONS.map((o) => o.value))
const BACKGROUNDS = new Set(BACKGROUND_OPTIONS.map((o) => o.value))
const FORMATS = new Set(FORMAT_OPTIONS.map((o) => o.value))

export interface SanitizedDraft {
  draft: ComposerDraft
  /** 恢复时被丢弃的参考图数量（损坏/超限/类型不支持） */
  droppedRefs: number
}

interface LocalMirror {
  version: number
  prompt: string
  params: GenParams
  count: number
  source?: ComposerDraft['source']
  updatedAt: number
}

function sanitizeParams(raw: unknown): GenParams {
  const p = (raw ?? {}) as Partial<GenParams>
  return {
    size: SIZES.has(p.size ?? '') ? p.size! : DEFAULT_PARAMS.size,
    quality: QUALITIES.has(p.quality ?? '') ? p.quality! : DEFAULT_PARAMS.quality,
    background: BACKGROUNDS.has(p.background ?? '') ? p.background! : DEFAULT_PARAMS.background,
    output_format: FORMATS.has(p.output_format ?? '') ? p.output_format! : DEFAULT_PARAMS.output_format,
  }
}

function sanitizeSource(raw: unknown): ComposerDraft['source'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const s = raw as { templateId?: unknown; templateName?: unknown }
  const templateId = typeof s.templateId === 'string' ? s.templateId : undefined
  const templateName = typeof s.templateName === 'string' ? s.templateName : undefined
  if (!templateId && !templateName) return undefined
  return { templateId, templateName }
}

function sanitizeRefImages(raw: unknown): { refs: Blob[]; dropped: number } {
  if (!Array.isArray(raw)) return { refs: [], dropped: 0 }
  const refs: Blob[] = []
  let dropped = 0
  let total = 0
  for (const item of raw) {
    if (!(item instanceof Blob)) {
      dropped++
      continue
    }
    if (!isAcceptedRefType(item.type) || item.size > MAX_REF_BYTES) {
      dropped++
      continue
    }
    if (refs.length >= MAX_REF_COUNT || total + item.size > MAX_REF_TOTAL_BYTES) {
      dropped++
      continue
    }
    refs.push(item)
    total += item.size
  }
  return { refs, dropped }
}

/** 校验并修复草稿结构；无法修复时返回 null */
export function sanitizeDraft(raw: unknown): SanitizedDraft | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<LocalMirror> & { refImages?: unknown }
  if (typeof r.prompt !== 'string') return null

  const { refs, dropped } = sanitizeRefImages(r.refImages)
  const count = Number.isFinite(r.count) ? Math.round(Number(r.count)) : 1
  const updatedAt = Number.isFinite(r.updatedAt) ? Number(r.updatedAt) : Date.now()

  return {
    draft: {
      version: DRAFT_VERSION,
      prompt: r.prompt,
      params: sanitizeParams(r.params),
      count: Math.min(10, Math.max(1, count)),
      refImages: refs,
      source: sanitizeSource(r.source),
      updatedAt,
    },
    droppedRefs: dropped,
  }
}

/** 同步读取 localStorage 镜像：只含文字/参数，不含参考图 */
export function readLocalDraft(): SanitizedDraft | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return sanitizeDraft(parsed)
  } catch {
    return null
  }
}

/** 读取 IndexedDB 完整草稿（含参考图） */
export async function readStoredDraft(): Promise<SanitizedDraft | null> {
  try {
    const raw = await getComposerDraft()
    return raw ? sanitizeDraft(raw) : null
  } catch {
    return null
  }
}

function writeLocalDraft(draft: ComposerDraft): boolean {
  try {
    const mirror: LocalMirror = {
      version: DRAFT_VERSION,
      prompt: draft.prompt,
      params: draft.params,
      count: draft.count,
      source: draft.source,
      updatedAt: draft.updatedAt,
    }
    localStorage.setItem(LS_KEY, JSON.stringify(mirror))
    return true
  } catch {
    return false
  }
}

/** 同时写 localStorage 与 IndexedDB；两者都失败才算彻底失败 */
export async function persistDraft(draft: ComposerDraft): Promise<{ local: boolean; idb: boolean }> {
  const local = writeLocalDraft(draft)
  let idb = false
  try {
    await putComposerDraft(draft)
    idb = true
  } catch {
    idb = false
  }
  return { local, idb }
}

/** 页面隐藏/卸载时调用：localStorage 同步写，IndexedDB 尽力而为 */
export function flushDraft(draft: ComposerDraft): void {
  writeLocalDraft(draft)
  void putComposerDraft(draft).catch(() => {
    /* 配额或隐私模式失败时忽略，localStorage 镜像仍在 */
  })
}

export async function clearDraft(): Promise<void> {
  try {
    localStorage.removeItem(LS_KEY)
  } catch {
    /* 忽略 */
  }
  try {
    await deleteComposerDraft()
  } catch {
    /* 忽略 */
  }
}

/**
 * 清空草稿：同步写一个空的本地镜像作为"已清空"标记，再尽力删除 IndexedDB。
 * 这样即使删除失败，下次启动也不会把旧草稿恢复出来（本地镜像的 updatedAt 更新）。
 */
export function markDraftEmpty(): void {
  writeLocalDraft({
    version: DRAFT_VERSION,
    prompt: '',
    params: { ...DEFAULT_PARAMS },
    count: 1,
    refImages: [],
    updatedAt: Date.now(),
  })
  void deleteComposerDraft().catch(() => {
    /* 删除失败时由空镜像兜底 */
  })
}

/** 只有提示词、参考图或张数才算“有内容”；单纯改参数不单独落草稿 */
export function draftHasContent(draft: ComposerDraft): boolean {
  return draft.prompt.trim().length > 0 || draft.refImages.length > 0 || draft.count !== 1
}

export function formatDraftTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}
