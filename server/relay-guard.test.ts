import { describe, expect, it } from 'vitest'
import { isLocalRelayRequest, isLoopbackHostname } from './relay-guard'

function req(overrides: {
  remote?: string
  host?: string
  origin?: string | null
  url?: string
}) {
  const headers: Record<string, string> = {}
  if (overrides.host !== undefined) headers.host = overrides.host
  if (overrides.origin !== undefined && overrides.origin !== null) headers.origin = overrides.origin
  return {
    socket: { remoteAddress: overrides.remote ?? '127.0.0.1' },
    headers,
    url: overrides.url ?? '/v1/models',
  } as unknown as Parameters<typeof isLocalRelayRequest>[0]
}

describe('relay guard', () => {
  it('识别本机主机名', () => {
    expect(isLoopbackHostname('localhost')).toBe(true)
    expect(isLoopbackHostname('127.0.0.1')).toBe(true)
    expect(isLoopbackHostname('::1')).toBe(true)
    expect(isLoopbackHostname('[::1]')).toBe(true)
    expect(isLoopbackHostname('localhost.evil.com')).toBe(false)
  })

  it('允许本机回环请求', () => {
    expect(isLocalRelayRequest(req({ host: '127.0.0.1:5173' }))).toBe(true)
    expect(isLocalRelayRequest(req({ remote: '::1', host: '[::1]:5173' }))).toBe(true)
    expect(
      isLocalRelayRequest(req({ host: 'localhost:5173', origin: 'http://localhost:5173' })),
    ).toBe(true)
  })

  it('拒绝非回环来源', () => {
    expect(isLocalRelayRequest(req({ remote: '10.0.0.2', host: '127.0.0.1:5173' }))).toBe(false)
  })

  it('拒绝非本机 Host 和 Origin', () => {
    expect(isLocalRelayRequest(req({ host: 'evil.com' }))).toBe(false)
    expect(isLocalRelayRequest(req({ host: '127.0.0.1:5173', origin: 'https://evil.com' }))).toBe(false)
    expect(isLocalRelayRequest(req({ host: '127.0.0.1:5173', origin: 'null' }))).toBe(false)
  })

  it('拒绝 absolute-form 和 // 开头的路径', () => {
    expect(isLocalRelayRequest(req({ host: '127.0.0.1:5173', url: '//evil.com/v1' }))).toBe(false)
    expect(isLocalRelayRequest(req({ host: '127.0.0.1:5173', url: 'http://evil.com/v1' }))).toBe(false)
  })

  it('缺少 Host 时拒绝', () => {
    expect(isLocalRelayRequest(req({}))).toBe(false)
  })
})
