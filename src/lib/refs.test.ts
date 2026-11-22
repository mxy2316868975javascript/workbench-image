import { describe, expect, it } from 'vitest'
import {
  isAcceptedRefType,
  normalizeRefFiles,
  validateRefBlobs,
  MAX_REF_BYTES,
  MAX_REF_COUNT,
} from './refs'

function file(name: string, type: string, size = 1024): File {
  return new File([new Uint8Array(size)], name, { type })
}

describe('参考图约束', () => {
  it('只接受 PNG / JPEG / WebP', () => {
    expect(isAcceptedRefType('image/png')).toBe(true)
    expect(isAcceptedRefType('image/jpeg')).toBe(true)
    expect(isAcceptedRefType('image/webp')).toBe(true)
    expect(isAcceptedRefType('image/gif')).toBe(false)
  })

  it('按扩展名推断缺失的 MIME 类型', () => {
    const result = normalizeRefFiles([file('a.PNG', ''), file('b.txt', 'text/plain')], [])
    expect(result.accepted).toHaveLength(1)
    expect(result.accepted[0].type).toBe('image/png')
    expect(result.rejected[0].reason).toContain('仅支持')
  })

  it('拒绝空文件、超大文件和超过数量的文件', () => {
    const existing = Array.from({ length: MAX_REF_COUNT }, (_, i) => file(`old-${i}.png`, 'image/png'))
    const result = normalizeRefFiles(
      [
        file('empty.png', 'image/png', 0),
        file('huge.png', 'image/png', MAX_REF_BYTES + 1),
        file('extra.png', 'image/png'),
      ],
      existing,
    )
    expect(result.accepted).toHaveLength(0)
    expect(result.rejected.map((r) => r.reason)).toEqual([
      '文件为空',
      `单张不能超过 ${Math.round(MAX_REF_BYTES / 1024 / 1024)}MB`,
      `最多 ${MAX_REF_COUNT} 张`,
    ])
  })

  it('校验已有 Blob 的类型、数量和大小', () => {
    expect(validateRefBlobs([new Blob(['a'], { type: 'image/png' })])).toEqual({ ok: true })
    expect(validateRefBlobs([new Blob(['a'], { type: 'text/plain' })])).toMatchObject({ ok: false })
    expect(
      validateRefBlobs(Array.from({ length: MAX_REF_COUNT + 1 }, () => new Blob(['a'], { type: 'image/png' }))),
    ).toMatchObject({ ok: false })
  })
})
