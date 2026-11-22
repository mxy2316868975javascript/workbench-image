/**
 * 提示词模板：内置模板（代码定义构建逻辑）+ 自定义模板（{{key}} 占位替换）。
 * 内置首号模板 ecom-pdp 来自 coolqoo/1click-ecom-detailpage 技能：
 * 转化驱动力诊断 → Campaign Style Lock → 按图片类型逐张产出英文生图 Prompt。
 */
import { gzFields, buildGz } from './gz-build'
import { lumaRescueFields, buildLumaRescue, lumaRescueNote } from './lumarescue'
import type { AnyTemplate, BuiltinTemplate, CustomTemplate, GenParams, TemplateField } from './types'

/* ---------------- ecom-pdp 内置模板 ---------------- */

/** Campaign Style Lock：视觉方向 → 风格锁定段落（默认值来自技能原文） */
const STYLE_LOCKS: Record<string, string> = {
  auto: 'consistent premium cross-border ecommerce visual system across the entire image set; fixed palette of clean off-white background, deep charcoal text, one product-matched accent color, and one soft secondary accent; neutral-cool studio lighting; modern geometric sans-serif headline placeholders only; consistent rounded rectangular info labels; consistent thin-line icon style; clean high-end product photography mixed with minimal infographic elements; stable product scale and placement; generous whitespace; fixed color palette, single font system, stable backgrounds, consistent lighting, matched icon styles',
  tech: 'consistent premium tech ecommerce visual system; deep navy-to-charcoal gradient background, electric blue accent color, silver product highlights; cool studio lighting with crisp specular reflections; modern geometric sans-serif headline placeholders; thin-line tech icon style; stable product scale and placement; generous whitespace',
  home: 'clean household care ecommerce visual system; bright airy white background, soft mint and sky-blue accent palette; natural soft daylight; rounded friendly info cards; consistent thin-line icon style; fresh tidy scene styling; stable product scale and placement',
  gift: 'warm gift editorial ecommerce visual system; cream and blush palette with gold foil accents; soft warm lighting with gentle shadows; elegant serif-feel headline placeholders; delicate ribbon and packaging styling; consistent premium gift presentation',
  outdoor: 'outdoor lifestyle ecommerce visual system; natural golden-hour daylight, earthy terrain palette with one saturated accent; rugged authentic textures; adventure-scene styling; product shown in genuine outdoor use; stable scale and placement',
}

/** 转化驱动力 → 驱动声明段落 */
const DRIVER_LINES: Record<string, string> = {
  visual: 'Conversion driver: Visual-Driven — stop the scroll in 1 second; communicate style, texture, finish and giftability through the visual itself.',
  pain: 'Conversion driver: Pain-Driven — sequence: problem snapshot, solution mechanism, benefit proof, trust frame, offer + CTA; make the problem concrete and the relief obvious.',
  emotion: 'Conversion driver: Emotion-Value-Driven — identity narrative, symbolic payoff, social or gifting cue, low-friction CTA with emotional reinforcement.',
}

interface EcomImageType {
  value: string
  label: string
  frame: string
  composition: string
  size: string
}

/** 图片类型：主图 5 种（1024x1024）+ 详情页 10 种（1024x1536，来自技能通用 PDP 序列） */
const IMAGE_TYPES: EcomImageType[] = [
  {
    value: 'hero-thumb', label: '主图 · 首屏冲击（Thumb-stop）', size: '1024x1024',
    frame: 'Hero image #1 (thumb-stop visual claim): make the shopper understand the core value in 1 second while scrolling a marketplace feed.',
    composition: 'centered hero product shot on clean background, generous negative space, single bold focal point, mobile-thumbnail safe margins, main-image composition',
  },
  {
    value: 'hero-feature', label: '主图 · 卖点特写', size: '1024x1024',
    frame: 'Hero image #2 (key feature close-up): spotlight the single most persuasive feature so shoppers grasp it without reading.',
    composition: 'tight macro close-up on the key feature area, thin-line callout labels pointing to details, product partially visible for context',
  },
  {
    value: 'hero-scene', label: '主图 · 场景适配', size: '1024x1024',
    frame: 'Hero image #3 (use scenario fit): show the product in its real usage context so buyers can place it in their own life.',
    composition: 'lifestyle scene with the product in natural use, shallow depth of field, product clearly the subject, environment cropped for mobile',
  },
  {
    value: 'hero-compare', label: '主图 · 新旧对比', size: '1024x1024',
    frame: 'Hero image #4 (ordinary vs upgraded comparison): contrast the ordinary option against this product on observable differences.',
    composition: 'clean split-frame comparison, left = ordinary alternative, right = this product, thin vertical divider, short verdict labels above each side',
  },
  {
    value: 'hero-offer', label: '主图 · 优惠+CTA', size: '1024x1024',
    frame: 'Hero image #5 (offer close): bundle, guarantee and CTA closing frame that makes action easy.',
    composition: 'product with bundle items arranged neatly, offer banner placeholder area at the bottom, minimal CTA badge, risk-reassurance cue',
  },
  {
    value: 'detail-promise', label: '详情页 · 首屏承诺', size: '1024x1536',
    frame: 'PDP detail #1 (above-the-fold promise): who it helps and what problem or desire it solves, shown as a vertical scroll-stopper.',
    composition: 'vertical mobile-first scroll-stopper, product hero with promise headline area, strong top-to-bottom reading hierarchy',
  },
  {
    value: 'detail-pain', label: '详情页 · 痛点放大', size: '1024x1536',
    frame: 'PDP detail #2 (pain / desire amplification): make the current inconvenience, risk or loss concrete and visual before the relief appears.',
    composition: 'problem scene in the upper area, visual contrast toward the relief below, thin infographic arrows connecting pain points to outcomes',
  },
  {
    value: 'detail-mechanism', label: '详情页 · 原理图解', size: '1024x1536',
    frame: 'PDP detail #3 (mechanism explanation): show how the product works, explained visually without long text.',
    composition: 'exploded or cutaway diagram style, numbered thin-line callouts, internal structure highlighted, clean sectioned layout',
  },
  {
    value: 'detail-benefits', label: '详情页 · 卖点堆栈', size: '1024x1536',
    frame: 'PDP detail #4 (benefit stack): present 2-4 scan-friendly functional benefits as an icon-driven grid.',
    composition: 'icon plus short-label grid, consistent rounded info cards, one benefit per card, balanced vertical rhythm',
  },
  {
    value: 'detail-steps', label: '详情页 · 使用步骤', size: '1024x1536',
    frame: 'PDP detail #5 (usage steps): 3-4 simple steps shown as a numbered visual sequence.',
    composition: 'numbered step-by-step layout with a small product scene per step, step numbers as large visual anchors',
  },
  {
    value: 'detail-scenario', label: '详情页 · 场景覆盖', size: '1024x1536',
    frame: 'PDP detail #6 (scenario coverage): where, when and who uses it, showing the before / after state across contexts.',
    composition: 'multi-panel scene grid, consistent crop and styling per panel, labels naming each scenario',
  },
  {
    value: 'detail-compare', label: '详情页 · 对比图（必须）', size: '1024x1536',
    frame: 'PDP detail #7 (mandatory comparison frame): ordinary option vs this product, based on observable differences only.',
    composition: 'two-column comparison table layout with thin dividers, verdict labels per row, product rendered on the winning side',
  },
  {
    value: 'detail-review', label: '详情页 · 用户好评（必须）', size: '1024x1536',
    frame: 'PDP detail #8 (mandatory customer review frame): dedicated social-proof frame with a 5-star review-style quote.',
    composition: 'review-card layout, five-star rating graphic, short quote placeholder, avatar placeholder circle, authentic marketplace review styling',
  },
  {
    value: 'detail-trust', label: '详情页 · 信任背书', size: '1024x1536',
    frame: 'PDP detail #9 (trust stack): materials, packaging, warranty and proof placeholders that de-risk the purchase.',
    composition: 'trust-badge grid with thin-line icons and short guarantee labels, packaging shot included, credible balanced layout',
  },
  {
    value: 'detail-faq', label: '详情页 · FAQ+CTA', size: '1024x1536',
    frame: 'PDP detail #10 (FAQ & CTA close): answer the top concerns and close with the offer plus a clear CTA.',
    composition: 'Q&A list layout with concise question lines, bottom CTA banner placeholder, risk-reversal badge near the CTA',
  },
]

export const ECOM_FIELDS: TemplateField[] = [
  { key: 'product', label: '产品名称与品类', type: 'text', required: true, placeholder: '例：便携榨汁杯 / 厨房小电器' },
  {
    key: 'market', label: '目标市场与渠道', type: 'select',
    options: ['Amazon US', 'Shopify 独立站', 'TikTok Shop', 'Walmart', '通用电商'],
  },
  {
    key: 'driver', label: '转化驱动力', type: 'select',
    options: ['Visual-Driven 视觉驱动', 'Pain-Driven 痛点驱动', 'Emotion-Value 情绪价值'],
  },
  { key: 'sellingPoints', label: '核心卖点（2-3 个）', type: 'textarea', required: true, placeholder: '例：30 秒出汁可清洗；Type-C 充电 12 杯续航；食品级材质' },
  { key: 'buyer', label: '买家与使用场景', type: 'textarea', placeholder: '例：健身人群在办公室/通勤路上快速补充蔬果摄入' },
  { key: 'headline', label: '图内主文案（英文 3-7 词，留空用占位）', type: 'text', placeholder: '例：Fresh Juice, Anywhere' },
  {
    key: 'style', label: '视觉方向', type: 'select',
    options: ['自动匹配', '高级科技感', '清新家居', '暖调礼品', '户外生活方式'],
  },
  { key: 'imageType', label: '图片类型', type: 'select', required: true, options: IMAGE_TYPES.map((t) => t.label) },
]

const STYLE_KEY_BY_LABEL: Record<string, string> = {
  '自动匹配': 'auto', '高级科技感': 'tech', '清新家居': 'home', '暖调礼品': 'gift', '户外生活方式': 'outdoor',
}
const DRIVER_KEY_BY_LABEL: Record<string, string> = {
  'Visual-Driven 视觉驱动': 'visual', 'Pain-Driven 痛点驱动': 'pain', 'Emotion-Value 情绪价值': 'emotion',
}

function buildEcomPrompt(values: Record<string, string>): { prompt: string; params?: Partial<GenParams> } {
  const product = values.product?.trim() || 'the product'
  const sellingPoints = values.sellingPoints?.trim() || 'the key differentiators shown in the reference'
  const buyer = values.buyer?.trim() || 'the typical buyer of this product category, in a realistic daily scenario'
  const market = values.market?.trim() || 'general ecommerce'
  const driverKey = DRIVER_KEY_BY_LABEL[values.driver ?? ''] ?? 'visual'
  const styleKey = STYLE_KEY_BY_LABEL[values.style ?? ''] ?? 'auto'
  const imageType = IMAGE_TYPES.find((t) => t.label === values.imageType) ?? IMAGE_TYPES[0]
  const headline = values.headline?.trim()

  const lines: string[] = [
    // 1. Campaign Style Lock（多图任务必填，固定复用）
    `Campaign Style Lock: ${STYLE_LOCKS[styleKey]}.`,
    '',
    // 2. Frame objective + conversion job + driver
    `Frame objective: ${imageType.frame}`,
    DRIVER_LINES[driverKey],
    '',
    // 3. Product, buyer scenario, scene
    `Product: ${product}.`,
    `Key selling points: ${sellingPoints}.`,
    `Target buyer & scenario: ${buyer}.`,
    `Market & channel: ${market}; follow that platform's main-image and detail-page visual conventions.`,
    '',
    // 4. On-image copy（Image Copy Gate：短文案、大字、强层级）
    headline
      ? `On-image headline: "${headline}".`
      : 'On-image headline: short readable 3-7 word English headline placeholder.',
    'On-image labels: 2-4 concise English labels derived from the key selling points, each under 3 words.',
    'Proof / offer line: include only if evidence-backed; otherwise omit.',
    '',
    // 5. Composition / camera / hierarchy
    `Composition: ${imageType.composition}; strong visual hierarchy, product never cropped at edges, mobile-first readability.`,
    '',
    // 6. Lighting / color / material / texture
    `Lighting & color: follow the Campaign Style Lock lighting and palette; render the product's true material and texture faithfully.`,
    '',
    // 7. Realism level & platform fit
    `Realism: photorealistic commercial product photography, ecommerce platform fit for ${market}.`,
    '',
    // 8. Size / aspect ratio
    `Aspect ratio: ${imageType.size} ${imageType.size === '1024x1536' ? '(vertical portrait detail frame)' : '(square main image)'}.`,
    '',
    // 9. Cleanliness constraints
    'Cleanliness constraints: clean layout with short readable headline placeholders, concise labels only; uncluttered composition; stable background; no watermarks; no third-party brand logos or platform badges.',
  ]

  return { prompt: lines.join('\n'), params: { size: imageType.size } }
}

export const ECOM_TEMPLATE: BuiltinTemplate = {
  id: 'builtin-ecom-pdp',
  name: '跨境电商详情页 / 主图（ecom-pdp）',
  description:
    '来自 1click-ecom-detailpage 技能：转化驱动力诊断 + Campaign Style Lock + 主图 5 种 / 详情页 10 种图片类型，产出可直接执行的英文生图 Prompt（详情页自动 1024×1536）',
  builtin: true,
  note: '模板默认关闭平台合规审查：对比图与好评图允许模拟营销内容（技能规则），请在发布前自行核实事实。详情页类型自动使用 1024×1536 竖版；多张详情页请保持同一视觉方向以复用 Style Lock。',
  fields: ECOM_FIELDS,
  build: buildEcomPrompt,
}


/* ---------------- PPT 逐页生图（Ronnie2025/codex-ppt-skill 路径 A） ---------------- */

const PPT_LAYOUT_OPTIONS = [
  '封面（左标题区 + 沉浸式主题视觉 + 底部 Logo 区）',
  '目录（大编号 + 错落章节条）',
  '核心结论（三段结论链 / 主张堆栈）',
  '场景地图（分层地图 / 泳道 / 节点网络）',
  '证据墙（资料卡 / 趋势线 / 时间轴）',
  '风险升级（从左到右风险演进链）',
  '优先级矩阵（高/中/低热力象限）',
  '方案架构（接入层 / 控制面 / 链路 / 审计运营）',
  '能力映射（风险节点连能力模块）',
  '评测体系（题集 / 攻击 / 执行 / 指标流水线）',
  '闭环飞轮（发现 → 分析 → 优化 → 验证 → 上线）',
  '路线图（阶段化路径与能力里程碑）',
  '结束卡片（行动建议 / 验收指标 / 下一步）',
  '自定义版式（在视觉元素里描述）',
]

