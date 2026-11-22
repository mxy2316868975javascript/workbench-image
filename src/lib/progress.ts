/**
 * 进度估算器。
 * 端点流式事件不含进度百分比，采用两层模型：
 *  1) 时间渐近曲线为主干：88% * (1 - e^(-t/40))，30s≈48%、60s≈74%、90s≈85%，封顶 88
 *  2) chunk 事件到包递增为辅：每个进度块 +0.4%，累计封顶 +6%
 * 最终封顶 96%（下载阶段 97%），100% 仅在完成时给出。
 */
export class ProgressEstimator {
  private startMs = Date.now()
  private extra = 0
  private manualFloor = 0

  /** 收到一个进度块（SSE chunk / 里程碑） */
  bump(delta = 0.4, cap = 6): void {
    this.extra = Math.min(cap, this.extra + delta)
  }

  /** 直接抬升下限（如进入下载阶段） */
  floor(v: number): void {
    this.manualFloor = Math.max(this.manualFloor, v)
  }

  current(): number {
    const elapsed = (Date.now() - this.startMs) / 1000
    const curve = 88 * (1 - Math.exp(-elapsed / 40))
    return Math.round(Math.min(96, Math.max(2, curve + this.extra, this.manualFloor)))
  }

  elapsedMs(): number {
    return Date.now() - this.startMs
  }

  finish(): number {
    return 100
  }
}
