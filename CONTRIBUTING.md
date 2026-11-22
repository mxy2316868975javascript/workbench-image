# 贡献指南

感谢参与改进 Image Workbench。本项目是纯浏览器端应用，没有后端与数据库迁移，改动的验证成本很低。

## 环境要求

- Node.js >= 20.19（推荐 22 LTS）
- npm（仓库带 `package-lock.json`，请用 `npm ci` 安装）

## 本地开发

```bash
npm ci
npm run dev        # http://localhost:5173
npm run lint       # ESLint
npm test           # Vitest 单测
npm run typecheck  # tsc 类型检查
npm run build      # 类型检查 + 生产构建
```

需要真实生图时，把 `.env.example` 复制为 `.env.local` 并填写端点，或启动后在右下角「设置」里填写。`.env.local` 不会被提交。

## 目录约定

```
src/components/   界面组件，按功能分文件；漫画工作室在 components/manga/
src/lib/          纯逻辑：SSE 解析、进度估算、生成器、IndexedDB、模板数据
src/store/        全局状态与并发队列（useSyncExternalStore）
server/           仅 dev/preview 用的 HTTP/2 转发中间件
scripts/          启动脚本（macOS 的 node 重签名兼容层）
```

- 新增界面优先复用 `src/components/ui.tsx` 里的基础组件与现有 Tailwind 风格。
- 新增数据访问写进 `src/lib/db.ts`，不要在组件里直接开 IndexedDB。
- 新增生成链路逻辑放在 `src/lib/`，保持组件只做展示与交互。
- 不要引入后端存储：本项目的核心约束是所有用户数据只留在本机。

## 代码风格

- 与周围代码保持一致：缩进、命名、注释密度以所在文件为准。
- 注释、提交信息用中文；代码标识符用英文。
- 不做与当前改动无关的重构或格式化，便于 review。

## 提交与 PR

1. 从 `main` 切分支：`git checkout -b feat/简短说明`。
2. 提交信息建议 `类型: 说明`，类型可用 `feat` / `fix` / `docs` / `refactor` / `chore`。
3. 提交前本地跑通 `npm run lint && npm test && npm run build`。
4. 发起 PR，按模板填写改动动机、验证方式与截图（界面改动）。
5. CI 会执行 lint、单测、源码/产物密钥扫描与构建，通过后合并。

## 安全与第三方内容

- 不要提交 `.env.local`、`dist/`、任何真实密钥或带密钥的截图。
- 发现安全问题请不要开公开 issue，按 [SECURITY.md](SECURITY.md) 私密报告。
- 新增第三方模板、风格库、提示词或示例数据前，必须确认上游许可与本项目 MIT 分发兼容，并在 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 补充来源、许可和版权行。没有 LICENSE 且 README 未明确授权的内容不要合入。
- 运行时拉取的数据固定到 commit，不要直接依赖上游 `main` / `master`。
