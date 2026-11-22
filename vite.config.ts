import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { llmRelayPlugin } from './server/relay-middleware'

// 部分上游端点不返回 CORS 头，浏览器无法直连，
// 开发/预览期通过 /api/relay 转发（HTTP/2 直连上游，SSE 无缓冲透传，仅转发不存储）。
// 上游地址用环境变量 RELAY_TARGET 配置，默认 https://api.openai.com。
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss(), llmRelayPlugin(env.RELAY_TARGET)],
    server: { port: 5173 },
    preview: { port: 4173 },
  }
})
