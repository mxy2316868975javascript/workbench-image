import { describe, expect, it } from 'vitest'
import { draftHasContent, formatDraftTime, sanitizeDraft } from './draft'

describe('sanitizeDraft', () => {
  it('拒绝非对象和缺失提示词', () => {
    expect(sanitizeDraft(null)).toBeNull()
    expect(sanitizeDraft('x')).toBeNull()
    expect(sanitizeDraft({})).toBeNull()
    expect(sanitizeDraft({ prompt: 123 })).toBeNull()
  })

  it('非法参数回退默认值，张数夹到 1-10', () => {
    const result = sanitizeDraft({
      prompt: 'hello',
      params: { size: 'bad', quality: 'bad', background: 'bad', output_format: 'bad' },
      count: 99,
      updatedAt: 123,
    })
    expect(result?.draft.params).toEqual({
      size: '1024x1024',
      quality: 'high',
      background: 'auto',
      output_format: 'png',
    })
    expect(result?.draft.count).toBe(10)
    expect(result?.draft.updatedAt).toBe(123)
  })

  it('丢弃无效参考图并记录数量', () => {
    const result = sanitizeDraft({
      prompt: 'hello',
      refImages: [
        new Blob(['a'], { type: 'image/png' }),
        new Blob(['b'], { type: 'text/plain' }),
        'not a blob',
      ],
      count: 1,
    })
    expect(result?.draft.refImages).toHaveLength(1)
    expect(result?.droppedRefs).toBe(2)
  })

  it('只保留有效 source 字段', () => {
    const result = sanitizeDraft({
      prompt: 'hello',
      source: { templateId: 't1', templateName: 2 },
    })
    expect(result?.draft.source).toEqual({ templateId: 't1', templateName: undefined })
  })
})

describe('draftHasContent', () => {
  const base = {
    version: 1 as const,
    prompt: '',
    params: { size: '1024x1024', quality: 'high', background: 'auto', output_format: 'png' },
    count: 1,
    refImages: [],
    updatedAt: 0,
  }

  it('只有提示词、参考图或非默认张数才算有内容', () => {
    expect(draftHasContent(base)).toBe(false)
    expect(draftHasContent({ ...base, prompt: 'x' })).toBe(true)
    expect(draftHasContent({ ...base, count: 2 })).toBe(true)
    expect(draftHasContent({ ...base, refImages: [new Blob(['a'], { type: 'image/png' })] })).toBe(true)
  })
})

describe('formatDraftTime', () => {
  it('输出本地时间字符串', () => {
    expect(formatDraftTime(Date.UTC(2026, 0, 1, 12, 34))).toMatch(/\d{2}:\d{2}/)
  })
})