function buildPpt(values: Record<string, string>): { prompt: string; params?: Partial<GenParams> } {
  const topic = values.topic?.trim() || '商业汇报'
  const audience = values.audience?.trim() || '业务与决策干系人'
  const primary = values.primary?.trim() || '深蓝'
  const secondary = values.secondary?.trim() || '浅蓝'
  const accent = values.accent?.trim() || '红色仅用于强调'
  const title = values.title?.trim() || topic
  const goal = values.goal?.trim() || `让${audience}理解「${title}」的核心主张`
  const bullets = (values.points ?? '')
    .split('\n')
    .map((l) => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 4)
  const layout = values.layout?.trim() || PPT_LAYOUT_OPTIONS[0]
  const visual = values.visual?.trim() || '与主题相关的简洁示意图元素'
  const logoNote = values.logo?.trim() || '右上角预留真实 Logo 区域'

  const globalBlock = [
    '【全局风格块】',
    `使用 16:9 横版演示文稿构图，目标 1920x1080 或更高。`,
    `汇报主题：${topic}；受众：${audience}。`,
    `使用选定配色：主色 ${primary}，辅助色 ${secondary}，强调色 ${accent}，强调色只小面积使用。`,
    '页面适合现场讲解：标题强、层级清晰、中文可读、留白充足。',
    '避免所有页面都变成同一种卡片网格，整套 PPT 要有节奏变化。',
    '不要绘制任何真实 Logo，给后处理叠加真实 Logo 留出干净区域。',
  ].join('\n')

  const bulletLines = bullets.length > 0 ? bullets.map((b) => `- ${b}`).join('\n') : '- 核心要点一\n- 核心要点二\n- 核心要点三'
  const layoutLine = `${layout}。`

  const pagePrompt = [
    `页面标题：`,
    title,
    '',
    `页面目标：`,
    goal,
    '',
    `核心文字：`,
    bulletLines,
    '',
    `版式结构：`,
    layoutLine,
    '',
    `视觉元素：`,
    visual,
    '',
    `风格提示词：`,
    `16:9 整页 PPT 图片，${primary}为主色、${secondary}为辅助色，${accent}只小面积强调，商务专业气质，干净背景，中文文字清晰，层级专业，不要像普通模板页。`,
    '',
    `Logo 规则：`,
    `${logoNote}。不要生成 Logo、伪 Logo、品牌标识、水印、二维码或印章。`,
    '',
    `负向约束：`,
    '不要水印、二维码、长 URL、伪 Logo、乱码、虚假数据、未经确认的信息、内部敏感内容、拥挤脚注、不可读小字。',
  ].join('\n')

  const prompt = `${globalBlock}\n\n${pagePrompt}`
  return { prompt, params: { size: '1536x1024' } }
}

export const PPT_TEMPLATE: BuiltinTemplate = {
  id: 'builtin-ppt-page',
  name: 'PPT 逐页生图（toB 商业汇报）',
  description:
    '来自 Ronnie2025/codex-ppt-skill 路径 A：中文 toB 商业汇报的整页生图——全局风格块（主色/辅助色/强调色）+ 逐页提示词（页面标题/目标/核心文字/版式结构/视觉元素/Logo 规则/负向约束），13 种常用版式可选，16:9 横版',
  builtin: true,
  note: '按页生成：每页填一次「页面标题 / 页面目标 / 核心要点」，逐页填入生成。图片型 PPT 页不可在 PowerPoint 内编辑；真实 Logo、二维码、印章请后期叠加，不要交给生图。整套 PPT 的封装（PPTX/PDF/PNG）使用原仓库 scripts/package_image_deck.py。',
  fields: [
    { key: 'topic', label: '汇报主题', type: 'text', required: true, placeholder: '例：数据安全治理方案汇报' },
    { key: 'audience', label: '受众与场景', type: 'text', placeholder: '例：客户高管售前交流 / 内部复盘' },
    { key: 'primary', label: '主色', type: 'text', placeholder: '深蓝' },
    { key: 'secondary', label: '辅助色', type: 'text', placeholder: '浅蓝' },
    { key: 'accent', label: '强调色', type: 'text', placeholder: '红色仅用于强调' },
    { key: 'title', label: '本页标题', type: 'text', required: true, placeholder: '例：风险升级路径：从误答到真实环境副作用' },
    { key: 'goal', label: '页面目标', type: 'textarea', placeholder: '这一页要让受众理解什么' },
    { key: 'points', label: '核心要点', type: 'textarea', placeholder: '每行一条，2-4 条短要点' },
    { key: 'layout', label: '版式结构', type: 'select', options: PPT_LAYOUT_OPTIONS },
    { key: 'visual', label: '视觉元素', type: 'textarea', placeholder: '例：控制台、系统节点、风险告警三角、流程箭头' },
    { key: 'logo', label: 'Logo 说明', type: 'text', placeholder: '例：右上角预留真实 Logo 区域' },
  ],
  build: buildPpt,
}


const RECIPE_BODY_C = `
A modern, realistic culinary infographic poster,
presenting the complete professional recipe of
《红烧肉 · 顶级配方》.

OVERALL STYLE:
High-end modern culinary editorial combined with professional cooking instruction.
Clean, precise, realistic, restrained.
Feels like a culinary institute teaching board or Michelin test kitchen manual.
Educational clarity is the primary goal.

LANGUAGE & TEXT QUALITY (ABSOLUTE PRIORITY):
All text must be in standard simplified Chinese only.
High-definition, print-quality Chinese characters.
No traditional Chinese.
No misspellings.
No incorrect or distorted characters.
No pseudo-text.

IMPORTANT TEXT RULES:
All text must be rendered as natural printed book text.
Do NOT display any markdown symbols or formatting characters.
Do NOT show characters such as:
#, ##, ###, -, *, |, >, \`\`\` or bullet symbols.
Section hierarchy must be expressed through layout, spacing, font size, and alignment only.

If needed, rewrite structured content into clean natural language paragraphs or aligned tables.

BACKGROUND:
Clean neutral background with subtle texture
(light warm gray or off-white).
Soft even studio lighting.
No patterns, no decorative backgrounds.
High contrast for long readable text.

TYPOGRAPHY:
Main title in modern, bold, highly legible Chinese typography.
Section titles in slightly larger or heavier font weight.
Body text in clean professional Chinese type.
Comfortable line spacing for dense instructional content.
Tables must be clean, aligned, and grid-based without ASCII characters.

LAYOUT STRUCTURE (CRITICAL):
Aspect ratio 16:9.
Double-row horizontal layout with clear blank space separating rows.
Strict grid system.
Visual separation achieved through spacing and alignment, not symbols.

UPPER ROW CONTENT (VISUAL SECTIONS):
Dish introduction (origin, flavor profile, serving context).
Ingredient lists grouped logically (main ingredients, secondary ingredients, seasonings).
Core principles or key logic summarized in short, readable statements.

LOWER ROW CONTENT (VISUAL SECTIONS):
Preparation work and tools.
Cooking process divided into stages with time and heat control.
Critical checkpoints, warnings, and professional tips.
Final quality standards and common questions.

IMAGERY (REALISTIC, EDUCATIONAL):
High-quality realistic food photography:
raw ingredients,
key cooking stages,
final result with clean professional plating.
Images must support understanding, not distract.

GRAPHIC ELEMENTS (FUNCTIONAL ONLY):
Minimal modern diagrams:
time indicators,
heat level markers,
process flow arrows.
Flat, technical style.
No decorative icons.

COLOR SYSTEM:
Neutral professional palette:
black, dark gray, warm gray, off-white.
One restrained accent color for emphasis only.
No bright or playful colors.

STRICT EXCLUSIONS:
No markdown characters.
No bullet symbols.
No decorative-only graphics.
No cultural motifs.
No cluttered collage.
No illegible characters.

FINAL RULE:
Render the content exactly like a professionally typeset cookbook page,
not a markdown document or note file.
`

const RECIPE_BODY_A = `
A high-quality vertical educational infographic poster in a traditional Chinese retro style,
designed for 《{{菜名}} 顶级配方》 by 大师秘籍.

BACKGROUND & MATERIAL:
Soft radial vignette on aged rice paper with visible fiber texture,
faint tea-stain marks,
subtle watermark of Song-dynasty culinary vessel at 8% opacity.
Warm ivory base (#F9F5EC).
Elegant ink-wash atmosphere, print-ready, museum-grade texture.

TYPOGRAPHY SYSTEM:
All body text in Noto Serif CJK SC (思源宋体), high legibility.
Primary titles in bold Chinese calligraphy (Yan Zhenqing style).
Secondary headers in refined semi-cursive (Xingshu).
Author signature in small seal script.

COLOR PALETTE (Elegant Ink):
Ink black, vermilion (#C3272B), celadon (#8BAF98),
amber (#D4A017), rice paper white.
Low saturation, restrained, traditional Chinese aesthetics.

LAYOUT PRINCIPLES:
Vertical aspect ratio 2:3.
40% negative space, generous padding.
Top-heavy title, middle instructional emphasis,
bottom 30% visually led by icons and process illustrations.
Clear visual hierarchy, no clutter, editorial layout quality.

RECIPE CONTENT HIGHLIGHTS:
- Main ingredients: [主要食材列表]
- Key technique: [核心技法]
- Distinctive flavor: [风味特点]
- Cooking time: [烹饪时间]

DECORATIVE ELEMENTS (SUBTLE):
Ruyi clouds, auspicious motifs, seal marks, ink borders.
Opacity strictly controlled (5–12%).
Decoration must support information, never decorative-only.

IMAGE QUALITY:
Ultra-high resolution, studio lighting for food elements,
sharp focus, no blur, no distortion, no pixelation.
Educational + collectible poster quality.

STRICT EXCLUSIONS:
No Western utensils.
No modern appliances unless explicitly required by recipe.
No illegible characters.
No excessive text density.
No irrelevant decorative graphics.
`

const RECIPE_BODY_B = `
A refined Chinese literati-style culinary infographic,
designed as a classical horizontal recipe manuscript scroll,
presenting the complete recipe of
《{{菜名}} · 顶级配方》.

OVERALL STYLE:
Traditional Chinese literati culinary manuscript.
Horizontal scroll reading experience.
Calm, scholarly, restrained, archival.
Text-first composition with subtle supporting illustrations.
Feels like a well-preserved hand-copied cooking scroll.

LANGUAGE & TEXT QUALITY (ABSOLUTE PRIORITY):
All text must be in standard simplified Chinese only.
High-definition, print-quality Chinese characters.
No traditional Chinese characters.
No misspellings.
No incorrect or distorted characters.
No pseudo-text.
Text accuracy and legibility override all visual effects.

BACKGROUND:
Warm ivory handmade rice paper texture.
Extremely subtle fiber grain.
Soft ink-wash gradients near the left and right edges only.
Large horizontal breathing space.
Quiet, timeless, breathable.

TYPOGRAPHY:
Main title in restrained, dignified Chinese calligraphy,
placed slightly left of center.
Readable, scholarly, not expressive.
Body text in classical Song-style serif Chinese.
Vertical text columns are allowed but arranged left-to-right.
Generous line spacing.
Clear paragraph rhythm.
Resembles annotated manuscript scroll pages.

LAYOUT STRUCTURE:
Horizontal scroll-inspired layout.
Aspect ratio 16:9.
Multiple vertical text columns flowing from left to right.
Asymmetrical but balanced composition.
No boxed sections, no frames.
Sections separated by spacing and rhythm only.

CONTENT ORGANIZATION (VISUAL FLOW):
From left to right:
- Dish introduction and flavor logic
- Ingredient ratios and seasoning composition
- Key preparation techniques
- Cooking time and heat control
- Slicing, resting, or finishing notes

Small vertical headings mark transitions.
Text reads continuously like a scroll.

GRAPHIC ELEMENTS (VERY SUBTLE):
Small ink-style illustrations used as visual pauses:
- Aromatic spices
- Main protein symbol
- Simple cookware sketches
Flat, minimal, monochrome.
Secondary to text.
No realism, no shading.

COLOR SYSTEM:
Ink black dominant.
Very light vermilion used sparingly for seals, stamps, or emphasis.
Overall near-monochrome.

DECORATION:
Minimal seal stamps near the title or section breaks.
Occasional light brush dividers only when text naturally pauses.
No decorative patterns.
No borders.

RULE:
Text is the hero.
Illustrations serve reading rhythm.
Beauty through restraint.
Nothing loud.
Nothing modern.

--ar 16:9 --v 6.1 --q 2 高清简体中文
Text accuracy is more important than visual complexity.
If necessary, simplify graphics to preserve text clarity.
`


/* ---------------- 菜谱海报（cclank/recipe-generator） ---------------- */

const RECIPE_TEXT_DEFAULT = '不加任何文字。'

function recipeFields(values: Record<string, string>): TemplateField[] {
  const style = values.style ?? 'C'
  const base: TemplateField[] = [
    { key: 'dish', label: '菜名', type: 'text', required: true, placeholder: '例：红烧肉 / 白切鸡 / 黑松露鱼籽酱国粹烤鸭' },
    { key: 'style', label: '海报风格', type: 'select', options: [
      { value: 'C', label: '现代写实风（默认，横版 16:9）' },
      { value: 'A', label: '传统海报风（竖版 2:3）' },
      { value: 'B', label: '文人卷轴风（横版 16:9）' },
    ] },
  ]
  if (style === 'A') {
    return [
      ...base,
      { key: 'ingredients', label: '主要食材列表', type: 'textarea', placeholder: '例：五花肉 500g、冰糖 30g、绍兴黄酒 60ml' },
      { key: 'technique', label: '核心技法', type: 'text', placeholder: '例：炒糖色 + 小火慢焖 90 分钟' },
      { key: 'flavor', label: '风味特点', type: 'text', placeholder: '例：咸甜适口、肥而不腻、入口即化' },
      { key: 'time', label: '烹饪时间', type: 'text', placeholder: '例：准备 20 分钟 + 烹制 90 分钟' },
    ]
  }
  return base
}

function buildRecipe(values: Record<string, string>): { prompt: string; params?: Partial<GenParams> } {
  const dish = values.dish?.trim() || '家常菜'
  const style = values.style ?? 'C'
  let body = style === 'A' ? RECIPE_BODY_A : style === 'B' ? RECIPE_BODY_B : RECIPE_BODY_C
  body = body.replace(/\{\{菜名\}\}/g, dish)
  if (style === 'A') {
    body = body
      .replace(/\[主要食材列表\]/g, values.ingredients?.trim() || '以菜谱食材清单为准')
      .replace(/\[核心技法\]/g, values.technique?.trim() || '以菜谱核心技法为准')
      .replace(/\[风味特点\]/g, values.flavor?.trim() || '以菜谱风味描述为准')
      .replace(/\[烹饪时间\]/g, values.time?.trim() || '以菜谱时间为准')
  }
  if (style !== 'A') body = body.replace(/【文字】/g, RECIPE_TEXT_DEFAULT)
  body += '\n所有文字使用高清简体中文，印刷级清晰，无乱码、无错字。'
  return { prompt: body, params: { size: style === 'A' ? '1024x1536' : '1536x1024' } }
}

