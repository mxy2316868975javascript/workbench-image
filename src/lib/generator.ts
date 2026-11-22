/**
 * 单张图片生成器。
 * 流程：POST /images/generations (stream:true) → SSE 事件解析 → 结果项（b64 或 URL）→ Blob。
 * 同时兼容两种事件风格：
 *  - 标准 OpenAI：image_generation.partial_image / image_generation.completed（b64_json）
 *  - 本端点代理：image.generation.chunk（纯进度块）+ image.generation.result（data[].url）
 * 若响应不是 event-stream，自动降级为普通 JSON 请求解析（进度退化为纯时间估算）。
 */
import { sseEvents } from './sse'
import { ProgressEstimator } from './progress'
import type { GenParams, LogLevel, Settings, UsageInfo } from './types'

export interface GenerateOptions {
  settings: Settings
  prompt: string
  params: GenParams
  signal: AbortSignal
  referenceImages?: Blob[] // 有参考图时走 /images/edits（图生图）
  log: (level: LogLevel, text: string) => void
  onProgress: (progress: number, phase: string) => void
  onPartial: (b64: string) => void
}

export interface GenerateResult {
  blob: Blob
  mime: string
  width: number
  height: number
  revisedPrompt?: string
  usage?: UsageInfo
  remoteUrl?: string
}

interface ResultItem {
  b64_json?: string
  url?: string
  revised_prompt?: string
}

/* ---------------- URL 工具 ---------------- */

function apiUrl(settings: Settings, path: string): string {
  const base = settings.baseUrl.replace(/\/+$/, '')
  return `${base}${path}`
}

/** 端点返回的图片 URL → 浏览器可 fetch 的地址（relay 模式走同源前缀，规避 CORS） */
function resolveAssetUrl(url: string, settings: Settings): string {
  try {
    const u = new URL(url, location.origin)
    const base = settings.baseUrl
    if (base.startsWith('/')) {
      // relay 模式：/api/relay/v1 → 前缀 /api/relay
      const relayPrefix = base.replace(/\/v1\/?$/, '')
      return relayPrefix + u.pathname
    }
    // 直连模式：绝对地址原样请求（依赖端点 CORS）
    return u.toString()
  } catch {
    return url
  }
}

/* ---------------- 结果处理 ---------------- */

function sniffMime(bytes: Uint8Array, fallback = 'image/png'): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png'
  if (bytes[0] === 0x52 && bytes[1] === 0x49) return 'image/webp' // RIFF
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif'
  return fallback
}

async function b64ToBlob(b64: string): Promise<{ blob: Blob; mime: string }> {
  const res = await fetch(`data:application/octet-stream;base64,${b64}`)
  const blob = await res.blob()
  const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer())
  return { blob, mime: sniffMime(head) }
}

async function downloadBlob(url: string, settings: Settings, signal: AbortSignal, log: GenerateOptions['log']): Promise<{ blob: Blob; mime: string }> {
  const target = resolveAssetUrl(url, settings)
  const shown = target.startsWith('/') ? target : url
  log('info', `下载图片：${shown}`)
  const res = await fetch(target, { signal })
  if (!res.ok) throw new Error(`图片下载失败：HTTP ${res.status}`)
  const blob = await res.blob()
  const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer())
  const mime = res.headers.get('content-type')?.startsWith('image/') ? res.headers.get('content-type')! : sniffMime(head)
  log('success', `下载完成：${(blob.size / 1024).toFixed(1)} KB，格式 ${mime.replace('image/', '')}`)
  return { blob, mime }
}

async function dimensionsOf(blob: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(blob)
  const { width, height } = bitmap
  bitmap.close()
  return { width, height }
}

function extractErrorText(json: unknown, fallback: string): string {
  if (json && typeof json === 'object') {
    const err = (json as any).error ?? json
    const msg = err?.message ?? err?.msg ?? err?.code
    if (typeof msg === 'string' && msg) return msg
  }
  return fallback
}

