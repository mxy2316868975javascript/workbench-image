/**
 * 本地转发中间件：浏览器 → dev server →（HTTP/2）→ 上游模型端点
 *
 * 为什么不用 Vite 内置 proxy：部分端点（尤其 SSE 流式接口）只在 HTTP/2 上即时推送，
 * h1.1 下边缘节点不 flush，而 http-proxy 只支持 h1.1 上游。
 * 这里用 node:http2 直连上游并原样 pipe，SSE 无缓冲透传。
 * 中间件只做转发，不存储任何数据。
 *
 * 上游地址通过环境变量 RELAY_TARGET 配置，默认 https://api.openai.com。
 */
import http2 from 'node:http2'
import type { Plugin } from 'vite'
import { isLocalRelayRequest } from './relay-guard'

const RELAY_PREFIX = '/api/relay'
const DEFAULT_RELAY_TARGET = 'https://api.openai.com'

/** 逐跳头，h2 转发时必须去掉 */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
])

function filterHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}
  for (const [k, v] of Object.entries(headers)) {
    if (v === undefined) continue
    const key = k.toLowerCase()
    if (HOP_BY_HOP.has(key) || key.startsWith('proxy-')) continue
    out[k] = v
  }
  return out
}

function createRelayHandler(target: string) {
  return (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => {
    // 只接受本机回环请求，避免 dev/preview 被 --host 暴露后变成开放代理
    if (!isLocalRelayRequest(req)) {
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('relay only accepts local requests')
      return
    }

    // connect 风格挂载已剥掉 RELAY_PREFIX，req.url 即上游路径
    const upstreamPath = req.url ?? '/'
    const headers = filterHeaders(req.headers as Record<string, string | string[] | undefined>)

    const session = http2.connect(target)
    session.on('error', (err) => {
      if (!res.headersSent) {
        res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
        res.end(`relay upstream error: ${err.message}`)
      } else {
        res.end()
      }
      session.close()
    })

    const h2req = session.request({
      ':method': req.method ?? 'GET',
      ':path': upstreamPath,
      ...headers,
    } as import('node:http2').OutgoingHttpHeaders)

    // 请求体透传
    req.pipe(h2req)

    h2req.on('response', (respHeaders) => {
      const status = (respHeaders[':status'] as number) ?? 500
      const out: Record<string, string | string[]> = {}
      for (const [k, v] of Object.entries(respHeaders)) {
        if (k.startsWith(':') || k === 'content-length') continue // 长度交给 node 自行分块
        out[k] = v as string | string[]
      }
      res.writeHead(status, out)
      res.flushHeaders()
      h2req.pipe(res)
    })

    h2req.on('error', () => {
      if (!res.headersSent) {
        res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
        res.end('relay stream error')
      } else {
        res.end()
      }
    })

    const cleanup = () => {
      h2req.close()
      session.close()
    }
    res.on('close', cleanup)
    req.on('aborted', cleanup)
  }
}

export function llmRelayPlugin(target = process.env.RELAY_TARGET || DEFAULT_RELAY_TARGET): Plugin {
  const handler = createRelayHandler(target)
  return {
    name: 'llm-api-h2-relay',
    configureServer(server) {
      server.middlewares.use(RELAY_PREFIX, handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(RELAY_PREFIX, handler)
    },
  }
}