export const RECIPE_TEMPLATE: BuiltinTemplate = {
  id: 'builtin-recipe',
  name: '菜谱海报（顶级配方）',
  description:
    '来自 cclank/recipe-generator 技能：菜名 → 米其林级菜谱海报——现代写实风（横版教程海报）、传统海报风（竖版收藏海报，可填食材/技法/风味/时间）、文人卷轴风（文字为主的横版卷轴）三种风格',
  builtin: true,
  note: '默认现代写实风（横版 16:9 教程海报）。选传统海报风（竖版 2:3）时可额外填写食材 / 技法 / 风味 / 时间，会填入海报的 RECIPE CONTENT HIGHLIGHTS 区域。完整菜谱文档（准备工作 / 步骤 / 技巧）按原技能流程由对话生成，本模板产出海报生图 Prompt。',
  fields: recipeFields,
  build: buildRecipe,
}



/* ---------------- Gorden 图片型 PPT（GordenSun/GordenSuperPPTSkills） ---------------- */

/** 视觉框架目录（§4：内容结构 → 图表形式；全篇每页不重复） */
const GORDEN_FRAMEWORKS = [
  '房子型架构图（屋顶=愿景，立柱=支柱，地基=底座）',
  '3D 莫比乌斯环 / 无限循环符号',
  'Bento 便当盒看板（大小不一网格单元）',
  '同心圆雷达扫描图（雷达环+扇区+节点）',
  '多层 3D 架构图（3-5 层立体堆叠+数据流）',
  'DNA 双螺旋进化链（双螺旋+横档节点）',
  '双圆交织（Venn 协同效应）',
  '三环重叠 / 多重同心圆',
  '五边形 / 六边形闭环（中心核心图标）',
  '鱼骨图（Ishikawa 问题诊断）',
  '漏斗图 / 层层过滤转化',
  'SWOT 矩阵 / 四象限',
  '3D 折叠彩带箭头（线性增长）',
  '锯齿状时间轴 / 3D 折叠时间带',
  '半圆仪表盘 / 环形进度',
  '金字塔 / 堆叠层（层级优先级）',
  'Hub-Spoke 放射（中心辐射概念图）',
  '全景 Dashboard（多卡片+迷你图+雷达+柱）',
  '全栈流融合（泳道+汇流）',
]

/** 风格库（§5） */
const GORDEN_STYLES = [
  { value: 'luxury-dense', label: '豪华高密度信息图（默认）' },
  { value: 'tech-business', label: '科技商务 / 浅色信息图' },
  { value: 'minimal', label: '简洁 / 极简商务干净' },
  { value: 'cute', label: '卡通 / 可爱 / 童趣' },
  { value: 'ink', label: '水墨 / 国风 / 中式' },
  { value: 'sketch', label: '手绘 / sketch 便签' },
  { value: 'blueprint', label: '科技 / 蓝图' },
  { value: 'magazine', label: '杂志 / 编辑' },
  { value: 'dark', label: '暗黑 / 大气' },
]

/** 风格 → 视觉基调段落（§5 风格库） */
const GORDEN_STYLE_LINES: Record<string, string> = {
  'luxury-dense': '深色或品牌色底（藏青/墨绿/酒红/科技深蓝）+ 金属/玻璃质感卡片 + 霓虹或金色强调 + 大量数据模块；信息密度高、层级丰富、装饰精致',
  'tech-business': '浅色背景（白/极浅冷灰 #F4F6F9）+ 右上角极淡科技网格纹理；白色卡片（细投影、圆角）+ 彩色标题条，要点带小号徽标图标，指标特大号红字，底部满幅总结横幅；干净、专业、信息密度高',
  minimal: '大量留白，单一强调色 + 灰阶，1 个核心元素，克制装饰',
  cute: '圆润形状、明快撞色、手绘插画图标、活泼字体',
  ink: '宣纸纹理、水墨晕染、留白意境、印章红点、衬线/楷体气质',
  sketch: '手绘线条、便签/黑板质感、不规则边框',
  blueprint: '网格底纹、电路/蓝图线条、冷色调、技术感标注',
  magazine: '强对比大标题、分栏、引用框，Wired/The Verge 气质',
  dark: '深色全幅、电影感光影、强戏剧性',
}

function gordenFields(values: Record<string, string>): TemplateField[] {
  const role = values.role ?? '内容'
  const base: TemplateField[] = [
    { key: 'role', label: '本页角色', type: 'select', options: [
      { value: '封面', label: '封面' },
      { value: '内容', label: '内容页' },
      { value: '章节页', label: '章节页' },
      { value: '结尾', label: '结尾' },
    ] },
    { key: 'title', label: '页面标题（叙事化，逐字照排）', type: 'text', required: true, placeholder: '例：用量 6 个月翻倍：交付体系如何跟上' },
    { key: 'coreInfo', label: '核心信息（一句话）', type: 'text', required: true, placeholder: '例：通过三维金字塔展示从物理交付到价值实现的分层路径' },
    { key: 'framework', label: '视觉框架', type: 'select', options: GORDEN_FRAMEWORKS },
    { key: 'style', label: '风格', type: 'select', options: GORDEN_STYLES },
    { key: 'primary', label: '主色', type: 'text', placeholder: '例：#1B2A4A 或 藏青' },
    { key: 'secondary', label: '辅色', type: 'text', placeholder: '例：#C9A227 金色' },
    { key: 'accent', label: '强调色', type: 'text', placeholder: '例：#E85D2A' },
    { key: 'content', label: '详细内容（厚内容，每行一段）', type: 'textarea', required: true, placeholder: '例：现状与数据 / 方案与分工 / 成效与 ROI（全用真实数据，出图时会蒸馏成页面文字）' },
    { key: 'modules', label: '模块与页面文字（verbatim）', type: 'textarea', placeholder: '每行一个模块：子标签「..」标题「..」要点「..」「..」重点数字「..」' },
    { key: 'icons', label: '图标语义', type: 'text', placeholder: '例：增长箭头、齿轮、盾牌、灯泡（扁平商务风）' },
    { key: 'texture', label: '背景纹理', type: 'text', placeholder: '例：拓扑网格 / 光晕与流云纹 / 碳纤维' },
  ]
  if (role === '封面') {
    return base.filter((f) => f.key !== 'coreInfo').concat([
      { key: 'subTitle', label: '副标题 / 定位说明', type: 'text', placeholder: '例：面向全球客户的交付与增值服务体系' },
    ])
  }
  return base
}

function buildGorden(values: Record<string, string>): { prompt: string; params?: Partial<GenParams> } {
  const role = values.role ?? '内容'
  const title = values.title?.trim() || '未命名页面'
  const coreInfo = values.coreInfo?.trim() || `本页呈现「${title}」的核心逻辑与结果`
  const framework = values.framework ?? 'Bento 便当盒看板（大小不一网格单元）'
  const style = values.style ?? 'tech-business'
  const styleLine = GORDEN_STYLE_LINES[style] ?? GORDEN_STYLE_LINES['tech-business']
  const primary = values.primary?.trim() || '品牌主色'
  const secondary = values.secondary?.trim() || '辅色'
  const accent = values.accent?.trim() || '强调色'
  const content = values.content?.trim() || ''
  const modules = values.modules?.trim() || ''
  const icons = values.icons?.trim() || '增长箭头、齿轮、盾牌、灯泡（扁平商务风，全套同风格）'
  const texture = values.texture?.trim() || '极淡科技网格纹理'

  const contentBlock = content
    ? ['【详细内容（设计者参考 · 出图时蒸馏成页面文字，不要整段糊上）】', content].join('\n')
    : ''
  // 页面文字（逐字照排）：主标题必入；内容页带导语；封面带副标题；模块文字逐字
  const pageTextLines: string[] = [`  - 主标题：「${title}」（特大号加粗）`]
  if (role !== '封面' && coreInfo) pageTextLines.push(`  - 导语：「${coreInfo}」（关键词高亮）`)
  if (role === '封面' && values.subTitle?.trim()) pageTextLines.push(`  - 副标题：「${values.subTitle.trim()}」`)
  if (modules) pageTextLines.push('  - 模块/卡片：' + modules)
  const pageText = pageTextLines.length > 0 ? ['【页面文字（逐字照排，必须完全使用以下文字，不得改写、不得编造）】', ...pageTextLines].join('\n') : ''

  const blocks: string[] = [
    '生成一页 16:9 的图片，内容形式是 PPT 汇报图（宽屏，高分辨率）。整体按该比例构图，四周留出适度页边距，上下边缘各预留少量空白安全边（关键内容不要贴到最上/最下边缘）。',
    `【整体风格】${styleLine}。主色 ${primary} + 辅色 ${secondary} + 强调色 ${accent}（强调色小面积使用）`,
    `【本页角色】${role}`,
    `【核心信息】${coreInfo}`,
    `【视觉框架】${framework}（全篇每页选不同框架，不重复）。`,
    '【版式结构】落实复杂度清单：顶部小节标题区（编号+标题+短分割线）+ 一行导语（关键词高亮）；中部主图表 / N 列模块卡片，每个模块内含子标签横幅 + 要点列表（带图标）+ 特大号重点数字；侧栏/四角 callout 标注框；底部通栏总结横幅。',
    '【图表形式】按内容结构匹配所选视觉框架；不要在图上标注形式的名称。',
  ]
  if (pageText) blocks.push(pageText)
  blocks.push('【图标/装饰】' + icons)
  blocks.push('【微件】标签药丸 / 进度条（含%）/ 连接线 / 指示箭头 / 节点编号——按需加入提升密度')
  blocks.push('【字号层级】重点数字 > 主标题 > 模块标题 > 子标签 > 正文要点；标题约为正文 2.5–3 倍，重点数字再放大；正文不要过小到难读，单卡正文控制在 2–4 行')
  if (contentBlock) blocks.push(contentBlock)
  blocks.push(`【背景纹理】${texture}`)
  blocks.push('【约束】不要页码/logo/水印；中文标点；文字清晰可读且零拼写错误；避免大面积纯绿色；满而不乱、严格对齐；数据零编造（完全使用用户提供的数据与专名）')

  const prompt = blocks.filter((b) => b && b.trim()).join('\n\n')
  return { prompt, params: { size: '1536x1024' } }
}

export const GORDEN_TEMPLATE: BuiltinTemplate = {
  id: 'builtin-gorden-ppt',
  name: 'Gorden 图片型 PPT（高密度信息图）',
  description:
    '来自 GordenSun/GordenSuperPPTSkills 的 GordenImagePPTGen：单页高密度豪华信息图——七段式稳定结构 + 19 种视觉框架 + 9 种风格库，页面文字逐字照排、数据零编造，产出 16:9 整页幻灯图（后续可用 GordenImage2PPTX 转可编辑 PPTX）',
  builtin: true,
  note: '铁律：①页面文字必须逐字写满真实内容，禁止占位符图；②数据零编造；③每页视觉框架不重复；④尽量避免大面积纯绿；⑤页脚干净不加页码 logo。厚内容（详细内容）出图时会蒸馏成页面文字，不要整段糊上。生成图片型 PPT 页后，可用原仓库 GordenImage2PPTX 转可编辑 PPTX。',
  fields: gordenFields,
  build: buildGorden,
}



/* ---------------- 电商执行卡（feichanggege/ecommerce-visual-copywriting-skill） ---------------- */

/** 图片任务定义（Step 4 主图任务 + 尺寸） */
const EVC_TASKS: Record<string, { label: string; job: string; size: string; rule: string }> = {
  kv1: {
    label: 'KV1 商品识别（首图）',
    job: '先认出是什么商品；购买理由放第二层，可省略',
    size: '1024x1024',
    rule: '主标题必须包含商品名 / 品类词，先完成识别再讲卖点；主体整体关系、关键形态与真实比例清楚；缩到移动端遮住副文案仍能说出商品品类',
  },
  benefit: {
    label: 'Benefit 卖点翻译',
    job: '把核心参数或功能翻译成用户收益',
    size: '1024x1024',
    rule: 'Feature → Advantage → Benefit → Evidence；把参数转成体感（数字配位置、体感或对照物）',
  },
  proof: {
    label: 'Proof 证据信任',
    job: '用真实证据建立信任',
    size: '1024x1024',
    rule: '产地、工艺、资质、检测、品牌证据只在证据账本「已确认 / 有依据」时使用；待补证改中性表达',
  },
  compare: {
    label: 'Compare 对比选择',
    job: '用客观维度降低选择成本',
    size: '1024x1024',
    rule: '基于可观察差异对比，不虚构竞品数据',
  },
  scene: {
    label: 'Scene 场景代入',
    job: '放入真实使用场景，强化代入',
    size: '1024x1024',
    rule: '真实使用场景，人物、道具服务商品识别',
  },
  spec: {
    label: 'Spec / CTA 规格决策',
    job: '规格、组合、适用条件或下一步决策信息',
    size: '1024x1536',
    rule: '规格表 / FAQ 单独排版，不堆进宣传标题区；套装澄清紧邻对应画面',
  },
}

const EVC_PLATFORMS = ['淘宝 / 天猫', '抖音小店', 'TikTok Shop', '小红书', '京东', '拼多多', '通用电商']

function countChars(s: string): number {
  // 字数含数字和标点，不含空白字符
  return s.replace(/\s/g, '').length
}

function evcFields(values: Record<string, string>): TemplateField[] {
  const fields: TemplateField[] = [
    { key: 'platform', label: '投放平台', type: 'select', options: EVC_PLATFORMS },
    { key: 'task', label: '图片任务', type: 'select', options: Object.entries(EVC_TASKS).map(([v, t]) => ({ value: v, label: t.label })) },
    { key: 'productName', label: '商品名称', type: 'text', required: true, placeholder: '例：厨房伸缩收纳架（KV1 主标题需含商品名 / 品类词）' },
    { key: 'subject', label: '画面主体描述', type: 'textarea', required: true, placeholder: '例：按原结构图展示完整架体与真实伸缩关系，继承产品配色' },
  ]
  if (values.task === 'spec') {
    fields.push({ key: 'specDetail', label: '规格 / 组合 / 适用条件', type: 'textarea', placeholder: '例：本品为单条装；承重 20kg（待补证不入稿）' })
  }
  fields.push(
    { key: 'title', label: '主标题（KV1 需含商品名，≤12 汉字）', type: 'text', required: true, placeholder: '例：厨房伸缩收纳架' },
    { key: 'subcopy', label: '副文案（每行一条，至多 2 条，每条 ≤18 汉字）', type: 'textarea', placeholder: '例：按需调节宽度' },
    { key: 'evidenceTag', label: '数字 / 证据标签（可选，须在证据账本内）', type: 'text', placeholder: '例：承重 20kg（已确认时才填）' },
    { key: 'renderMode', label: '文字渲染方式', type: 'select', options: [
      { value: 'blank', label: '留白排版（默认：预留文字区，后期叠字）' },
      { value: 'model', label: '模型出字（仅限 ≤8 字短标题，错字回退留白）' },
    ] },
    { key: 'styleLock', label: 'Style Lock（构图 / 色彩 / 光影 / 材质）', type: 'textarea', placeholder: '例：浅灰背景、柔光；商品整体第一落点；左上保留商品名区；底部预留注释区' },
    { key: 'topReasons', label: 'Top3 购买理由（FABE，可选）', type: 'textarea', placeholder: '每行一条：卖点 → 优势 → 收益 → 证据' },
    { key: 'evidenceNotes', label: '证据账本备注', type: 'textarea', placeholder: '例：承重 20kg 仅口述，待补证不入稿；平台规则待核验' },
  )
  return fields
}

