/** 参考图约束与归一化：类型推断、数量/体积上限、拒绝原因 */
export const MAX_REF_COUNT = 4
export const MAX_REF_BYTES = 20 * 1024 * 1024
export const MAX_REF_TOTAL_BYTES = 40 * 1024 * 1024

export const ACCEPTED_REF_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

export interface RefReject {
  name: string
  reason: string
}

const EXT_TYPE: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

export function isAcceptedRefType(type: string): boolean {
  return (ACCEPTED_REF_TYPES as readonly string[]).includes(type)
}

/** 文件 type 缺失时按扩展名推断；推断不了返回 null */
function coerceRefFile(f: File): Blob | null {
  if (isAcceptedRefType(f.type)) return f
  const ext = f.name.toLowerCase().split('.').pop() ?? ''
  const inferred = EXT_TYPE[ext]
  if (!inferred) return null
  try {
    return new File([f], f.name, { type: inferred })
  } catch {
    return new Blob([f], { type: inferred })
  }
}

/**
 * 归一化新增参考图：跳过空文件、超限、类型不支持、超过数量的文件，并返回可读的拒绝原因。
 * existing 用于计算已有数量与总体积。
 */
export function normalizeRefFiles(
  files: FileList | File[],
  existing: Blob[],
): { accepted: Blob[]; rejected: RefReject[] } {
  const list = Array.from(files as ArrayLike<File>)
  const accepted: Blob[] = []
  const rejected: RefReject[] = []
  let count = existing.length
  let totalBytes = existing.reduce((n, b) => n + b.size, 0)

  for (const f of list) {
    const name = f.name || '图片'
    if (!f.size) {
      rejected.push({ name, reason: '文件为空' })
      continue
    }
    if (f.size > MAX_REF_BYTES) {
      rejected.push({ name, reason: `单张不能超过 ${Math.round(MAX_REF_BYTES / 1024 / 1024)}MB` })
      continue
    }
    const coerced = coerceRefFile(f)
    if (!coerced) {
      rejected.push({ name, reason: '仅支持 PNG / JPEG / WebP' })
      continue
    }
    if (count >= MAX_REF_COUNT) {
      rejected.push({ name, reason: `最多 ${MAX_REF_COUNT} 张` })
      continue
    }
    if (totalBytes + coerced.size > MAX_REF_TOTAL_BYTES) {
      rejected.push({ name, reason: `参考图总大小不能超过 ${Math.round(MAX_REF_TOTAL_BYTES / 1024 / 1024)}MB` })
      continue
    }
    accepted.push(coerced)
    count++
    totalBytes += coerced.size
  }

  return { accepted, rejected }
}

/** 校验已存在的 Blob（草稿恢复 / 历史回填），返回统一的中文原因 */
export function validateRefBlobs(refs: Blob[]): { ok: boolean; message?: string } {
  if (refs.length > MAX_REF_COUNT) return { ok: false, message: `参考图最多 ${MAX_REF_COUNT} 张` }
  let total = 0
  for (const b of refs) {
    if (!isAcceptedRefType(b.type)) return { ok: false, message: '参考图仅支持 PNG / JPEG / WebP' }
    if (b.size > MAX_REF_BYTES) {
      return { ok: false, message: `单张参考图不能超过 ${Math.round(MAX_REF_BYTES / 1024 / 1024)}MB` }
    }
    total += b.size
  }
  if (total > MAX_REF_TOTAL_BYTES) {
    return { ok: false, message: `参考图总大小不能超过 ${Math.round(MAX_REF_TOTAL_BYTES / 1024 / 1024)}MB` }
  }
  return { ok: true }
}
