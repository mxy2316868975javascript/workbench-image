# 生图工作台 · Image Workbench

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/mxy2316868975javascript/workbench-image/actions/workflows/ci.yml/badge.svg)](https://github.com/mxy2316868975javascript/workbench-image/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D20.19-339933?logo=node.js&logoColor=white)](package.json)

纯浏览器端的 AI 生图工作台：所有数据（图片、历史、设置、密钥）只存本机 IndexedDB，**没有任何后端存储**。

A browser-only AI image workbench: streaming generation, batch queue, local history, and a large built-in prompt-template library. Images, settings and API keys never leave the browser.

## 界面截图

| 深色主题 | 浅色主题 |
| --- | --- |
| ![深色主题](docs/screenshots/main-dark.png) | ![浅色主题](docs/screenshots/main-light.png) |

![内置模板库](docs/screenshots/templates.png)

## 功能

- **流式输出**：`stream: true` 直连端点，SSE 逐事件解析，进度块实时写入日志控制台
- **草稿与提交预检**：左栏输入自动保存（文字镜像到 localStorage、参考图存 IndexedDB），刷新或重开浏览器后恢复并提示；提交前检查端点 / 密钥 / 模型、透明背景与 JPEG 冲突、参考图数量 / 类型 / 体积，给出模型、张数、预计时长与排队位置；中文输入法组合中不会误触 ⌘Enter
- **百分比进度**：每张卡片独立的百分比 + 进度条（时间渐近曲线 + SSE chunk 到包修正），批量任务有整批均值进度
- **日志流**：底部可展开/全屏的日志抽屉，时间戳、级别着色、按单张图片过滤、自动滚动、复制
- **批量生图**：1–10 张，全局并发数可调（1–6），队列自动调度、槽位复用，整批取消 / 失败重试
- **图生图**：参考图走 `/images/edits`（multipart），支持点击选择 / 拖拽 / 剪贴板粘贴添加（最多 4 张），任务与历史记录带「图生图」标识，重新生成时参考图一并还原
- **历史记录**：按任务分组，增删改查齐全——查看/复制/编辑旧提示词、一键回填生成面板、重新生成、删除单图与整任务（级联）；支持任务与图片的**批量删除**（多选模式）
- **删除确认**：所有删除操作（单图 / 整任务 / 批量 / 灯箱内删除）统一弹出确认框；清空数据库需输入「清空」二次确认
- **预览**：灯箱全尺寸预览（从 IndexedDB 取原 Blob），滚轮缩放、拖拽平移、上下张切换、下载、复制提示词、元信息（耗时 / tokens / 改写后提示词）
- **双主题**：深色 / 浅色 / 跟随系统
- **提示词模板**：内置「跨境电商详情页 / 主图（ecom-pdp）」模板（来自 [1click-ecom-detailpage](https://github.com/coolqoo/1click-ecom-detailpage) 技能）——填产品 / 渠道 / 转化驱动力 / 卖点等字段，实时预览英文 Prompt（Campaign Style Lock + Frame objective + 图内文案门），主图 5 种 / 详情页 10 种图片类型，详情页自动联动 1024×1536；支持新建自定义模板（`{{key}}` 占位正文 + 字段定义），模板存 IndexedDB
- **vane 玩法合集**：内置 [vane-gpt-image-skills](https://github.com/VaneAi888/vane-gpt-image-skills) 的 5 种玩法，动态表单按玩法切换——多画风表情包（12 画风 × 6 主题，需参考图）、电影级海报（36 版式，片名原样保留、竖版 2:3）、书页里的电影（剧透开关）、宠物新年写真（3 种影棚）、微信红包封面（36 风格，3:4 安全区构图），按各技能规则产出中文 Prompt
- **电商执行卡（视觉文案 SOP）**：内置 [ecommerce-visual-copywriting-skill](https://github.com/feichanggege/ecommerce-visual-copywriting-skill) 的电商视觉策划 SOP——6 种图片任务（KV1 商品识别 / 卖点翻译 / 证据信任 / 对比 / 场景 / 规格 CTA）、KV1 先识别后卖点的规则、主图标题 ≤12 字与副文案 ≤18 字自动计数、留白排版 / 模型出字两种文字渲染、证据账本与广告法合规提示，产出十行执行卡 + 自包含生图 Prompt
- **文档配图（三风格）**：内置 [Document-illustrator-skill](https://github.com/op7418/Document-illustrator-skill)（歸藏）——文档内容归纳成系列配图：渐变玻璃卡片（Keynote 极简 + 玻璃拟态 + 3D 锚点物）、数字极简票券（黑白登机牌结构）、扁平矢量插画（复古柔和全景）三种风格，16:9 / 3:4 双比例，支持封面图模式
- **cc2image 模板大全**：内置 [awesome-gpt-image-2](https://github.com/freestylefly/awesome-gpt-image-2) 的 13 分类 46 模板（UI / 信息图 / 海报 / 电商 / 品牌 / 建筑 / 摄影 / 插画 / 角色 / 场景 / 古风 / 出版物…），含常规模板与 JSON 进阶模板，编辑 `[]` 占位符即出 Prompt，按需拉取缓存
- **Gorden 图片型 PPT**：内置 [GordenSuperPPTSkills](https://github.com/GordenSun/GordenSuperPPTSkills) 的 GordenImagePPTGen——单页高密度豪华信息图：七段式稳定结构（标题/核心逻辑/视觉框架/视觉生成提示/详细内容/图标/背景纹理）、19 种视觉框架（莫比乌斯环、Bento 看板、同心圆雷达、鱼骨图…）、9 种风格库，页面文字逐字照排、数据零编造；后续可用同仓库 GordenImage2PPTX 转可编辑 PPTX
- **归藏社交卡片**：内置 [guizang-social-card-skill](https://github.com/op7418/guizang-social-card-skill)（歸藏）——Editorial Magazine × E-ink 与 Swiss International 两种视觉模式、10 套主题色板、28 种版式——小红书 3:4 轮播图文与公众号 21:9 / 1:1 封面，按风格身份测试与内容密度规则产出设计卡 Prompt
- **菜谱海报**：内置 [recipe-generator](https://github.com/cclank/recipe-generator) 的米其林级菜谱海报——现代写实风（横版教程海报）、传统海报风（竖版 2:3 收藏海报）、文人卷轴风（横版文字卷轴）三种风格；竖版可填食材 / 技法 / 风味 / 时间填入 RECIPE CONTENT HIGHLIGHTS
- **PPT 逐页生图**：内置 [codex-ppt-skill](https://github.com/Ronnie2025/codex-ppt-skill) 路径 A——中文 toB 商业汇报的整页生图：全局风格块（主色/辅助色/强调色）+ 逐页提示词（页面标题/目标/核心要点/版式结构/视觉元素/Logo 规则/负向约束），13 种常用版式（风险升级、优先级矩阵、闭环飞轮、路线图…），16:9 横版按页生成
- **电商场景模板库**：内置 [ecom-details-image](https://github.com/liangdabiao/ecom-details-image) 的 25 个电商场景模板（白底主图 / 场景图 / 平铺图 / UGC / 直播 / 拆解图…），按 GPT-Image 铁律自动注入——颜色 hex 码、产品占比黄金区间、留白显式声明、平台预留空间、三层信息架构、否定清单；支持命名变体（奢华 / 清新 / 科技）与三层文字（核心承诺 / 证据 / CTA）
- **科研图表示意版**：内置 [vivid-illustration-skill](https://github.com/yjz211/vivid-illustration-skill) 的 148 个数据图配方（比较 / 趋势 / 分布 / 矩阵 / 组合…），按标签与关键词检索，附上游示例图；填数据产出**示意版**图表生图 Prompt——明确标注数值与文字为 AI 近似渲染，精确科研图请用原仓库 matplotlib 源码
- **小黑怪诞正文配图**：内置 [ian-xiaohei-illustrations](https://github.com/helloianneo/ian-xiaohei-illustrations)（Ian 小黑 IP）——中文文章的怪诞正文配图：固定 IP 角色小黑（黑色实心、白点眼、认真做荒诞的事）+ 纯白手绘线稿 + 红橙蓝中文手写批注 + 大量留白，8 种结构类型（Workflow / 前后对比 / 概念隐喻…），英文 Prompt 内置风格 DNA 与小黑 IP 定义
- **花叔 Design 风格库**：内置 [huashu-design](https://github.com/alchaincyf/huashu-design) 的 92 种设计风格（网页 20 / PPT 20 / 信息图 20 / App 12 / 中文东亚 12 / 小红书 8）+ 9 款 AI 生图专用风格——按官方「Mood, Not Layout」生图心法产出短提示词：选风格 → 描述情绪与观众感受，不堆布局；含视觉 DNA / 参考美学 / 适配场景
- **极简 Zine 海报**：内置 [gc-minimal-zine-poster](https://github.com/LiamGvchi/gc-minimal-zine-poster)——诗性纸感留白微编辑海报，70-90% 留白 + 单一高饱和色 + 纸张纹理，10 种布局家族 × 10 种焦点形态 × 9 种材质 × 10 种情绪；按 Prompt Compiler 四段式结构组装
- **论文方法图解**：内置 [paper-craft-skills](https://github.com/zsyggg/paper-craft-skills) 的 paper-comic——论文核心方法的视觉图解：sketchnote 温暖手抄报 / paper-figure 论文框架图两种风格，竖版 2:3 与横版，内置构图原则、文字标注规范（术语英文 / 解释中文）与颜色限制；论文漫画系列可按范围逐页生成
- **cc2image 内容配图**：内置 [cc2image](https://github.com/izscc/cc2image) 的封面 / 正文 / logo 三种模式——49 套中文内容视觉风格（手绘知识风、典籍山水风、霓虹搜索风…）+ 8 套图标风格，统一「中文知识博主手绘图解」视觉锚点，封面 21:9 / 正文 16:9 / logo 1:1 按意图适配画幅
- **手绘风格配方库**：内置 [hand-drawn-styles](https://github.com/threerocks/hand-drawn-styles) 的 23 个编号手绘画风配方（儿童涂色、蜡笔童涂、吉卜力、水墨、像素、皮影…），首次使用拉取 STYLES.md + 选型指导并缓存；选画风 → 填【主体】【文字】→ 按 PROTOCOL 规则处理比例（纯风格不注入、1/4 号注入软结构提示、自选则用你的），产出中文配方 Prompt；3.1/19/20/22/23 号带原仓库正式生产工作流提示
- **水仙提示词库**：内置 [shuixian-prompts](https://github.com/BaYue-SYJ/shuixian-prompts) 开源库的 6600+ 条中文生图提示词——首次使用从 GitHub 拉取（双源回退，约 14MB）并缓存到本地，之后离线可用；按分类 / 关键词检索，每条自动解析 `{argument}` 参数填空即用，附上游示例图
- **GPT Image 2 精选画廊**：内置 [GPT-Image2-Skill](https://github.com/wuyoscar/GPT-Image2-Skill) 的 171 条编号案例（31 分类：动漫 / 游戏 / 海报 / 摄影 / 科研图表 / 信息图 / UI / 产品 / 建筑 / 时尚…）——按分类与关键词检索，每条含完整英文 Prompt、画幅与示例图，Prompt 可直接编辑后再填入，尺寸按原案例画幅自动联动；另附 19 条提示词工艺原则（精确文字引号、画布与版式前置、图表语法、编辑不变量等）供速查
- **照片救援（LumaRescue）**：内置 [LumaRescue](https://github.com/justlovemaki/LumaRescue)——废片修复与美化：按题材（人像 / 风景 / 建筑 / 展品 / 产品 / 文档 / 老照片）套用不同保留规则，区分硬锚点（身份、文字、文物事实、建筑结构）与软锚点（光线 / 天空 / 背景 / 构图），光影优先并默认做大师级重构图；输出 AI 自然版 / AI 美化版两档图生图编辑 Prompt，老照片可只修复、克制的可信上色、现代干净修复或保留年代颗粒。原技能的 program_* 两版依赖本地确定性修图，工作台不覆盖
- **侧栏管理**：左右侧栏均可一键收起/展开（宽度过渡动画），偏好写入 localStorage 刷新后保留；窄屏（<1024px）自动切换为「生成 / 看板」页签布局，多任务并行时所有进行中任务的卡片分区同屏显示（最近 6 个任务持续可见）
- **数据管理**：设置面板内可清空数据库（删除全部任务与图片、保留设置与密钥），需输入「清空」二次确认
- **持久化**：刷新或关闭页面后历史与图片原样保留；中断的任务在下次启动时标记为失败、可手动重试；顶栏显示 IndexedDB 存储用量

## 环境要求

- Node.js >= 20.19（推荐 22 LTS）
- npm 10+
- 较新的 Chrome / Edge / Safari / Firefox

## 快速开始

```bash
npm ci
cp .env.example .env.local   # 可选：填写端点与模型
npm run dev                  # http://localhost:5173
```

首次打开若未配置端点或密钥，会自动弹出设置面板。所有配置（含密钥）只存本浏览器 IndexedDB。

### 环境变量

| 变量 | 作用 | 默认值 |
| --- | --- | --- |
| `VITE_DEFAULT_BASE_URL` | 生图端点 Base URL | `/api/relay/v1` |
| `VITE_DEFAULT_API_KEY` | 生图密钥 | 空 |
| `VITE_DEFAULT_MODEL` | 生图模型 | `gpt-image-1` |
| `VITE_TEXT_BASE_URL` | 文本端点（漫画脚本 / 分镜） | `/api/relay/v1` |
| `VITE_TEXT_API_KEY` | 文本密钥 | 空 |
| `VITE_TEXT_MODEL` | 文本模型 | `gpt-4o-mini` |
| `RELAY_TARGET` | 内置 relay 的上游地址（仅 dev / preview） | `https://api.openai.com` |

> **密钥安全**：`VITE_*` 变量会被 Vite 打包进前端产物，等同于公开信息。真实密钥建议启动后在设置面板填写（只存 IndexedDB），不要写进 `.env.local` 后再公开发布构建产物。

## 两个关键的基础设施说明

### 1. `/api/relay` 转发（仅转发，零存储）

部分上游端点不返回 CORS 头，浏览器无法直连。开发/预览服务器内置了一个转发中间件
（`server/relay-middleware.ts`）：

- 上游地址由 `RELAY_TARGET` 指定，默认 `https://api.openai.com`
- 中间件用 **node:http2** 直连上游并逐字节 pipe——部分端点的 SSE 只在 HTTP/2 上即时推送，
  h1.1 下边缘节点不 flush（Vite 内置 proxy 只支持 h1.1 上游，会收不到流）
- 中间件只转发请求，不存储任何数据；图片字节由前端下载后写入 IndexedDB

### 2. `scripts/run-vite.cjs` 本地 node 副本（macOS 签名问题）

官方 Node 发行版带 hardened runtime 签名，macOS 的库验证（Library Validation）会拒绝加载
签名不一致的原生模块（rollup / tailwind oxide 的 `.node` 文件），报
`mapping process and mapped file (non-platform) have different Team IDs`。

`npm run dev / build / preview` 通过 `scripts/run-vite.cjs` 启动 vite。在 **macOS** 上脚本会先复制当前
node 到 `.node-local/` 并做 ad-hoc 重签名（去掉硬化标志），用它启动 vite——进程与原生库都是 ad-hoc，
dlopen 即可正常工作；该目录已加入 `.gitignore`。Linux / Windows 或没有 `codesign` 的环境直接使用系统
node，不做复制，因此同一脚本可直接用于 CI。

## 生产构建

```bash
npm run build      # tsc 类型检查 + vite build → dist/
npm run preview    # 本地预览 dist（同样带 relay 与本地 node 逻辑）
```

产物为纯静态文件。注意：静态部署时没有 relay 中间件，需要把设置里的 Base URL 换成
支持 CORS 的端点，或自行托管一个转发层。

## 目录结构

```
src/
├── lib/                  # 纯逻辑：类型 / IndexedDB / SSE / 进度 / 生成器 / 模板数据
├── store/                # 全局 store（useSyncExternalStore）+ 并发队列
├── theme/                # 深浅主题
└── components/           # 界面组件；漫画工作室在 components/manga/
server/relay-middleware.ts # HTTP/2 SSE 转发中间件（dev / preview）
scripts/run-vite.cjs      # vite 启动器（macOS 签名兼容层）
docs/screenshots/         # README 截图
```

## 事件格式兼容

`generator.ts` 同时兼容两类端点行为，切换端点无需改代码：

| 行为 | 标准 OpenAI（gpt-image-1 等） | 本端点（代理） |
|---|---|---|
| 事件风格 | `image_generation.partial_image` / `completed`（b64） | `image.generation.chunk`（无内容进度块）+ `image.generation.result`（data[].url） |
| 结果形态 | b64_json | url（前端经 relay 下载后落库） |
| 进度字段 | 无 | 无（由 ProgressEstimator 估算） |
| 图生图 | `/images/edits` multipart（image / image[]） | 同格式，已实测可用 |

## 进度百分比原理

端点事件不含任何进度数字，进度为感知估算（`src/lib/progress.ts`）：

1. 主干：时间渐近曲线 `88 × (1 − e^(−t/40))`，渐近不封死，避免"100% 还在等"
2. 辅助：每个 SSE chunk 到达 +0.4%（封顶 +6%），生成活跃时走得更快
3. 阶段：下载图片阶段抬到 97%，100% 仅在图片落库后给出；标准端点的局部帧到达时按 `(index+1)/4 × 88` 抬底

## 第三方内容与许可

本项目代码以 [MIT](LICENSE) 许可发布。`src/lib/` 内置的提示词模板、风格库与示例数据整理自多个上游
开源项目，功能列表中已逐项标注来源（如 [1click-ecom-detailpage](https://github.com/coolqoo/1click-ecom-detailpage)、
[vane-gpt-image-skills](https://github.com/VaneAi888/vane-gpt-image-skills)、
[awesome-gpt-image-2](https://github.com/freestylefly/awesome-gpt-image-2) 等）。

这些内容的版权与许可归各上游作者所有，使用与再分发时请遵循对应仓库的许可条款；上游未声明许可的，
请自行联系作者确认。MIT 许可仅覆盖本仓库自行编写的代码。

## 贡献

欢迎提交 issue 与 PR，流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。安全问题请不要开公开 issue，
按 [SECURITY.md](SECURITY.md) 私密报告。

## 许可

[MIT](LICENSE) © 2026 Lemon