function buildEvc(values: Record<string, string>): { prompt: string; params?: Partial<GenParams> } {
  const platform = values.platform ?? '通用电商'
  const taskId = values.task ?? 'kv1'
  const task = EVC_TASKS[taskId] ?? EVC_TASKS.kv1
  const productName = values.productName?.trim() || '未命名商品'
  const subject = values.subject?.trim() || productName
  const title = values.title?.trim() || productName
  const titleCount = countChars(title)
  const subLines = (values.subcopy ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 2)
  const tag = values.evidenceTag?.trim()
  const renderMode = values.renderMode === 'model' ? '模型出字' : '留白排版'
  const styleLock = values.styleLock?.trim() || '浅灰纯色背景、柔光、商品整体第一落点、左上保留商品名区、底部预留注释区'
  const taskRole = taskId === 'kv1' ? 'KV1 — Hero' : taskId.charAt(0).toUpperCase() + taskId.slice(1)

  // KV1 识别规则提示
  const kv1Rule = taskId === 'kv1' ? '商品图首张先回答「这是什么商品」：商品身份 → 识别性款式 → 至多一个辅助购买理由；主标题含商品名 / 品类词。' : ''
  const specRule = taskId === 'spec' ? '规格 / FAQ 单独排版，不堆进宣传标题区；套装与适用条件紧邻对应画面。' : ''
  const evidenceLine = values.evidenceNotes?.trim()
    ? `证据 / 平台备注：${values.evidenceNotes.trim()}`
    : '证据 / 平台备注：无待补证项'
  const tagLine = tag ? `数字 / 证据标签：「${tag}」（须已在证据账本内）` : '数字标签：无（不硬凑）'

  // 生图 Prompt（自包含：结构 / 材质 / 光线 / 构图 / Style Lock / 参考图约束 / 文字渲染方式）
  const genPrompt = [
    `电商商品图（${task.label}）· ${platform}。`,
    `商品：${productName}。画面主体：${subject}。`,
    kv1Rule,
    specRule,
    `Style Lock：${styleLock}。保持包装真实文字与 Logo 保真，不得为更好看擅自改包装结构、口味、规格或配件。`,
    `文字渲染方式：${renderMode === '留白排版' ? '留白排版——预留文字安全区（位置 / 占比 / 底色明暗），交付独立文字层后期叠字；包装已有文字与 Logo 保真' : `模型出字——主标题「${title}」用引号精确字符串、简体中文、清晰字体、按层级摆放；错字 / 漏字 / 乱码即回退留白排版`}`,
    `画幅：${task.size}。`,
    '禁止：包装变形、Logo 错误、文字乱码、结构新增、人物肢体异常、风格漂移、水印、二维码、竞品品牌元素。',
  ].filter(Boolean).join('\n')

  // 执行卡（SOP 十行单张执行卡 + 文案规格自检）
  const card = [
    `${taskRole}｜${productName} / ${platform}`,
    `任务：${task.job}`,
    `画面：${subject}；继承产品比例与 Style Lock`,
    `文案：标题「${title}」（${titleCount} 字）` +
      (subLines.length ? `；副文案 ${subLines.length} 条（每条 ${subLines.map((s) => countChars(s) + ' 字').join('、')}）` : '；副文案 0 条') +
      `；${tagLine}`,
    `排版：商品整体第一落点；${styleLock}`,
    `文字渲染方式：${renderMode === '留白排版' ? '留白排版（后期叠字）' : `模型出字：「${title}」`}`,
    `文案规格自检：标题 ${titleCount}${titleCount > 12 ? '（超 12 字建议精简）' : ''}；副文案 ${subLines.length} 条${subLines.some((s) => countChars(s) > 18) ? '（有超 18 字副文案）' : ''}；数字标签 ${tag ? 1 : 0} 个`,
    `Prompt：${genPrompt}`,
    `Negative Prompt：包装 / Logo 变形、额外配件、宣传字溢出、水印、乱码、风格漂移、人物肢体异常`,
    evidenceLine,
  ].join('\n')

  return { prompt: card, params: { size: task.size } }
}

export const EVC_TEMPLATE: BuiltinTemplate = {
  id: 'builtin-ecom-card',
  name: '电商执行卡（视觉文案 SOP）',
  description:
    '来自 feichanggege/ecommerce-visual-copywriting-skill：电商视觉策划 SOP——证据账本、成交驱动力（6 类）、KV1 商品识别规则、文案规格计数（主图标题 ≤12 字 / 副文案 ≤18 字）、留白排版 / 模型出字、广告法合规，产出十行执行卡 + 自包含生图 Prompt',
  builtin: true,
  note: (values) => {
    const taskId = values.task ?? 'kv1'
    const t = taskId === 'kv1' ? 'KV1 首图先回答「这是什么商品」：主标题含商品名 / 品类词，缩到移动端遮住副文案仍能认出品类。' : ''
    return (
      (t ? t + ' ' : '') +
      '证据纪律：事实宣称先过证据账本（已确认 / 有依据 / 待补证 / 禁止），待补证改中性表达或删；国内平台遵守广告法（不虚构功效、背书、销量）。' +
      '文字渲染默认留白排版（后期叠字），模型出字仅限 ≤8 字短标题。'
    )
  },
  fields: evcFields,
  build: buildEvc,
}


const DOC_ILLU_STYLE_GRADIENT = `
你是一位专家级UI UX演示设计师，请生成高保真、未来科技感的16比9演示文稿幻灯片。请根据视觉平衡美学，自动在封面、网格布局或数据可视化中选择一种最完美的构图。

全局视觉语言方面，风格要无缝融合Apple Keynote的极简主义、现代SaaS产品设计和玻璃拟态风格。整体氛围需要高端、沉浸、洁净且有呼吸感。光照采用电影级体积光、柔和的光线追踪反射和环境光遮蔽。配色方案选择深邃的虚空黑或纯净的陶瓷白作为基底，并以流动的极光渐变色即霓虹紫、电光蓝、柔和珊瑚橙、青色作为背景和UI高光点缀。

关于画面内容模块，请智能整合以下元素：

1. 排版引擎采用Bento便当盒网格系统，将内容组织在模块化的圆角矩形容器中。容器材质必须是带有模糊效果的磨砂玻璃，具有精致的白色边缘和柔和的投影，并强制保留巨大的内部留白，避免拥挤。

2. 插入礼物质感的3D物体，渲染独特的高端抽象3D制品作为视觉锚点。它们的外观应像实体的昂贵礼物或收藏品，材质为抛光金属、幻彩亚克力、透明玻璃或软硅胶，形状可是悬浮胶囊、球体、盾牌、莫比乌斯环或流体波浪。

3. 字体与数据方面，使用干净的无衬线字体，建立高对比度。如果有图表，请使用发光的3D甜甜圈图、胶囊状进度条或悬浮数字，图表应看起来像发光的霓虹灯玩具。

构图逻辑参考： 如果生成封面，请在中心放置一个巨大的复杂3D玻璃物体，并覆盖粗体大字，背景有延伸的极光波浪。 如果生成内容页，请使用Bento网格布局，将3D图标放在小卡片中，文本放在大卡片中。 如果生成数据页，请使用分屏设计，左侧排版文字，右侧悬浮巨大的发光3D数据可视化图表。

渲染质量要求：虚幻引擎5渲染，8k分辨率，超细节纹理，UI设计感，UX界面，Dribbble热门趋势，设计奖获奖作品。
`

const DOC_ILLU_STYLE_TICKET = `
帮我根据下面的设计风格要求和内容要求，生成一张中文的信息图片：  
设计风格要求：  
运用3-4种不同字号创造层次感，关键词使用最大字号  
主标题字号需要比副标题和介绍大三倍以上，采用网格排版，类似高级杂志  
文字与装饰元素间保持和谐的比例关系  
确保视觉流向清晰，引导读者目光移动  
数字极简票券风设计风格  
黑白对比主导：高度对比的黑白配色方案，形成强烈视觉冲击  
票券化布局：类似登机牌、门票或电子凭证的结构设计  
几何分区明确：画面被精确划分为信息区块，井然有序  
留白艺术运用：大量有效留白提升整体通透感和优雅度  
东西方美学融合：结合中文传统排版与西方现代设计语言  
工业设计感：注册商标符号、条形码等商业元素的精致运用  
数字界面映射：模拟电子屏幕或应用界面的信息呈现方式  
文字排版风格  
中英混排对比：中英文字体混合使用，创造文化融合感  
尺寸层级分明：主标题大号处理，副文本精致小巧  
多向排列组合：包含横排、竖排、斜排等多方向文字布局  
间距精确控制：字符间距和行距经过精心计算，保持呼吸感  
符号化装饰：括号、下划线、箭头融入文字设计  
衬线与非衬线混搭：不同字体家族交替使用，增强层次感  
时间信息格式化：日期标注采用统一格式，搭配方向指示符  
视觉元素风格  
功能性指示符：各类箭头、星号作为视觉引导和强调  
UI元素借鉴："CHECK IN"、"@"等数字界面元素的平面化应用  
边框与分割线：简洁线条用于区隔不同信息区域  
简约图形符号：最小化的设计符号传达核心信息  
手写风点缀：如"Romantic"的手写体为机械排版增添人文温度  
方向性视觉流动：通过元素排布创造从左到右、从上到下的阅读节奏  
负空间利用：将空白区域视为积极设计元素的一部分  
文本信息：
`

const DOC_ILLU_STYLE_VECTOR = `
帮我基于这个风格要求和内容生成 PPT：

视觉风格与美术指导 (Visual Style & Art Direction)

插画风格： 扁平化矢量插画（Flat Vector Illustration）。必须包含清晰、统一粗细的黑色轮廓线（Monoline/Stroke）。色彩填涂需简洁，仅使用少量阴影，严禁使用渐变色或3D渲染效果。
构图形式： 横向全景式构图（Panoramic），占据版面顶部 1/3 的空间。
线条风格 (Line Work)： 必须使用统一粗细的黑色单线描边（Monoline/Uniform Stroke）。所有物体（建筑、植物、云朵）都必须有封闭的黑色轮廓，类似填色书的线稿风格。线条末端圆润，避免尖锐的棱角。
几何化处理 (Geometric Simplification)： 将复杂的物体简化为基本几何形状。例如，树木简化为棒棒糖形状或三角形，建筑物简化为简单的矩形块面，窗户简化为整齐的小方格网格。不要追求写实细节，要追求“玩具模型”般的可爱感。
空间与透视： 采用平视或稍微俯视的 2.5D 视角（类似等轴测，但更自由）。通过图层的前后遮挡来表现纵深，不要使用大气透视（即远景不要变模糊或变淡），所有图层清晰度一致。
装饰元素： 在空白处添加装饰性的几何元素，如放射状的线条（代表阳光或能量）、药丸形状的云朵、或者是简单的小圆点和星星，以平衡画面的视觉密度。
配色方案： 复古且柔和的色调。
背景： 米色/奶油色（Cream/Off-white）纸张纹理感底色。
强调色： 珊瑚红、薄荷绿、芥末黄、赭石色（Burnt Orange）和岩石蓝。
字体排版：
主标题： 巨大的、加粗的复古衬线体（Retro Serif），体现权威感与优雅感。
副标题： 位于矩形色块内的全大写无衬线体。
正文： 清晰易读的几何感无衬线体。

需要生成 PPT 的内容：
`


function docIlluFields(_values: Record<string, string>): TemplateField[] {
  const fields: TemplateField[] = [
    { key: 'title', label: '配图主题 / 标题', type: 'text', required: true, placeholder: '例：AI 编程工具概念演化：从 Rules 到 Skills' },
    { key: 'points', label: '内容要点（每行一条）', type: 'textarea', required: true, placeholder: '例：\n早期模型幻觉问题与 rules 文件的作用\n静态上下文 vs 动态上下文\nSkills 统一动态上下文' },
    { key: 'style', label: '视觉风格', type: 'select', options: [
      { value: 'gradient-glass', label: '渐变玻璃卡片（Keynote 极简 + 玻璃拟态）' },
      { value: 'ticket', label: '数字极简票券（黑白对比登机牌结构）' },
      { value: 'vector-illustration', label: '扁平矢量插画（复古柔和全景）' },
    ] },
    { key: 'ratio', label: '画幅比例', type: 'select', options: [
      { value: '16:9', label: '16:9 横屏（演示 / 横幅）' },
      { value: '3:4', label: '3:4 竖屏（社媒 / 海报）' },
    ] },
    { key: 'coverMode', label: '图片模式', type: 'select', options: [
      { value: 'content', label: '内容配图（聚焦单一主题）' },
      { value: 'cover', label: '封面图（概括全文核心信息）' },
    ] },
  ]
  return fields
}

function buildDocIllu(values: Record<string, string>): { prompt: string; params?: Partial<GenParams> } {
  const style = values.style ?? 'gradient-glass'
  const ratio = values.ratio === '3:4' ? '3:4' : '16:9'
  const coverMode = values.coverMode === 'cover'
  const title = values.title?.trim() || '未命名主题'
  const points = (values.points ?? '')
    .split('\n')
    .map((l) => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean)
  const pointList = points.map((p) => `- ${p}`).join('\n')

  const body = style === 'gradient-glass' ? DOC_ILLU_STYLE_GRADIENT : style === 'ticket' ? DOC_ILLU_STYLE_TICKET : DOC_ILLU_STYLE_VECTOR

  const contentBlock = [
    '',
    '—— 配图内容 ——',
    `主题 / 标题：「${title}」`,
    '内容要点：',
    pointList,
    `图片模式：${coverMode ? '封面图——概括全文核心信息，作为系列配图的引导' : '内容配图——聚焦单一主题，信息密度适中'}`,
    `画幅比例：${ratio === '3:4' ? '3:4 竖屏（社媒 / 海报），输出竖版构图' : '16:9 横屏（演示 / 横幅），输出横版构图'}`,
  ].join('\n')

  const prompt = `${body}\n${contentBlock}`
  return { prompt, params: { size: ratio === '3:4' ? '1024x1536' : '1536x1024' } }
}

