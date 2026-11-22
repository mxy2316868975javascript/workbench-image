#!/usr/bin/env node
/**
 * 扫描指定目录里的常见密钥特征（只输出文件与行号，不输出密钥本身）。
 * 用法：node scripts/check-secrets.mjs src server scripts .github
 */
import fs from 'node:fs'
import path from 'node:path'

const PATTERNS = [
  { name: 'OpenAI-style key', re: /sk-[A-Za-z0-9_-]{20,}/g },
  { name: 'GitHub token', re: /ghp_[A-Za-z0-9]{30,}/g },
  { name: 'GitHub fine-grained token', re: /github_pat_[A-Za-z0-9_]{20,}/g },
  { name: 'AWS access key', re: /AKIA[0-9A-Z]{16}/g },
  { name: 'private key block', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'Slack token', re: /xox[baprs]-[A-Za-z0-9-]{10,}/g },
]

const SKIP_DIRS = new Set(['node_modules', '.git', '.node-local', 'dist', 'coverage'])
const TEXT_EXT = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.json', '.md', '.yml', '.yaml',
  '.html', '.css', '.txt', '.env', '.example', '.toml', '.sh', '.svg',
])

const targets = process.argv.slice(2)
if (targets.length === 0) {
  console.error('用法：node scripts/check-secrets.mjs <目录或文件> [...]')
  process.exit(2)
}

/** 递归收集文本文件 */
function collect(target, out) {
  if (!fs.existsSync(target)) return
  const stat = fs.statSync(target)
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(target)) {
      if (SKIP_DIRS.has(name)) continue
      collect(path.join(target, name), out)
    }
    return
  }
  if (!stat.isFile() || stat.size > 2 * 1024 * 1024) return
  const ext = path.extname(target).toLowerCase()
  if (ext && !TEXT_EXT.has(ext) && !target.endsWith('.env.example')) return
  out.push(target)
}

const files = []
for (const target of targets) collect(target, files)

let hits = 0
for (const file of files) {
  let text
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    continue
  }
  const lines = text.split(/\r?\n/)
  for (const [index, line] of lines.entries()) {
    for (const { name, re } of PATTERNS) {
      re.lastIndex = 0
      if (re.test(line)) {
        hits++
        console.error(`[${name}] ${file}:${index + 1}`)
      }
    }
  }
}

if (hits > 0) {
  console.error(`\n发现 ${hits} 处疑似密钥。请删除或改用运行时设置，不要提交。`)
  process.exit(1)
}
console.log(`未发现疑似密钥（扫描 ${files.length} 个文件）`)