/* ---------------- 主流程 ---------------- */

export async function generateOne(opts: GenerateOptions): Promise<GenerateResult> {
  const { settings, prompt, params, signal, log, onProgress, onPartial } = opts
  const est = new ProgressEstimator()
  const tick = setInterval(() => {
    onProgress(est.current(), '生成中')
  }, 250)

  try {
    let url: string
    let body: BodyInit
    let headers: Record<string, string> = { Authorization: `Bearer ${settings.apiKey}` }

    if (opts.referenceImages?.length) {
      // 图生图：multipart/form-data，fetch 自动生成 boundary，不能手动设 Content-Type
      const fd = new FormData()
      fd.append('model', settings.model)
      fd.append('prompt', prompt)
      fd.append('n', '1')
      fd.append('size', params.size)
      fd.append('quality', params.quality)
      fd.append('stream', 'true')
      fd.append('partial_images', '3')
      if (params.background !== 'auto') fd.append('background', params.background)
      if (params.output_format !== 'png') fd.append('output_format', params.output_format)
      for (const [i, blob] of opts.referenceImages.entries()) {
        const file = blob instanceof File
          ? blob
          : new File([blob], `reference-${i + 1}.${(blob.type.split('/')[1] ?? 'png').replace('jpeg', 'jpg')}`, { type: blob.type || 'image/png' })
        if (opts.referenceImages.length === 1) fd.append('image', file)
        else fd.append('image[]', file)
      }
      url = apiUrl(settings, '/images/edits')
      body = fd
      log('info', `请求 ${url}（图生图，参考图 ${opts.referenceImages.length} 张，model=${settings.model}，size=${params.size}，quality=${params.quality}，stream=true）`)
    } else {
      const jsonBody: Record<string, unknown> = {
        model: settings.model,
        prompt,
        n: 1,
        size: params.size,
        quality: params.quality,
        stream: true,
        partial_images: 3,
      }
      if (params.background !== 'auto') jsonBody.background = params.background
      if (params.output_format !== 'png') jsonBody.output_format = params.output_format
      url = apiUrl(settings, '/images/generations')
      body = JSON.stringify(jsonBody)
      headers['Content-Type'] = 'application/json'
      log('info', `请求 ${url}（model=${settings.model}，size=${params.size}，quality=${params.quality}，stream=true）`)
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal,
    })

    if (!res.ok) {
      let detail = res.statusText || '请求失败'
      try {
        const text = await res.text()
        try { detail = extractErrorText(JSON.parse(text), detail) } catch { if (text) detail = text.slice(0, 300) }
      } catch { /* 保留默认 */
      }
      throw new Error(`HTTP ${res.status}：${detail}`)
    }

    const ctype = res.headers.get('content-type') ?? ''
    let item: ResultItem
    let usage: UsageInfo | undefined

    if (ctype.includes('text/event-stream') || ctype.includes('event-stream')) {
      log('success', '流式连接已建立，开始接收事件')
      let chunkCount = 0
      let completed = false
      item = { }

      for await (const ev of sseEvents(res.body!)) {
        if (signal.aborted) throw new DOMException('已取消', 'AbortError')
        if (ev.data === '[DONE]') { log('info', '流结束（[DONE]）'); completed = true; break }
        if (!ev.data) continue

        let json: any
        try { json = JSON.parse(ev.data) } catch {
          log('warn', `非 JSON 事件数据：${ev.data.slice(0, 80)}`)
          continue
        }

        const objType: string = json?.object ?? ev.event ?? ''
        const upstream: string = json?.upstream_event_type ?? ''

        if (objType === 'image.generation.chunk') {
          chunkCount++
          est.bump(0.4)
          if (chunkCount % 5 === 1) {
            log('info', `收到第 ${chunkCount} 个进度块${upstream ? `（${upstream}）` : ''}`)
          }
        } else if (objType === 'image_generation.partial_image') {
          const idx = json.partial_image_index ?? 0
          est.floor(Math.round(((idx + 1) / 4) * 88))
          log('info', `收到局部图 #${idx + 1}`)
          if (json.b64_json) onPartial(json.b64_json)
        } else if (objType === 'image_generation.completed') {
          item = { b64_json: json.b64_json, revised_prompt: json.revised_prompt }
          usage = normalizeUsage(json.usage)
          log('success', '生成完成（completed 事件）')
        } else if (objType === 'image.generation.result') {
          const arr: any[] = Array.isArray(json.data) ? json.data : []
          const first = arr[0]
          item = first
            ? { b64_json: first.b64_json, url: first.url, revised_prompt: first.revised_prompt }
            : {}
          usage = normalizeUsage(json.usage)
          log('success', '生成完成（result 事件）')
        } else if (json?.error) {
          throw new Error(extractErrorText(json, '端点返回错误'))
        } else if (Array.isArray(json?.data) && json.data.length > 0) {
          const first = json.data[0]
          item = { b64_json: first.b64_json, url: first.url, revised_prompt: first.revised_prompt }
          usage = normalizeUsage(json.usage)
          log('success', `生成完成（data 数组，${json.data.length} 项）`)
        } else {
          log('info', `事件 ${objType || ev.event || '未知'}${upstream ? ` / ${upstream}` : ''}`)
        }
      }

      if (!completed && !item.b64_json && !item.url) {
        log('warn', '流意外中断且未收到结果')
      }
      if (chunkCount > 0) log('info', `共收到 ${chunkCount} 个进度块`)
      if (!item.b64_json && !item.url) throw new Error('端点未返回图片数据')
    } else {
      // 非流式降级
      log('warn', `端点未返回 SSE 流（Content-Type: ${ctype || '未知'}），降级为普通请求解析`)
      const json = await res.json()
      const arr: any[] = Array.isArray(json?.data) ? json.data : []
      const first = arr[0]
      item = first
        ? { b64_json: first.b64_json, url: first.url, revised_prompt: first.revised_prompt }
        : {}
      usage = normalizeUsage(json?.usage)
      if (!item.b64_json && !item.url) {
        throw new Error(extractErrorText(json, '端点未返回图片数据'))
      }
      log('success', '解析到结果数据')
    }

    // 获取图片字节
    onProgress(est.current(), item.b64_json ? '解码图片' : '下载图片')
    est.floor(97)
    let blobResult: { blob: Blob; mime: string }
    if (item.b64_json) {
      log('info', '解码 base64 图片数据')
      blobResult = await b64ToBlob(item.b64_json)
    } else {
      blobResult = await downloadBlob(item.url!, settings, signal, log)
    }

    const dims = await dimensionsOf(blobResult.blob)
    onProgress(100, '完成')
    log('success', `完成：${dims.width}×${dims.height}，用时 ${(est.elapsedMs() / 1000).toFixed(1)}s`)

    return {
      blob: blobResult.blob,
      mime: blobResult.mime,
      ...dims,
      revisedPrompt: item.revised_prompt,
      usage,
      remoteUrl: item.url,
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      log('warn', '已取消')
      throw err
    }
    const msg = err instanceof Error ? err.message : String(err)
    log('error', `失败：${msg}`)
    throw new Error(msg)
  } finally {
    clearInterval(tick)
  }
}

function normalizeUsage(u: any): UsageInfo | undefined {
  if (!u || typeof u !== 'object') return undefined
  const { input_tokens, output_tokens, total_tokens } = u
  if (typeof total_tokens !== 'number' && typeof output_tokens !== 'number') return undefined
  return {
    input_tokens: input_tokens ?? 0,
    output_tokens: output_tokens ?? 0,
    total_tokens: total_tokens ?? (input_tokens ?? 0) + (output_tokens ?? 0),
  }
}