export const DOC_ILLU_TEMPLATE: BuiltinTemplate = {
  id: 'builtin-doc-illustrator',
  name: '文档配图（三风格 / 双比例）',
  description:
    '来自 op7418/Document-illustrator-skill（歸藏）：文档内容归纳成系列配图——渐变玻璃卡片（Keynote 极简 + 玻璃拟态 + 3D 锚点物）、数字极简票券（黑白对比登机牌结构）、扁平矢量插画（复古柔和全景）三种风格，16:9 / 3:4 双比例，支持封面图模式',
  builtin: true,
  note: '原技能面向 Nano Banana Pro / Gemini，Prompt 为通用中文图片指令，可直接用于本工作台的生图模型。每次产出一张配图：做整套系列配图时，按主题逐张填入要点（也可贴入文档段落让要点覆盖内容）。16:9 输出 1536×1024、3:4 输出 1024×1536（近似原比例档位）。',
  fields: docIlluFields,
  build: buildDocIllu,
}


const PAPER_COMIC_BASE = `
# 论文方法图解 — 基础规范

## 图片规格

- 竖版 2:3 比例
- 高清，所有标注文字清晰可读
- 背景颜色按具体风格要求
- 生成前必须确认用户选择了生成范围和张数；不要生成未确认的额外页面

## 构图原则

### 信息层次
1. **标题**：页面顶部，简短说明本页主题（如"方法总览""核心机制：注意力计算"）
2. **主体**：视觉图解占页面75%-85%面积
3. **标注**：关键节点旁的文字解释，简洁精确

### 视觉流向
- 明确的方向性（左→右，或上→下，或中心向外扩散）
- 用箭头、线条、数字序号引导阅读顺序
- 不要出现"不知道该看哪"的混乱布局

### 重点强调
- 本页的核心创新点用**强调色**标记（边框加粗/填充色/高亮区域）
- 非关键辅助信息用浅色处理，不抢焦点

### 信息密度
- 机制图不能只画大标题和几个孤立模块；必须包含足够的内部步骤、局部放大或小例子
- 如果画面空白超过约25%，优先补充：关键公式短标注、输入/输出维度、矩阵小格、token示例、before/after对比、注意力热力图
- 如果一页无法清楚容纳所有信息，拆成多页，不要牺牲可读性
- 封面图允许更概念化；细节图必须优先解释“怎么做”

---

## 文字标注规范

### 标注内容
- 每个方框/节点旁标注名称（如"Embedding""Self-Attention""FFN"）
- 关键数据维度（如"d=512""n=12 heads"）
- 重要的数学关系用简短文字（如"Q×K^T""÷√dk"），不用完整LaTeX公式

### 标注位置
- 紧贴所标注的对象
- 不遮挡关键视觉元素
- 多个标注不重叠

### 标注语言
- 专业术语保留英文（如"Transformer""Attention""Embedding"）
- 解释性文字用中文
- 标注文字精简——能用3个字不用10个字

---

## 颜色使用

### 限制原则
- 主色+强调色，不超过3种颜色
- 不用渐变色、不用过饱和色
- 颜色用于区分，不用于装饰
- sketchnote 风格使用明亮浅米白/奶油白背景；禁止旧纸、暗角、污渍、黄褐色复古调

### 颜色含义
- 深色/粗线 = 核心路径/关键结构
- 浅色/细线 = 辅助信息/上下文
- 强调色 = 本页要你记住的那一个点

---

## 每页必含

- [ ] 页面顶部标题
- [ ] 清晰且占画面主体的核心视觉元素（流程图/结构图/对比图）
- [ ] 关键节点的文字标注
- [ ] 方向性引导（箭头/数字/线条）
- [ ] 本页唯一的核心强调点（用颜色/大小突出）
- [ ] 对机制细节页，至少包含一个局部放大、小例子、维度说明或关键公式短标注

## 每页禁止

- [ ] 不要出现任何代码块
- [ ] 不要照片级写实渲染
- [ ] 不要3D立体效果
- [ ] 文字标注不要连成一段话（每个标注独立、简短）
- [ ] 不要画"装饰性"元素（和内容无关的图案、花纹）
- [ ] 不要大面积空白
- [ ] sketchnote 不要画成旧羊皮纸、泛黄档案或复古日记
`

const PAPER_COMIC_SKETCHNOTE = `
# sketchnote — 温暖手抄报科研笔记风

像一张被精心整理过的研究手抄报：明亮、温暖、清爽，但仍然专业。

## 氛围

- 温暖、个人化、有思考的温度
- 清爽明亮，像课堂讲义/研究手抄报，而不是复古旧纸
- 不像机器生成的冷冰冰配图
- 让人想凑近看细节，像是在读一页认真整理过的方法笔记

## 视觉规范

### 底色
- 明亮浅米白或奶油白（建议 #FFF8EA / #FAF4E6 / #FFFDF7）
- 纸面干净，可以有极轻微纸感，但不能有明显纹理
- 不要牛皮纸、旧羊皮纸、暗角、污渍、黄褐色边缘、泛黄旧照片感
- 整体观感应是“温暖干净”，不是“老旧复古”

### 线条
- 黑色手绘风格线条，有自然的笔触粗细变化
- 不是完美的矢量直线——允许轻微的不规则，但不能潦草
- 粗线 = 核心结构，细线 = 辅助连接

### 文字
- 手写体风格（英文选sketch/casual字体，中文保持可读但略带手写感）
- 标注文字整洁，不能太潦草影响可读性
- 标题字体比标注字稍大、稍粗

### 强调
- 强调色：深蓝（#2C5F8A）、珊瑚红（#D85C4A）、橄榄绿（#5C6B4F）、柔和黄色（#F3D36B）
- 强调方法：手绘虚线边框、淡彩填充、马克笔下划线、局部放大圈
- 不要大面积重色块，保持轻快、清晰、手抄报感

### 信息密度
- 主体机制图应占画面 75%-85%，不要只有标题和稀疏模块
- 如果留白过多，优先补充：局部放大框、一步一步的小例子、输入/输出维度、关键公式短标注、before/after 对比
- 一张图只讲一个主机制，但要把这个机制讲透
- 封面图可以更概念化；机制细节图必须有足够可读细节

### 理解锚点（克制使用）
- 小箭头（手绘三角箭头）
- 小圈/小点标注
- 重要结论旁可以有一个星号或下划线
- 简化小图标：放大镜、便签、灯泡、括号圈注、手绘警示线
- 抽象小比喻：例如“注意力聚光灯”“信息路由”“记忆桥”，但必须服务机制解释
- 右下角手写页码

## 注意
- 不要真实的纸张纹理照片（太乱了）
- 保持在"手绘的精致"和"手绘的随意"之间的平衡
- 整洁但不冷，温暖但不乱
- 不要变成剧情漫画，不要画人物对话框抢走论文机制
- 不要把 sketchnote 画成旧日记、羊皮纸、藏宝图或泛黄档案

`

const PAPER_COMIC_FIGURE = `
# paper-figure — 论文框架图风

像一张重新设计过的顶会论文 Figure：专业、清楚、信息密度高，但比原论文图更适合传播。

## 氛围

- 像 NeurIPS / ICLR / Nature / Science 论文中的方法总览图
- 不是蓝图、不是海报、不是漫画
- 目标是让读者在30秒内理解论文核心方法

## 视觉规范

### 画布
- 白底或极浅灰底
- README 首屏优先横版 16:9 或 4:3
- 机制拆解图可用竖版 2:3

### 图元
- 干净的矢量感模块：圆角矩形、矩阵小格、token序列、分组框、编号步骤
- 箭头精确、方向明确，主路径比辅助路径更粗
- 允许使用小型热力图、曲线、结果缩略图、模块堆叠、对比路径

### 文字
- 无衬线字体，像论文图中的短标签
- 标注必须短：模块名、变量名、关键操作、1行解释
- 语言遵循用户确认：中文 / English / 双语

### 色彩
- 黑/深灰为主
- 只使用1-2个强调色，例如蓝+橙、青+紫
- 强调色用于核心贡献、关键路径或对比，不做装饰

## 生成原则

- 可以参考论文原始框架图的概念，但必须重新组织信息，不能复刻原图
- 概述图要覆盖输入、核心模块、输出和关键贡献
- 细节图要把一个机制拆清楚，不要把所有东西塞进一页
- 结果图只放最有说服力的一条结果，不做完整实验表格

## 禁止

- 不要蓝底白线工程图纸风
- 不要3D渲染
- 不要用大段文字解释
- 不要复制论文原图布局
- 不要做成PPT封面或营销海报

`


function paperComicFields(_values: Record<string, string>): TemplateField[] {
  return [
    { key: 'paperTitle', label: '论文标题', type: 'text', required: true, placeholder: '例：Attention Is All You Need' },
    { key: 'pageTopic', label: '本页主题', type: 'text', required: true, placeholder: '例：方法总览 / 核心机制：注意力计算 / 实验对比' },
    { key: 'method', label: '方法与机制描述', type: 'textarea', required: true, placeholder: '要图解的步骤、模块关系、关键公式与维度（例：输入 Embedding → Self-Attention（Q×K^T ÷ √dk，12 heads）→ FFN → 残差连接）' },
    { key: 'scope', label: '生成范围', type: 'select', options: [
      { value: 'overview', label: '方法总览' },
      { value: 'mechanism', label: '核心机制细节' },
      { value: 'experiment', label: '实验对比' },
      { value: 'innovation', label: '关键创新点' },
      { value: 'cover', label: '封面（概念化）' },
    ] },
    { key: 'style', label: '视觉风格', type: 'select', options: [
      { value: 'sketchnote', label: 'sketchnote 温暖手抄报' },
      { value: 'paper-figure', label: 'paper-figure 论文框架图' },
    ] },
    { key: 'lang', label: '标注语言', type: 'select', options: [
      { value: 'zh', label: '中文（术语保留英文）' },
      { value: 'en', label: 'English' },
      { value: 'bilingual', label: '双语' },
    ] },
    { key: 'ratio', label: '画幅比例', type: 'select', options: [
      { value: '2:3', label: '竖版 2:3（机制拆解默认）' },
      { value: '16:9', label: '横版 16:9（README 首屏）' },
      { value: '4:3', label: '4:3' },
    ] },
  ]
}

function buildPaperComic(values: Record<string, string>): { prompt: string; params?: Partial<GenParams> } {
  const paperTitle = values.paperTitle?.trim() || '一篇论文'
  const pageTopic = values.pageTopic?.trim() || '方法总览'
  const method = values.method?.trim() || '待补充的方法描述'
  const scope = values.scope ?? 'overview'
  const style = values.style ?? 'sketchnote'
  const lang = values.lang ?? 'zh'
  const ratio = values.ratio ?? '2:3'

  // 基础规范（构图 / 标注 / 颜色 / 必含与禁止清单）两种风格共用，视觉风格段单独切换

  const scopeLine: Record<string, string> = {
    overview: '生成范围：方法总览——讲清整篇论文的方法框架与流程。',
    mechanism: '生成范围：核心机制细节——把本页机制讲透，含局部放大、维度说明与关键公式短标注。',
    experiment: '生成范围：实验对比——用可视化对比实验结果。',
    innovation: '生成范围：关键创新点——突出论文最核心的贡献。',
    cover: '生成范围：封面——概念化呈现论文主题，允许更概念化。',
  }
  const langLine =
    lang === 'zh' ? '标注语言：专业术语保留英文（如 Transformer、Attention、Embedding），解释性文字用中文。'
    : lang === 'en' ? '标注语言：English labels and annotations only.'
    : '标注语言：双语——术语英文、解释中文。'

  const paperLine = `论文：「${paperTitle}」。本页主题：${pageTopic}。`
  const methodLine = `方法与机制描述（图解内容依据）：${method}`

  const prompt = [
    PAPER_COMIC_BASE,
    '',
    `=== 视觉风格 ===`,
    style === 'paper-figure' ? PAPER_COMIC_FIGURE : PAPER_COMIC_SKETCHNOTE,
    '',
    `=== 本页内容 ===`,
    paperLine,
    methodLine,
    scopeLine[scope] ?? '',
    langLine,
    `画幅比例：${ratio}。`,
  ].filter(Boolean).join('\n')

  return { prompt, params: { size: ratio === '2:3' ? '1024x1536' : '1536x1024' } }
}

export const PAPER_COMIC_TEMPLATE: BuiltinTemplate = {
  id: 'builtin-paper-comic',
  name: '论文方法图解（paper-comic）',
  description:
    '来自 zsyggg/paper-craft-skills 的 paper-comic：论文核心方法的视觉图解——sketchnote 温暖手抄报 / paper-figure 论文框架图两种风格，竖版 2:3 与横版，含信息层次、文字标注规范与颜色限制',
  builtin: true,
  note: '一张图讲一个主机制，讲透不贪多；系列图解请按范围多次生成。基础规范（信息层次 / 文字标注 / 颜色限制 / 每页必含与禁止清单）已内置。sketchnote 明亮奶油白底（#FFF8EA），禁止旧纸复古调。',
  fields: paperComicFields,
  build: buildPaperComic,
}



/* ---------------- 小黑怪诞正文配图（helloianneo/ian-xiaohei-illustrations） ---------------- */

/** 结构类型（来自 composition-patterns.md，8 选 1） */
const XIAOHEI_STRUCTURES = [
  'Workflow（输入 → 处理 → 输出工作流）',
  '系统局部（信息来源 / 过滤器 / 数据库 / 渲染器）',
  '前后对比（混乱 vs 有序 / 手动 vs 自动）',
  '角色状态（痛点 / 卡住 / 跑起来的状态变化）',
  '概念隐喻（一个大怪物件或机器承载核心意思）',
  '方法分层（方法论框架 / 能力栈 / 内容分层）',
  '地图路线（路线图 / 迁移路径 / 决策地图）',
  '小漫画分镜（2-4 格连续小分镜）',
]

/** 风格 DNA 与 IP 定义（来自 style-dna.md / xiaohei-ip.md，逐字保留） */
const XIAOHEI_VISUAL_DNA = [
  'Pure white background. Minimalist black hand-drawn line art. Slightly wobbly pen lines. Lots of empty white space. Sparse red/orange/blue handwritten Chinese annotations. Clean absurd product-sketch feeling. No gradients, no shadows, no paper texture, no complex background, no commercial vector style, no PPT infographic look, no cute mascot poster, no children\'s illustration, no realistic UI.',
].join('\n')

const XIAOHEI_IP = '小黑, a small solid-black absurd creature with white dot eyes, tiny thin legs, blank serious expression, slightly uneven hand-drawn body shape. 小黑 must perform the core conceptual action, not decorate the scene. Make 小黑 serious, deadpan, and slightly bizarre, not cute.'

const XIAOHEI_COLOR_USE = 'Black for main line art and 小黑. Orange for main flow/path/arrows. Red only for key warnings/problems/results. Blue only for secondary notes or feedback/system state.'

