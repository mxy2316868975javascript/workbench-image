/** 图片工具：缩略图、下载、对象 URL */

const THUMB_MAX = 512

/** 生成缩略 Blob（最长边 512），用于历史列表快速渲染 */
export async function makeThumbBlob(blob: Blob): Promise<Blob | undefined> {
  try {
    const bitmap = await createImageBitmap(blob)
    const scale = Math.min(1, THUMB_MAX / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = new OffscreenCanvas(w, h)
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    return await canvas.convertToBlob({ type: 'image/webp', quality: 0.82 })
  } catch {
    return undefined
  }
}

/** 触发浏览器下载 */
export function downloadBlobAs(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  return `${m}m${Math.round(s - m * 60)}s`
}

export function formatTime(t: number): string {
  const d = new Date(t)
  const pad = (x: number, len = 2) => String(x).padStart(len, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function logTime(t: number): string {
  const d = new Date(t)
  const pad = (x: number, len = 2) => String(x).padStart(len, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

export function uid(prefix = ''): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}
