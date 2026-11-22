import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProgressEstimator } from './progress'

describe('ProgressEstimator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('起步有 2% 下限，随时间沿曲线增长但不超过 96%', () => {
    const p = new ProgressEstimator()
    expect(p.current()).toBe(2)

    vi.advanceTimersByTime(40_000)
    const at40s = p.current()
    expect(at40s).toBeGreaterThan(50)
    expect(at40s).toBeLessThan(70)

    vi.advanceTimersByTime(10 * 60_000)
    expect(p.current()).toBe(88)
    p.floor(96)
    expect(p.current()).toBe(96)
  })

  it('chunk 递增有上限，不会把进度推过 96%', () => {
    const p = new ProgressEstimator()
    for (let i = 0; i < 100; i++) p.bump()
    expect(p.current()).toBe(6) // 2 的下限之上 +6 封顶
    expect(p.current()).toBeLessThanOrEqual(96)
  })

  it('floor 只升不降，且仍受 96% 封顶', () => {
    const p = new ProgressEstimator()
    p.floor(97)
    expect(p.current()).toBe(96)
    p.floor(10)
    expect(p.current()).toBe(96)
  })

  it('elapsedMs 与 finish', () => {
    const p = new ProgressEstimator()
    vi.advanceTimersByTime(1_500)
    expect(p.elapsedMs()).toBe(1_500)
    expect(p.finish()).toBe(100)
  })
})
