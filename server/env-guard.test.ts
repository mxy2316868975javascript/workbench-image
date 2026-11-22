import { describe, expect, it } from 'vitest'
import { assertNoSecretEnv, findSecretEnvKeys } from './env-guard'

describe('env guard', () => {
  it('只挑出非空的 secret-like VITE_* 变量', () => {
    expect(
      findSecretEnvKeys({
        VITE_DEFAULT_API_KEY: 'sk-x',
        VITE_TEXT_API_KEY: '  ',
        VITE_TEXT_TOKEN: 't',
        VITE_DEFAULT_MODEL: 'gpt-image-1',
        VITE_DEFAULT_BASE_URL: 'http://localhost',
        RELAY_TARGET: 'https://api.openai.com',
      }),
    ).toEqual(['VITE_DEFAULT_API_KEY', 'VITE_TEXT_TOKEN'])
  })

  it('build 阶段命中时抛错，错误信息不包含值', () => {
    expect(() => assertNoSecretEnv({ VITE_DEFAULT_API_KEY: 'sk-secret-value' }, 'build')).toThrow(
      /VITE_DEFAULT_API_KEY/,
    )
    try {
      assertNoSecretEnv({ VITE_DEFAULT_API_KEY: 'sk-secret-value' }, 'build')
    } catch (err) {
      expect(String(err)).not.toContain('sk-secret-value')
    }
  })

  it('dev/serve 阶段不拦截', () => {
    expect(() => assertNoSecretEnv({ VITE_DEFAULT_API_KEY: 'sk-x' }, 'serve')).not.toThrow()
  })

  it('没有 secret-like 变量时放行', () => {
    expect(() => assertNoSecretEnv({ VITE_DEFAULT_MODEL: 'gpt-image-1' }, 'build')).not.toThrow()
  })
})
