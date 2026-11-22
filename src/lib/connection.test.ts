import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchModels } from './connection'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('fetchModels', () => {
  it('空端点直接失败', async () => {
    await expect(fetchModels('  ', 'key')).resolves.toEqual({
      status: 'fail',
      models: [],
      message: '端点地址为空',
    })
  })

  it('404 视为端点不支持 /models，而不是连接失败', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })))
    await expect(fetchModels('http://localhost:5173/v1', 'key')).resolves.toMatchObject({
      status: 'unknown',
      models: [],
    })
  })

  it('非 2xx 返回失败', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })))
    await expect(fetchModels('http://localhost:5173/v1', 'key')).resolves.toMatchObject({
      status: 'fail',
      message: 'HTTP 500',
    })
  })

  it('解析 data[].id，忽略无效项', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: [{ id: 'gpt-image-1' }, { id: 'gpt-4o-mini' }, { foo: 1 }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchModels('http://localhost:5173/v1/', 'secret')).resolves.toEqual({
      status: 'ok',
      models: ['gpt-image-1', 'gpt-4o-mini'],
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:5173/v1/models',
      expect.objectContaining({ headers: { Authorization: 'Bearer secret' } }),
    )
  })

  it('网络异常返回失败', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))
    await expect(fetchModels('http://localhost:5173/v1', 'key')).resolves.toMatchObject({
      status: 'fail',
      models: [],
      message: 'network down',
    })
  })

  it('超时返回可读提示', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
            })
          }),
      ),
    )
    const promise = fetchModels('http://localhost:5173/v1', 'key', 5000)
    await vi.advanceTimersByTimeAsync(5000)
    await expect(promise).resolves.toMatchObject({
      status: 'fail',
      models: [],
      message: '连接超时（5s）',
    })
  })
})
