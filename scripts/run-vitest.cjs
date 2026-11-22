/**
 * 启动 vitest 的包装脚本，复用 node-runtime 的 macOS 签名兼容逻辑。
 */
const { spawnSync } = require('node:child_process')
const path = require('node:path')
const { ROOT, resolveNode } = require('./node-runtime.cjs')

const vitestBin = path.join(ROOT, 'node_modules', 'vitest', 'vitest.mjs')
const res = spawnSync(resolveNode(), [vitestBin, ...process.argv.slice(2)], {
  cwd: ROOT,
  stdio: 'inherit',
})
process.exit(res.status ?? 1)