const XIAOHEI_CONSTRAINTS = 'One image explains only one core structure. Keep the main subject around 40%-60% of the canvas. Preserve at least 35% blank white space. Use at most 5-8 short handwritten Chinese labels. Do not write a title in the top-left corner. Do not write the structure type on the image. Do not make it a formal diagram, course slide, or dense explainer. Do not copy prior examples or reuse known case compositions unless explicitly requested; invent a fresh visual metaphor for this specific article. It should be clear but not instructional, interesting but not childish, strange but clean.'

function buildXiaohei(values: Record<string, string>): { prompt: string; params?: Partial<GenParams> } {
  const theme = values.theme?.trim() || '文章核心观点的视觉隐喻'
  const structure = values.structure ?? '概念隐喻'
  const coreIdea = values.coreIdea?.trim() || theme
  const composition = values.composition?.trim() || `Invent a fresh, slightly absurd but plausible composition: 小黑 performing the core conceptual action, with the main objects and information flow supporting the idea.`
  const elements = values.elements?.trim() || 'minimal props that support the metaphor'
  const labels = values.labels?.trim() || '2-4 short Chinese annotation words derived from the core idea'

  const prompt = [
    'Generate one standalone 16:9 horizontal Chinese article illustration.',
    '',
    'Visual DNA:',
    XIAOHEI_VISUAL_DNA,
    '',
    'Recurring IP character required:',
    XIAOHEI_IP,
    '',
    `Theme: ${theme}`,
    `Structure type: ${structure}`,
    `Core idea: ${coreIdea}`,
    `Composition: ${composition}`,
    `Suggested elements: ${elements}`,
    `Chinese handwritten labels: ${labels}`,
    '',
    'Color use:',
    XIAOHEI_COLOR_USE,
    '',
    'Constraints:',
    XIAOHEI_CONSTRAINTS,
  ].join('\n')
  return { prompt, params: { size: '1536x1024' } }
}

export const XIAOHEI_TEMPLATE: BuiltinTemplate = {
  id: 'builtin-xiaohei',
  name: '小黑怪诞正文配图（Ian 小黑 IP）',
  description:
    '来自 helloianneo/ian-xiaohei-illustrations：中文文章的怪诞正文配图——固定 IP 角色小黑（黑色实心、白点眼、认真做荒诞的事）+ 纯白手绘线稿 + 红橙蓝中文手写批注 + 大量留白，8 种结构类型，产出英文生图 Prompt',
  builtin: true,
  note: '固定 IP「小黑」必须参与核心动作（不是装饰）。每张只讲一个核心结构；每次从文章重新发明隐喻，不复刻旧构图。中文批注 5-8 处（每处 2-8 字）。原仓库 references/prompt-template.md 另有去标题 / 增强怪诞感的编辑提示词。',
  fields: [
    { key: 'theme', label: '文章主题 / 配图主题', type: 'text', required: true, placeholder: '例：AI 编程工具概念演化' },
    { key: 'structure', label: '结构类型', type: 'select', options: XIAOHEI_STRUCTURES },
    { key: 'coreIdea', label: '核心意思（这张图要表达什么）', type: 'textarea', required: true, placeholder: '例：上下文从静态配置进化为动态加载' },
    { key: 'composition', label: '画面构图（可选，留空则按核心意思重新发明隐喻）', type: 'textarea', placeholder: '例：小黑在一条传送带上把散落的 rules 文件压成一块动态上下文砖' },
    { key: 'elements', label: '建议元素（可选，斜杠分隔）', type: 'text', placeholder: '例：传送带 / rules 文件 / 压缩砖' },
    { key: 'labels', label: '中文手写标注词（可选，斜杠分隔，2-8 处）', type: 'text', placeholder: '例：rules / 压砖 / 上下文' },
  ],
  build: buildXiaohei,
}



/* ---------------- 极简 Zine 海报（LiamGvchi/gc-minimal-zine-poster） ---------------- */

const ZINE_LAYOUTS = [
  'center-fragment（中心碎片+环绕留白）',
  'lower-left-float（焦点在左下，上方大片空场）',
  'upper-right-block（色块或照片在右上，文字漂移）',
  'dual-panel（两个小面板相邻或叠压）',
  'irregular-cutout（撕纸或不规则形状承载图像）',
  'type-led（文字即主焦点，图像退后）',
  'dot-orbit（点、字母、线条绕一个小主体旋转）',
  'single-specimen（一个孤立物件）',
  'diagonal-notes（两三个小元素形成对角运动）',
  'edge-counterweight（偏轴焦点+远处微文字配重）',
]

const ZINE_FOCAL_FORMS = [
  'tiny faded photo（微褪色照片）',
  'clean rectangular photo crop（矩形照片裁片）',
  'torn-paper clipping（撕纸剪片）',
  'flat silhouette（平面剪影）',
  'opaque printed color block（印刷色块）',
  'old printed illustration（旧印刷插图）',
  'object specimen（物件标本）',
  'translucent geometric overlay（半透明几何叠加）',
  'abstract texture window（抽象纹理窗口）',
  'fragmented type as image（碎片文字作图）',
]

const ZINE_TYPO_MODES = [
  'fragmented floating letters（碎片漂浮字母）',
  'short phrase pressed against the image edge（短语贴边）',
  'archive microtext with date or weather（档案微文字）',
  'diagonal scattered words（对角散落词语）',
  'low-contrast gray ghost text（低对比灰色幽灵文字）',
  'headline-as-object with rough letterpress（标题即物件）',
  'text inside a color block or cutout（色块/剪片内嵌文字）',
  'almost textless with one tiny caption（几乎无文字）',
]

const ZINE_TEXTURES = [
  'xerox softness（复印柔化）',
  'risograph grain（孔版印刷颗粒）',
  'letterpress ink bleed（活版印刷墨渗）',
  'halftone degradation（半调退化）',
  'film-grain photograph（胶片颗粒照片）',
  'scan noise and paper fibers（扫描噪点+纸张纤维）',
  'aged paper mottling（旧纸斑驳）',
  'slight misregistration（轻微套印不准）',
]

const ZINE_COLORS = [
  'cobalt blue（钴蓝）', 'ultramarine（群青）', 'cyan（青色）', 'violet（紫色）',
  'magenta-pink（品红粉）', 'lemon yellow（柠檬黄）', 'pear green（梨绿）',
  'orange（橙色）', 'tomato red（番茄红）',
]

const ZINE_PAPERS = [
  'warm white（暖白）', 'ivory（象牙白）', 'light gray（浅灰）',
  'old-paper yellow（旧纸黄）', 'pale khaki（浅卡其）', 'light kraft beige（浅牛皮纸米色）',
]

const ZINE_MOODS = [
  'quiet（安静）', 'summer（夏日）', 'solitude（孤独）', 'childhood（童年）',
  'seaside（海边）', 'afternoon（午后）', 'night（夜晚）', 'memory（记忆）',
  'slight surrealism（轻微超现实）', 'minimal editorial（极简编辑）',
]

function zineFields(_values: Record<string, string>): TemplateField[] {
  return [
    { key: 'theme', label: '主题 / 内容 / 一句话', type: 'textarea', required: true, placeholder: '例：台风过境后的清晨 / 一段关于记忆与遗忘的文字' },
    { key: 'mood', label: '情绪', type: 'select', options: ZINE_MOODS },
    { key: 'metaphor', label: '核心视觉隐喻', type: 'text', required: true, placeholder: '例：一把被雨水打湿的钥匙 / 一扇半开的窗' },
    { key: 'layout', label: '布局家族', type: 'select', options: ZINE_LAYOUTS },
    { key: 'focalForm', label: '焦点元素形态', type: 'select', options: ZINE_FOCAL_FORMS },
    { key: 'color', label: '主色（唯一高饱和色）', type: 'select', options: ZINE_COLORS },
    { key: 'paper', label: '纸张色调', type: 'select', options: ZINE_PAPERS },
    { key: 'typo', label: '排版模式', type: 'select', options: ZINE_TYPO_MODES },
    { key: 'texture', label: '材质处理', type: 'select', options: ZINE_TEXTURES },
    { key: 'shortText', label: '短句 / 注释（可选）', type: 'text', placeholder: '例：remain / 潮湿的记忆 / 2026.06' },
  ]
}

function buildZine(values: Record<string, string>): { prompt: string; params?: Partial<GenParams> } {
  const theme = values.theme?.trim() || "一个安静的主题"
  const mood = values.mood ?? "quiet"
  const focalForm = values.focalForm ?? ZINE_FOCAL_FORMS[0]
  const color = values.color ?? ZINE_COLORS[0]
  const paper = values.paper ?? ZINE_PAPERS[0]
  const typo = values.typo ?? ZINE_TYPO_MODES[2]
  const texture = values.texture ?? ZINE_TEXTURES[5]
  const shortText = values.shortText?.trim() || ""
  const typoLine = shortText
    ? `Typography: ${typo} for the short phrase "${shortText}", with optional archive microtext (date or weather). Use ${color} as the sole saturated color, carried by the focal element and occupying about 1.5% of the canvas or 20% of the visual cluster. Apply ${texture} without washing out the chromatic ink.`
    : `Typography: ${typo} with no explicit phrase. Use ${color} as the sole saturated color, carried by the focal element and occupying about 1.5% of the canvas or 20% of the visual cluster. Apply ${texture} without washing out the chromatic ink.`
  const prompt = [
    `Tall vertical 3:5 paper poster, full-frame ${paper} aged paper with ${texture}, no border and no mockup. Keep 75% as open paper. Place one 15% visual cluster at center-low, comfortably away from the edges.`,
    "",
    `Translate "${theme}" into a single visual metaphor. Render it as ${focalForm} using ${texture}. Keep the event isolated and imageable; do not expand it into a full scene.`,
    "",
    typoLine,
    "",
    `Flat orthographic scanned-paper appearance, matte absorbent surface, diffuse light, low-to-medium contrast, mood: ${mood}.`,
    `Avoid: full-bleed scene, commercial headline, product ad, logo, CTA, brand campaign, glossy mockup, clean UI white, cinematic lighting, hard shadow, 3D render, neon, cyberpunk, cute cartoon, dense collage, multicolor palette, stock-photo realism.`,
  ].filter(Boolean).join("\n\n")
  return { prompt, params: { size: "1024x1536" } }
}

export const ZINE_TEMPLATE: BuiltinTemplate = {
  id: 'builtin-zine-poster',
  name: '极简 Zine 海报（诗性纸感留白）',
  description:
    '来自 gc-minimal-zine-poster：诗性纸感留白微编辑海报——70-90% 留白 + 一个 8-25% 视觉事件 + 单一高饱和色 + 纸张纹理，日本/Korean indie zine 气质；10 种布局家族 × 10 种焦点形态 × 9 种材质处理 × 10 种情绪',
  builtin: true,
  note: '按官方 Prompt Compiler 四段式结构组装：画布+纸张+留白 → 视觉隐喻+焦点元素+材质处理 → 排版+主色+印刷缺陷 → 扫描纸面+情绪+禁忌清单。一张图只讲一个视觉事件，不展开成完整场景。反身份：避免商业广告、产品海报、logo、CTA、3D、霓虹、赛博朋克、可爱卡通。'
    + " 纸张色调与情绪可在下拉中选择，短句可选。",
  fields: zineFields,
  build: buildZine,
}

/** 归藏社交卡片模板（详见 gz-build.ts） */
export const GZ_TEMPLATE: BuiltinTemplate = {
  id: 'builtin-gz-card',
  name: '归藏社交卡片（小红书图文 / 公众号封面）',
  description:
    '来自 op7418/guizang-social-card-skill：Editorial Magazine × E-ink 与 Swiss International 两种视觉模式、10 套主题色板、28 种版式——小红书 3:4 轮播图文与公众号 21:9 / 1:1 封面',
  builtin: true,
  note: 'Editorial 铁律：「越大越轻」——大标题 weight 500 + 宽字距，正文用衬线中文。Swiss 铁律：大字轻、小字重。',
  fields: gzFields,
  build: buildGz,
}

/* ---------------- 自定义模板（{{key}} 占位替换） ---------------- */

export function renderCustomTemplate(t: CustomTemplate, values: Record<string, string>): string {
  return t.body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => values[key] ?? '')
}

/* ---------------- vane 玩法合集（VaneAi888/vane-gpt-image-skills） ---------------- */

const VANE_STYLES = [
  'Q版萌系', '真人实拍风', '像素风', '日漫二次元', '3D立体风', '手绘涂鸦风',
  '扁平矢量风', '极简线稿风', '毛绒布偶风', '拼贴剪纸风', '国风水墨风', '复古漫画风',
]

const VANE_THEMES = ['工作中', 'AI 搭子', '情绪现场', '鼓励搭子', '摸鱼日常', '节日限定', '自定义场景']

