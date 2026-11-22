/**
 * 启动 vite 的包装脚本，复用 node-runtime 的 macOS 签名兼容逻辑。
 */
const { spawnSync } = require('node:child_process')
const path = require('node:path')
const { ROOT, resolveNode } = require('./node-runtime.cjs')

/** vite 的 bin 不在 exports 里，需从包根目录拼接；兜底走 node_modules 相对路径 */
function viteBin() {
  try {
    const pkg = require.resolve('vite/package.json')
    return path.join(path.dirname(pkg), 'bin', 'vite.js')
  } catch {
    return path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')
  }
}

const res = spawnSync(resolveNode(), [viteBin(), ...process.argv.slice(2)], {
  cwd: ROOT,
  stdio: 'inherit',
})
process.exit(res.status ?? 1)
