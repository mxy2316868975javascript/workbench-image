import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { llmRelayPlugin } from './server/relay-middleware'
import { assertNoSecretEnv } from './server/env-guard'

// 部分上游端点不返回 CORS 头，浏览器无法直连，
// 开发/预览期通过 /api/relay 转发（HTTP/2 直连上游，SSE 无缓冲透传，仅转发不存储）。
// 上游地址用环境变量 RELAY_TARGET 配置，默认 https://api.openai.com。
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // 生产构建拒绝把 Key 打进前端产物；dev 仍允许 .env.local 里的本地 Key
  assertNoSecretEnv(env, command)
  // GitHub Pages 部署时用相对路径，避免硬编码仓库名；本地/普通静态托管仍用根路径
  const base = process.env.GITHUB_PAGES ? './' : '/'
  return {
    base,
    plugins: [react(), tailwindcss(), llmRelayPlugin(env.RELAY_TARGET)],
    server: { port: 5173, host: '127.0.0.1' },
    preview: { port: 4173, host: '127.0.0.1' },
  }
})
