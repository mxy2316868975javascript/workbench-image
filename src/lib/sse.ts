/**
 * SSE 解析器：基于 fetch ReadableStream，逐行解析 event/data 字段。
 * 兼容标准 SSE（event: + data: 多行 + 空行分发）与本端点的纯 data: JSON 行。
 */
export interface SSEEvent {
  event: string // 未声明时为 'message'
  data: string  // 多行 data 以 \n 连接
}

export interface SSELine {
  type: 'comment' | 'event' | 'data' | 'raw'
  text: string
}

/** 仅逐行回调版本：适合日志型消费（不缓存拼接） */
export function parseSSELine(line: string): SSELine | null {
  if (line === '' || line.startsWith(':')) return { type: 'comment', text: line }
  if (line.startsWith('data:')) return { type: 'data', text: line.slice(5).trimStart() }
  if (line.startsWith('event:')) return { type: 'event', text: line.slice(6).trim() }
  return { type: 'raw', text: line }
}

/** 标准事件流版本：异步生成器，按空行分发完整事件 */
export async function* sseEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<SSEEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let dataLines: string[] = []
  let eventName = 'message'
  let closed = false

  const flush = function* (): Generator<SSEEvent> {
    if (dataLines.length === 0) return
    const data = dataLines.join('\n')
    dataLines = []
    const ev: SSEEvent = { event: eventName, data }
    eventName = 'message'
    yield ev
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) { closed = true; break }
      buffer += decoder.decode(value, { stream: true })
      let idx: number
      while ((idx = buffer.indexOf('\n')) >= 0) {
        let line = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 1)
        if (line.endsWith('\r')) line = line.slice(0, -1)
        if (line === '' || line.startsWith(':')) {
          yield* flush()
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart())
        } else if (line.startsWith('event:')) {
          eventName = line.slice(6).trim() || 'message'
        }
        // 其他未知字段忽略
      }
    }
  } finally {
    if (!closed) {
      try { await reader.cancel() } catch { /* 忽略 */ }
    }
  }
  // 流结束时可能还剩一行没有换行符的字段，先处理再 flush
  if (buffer) {
    let line = buffer
    if (line.endsWith('\r')) line = line.slice(0, -1)
    if (line === '' || line.startsWith(':')) {
      yield* flush()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
    } else if (line.startsWith('event:')) {
      eventName = line.slice(6).trim() || 'message'
    }
  }
  // 流结束前残留的未分发事件
  yield* flush()
}