/** 电影海报 36 版式（编号 → 名称 + 核心构图描述，来自 vane-cinematic-poster 版式库） */
const POSTER_LAYOUTS: Record<string, { name: string; desc: string }> = {
  '01': { name: '中央英雄', desc: '人物完整或半身居中，占画面约 2/3；片名横跨下方，信息在底部' },
  '02': { name: '超近景面孔', desc: '面部裁切至几乎充满画面；片名置于下部平静区域，信息贴底' },
  '03': { name: '背影望远', desc: '人物缩小放在下三分之一，朝向远方景观；片名置于天空或上方留白，信息贴底' },
  '04': { name: '侧脸与留白', desc: '大侧脸靠左或右边缘，朝画面内部；片名和文案置于另一侧留白' },
  '05': { name: '双人对峙', desc: '两人分居左右，面向中线；片名放两人之间或底部，信息贴底' },
  '06': { name: '上下双肖像', desc: '两人头像分别占上下半幅，通过边界或过渡衔接；片名压在接缝，信息在最下方' },
  '07': { name: '中心人物环绕配角', desc: '主角居中最大，其余人物以不同尺度围绕；片名横跨底部，信息贴底' },
  '08': { name: '人物切片并列', desc: '画面切为 3-5 条纵向画幅，各条一个人物或局部；片名横跨切片下缘' },
  '09': { name: '人物俯视构图', desc: '俯拍人物置于画面中心或下方，周围地面形成图案；片名沿上部或下部边缘排' },
  '10': { name: '巨型片名压画', desc: '片名占画面高度的一半以上，主体嵌在字前或字后；信息底部' },
  '11': { name: '纵向文字轴', desc: '片名竖排贴近一侧，另一侧保留人物或场景；信息与文字轴对齐' },
  '12': { name: '顶部大字与下方场景', desc: '上三分之一到二分之一为片名，下方为一幅完整场景；信息贴底' },
  '13': { name: '中心文字与四周留白', desc: '片名居中，极小主体或符号位于其上或下；大量空白，信息贴近边缘' },
  '14': { name: '字中有画', desc: '以片名字形作为窗口，字内部显示人物或场景；背景简洁，信息底部' },
  '15': { name: '阶梯式片名', desc: '片名字词分多行逐级错位，产生对角节奏；主体占文字空出的角落' },
  '16': { name: '片名遮挡人物', desc: '人物为全幅主视觉，片名横向置于人物胸部或腰部之前形成明确前后关系；信息底部；避免覆盖眼睛' },
  '17': { name: '细长压缩字带', desc: '片名以高窄字占据画面纵向中央或顶部横带，周围安排主体细节；信息贴边' },
  '18': { name: '重复字纹', desc: '片名或一句短语多次重复形成背景纹理，其中一次突出；主体居中或偏侧，信息底部' },
  '19': { name: '地平线三分法', desc: '地平线位于上或下三分线，人物是小比例点；片名置于大块天空或地面，信息贴底' },
  '20': { name: '建筑框景', desc: '用门、窗、走廊等边框围住主体；片名置于框外边缘或框内低对比区' },
  '21': { name: '强透视消失点', desc: '道路、隧道或建筑线条指向深处主体；片名放上方或下方，不挡消失点' },
  '22': { name: '巨物与微小人物', desc: '巨型建筑、生物或天体占主要画幅，人物位于下缘；片名在上方或底部；用尺度建立故事' },
  '23': { name: '前景剪影窗口', desc: '前景人物或物体轮廓形成深色框架，中间留出明亮场景；片名在下方暗部' },
  '24': { name: '俯瞰地图式', desc: '从正上方展示城市、房间或地形，人物很小；片名与街道或空间网格对齐' },
  '25': { name: '上下空间分界', desc: '画面以水面、地面或云层分为上下两界，分别展示两种状态；片名沿分界线或底部排布' },
  '26': { name: '画中画嵌套', desc: '大场景中嵌入一张有明确边界的照片、屏幕或小画面；片名与嵌套框对齐' },
  '27': { name: '对角线动势', desc: '主要建筑、车辆或人物运动沿对角线横穿画幅；片名置于对角线两侧较安静的区域' },
  '28': { name: '单一物件静物', desc: '具有故事意义的物品居中或略偏心，背景纯净；片名置于物件上方或下方，信息贴底' },
  '29': { name: '剪影双重曝光', desc: '人物轮廓内部承载另一场景，两者清晰可辨；片名在轮廓外的留白处' },
  '30': { name: '撕裂揭示', desc: '画面被纸张或画面撕口分开，裂口露出第二层故事；片名靠近撕裂区域但不遮住关键内容' },
  '31': { name: '碎片拼贴', desc: '照片、纹理和文字碎片围绕中心焦点组合；片名占一块完整清晰区域；限制碎片数量' },
  '32': { name: '镜像倒影', desc: '主体与水面、镜面或玻璃中的倒影形成上下或左右呼应，倒影可暗示反差；片名放在分界附近或底部' },
  '33': { name: '负空间隐喻', desc: '两个实体或一片剪影之间的空白构成第二个可辨认符号；片名置于空白之外；缩略图仍须看懂主要形状' },
  '34': { name: '圆形视觉容器', desc: '圆形或椭圆窗口装入主体，画面其余部分留白；片名沿圆下方水平排列或沿边缘排列' },
  '35': { name: '网格档案墙', desc: '按规则网格排列照片、证据、人物或物件，某一格突出；片名置于网格上方或下方' },
  '36': { name: '色块几何分区', desc: '两至三个大色块将画面清楚划分，人物或物件与色块边界互动；片名放在对比清楚的色块中' },
}

const POSTER_LAYOUT_OPTIONS = Object.entries(POSTER_LAYOUTS).map(([no, l]) => ({
  value: no,
  label: `${no} ${l.name}`,
}))

/** 红包封面 36 风格（来自 wechat-red-packet-cover 风格目录） */
const REDPACKET_STYLES = [
  '红金木版锦鲤', '青花瓷仙鹤', '写意水墨山水', '民俗剪纸骏马', '锦绣牡丹', '新艺术荷花',
  '红金日出丝绸', '工笔梅花鸟', '民俗猛虎', '蜡笔招财猫', '黏土兔子', '水彩小龙',
  '扁平橘子角色', '毛毡舞狮', '手绘小狗', '像素灯笼城', '拼贴熊猫', '毛绒小熊',
  '孟菲斯几何', '港风霓虹夜景', '包豪斯几何', '全息金属丝带', '复古花朵图案', '极简折纸',
  '像素赛博城市', '黑白橙粗野主义', '玻璃橘子', '印象派花田', '雪山摄影', '胶片静物',
  '夜色灯笼插画', '蓝晒植物', '樱花水彩', '星座图谱', '沙丘红日', '花鸟马赛克',
]

const VANE_MODE_OPTIONS = [
  { value: 'sticker', label: '多画风动态表情包' },
  { value: 'poster', label: '电影级海报（36 版式）' },
  { value: 'book', label: '书页里的电影' },
  { value: 'pet', label: '宠物新年写真' },
  { value: 'redpacket', label: '微信红包封面' },
]

function vaneFields(values: Record<string, string>): TemplateField[] {
  const mode = values.mode ?? VANE_MODE_OPTIONS[0].value
  if (mode === 'sticker') {
    return [
      { key: 'character', label: '角色 / 人物名', type: 'text', placeholder: '例：韦恩 / 我家橘猫；留空则用「这个角色」' },
      { key: 'style', label: '画风', type: 'select', options: VANE_STYLES },
      { key: 'theme', label: '主题', type: 'select', options: VANE_THEMES },
      { key: 'scene', label: '动作与短句', type: 'textarea', required: true, placeholder: '例：举着咖啡杯伸懒腰，配文「先歇一下」' },
    ]
  }
  if (mode === 'poster') {
    return [
      { key: 'title', label: '片名（原样保留）', type: 'text', required: true, placeholder: '例：归途' },
      { key: 'genre', label: '类型与情绪', type: 'text', placeholder: '例：悬疑 / 冷峻压抑' },
      { key: 'story', label: '一句话故事', type: 'textarea', placeholder: '例：一家人在春节前重逢的旅程' },
      { key: 'layout', label: '版式（36 选 1，未指定则按内容推荐）', type: 'select', options: POSTER_LAYOUT_OPTIONS },
      { key: 'lang', label: '海报文字语言', type: 'select', options: ['中文', '英文'] },
      { key: 'info', label: '演职员 / 日期等信息（可选）', type: 'textarea', placeholder: '没有就留空，将使用占位排版' },
    ]
  }
  if (mode === 'book') {
    return [
      { key: 'book', label: '书名与作者', type: 'text', required: true, placeholder: '例：《小王子》，圣埃克苏佩里' },
      { key: 'focus', label: '要表现的人物 / 段落 / 主题', type: 'textarea', required: true, placeholder: '例：小王子与玫瑰的关系' },
      { key: 'spoiler', label: '剧透处理', type: 'select', options: ['避免剧透', '可以剧透'] },
      { key: 'metaphor', label: '视觉隐喻方向（可选）', type: 'text', placeholder: '例：星球与玫瑰的悬浮构图' },
    ]
  }
  if (mode === 'pet') {
    return [
      { key: 'pet', label: '宠物特征描述', type: 'textarea', required: true, placeholder: '例：橘猫，白色爪子，绿色眼睛，微胖' },
      { key: 'studio', label: '影棚背景', type: 'select', options: ['中国红影棚', '黑金影棚', '纯白影棚', '多样姿势'] },
      { key: 'props', label: '节庆道具 / 生肖元素', type: 'text', placeholder: '例：灯笼、红包、福字' },
    ]
  }
  return [
    { key: 'subject', label: '主题与主体描述', type: 'textarea', required: true, placeholder: '例：我的橘猫戴着虎头帽，圆润可爱' },
    { key: 'style', label: '风格（36 选 1）', type: 'select', options: REDPACKET_STYLES },
    { key: 'text', label: '画中祝福文字', type: 'select', options: ['不加字（默认）', '加祝福文字'] },
    { key: 'greeting', label: '祝福文字内容', type: 'text', placeholder: '例：恭喜发财，大吉大利' },
  ]
}

const VANE_NOTES: Record<string, string> = {
  sticker: '表情包需要参考图：填入后请在面板添加照片或角色参考图。本工作台产出表情包静态原画（1024×1024），GIF 动图合成不在工作台范围。',
  poster: '片名等文字会原样保留，不编造发行信息与获奖内容；生成文字不准确时可先生成无字底图再后期排版。竖版 2:3（1024×1536）。',
  book: '画面基于书籍创意演绎，非官方改编海报；按剧透设置控制画面依据，公开使用前请核对书籍相关权利。竖版 2:3（1024×1536）。',
  pet: '需要参考图：填入后请添加宠物面部清晰的正面照片；九宫格预览与 GIF 合成不在工作台范围，产出单张独立写真（1024×1024）。',
  redpacket: '输出 1024×1536（上下留白适配 3:4 安全区）；微信上传需 957×1278 JPEG，后期居中裁剪即可。默认不加画中文字，头像/按钮/红包下摆不会画进原图。',
}

function buildVane(values: Record<string, string>): { prompt: string; params?: Partial<GenParams> } {
  const mode = values.mode ?? 'sticker'
  if (mode === 'sticker') {
    const character = values.character?.trim() || '这个角色'
    const style = values.style ?? 'Q版萌系'
    const theme = values.theme ?? '自定义场景'
    const scene = values.scene?.trim() || '自然活泼的日常动作与表情'
    const prompt = [
      `表情包静态原画：以参考图中的「${character}」为原型，绘制一张「${style}」画风的聊天表情包。`,
      `主题：${theme}。画面内容：${scene}。`,
      '要求：保持参考图中人物的脸部、发型、服装等识别特征，不套用统一模板脸；人物完整不出框，动作在手机小尺寸下一眼可辨。',
      '图内文字：把短句用清晰的中文手写体气泡呈现，字大且易读。',
      '构图：方形 1024x1024，角色居中，背景纯色或透明，无水印、无多余装饰。',
    ].join('\n')
    return { prompt, params: { size: '1024x1024' } }
  }
  if (mode === 'poster') {
    const title = values.title?.trim() || '未命名影片'
    const no = values.layout ?? '01'
    const layout = POSTER_LAYOUTS[no] ?? POSTER_LAYOUTS['01']
    const genre = values.genre?.trim() || '剧情'
    const story = values.story?.trim() || ''
    const lang = values.lang ?? '中文'
    const info = values.info?.trim()
    const storyLine = story ? `故事一句话梗概：${story}。` : ''
    const infoLine = info
      ? `信息区文字（原样保留）：${info}。`
      : `信息区：使用占位排版（演职员 / 日期占位文字），不编造真实发行信息、获奖桂冠或评分。`
    const prompt = [
      `电影海报：为${genre}题材的影片《${title}》设计一张竖版海报。`,
      storyLine,
      `版式（${no} ${layout.name}）：${layout.desc}。`,
      `片名「${title}」使用清晰的${lang === '中文' ? '中文字体（宋体 / 黑体 / 书法体按题材选择，不默认书法体）' : 'English typography'}，位置与层级符合所选版式；${infoLine}`,
      `配色与光影服务影片情绪；负空间充足，主次关系明确；人物 / 物件不被重要文字遮挡，边缘裁切合理。`,
      `画幅：竖版 2:3（1024x1536）。`,
      `洁癖约束：文字内容准确、缩略图中片名易读；没有参考依据就不添加额外元素。`,
    ].filter(Boolean).join('\n')
    return { prompt, params: { size: '1024x1536' } }
  }
  if (mode === 'book') {
    const book = values.book?.trim() || '一本书'
    const focus = values.focus?.trim() || '书中最核心的人物与主题'
    const spoiler = values.spoiler === '可以剧透'
    const metaphor = values.metaphor?.trim()
    const metaphorLine = metaphor ? `视觉隐喻方向：${metaphor}。` : ''
    const spoilerLine = spoiler
      ? '剧透处理：可以揭示关键情节。'
      : '剧透处理：避免剧透，画面只呈现人物、场景与意象层面的想象，不揭示结局；并在说明中交代画面依据。'
    const prompt = [
      `书页里的电影：如果《${book}》有一张电影海报，它会是什么样子？`,
      `要表现的内容：${focus}。`,
      spoilerLine,
      metaphorLine,
      '要求：电影感构图与光影，把阅读想象转成可执行的视觉画面；区分「原书内容」与「视觉隐喻」两部分；核对书名与作者文字准确。',
      '画幅：竖版 2:3（1024x1536）电影海报构图。',
    ].filter(Boolean).join('\n')
    return { prompt, params: { size: '1024x1536' } }
  }
  if (mode === 'pet') {
    const pet = values.pet?.trim() || '参考图中的宠物'
    const studio = values.studio ?? '中国红影棚'
    const props = values.props?.trim() || '红色节庆道具与福字点缀'
    const studioLine =
      studio === '中国红影棚' ? '中国红纯色影棚背景，暖调节庆灯光'
      : studio === '黑金影棚' ? '黑金色调影棚背景，轮廓光勾勒宠物'
      : studio === '纯白影棚' ? '纯白影棚背景，柔和均匀布光'
      : '一组不同姿势与景别的构图（特写 / 半身 / 全身交替）'
    const prompt = [
      `宠物新年写真：以参考图中的宠物为原型（${pet}），拍摄一张${studioLine}的新年主题写真。`,
      `节庆元素：${props}。`,
      '要求：严格保持参考图中宠物的可辨识特征（毛色、花纹、五官比例），不美化成别的宠物；姿态自然，主体完整不被裁切。',
      '构图：方形 1024x1024，宠物为绝对主体，背景干净。',
    ].join('\n')
    return { prompt, params: { size: '1024x1024' } }
  }
  const subject = values.subject?.trim() || '参考图中的主体'
  const style = values.style ?? '红金木版锦鲤'
  const withText = values.text === '加祝福文字'
  const greeting = values.greeting?.trim() || '恭喜发财，大吉大利'
  const textLine = withText
    ? `画中祝福文字：「${greeting}」，位置避开主体与上部头像区，字大易读。`
    : '不加画中文字（默认），祝福语由微信界面的昵称 / 祝福语位展示。'
  const prompt = [
    `微信红包封面原图：以「${style}」风格绘制一张 3:4 竖版封面，主体：${subject}。`,
    '构图要求：上部保留头像与昵称展示空间，下部保留按钮区域，关键主体放在中部安全区不被遮挡；不要把微信头像、按钮、红包下摆画进原图。',
    textLine,
    '风格质感：按所选风格统一色彩、材质与装饰元素，画面完整精致。',
    '画幅：竖版 1024x1536（3:4 安全区构图，后期可居中裁剪到 957x1278 上传）。',
  ].join('\n')
  return { prompt, params: { size: '1024x1536' } }
}

