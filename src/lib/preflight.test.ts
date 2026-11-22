import { describe, expect, it } from 'vitest'
import { estimateDuration, preflightGeneration, type PreflightInput } from './preflight'
import type { GenParams, Settings } from './types'

const params: GenParams = {
  size: '1024x1024',
  quality: 'high',
  background: 'auto',
  output_format: 'png',
}

const settings: Settings = {
  baseUrl: 'http://localhost:5173/v1',
  apiKey: 'test-key',
  model: 'gpt-image-1',
  concurrency: 2,
  autoRetry: true,
  defaultParams: params,
}

function input(overrides: Partial<PreflightInput> = {}): PreflightInput {
  return {
    prompt: 'a cat sitting on a chair',
    params,
    count: 1,
    refs: [],
    settings,
    connection: { status: 'ok' },
    storage: null,
    durations: [],
    concurrency: 2,
    ...overrides,
  }
}

const ids = (result: ReturnType<typeof preflightGeneration>) => result.issues.map((i) => i.id)

describe('preflightGeneration', () => {
  it('正常输入通过，并给出预估', () => {
    const result = preflightGeneration(input())
    expect(result.ok).toBe(true)
    expect(result.issues).toEqual([])
    expect(result.estimate.minSec).toBeGreaterThan(0)
    expect(result.estimate.maxSec).toBeGreaterThan(result.estimate.minSec)
  })

  it('空提示词阻断', () => {
    const result = preflightGeneration(input({ prompt: '   ' }))
    expect(result.ok).toBe(false)
    expect(ids(result)).toContain('prompt-empty')
  })

  it('过长的提示词只警告', () => {
    const result = preflightGeneration(input({ prompt: 'x'.repeat(8001) }))
    expect(result.ok).toBe(true)
    expect(ids(result)).toContain('prompt-long')
  })

  it('端点、Key、模型都检查', () => {
    const result = preflightGeneration(
      input({ settings: { ...settings, baseUrl: 'not-a-url', apiKey: '', model: '' } }),
    )
    expect(ids(result)).toEqual(expect.arrayContaining(['base-url-invalid', 'api-key-empty', 'model-empty']))
    expect(result.ok).toBe(false)
  })

  it('透明背景 + JPEG 阻断，并给出修复动作', () => {
    const result = preflightGeneration(
      input({ params: { ...params, background: 'transparent', output_format: 'jpeg' } }),
    )
    expect(result.ok).toBe(false)
    const issue = result.issues.find((i) => i.id === 'transparent-jpeg')
    expect(issue?.fix).toEqual({ label: '改为 PNG', kind: 'set-png' })
  })

  it('张数必须在 1-10 的整数范围', () => {
    for (const count of [0, 11, 1.5, Number.NaN]) {
      const result = preflightGeneration(input({ count }))
      expect(result.ok).toBe(false)
      expect(ids(result)).toContain('count-invalid')
    }
  })

  it('参考图超过 4 张阻断', () => {
    const refs = Array.from({ length: 5 }, () => new Blob(['x'], { type: 'image/png' }))
    const result = preflightGeneration(input({ refs }))
    expect(result.ok).toBe(false)
    expect(ids(result)).toContain('refs-invalid')
  })

  it('连接失败只警告，不阻断', () => {
    const result = preflightGeneration(
      input({ connection: { status: 'fail', error: 'connection refused' } }),
    )
    expect(result.ok).toBe(true)
    expect(ids(result)).toContain('connection-fail')
    expect(result.issues.find((i) => i.id === 'connection-fail')?.level).toBe('warn')
  })

  it('存储接近上限时警告', () => {
    const result = preflightGeneration(input({ storage: { usage: 95, quota: 100 } }))
    expect(result.ok).toBe(true)
    expect(result.issues.find((i) => i.id === 'storage-full')?.level).toBe('warn')
  })
})

describe('estimateDuration', () => {
  it('按并发波次和近期耗时估算', () => {
    const result = estimateDuration(1, 1, [30_000])
    expect(result.minSec).toBe(25)
    expect(result.maxSec).toBe(40)
    expect(result.label).toContain('秒')
  })

  it('没有历史耗时使用默认值，并换算成分钟', () => {
    const result = estimateDuration(4, 2)
    expect(result.label).toContain('分钟')
    expect(result.maxSec).toBeGreaterThan(result.minSec)
  })
})
