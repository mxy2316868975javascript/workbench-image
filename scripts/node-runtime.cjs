/**
 * 解析可用的 node 运行时。
 *
 * macOS：官方 node 发行版带 hardened runtime 签名，库验证（Library Validation）会拒绝
 * 加载签名不一致的原生模块（rollup / tailwind oxide 的 .node），报
 * "mapping process and mapped file (non-platform) have different Team IDs"。
 * 处理方式：复制当前 node 到 .node-local/ 并 ad-hoc 重签名（去掉硬化标志）后再运行。
 *
 * 其他平台（Linux / Windows）直接使用当前 node，避免无谓地复制 ~110MB 二进制，
 * 因此该脚本可以安全地用于 CI。副本目录已加入 .gitignore。
 */
const { spawnSync, execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const LOCAL_DIR = path.join(ROOT, '.node-local')
const LOCAL_NODE = path.join(LOCAL_DIR, 'node')

function hasCodesign() {
  try {
    execSync('command -v codesign', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/** 仅 macOS + 有 codesign 时才启用本地重签名副本 */
function ensureLocalNode() {
  if (process.platform !== 'darwin' || !hasCodesign()) return process.execPath
  if (fs.existsSync(LOCAL_NODE)) return LOCAL_NODE

  fs.mkdirSync(LOCAL_DIR, { recursive: true })
  fs.copyFileSync(process.execPath, LOCAL_NODE)
  try {
    execSync(`codesign --force --sign - "${LOCAL_NODE}"`, { stdio: 'ignore' })
  } catch {
    return process.execPath
  }
  fs.chmodSync(LOCAL_NODE, 0o755)
  return LOCAL_NODE
}

/** 验证本地 node 能否加载原生模块（以 rollup 绑定为准） */
function canLoadNative(nodePath) {
  try {
    const res = spawnSync(nodePath, ['-e', "require('rollup/dist/native.js')"], {
      cwd: ROOT,
      stdio: 'ignore',
    })
    return res.status === 0
  } catch {
    return false
  }
}

/** 返回可直接 spawn 的 node 路径 */
function resolveNode() {
  const local = ensureLocalNode()
  return local !== process.execPath && canLoadNative(local) ? local : process.execPath
}

module.exports = { ROOT, resolveNode }