export const VANE_TEMPLATE: BuiltinTemplate = {
  id: 'builtin-vane',
  name: 'vane 玩法合集（表情包 / 海报 / 书影 / 宠物 / 红包封面）',
  description:
    '来自 VaneAi888/vane-gpt-image-skills 合集：5 种玩法动态切换——多画风表情包、电影级海报（36 版式）、书页里的电影、宠物新年写真、微信红包封面（36 风格），按各技能规则产出中文生图 Prompt',
  builtin: true,
  note: (values) => VANE_NOTES[values.mode ?? 'sticker'] ?? '',
  fields: vaneFields,
  build: buildVane,
}



/* ---------------- cc2image 内容配图（izscc/cc2image） ---------------- */

const CC2_STYLE_OPTIONS = [
    { value: 'handdrawn_knowledge_card', label: '手绘知识风' },
    { value: 'oriental_editorial_illustration', label: '典籍山水风' },
    { value: 'study_note_card', label: '学习笔记风' },
    { value: 'pastel_learning_pyramid', label: '粉彩金字塔风' },
    { value: 'childlike_cultural_infographic', label: '童趣科普风' },
    { value: 'frosted_glass_editorial', label: '磨砂情绪风' },
    { value: 'translucent_object_editorial', label: '透明物件风' },
    { value: 'glassmorphism_gradient_blob', label: '玻璃气泡风' },
    { value: 'embossed_typography_poster', label: '纸雕字体风' },
    { value: 'acrylic_dimensional_type', label: '亚克力字风' },
    { value: 'dark_neon_search_ui', label: '霓虹搜索风' },
    { value: 'black_void_glowing_hands', label: '黑场肢体风' },
    { value: 'soft_neumorphism_ui', label: '柔光界面风' },
    { value: 'minimal_line_shadow_brand', label: '线性品牌风' },
    { value: 'white_mono_texture_editorial', label: '白色肌理风' },
    { value: 'minimal_architecture_portfolio', label: '建筑线稿风' },
    { value: 'minimal_healing_metaphor_comic', label: '治愈漫画风' },
    { value: 'retro_minimal_poster_illustration', label: '复古海报风' },
    { value: 'editorial_balloon_collage', label: '气球拼贴风' },
    { value: 'transparent_architectural_type', label: '透明字境风' },
    { value: 'paper_cut_profile_silhouette', label: '纸雕剪影风' },
    { value: 'torn_paper_note_minimal', label: '撕纸便签风' },
    { value: 'fluffy_soft_typography', label: '毛绒字体风' },
    { value: 'cloud_typography_cover', label: '云朵字体风' },
    { value: 'foam_bubble_typography', label: '泡沫字体风' },
    { value: 'embroidered_patch_brand', label: '刺绣徽章风' },
    { value: 'luxury_gold_typography', label: '金属奢华风' },
    { value: 'miniature_map_life_scene', label: '微缩地图风' },
    { value: 'miniature_checklist_scene', label: '微缩清单风' },
    { value: 'fabric_micro_scene_ad', label: '布料微缩风' },
    { value: 'giant_letter_lifestyle_scene', label: '巨字生活风' },
    { value: 'oriental_floral_minimal_editorial', label: '花艺留白风' },
    { value: 'zen_ink_philosophy_poster', label: '禅意水墨风' },
    { value: 'editorial_line_character', label: '编辑线稿风' },
    { value: 'editorial_object_annotation_card', label: '具象标注风' },
    { value: 'crowd_typography_scene', label: '人群造字风' },
    { value: 'semantic_material_typography', label: '语义字体风' },
    { value: 'quirky_doodle_character_flow', label: '怪诞小人风' },
    { value: 'minimal_line_art', label: '线条艺术风' },
    { value: 'isometric_modular_system', label: '轴测模块系统风' },
    { value: 'monochrome_system_editorial', label: '黑白系统风' },
    { value: 'isometric_timeline_miniature', label: '时间微缩风' },
    { value: 'real_object_doodle_composite', label: '实物涂鸦风' },
    { value: 'expressive_3d_quirky_character', label: '3D怪表情风' },
    { value: 'giant_chinese_concept_poster', label: '大字海报风' },
    { value: 'premium_product_ad_poster', label: '产品海报风' },
    { value: 'glyph_object_imagery', label: '字物意象风' },
    { value: 'editorial_line_infographic_poster', label: '竖版线稿长图风' },
    { value: 'scribble_furball_character_family', label: '毛球角色家族风' },
]

const CC2_LOGO_OPTIONS = [
    { value: 'cute_3d_plastic_icon', label: '3D 新拟物风小图标' },
    { value: 'candy_glass_3d_icon', label: '3D 糖果风格图标' },
    { value: 'airbnb_soft_miniature_icon', label: 'Airbnb 风软拟物图标' },
    { value: 'circular_2_5d_vector_icon', label: '圆形轻拟物风格图标' },
    { value: 'soft_frosted_glass_icon', label: '软糖风格图标' },
    { value: 'circular_3d_texture_icon', label: '环形 3D 质感图标' },
    { value: 'frosted_glass_ui_icon', label: '磨砂玻璃质感小图标' },
    { value: 'pastel_reward_badge_icon', label: '粉彩奖励徽章图标' },
]

/** cc2image 统一视觉锚点（来自 visual_style.md） */
const CC2_STYLE_ANCHOR =
  '整体风格像高质量中文知识博主的手绘知识图解系统：暖白纸感背景，黑灰细线手绘，低饱和浅色块，中文手写字，自然成熟，克制精致，留白充足，轻商业内容资产感。不要做成 PPT，不要课程课件，不要科技海报，不要 3D，不要可爱儿童插画，不要复杂信息图，不要密集小字，不要高饱和颜色，不要英文乱码，不要水印。'

function cc2Fields(values: Record<string, string>): TemplateField[] {
  const mode = values.cc2mode ?? 'cover'
  const base: TemplateField[] = [
    { key: 'cc2mode', label: '配图类型', type: 'select', options: [
      { value: 'cover', label: '封面图（21:9 横版）' },
      { value: 'body', label: '正文配图（16:9 横版）' },
      { value: 'logo', label: 'logo / 图标（1:1）' },
    ] },
    { key: 'topic', label: '主题 / 文章内容', type: 'textarea', required: true, placeholder: '贴入中文主题、文章、段落或知识点' },
  ]
  if (mode === 'logo') {
    return [
      ...base,
      { key: 'logoStyle', label: '图标风格', type: 'select', options: [
    { value: 'cute_3d_plastic_icon', label: '3D 新拟物风小图标' },
    { value: 'candy_glass_3d_icon', label: '3D 糖果风格图标' },
    { value: 'airbnb_soft_miniature_icon', label: 'Airbnb 风软拟物图标' },
    { value: 'circular_2_5d_vector_icon', label: '圆形轻拟物风格图标' },
    { value: 'soft_frosted_glass_icon', label: '软糖风格图标' },
    { value: 'circular_3d_texture_icon', label: '环形 3D 质感图标' },
    { value: 'frosted_glass_ui_icon', label: '磨砂玻璃质感小图标' },
    { value: 'pastel_reward_badge_icon', label: '粉彩奖励徽章图标' },
      ] },
      { key: 'logoSubject', label: '图标主体', type: 'text', placeholder: '例：一个咖啡杯图标，圆润可爱' },
    ]
  }
  const styleField: TemplateField = {
    key: 'style', label: '视觉风格（49 选 1）', type: 'select',
    options: CC2_STYLE_OPTIONS,
  }
  if (mode === 'cover') {
    return [
      ...base,
      styleField,
      { key: 'subtitle', label: '副标题（可选）', type: 'text', placeholder: '例：把复杂知识变成一张图' },
      { key: 'metaphor', label: '核心隐喻（可选）', type: 'text', placeholder: '例：把知识拆成积木块' },
      { key: 'elements', label: '画面元素（可选）', type: 'textarea', placeholder: '例：积木块、箭头、小人' },
      { key: 'figure', label: '小人与气泡（可选）', type: 'text', placeholder: '例：小人坐着思考，气泡「有启发」' },
      { key: 'conclusion', label: '底部判断句（可选）', type: 'text', placeholder: '例：知识只有被拆解才能被吸收' },
    ]
  }
  return [
    ...base,
    styleField,
    { key: 'structure', label: '图解结构', type: 'select', options: [
      '闭环机制图', '横向流程图', '分类树图', '左右对比图', '结构类比图', '风险路径图', '光谱选择图', '随附场景图',
    ] },
    { key: 'modules', label: '核心模块（2-4 个）', type: 'textarea', required: true, placeholder: '例：输入 → 加工 → 输出 → 反馈' },
    { key: 'annotation', label: '必要注释（可选）', type: 'text', placeholder: '例：每步不超过 5 个字' },
  ]
}

function buildCc2(values: Record<string, string>): { prompt: string; params?: Partial<GenParams> } {
  const mode = values.cc2mode ?? 'cover'
  const topic = values.topic?.trim() || '中文知识主题'
  const anchor = `视觉风格锚点：${CC2_STYLE_ANCHOR}`
  if (mode === 'logo') {
    const style = values.logoStyle ?? 'cute_3d_plastic_icon'
    const styleLabel = CC2_LOGO_OPTIONS.find((o) => o.value === style)?.label ?? style
    const subject = values.logoSubject?.trim() || `与「${topic}」相关的图标主体`
    const prompt = [
      `App 图标 / logo 设计：${styleLabel}。`,
      `图标主体：${subject}，与主题「${topic}」相关。`,
      '构图：1:1 正方形居中，图标主体完整清晰，背景干净。',
      anchor,
    ].join('\n')
    return { prompt, params: { size: '1024x1024' } }
  }
  const styleId = values.style ?? 'handdrawn_knowledge_card'
  const styleLabel = CC2_STYLE_OPTIONS.find((o) => o.value === styleId)?.label ?? styleId
  if (mode === 'cover') {
    const subtitle = values.subtitle?.trim()
    const metaphor = values.metaphor?.trim() || `与「${topic}」相关的核心概念隐喻`
    const elements = values.elements?.trim() || '简洁的概念图元素（模块、箭头、标签）'
    const figure = values.figure?.trim() || '小人坐着思考，气泡写着「有启发」'
    const conclusion = values.conclusion?.trim() || `「${topic}，值得被认真拆解一次」`
    const subLine = subtitle ? `标题下方写副标题：「${subtitle}」。副标题使用较小的细线手写字，清楚、自然、安静。` : ''
    const prompt = [
      `请生成一张中文知识文章封面图（横版宽幅构图，按 21:9 封面意图适配当前画幅）。`,
      `主题是「${topic}」。`,
      `视觉风格方向：${styleLabel}（在统一视觉锚点内做该风格的题材适配）。`,
      anchor,
      `采用左右结构：左侧约 45% 放主标题和副标题，右侧约 55% 放手绘概念图。`,
      `左侧用自然成熟的中文手写大字写标题：「${topic}」。标题可以分成两行或三行，其中一行背后加一块很淡的低饱和手绘笔刷色块。`,
      subLine,
      `右侧画一个简单的手绘概念图，核心隐喻是「${metaphor}」。画面元素包括「${elements}」。图解简洁，像知识隐喻，不是插画场景。图解中可以有少量中文标签，每个标签 2 到 6 个字。`,
      `右下角画一个极简抽象小人，${figure}。`,
      `底部用很轻的小字写一句判断式结论：「${conclusion}」。`,
    ].filter(Boolean).join('\n')
    return { prompt, params: { size: '1536x1024' } }
  }
  const structure = values.structure ?? '横向流程图'
  const modules = values.modules?.trim() || '输入 → 加工 → 输出'
  const annotation = values.annotation?.trim() || '注释保持极简'
  const prompt = [
    `请生成一张中文文章正文配图（横版构图，按 16:9 意图适配当前画幅），不是封面图。`,
    `主题是「${topic}」。`,
    `视觉风格方向：${styleLabel}（在统一视觉锚点内做该风格的题材适配）。`,
    anchor,
    `画面顶部居中写一个自然成熟的中文手写标题：「${topic}」，标题下方一条很轻的手绘短线。`,
    `画面中间绘制一个「${structure}」。核心模块包括：「${modules}」。模块使用低饱和浅色圆角卡片、便签、框图或标签承载，模块之间用黑灰色细线手绘箭头连接。主体图解不要过大，四周保留明显留白。`,
    `在图解旁加入少量极简短注释：「${annotation}」。注释必须短，不要生成大段正文，不要密集小字。`,
    `画面右侧或右下角画一个极简抽象小人，细线条，成人感，在思考或做记录。小人旁边有一个小气泡，写着：「有启发」。`,
    `画面底部用轻微手写小字写一句判断式结论：「拆解之后，知识才真正属于你」。`,
  ].join('\n')
  return { prompt, params: { size: '1536x1024' } }
}

export const CC2_TEMPLATE: BuiltinTemplate = {
  id: 'builtin-cc2image',
  name: 'cc2image 内容配图（封面 / 正文 / logo）',
  description:
    '来自 izscc/cc2image 技能：中文内容交互式生图系统——49 套内容视觉风格 + 8 套图标风格，封面 21:9 / 正文 16:9 / logo 1:1 三种模式，按统一视觉锚点产出中文手绘知识图解 Prompt',
  builtin: true,
  note: (values) => {
    const mode = values.cc2mode ?? 'cover'
    if (mode === 'logo') return 'logo 模式固定 1:1 单张；8 种图标风格。'
    return '49 套内容风格共用一套「中文知识博主手绘图解」视觉锚点，风格名决定题材适配方向。封面默认 21:9、正文 16:9，本工作台按横版画幅适配；需要精确 21:9 时后期裁剪即可。'
  },
  fields: cc2Fields,
  build: buildCc2,
}


/* ---------------- 照片救援（LumaRescue） ---------------- */

export const LUMA_RESCUE_TEMPLATE: BuiltinTemplate = {
  id: 'builtin-lumarescue',
  name: '照片救援 · LumaRescue',
  description:
    '来自 justlovemaki/LumaRescue：废片修复 / 人像美化 / 风景增强 / 老照片修复上色 / 建筑与展品优化——保留身份与事实、放开光线与构图，按自然 / 美化两档产出图生图编辑 Prompt',
  builtin: true,
  note: lumaRescueNote,
  fields: lumaRescueFields,
  build: buildLumaRescue,
}

export function getAllTemplates(customs: CustomTemplate[]): AnyTemplate[] {
  return [ECOM_TEMPLATE, VANE_TEMPLATE, CC2_TEMPLATE, PPT_TEMPLATE, RECIPE_TEMPLATE, GORDEN_TEMPLATE, EVC_TEMPLATE, DOC_ILLU_TEMPLATE, PAPER_COMIC_TEMPLATE, XIAOHEI_TEMPLATE, GZ_TEMPLATE, ZINE_TEMPLATE, LUMA_RESCUE_TEMPLATE, ...customs]
}
