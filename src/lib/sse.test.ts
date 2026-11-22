import { describe, expect, it } from 'vitest'
import { parseSSELine, sseEvents, type SSEEvent } from './sse'

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
}

async function collect(chunks: string[]): Promise<SSEEvent[]> {
  const events: SSEEvent[] = []
  for await (const event of sseEvents(streamOf(chunks))) events.push(event)
  return events
}

describe('parseSSELine', () => {
  it('识别注释、data、event 和未知行', () => {
    expect(parseSSELine(': ping')).toEqual({ type: 'comment', text: ': ping' })
    expect(parseSSELine('data: hello')).toEqual({ type: 'data', text: 'hello' })
    expect(parseSSELine('data:  {"a":1}')).toEqual({ type: 'data', text: '{"a":1}' })
    expect(parseSSELine('event: image.generation.chunk')).toEqual({
      type: 'event',
      text: 'image.generation.chunk',
    })
    expect(parseSSELine('id: 1')).toEqual({ type: 'raw', text: 'id: 1' })
  })
})

describe('sseEvents', () => {
  it('按空行分发事件，并保留 event 名称', async () => {
    const events = await collect([
      'event: image.generation.result\ndata: {"url":"https://example.com/a.png"}\n\n',
      'data: [DONE]\r\n\r\n',
    ])
    expect(events).toEqual([
      { event: 'image.generation.result', data: '{"url":"https://example.com/a.png"}' },
      { event: 'message', data: '[DONE]' },
    ])
  })

  it('合并多行 data，忽略注释行', async () => {
    const events = await collect([': keepalive\ndata: line1\ndata: line2\n\n'])
    expect(events).toEqual([{ event: 'message', data: 'line1\nline2' }])
  })

  it('跨 chunk 的字段可以正确拼接', async () => {
    const events = await collect(['event: chunk\ndata: {"index":', '1}\n\n'])
    expect(events).toEqual([{ event: 'chunk', data: '{"index":1}' }])
  })

  it('流结束时发完剩余事件', async () => {
    const events = await collect(['data: tail'])
    expect(events).toEqual([{ event: 'message', data: 'tail' }])
  })

  it('空事件不产生输出', async () => {
    expect(await collect(['\n\n: comment\n\n'])).toEqual([])
  })
})
