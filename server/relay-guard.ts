/**
 * relay 访问守卫：本地开发转发器只允许回环地址访问，避免 preview --host 或反代把
 * /api/relay 暴露成开放代理。
 */
import type { IncomingMessage } from 'node:http'

const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

/** Host / Origin 里的主机名是否为本机回环名 */
export function isLoopbackHostname(hostname: string): boolean {
  const name = hostname.toLowerCase()
  return name === 'localhost' || name === '127.0.0.1' || name === '::1' || name === '[::1]'
}

function parseHost(value: string): URL | null {
  try {
    return new URL(`http://${value}`)
  } catch {
    return null
  }
}

/**
 * 只接受本机回环请求：
 * - socket.remoteAddress 必须是 127.0.0.1 / ::1 / ::ffff:127.0.0.1
 * - Host 必须是 localhost / 127.0.0.1 / [::1]（可带端口）
 * - 带 Origin 时必须同为本机回环；没有 Origin 的本地 curl 放行
 * - 路径必须是 origin-form，拒绝 absolute-form 和 // 开头
 */
export function isLocalRelayRequest(
  req: Pick<IncomingMessage, 'socket' | 'headers' | 'url'>,
): boolean {
  const remote = req.socket.remoteAddress ?? ''
  if (!LOOPBACK_ADDRESSES.has(remote)) return false

  const hostHeader = req.headers.host
  if (typeof hostHeader !== 'string' || !hostHeader) return false
  const host = parseHost(hostHeader)
  if (!host || !isLoopbackHostname(host.hostname)) return false

  const origin = req.headers.origin
  if (origin !== undefined) {
    if (typeof origin !== 'string' || origin === 'null') return false
    let parsed: URL
    try {
      parsed = new URL(origin)
    } catch {
      return false
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
    if (!isLoopbackHostname(parsed.hostname)) return false
  }

  const url = req.url ?? ''
  if (!url.startsWith('/') || url.startsWith('//')) return false

  return true
}
