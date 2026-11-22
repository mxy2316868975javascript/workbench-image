/** 端点连通性探测：GET {baseUrl}/models，供设置页与提交预检共用 */
export interface ModelsProbe {
  status: 'ok' | 'unknown' | 'fail'
  models: string[]
  message?: string
}

const TIMEOUT_MS = 5000

export async function fetchModels(
  baseUrl: string,
  apiKey: string,
  timeoutMs = TIMEOUT_MS,
): Promise<ModelsProbe> {
  const base = baseUrl.trim().replace(/\/+$/, '')
  if (!base) return { status: 'fail', models: [], message: '端点地址为空' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${base}/models`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      signal: controller.signal,
    })
    // 部分端点不实现 /models，不能据此判断端点不可用
    if (res.status === 404) {
      return { status: 'unknown', models: [], message: '端点不支持 /models' }
    }
    if (!res.ok) {
      return { status: 'fail', models: [], message: `HTTP ${res.status}` }
    }
    const json = await res.json().catch(() => null)
    const data = Array.isArray(json?.data) ? json.data : []
    const models: string[] = data.map((m: unknown) => (m as { id?: unknown })?.id).filter(Boolean) as string[]
    return { status: 'ok', models }
  } catch (err) {
    const aborted = (err as Error)?.name === 'AbortError'
    const message = aborted ? `连接超时（${Math.round(timeoutMs / 1000)}s）` : err instanceof Error ? err.message : String(err)
    return { status: 'fail', models: [], message }
  } finally {
    clearTimeout(timer)
  }
}
