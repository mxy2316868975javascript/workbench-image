/**
 * 构建期环境变量防护：生产构建不允许把 secret-like 的 VITE_* 打进前端产物。
 * 这些变量会被 Vite 内联到 JS 里，等同于公开信息；真实 Key 只能通过设置面板写入 IndexedDB。
 */

export const SECRET_ENV_NAME_RE = /(^|_)(API_?KEY|KEY|TOKEN|SECRET|PASSWORD)$/i

/** 返回非空的、名称看起来像密钥的 VITE_* 变量名（不返回值本身） */
export function findSecretEnvKeys(env: Record<string, string>): string[] {
  return Object.keys(env)
    .filter((key) => key.startsWith('VITE_'))
    .filter((key) => SECRET_ENV_NAME_RE.test(key))
    .filter((key) => (env[key] ?? '').trim().length > 0)
    .sort()
}

/** build 阶段命中密钥变量时直接失败，错误信息只列变量名 */
export function assertNoSecretEnv(env: Record<string, string>, command: string): void {
  if (command !== 'build') return
  const keys = findSecretEnvKeys(env)
  if (keys.length === 0) return

  throw new Error(
    [
      '检测到 secret-like 的 VITE_* 环境变量，已中止构建：',
      ...keys.map((key) => `  - ${key}`),
      '',
      'VITE_* 会被 Vite 内联进前端产物，任何拿到构建文件的人都能读到。',
      '请清空这些变量，把真实 Key 改到应用「设置」面板填写（只存本机 IndexedDB）。',
    ].join('\n'),
  )
}
