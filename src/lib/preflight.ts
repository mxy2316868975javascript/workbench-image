/**
 * 提交预检：纯函数，不访问网络、不写状态。
 * error 阻断提交并给出修复动作；warn 只提示，不拦。
 */
import type {
  ConnectionState,
  GenParams,
  PreflightEstimate,
  PreflightIssue,
  PreflightResult,
  Settings,
  StorageUsage,
} from './types'
import { validateRefBlobs } from './refs'

export interface PreflightInput {
  prompt: string
  params: GenParams
  count: number
  refs: Blob[]
  settings: Settings
  connection: ConnectionState
  storage?: StorageUsage | null
  /** 近期同模型/同尺寸成功任务的耗时（毫秒） */
  durations?: number[]
  concurrency: number
}

const FALLBACK_MS = 45_000

function isValidBaseUrl(value: string): boolean {
  const v = value.trim()
  if (!v) return false
  if (v.startsWith('/')) return true
  try {
    const u = new URL(v)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function round5(seconds: number): number {
  return Math.max(5, Math.round(seconds / 5) * 5)
}

function formatEstimate(minSec: number, maxSec: number): string {
  if (maxSec < 90) return `约 ${minSec}–${maxSec} 秒`
  const min = Math.max(1, Math.round(minSec / 60))
  const max = Math.max(min + 1, Math.round(maxSec / 60))
  return `约 ${min}–${max} 分钟`
}

export function estimateDuration(
  count: number,
  concurrency: number,
  durations: number[] = [],
): PreflightEstimate {
  const perImage = median(durations.filter((n) => Number.isFinite(n) && n > 0)) ?? FALLBACK_MS
  const safeCount = Number.isFinite(count) ? Math.min(10, Math.max(1, count)) : 1
  const safeConcurrency = Number.isFinite(concurrency) ? Math.max(1, concurrency) : 1
  const waves = Math.ceil(safeCount / safeConcurrency)
  const baseSec = (waves * perImage) / 1000
  const minSec = round5(baseSec * 0.8)
  const maxSec = Math.max(minSec + 5, round5(baseSec * 1.4))
  return { minSec, maxSec, label: formatEstimate(minSec, maxSec) }
}

export function preflightGeneration(input: PreflightInput): PreflightResult {
  const { prompt, count, refs, settings, connection, storage, concurrency } = input
  const issues: PreflightIssue[] = []

  if (!prompt.trim()) {
    issues.push({ id: 'prompt-empty', level: 'error', message: '先输入提示词' })
  } else if (prompt.length > 8000) {
    issues.push({
      id: 'prompt-long',
      level: 'warn',
      message: `提示词 ${prompt.length} 字符，部分模型可能截断`,
    })
  }

  const baseUrl = settings.baseUrl.trim()
  const apiKey = settings.apiKey.trim()
  const model = settings.model.trim()
  const configOk = !!baseUrl && !!apiKey && !!model

  if (!baseUrl) {
    issues.push({
      id: 'base-url-empty',
      level: 'error',
      message: '还没有配置端点地址',
      fix: { label: '去设置', kind: 'settings' },
    })
  } else if (!isValidBaseUrl(baseUrl)) {
    issues.push({
      id: 'base-url-invalid',
      level: 'error',
      message: '端点地址格式不对，需要 http(s):// 或 / 开头的路径',
      fix: { label: '去设置', kind: 'settings' },
    })
  }

  if (!apiKey) {
    issues.push({
      id: 'api-key-empty',
      level: 'error',
      message: 'API Key 为空',
      fix: { label: '去设置', kind: 'settings' },
    })
  }

  if (!model) {
    issues.push({
      id: 'model-empty',
      level: 'error',
      message: '模型名称为空',
      fix: { label: '去设置', kind: 'settings' },
    })
  }

  if (input.params.background === 'transparent' && input.params.output_format === 'jpeg') {
    issues.push({
      id: 'transparent-jpeg',
      level: 'error',
      message: '透明背景不支持 JPEG',
      fix: { label: '改为 PNG', kind: 'set-png' },
    })
  }

  if (!Number.isFinite(count) || count < 1 || count > 10 || Math.round(count) !== count) {
    issues.push({ id: 'count-invalid', level: 'error', message: '张数需要在 1–10 之间' })
  }

  const refCheck = validateRefBlobs(refs)
  if (!refCheck.ok) {
    issues.push({
      id: 'refs-invalid',
      level: 'error',
      message: refCheck.message ?? '参考图不符合要求',
      fix: { label: '清空参考图', kind: 'clear-refs' },
    })
  }

  if (configOk && connection.status === 'fail') {
    issues.push({
      id: 'connection-fail',
      level: 'warn',
      message: connection.error ? `上次连接失败：${connection.error}` : '上次连接失败，仍可尝试',
    })
  }

  if (storage && storage.quota > 0) {
    const ratio = storage.usage / storage.quota
    if (ratio >= 0.9) {
      issues.push({
        id: 'storage-full',
        level: 'warn',
        message: `本地存储已用 ${Math.round(ratio * 100)}%，生成后可能无法保存`,
        fix: { label: '清理历史', kind: 'open-storage' },
      })
    }
  }

  const estimate = estimateDuration(count, concurrency, input.durations)
  return { ok: !issues.some((i) => i.level === 'error'), issues, estimate }
}
