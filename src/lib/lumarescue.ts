/**
 * 照片救援（justlovemaki/LumaRescue）模板构建器：
 * 按题材（人像 / 风景 / 建筑 / 展品 / 产品 / 文档 / 老照片）套用修复与美化逻辑，
 * 区分硬锚点（必须保留）与软锚点（允许改善），产出 ai_natural / ai_beauty 两档
 * 图生图编辑 Prompt。原技能的 program_* 两版依赖本地确定性修图，工作台不覆盖。
 */
import type { GenParams, TemplateField } from './types'

interface RescueProfile {
  value: string
  label: string
  /** 英文题材名（写进 Prompt，避免中英混排影响模型判断） */
  en: string
  /** 必须保持的事实内容 */
  hard: string
  /** 允许改善的审美项 */
  soft: string
  /** 题材专属处理规则（英文 Prompt 段落） */
  logic: string
}

const PROFILES: RescueProfile[] = [
  {
    value: 'portrait',
    label: '人像 / 自拍 / 写真',
    en: 'portrait or selfie photograph',
    hard: 'identity, facial structure, age, expression, pose, body shape, hairstyle, glasses, jewelry and clothing; keep hands and fingers natural',
    soft: 'light quality and direction, healthy skin tone, eye clarity, background clutter and blur, lens feel, crop and breathing room',
    logic:
      'Portrait logic: flattering but natural directional light, healthy believable skin tone, clear eyes, real skin texture, hair and fabric detail. Retouch blemishes and distractions lightly. Simulate a longer portrait focal length and shallow depth of field through natural background blur and subject separation. Do not change facial structure, age, body shape or personal features. Avoid waxy skin, smeared detail and blur spill onto hair, glasses, fingers or clothing edges.',
  },
  {
    value: 'landscape',
    label: '风景 / 旅行 / 城市',
    en: 'landscape, travel or cityscape photograph',
    hard: 'recognizable terrain, viewpoint, landmarks, man-made structures, horizon placement and subject placement',
    soft: 'sky, clouds, time-of-day feel, light direction, atmosphere, color grade, depth, foreground separation and crop',
    logic:
      'Landscape logic: build depth with clear foreground, midground and background layers; let light guide the eye; recover or rebuild the sky and atmosphere coherently. Avoid pasted-looking clouds, mismatched sun direction, halos along mountains and rooftops, fake HDR and impossible scenery. For a breathtaking beauty version you may rebuild sky, extend canvas and relight the scene, but keep the place recognizable.',
  },
  {
    value: 'architecture',
    label: '建筑 / 室内',
    en: 'architecture or interior photograph',
    hard: 'building identity, straight geometry and verticals, facade rhythm, window layout, signage, materials and structural design',
    soft: 'light and shadow structure, sky, color grade, perspective cleanup, visitors and clutter, crop and negative space',
    logic:
      'Architecture logic: straighten verticals and perspective, keep facade rhythm and material texture believable, shape calm architectural light and clean shadows. Do not warp buildings, invent windows, alter signage or over-HDR surfaces. Use generative edits conservatively: correct, clean and simplify rather than reinvent the building.',
  },
  {
    value: 'museum',
    label: '博物馆 / 展览 / 藏品',
    en: 'museum exhibition or artifact photograph',
    hard: 'artifact color, material, patina, brushwork, inscriptions, labels that matter, frame, plinth and necessary display context',
    soft: 'glass glare, white balance, uneven museum lighting, empty walls, visitors, background blur and crop',
    logic:
      'Museum exhibit logic: documentary fidelity plus exhibit isolation. Remove glass glare and correct mixed museum lighting; preserve the artifact’s true material, patina, inscriptions and damage marks. Recompose by default: straighten perspective, crop away empty walls, visitors and case edges, and let the artifact occupy a calmer, stronger position. Add natural background blur when it makes the artifact more prominent, but keep the artifact, inscriptions and labels sharp. Never invent missing artifact details.',
  },
  {
    value: 'product',
    label: '产品 / 美食',
    en: 'product or food photograph',
    hard: 'product geometry and design, packaging text, logos, brand colors and accurate materials; food shape and portion',
    soft: 'background and props, lighting, surface reflections, color appetite, crop and presentation',
    logic:
      'Product and food logic: premium or appetizing presentation with accurate geometry, clean surface texture and controlled highlights. Render materials and food textures honestly, keep brand colors truthful, and crop for sharing or commerce. Do not redesign packaging, rewrite labels or turn food into an unappetizing illustration.',
  },
  {
    value: 'doc',
    label: '文档 / 艺术品 / 扫描件',
    en: 'document, artwork or scanned page',
    hard: 'text legibility and content, artwork colors and edges, document completeness and factual layout',
    soft: 'white balance, contrast, background cleanup, perspective correction, dead margins and crop',
    logic:
      'Document and artwork logic: legibility first. Correct perspective, white balance and uneven lighting; clean backgrounds and dead margins; keep colors, edges and content faithful. Never rewrite, invent or decorate text, and do not crop away required content or artwork edges.',
  },
  {
    value: 'oldphoto',
    label: '老照片 / 褪色 / 黑白 / 破损',
    en: 'old, faded, black-and-white or damaged photograph',
    hard: 'faces and identity, historical facts, inscriptions, original composition and any age cues the user wants preserved',
    soft: 'dust, scratches, tears, stains, fading, contrast, tonal balance, colorization and crop',
    logic:
      'Old-photo logic: restore structure before color. Repair dust, scratches and tears; recover contrast and tonal balance; keep reconstruction plausible and state that missing areas were inferred. Colorization must be restrained and believable — no neon skin, fabric or sky. Protect original grain and age cues unless a modern clean restoration is requested.',
  },
  {
    value: 'mixed',
    label: '混合场景 / 其他',
    en: 'mixed-scene photograph',
    hard: 'main subject identity, readable text, key objects and the core scene layout',
    soft: 'lighting, background, color, atmosphere, depth, lens feel and crop',
    logic:
      'Mixed-scene logic: identify the main subject and protect its factual identity, then improve light, color, depth, background hierarchy and framing. Apply the least invasive treatment that makes the photo clearly more beautiful.',
  },
]

const AESTHETICS: { value: string; label: string; desc: string }[] = [
  { value: 'auto', label: '自动匹配题材', desc: 'Choose the most fitting photographic direction for this subject and scene.' },
  { value: 'clean', label: '干净自然', desc: 'Clean and natural: true-to-life color, soft neutral light, honest texture, restrained contrast.' },
  { value: 'filmic', label: '暖调胶片', desc: 'Warm filmic: gentle warm highlights, slightly lifted shadows, subtle analog grain and color separation.' },
  { value: 'airy', label: '通透明亮', desc: 'Airy and bright: luminous highlights, soft haze, pale palette and generous clean negative space.' },
  { value: 'cinematic', label: '戏剧电影感', desc: 'Dramatic cinematic: decisive key light, deep shadows, restrained teal-and-amber palette, strong atmosphere.' },
  { value: 'commercial', label: '商业高级感', desc: 'Premium commercial: crisp controlled highlights, rich material texture, polished color and high-end finish.' },
  { value: 'portrait', label: '浪漫人像', desc: 'Romantic editorial portrait: shaped flattering light, creamy background separation, warm healthy skin, quiet mood.' },
  { value: 'documentary', label: '纪实端正', desc: 'Documentary dignity: faithful color and context, restrained correction, no theatrical grade.' },
  { value: 'architectural', label: '几何建筑', desc: 'Geometric architectural: straight lines, monumental order, material truth and calm shadow structure.' },
  { value: 'minimal', label: '极简安静', desc: 'Quiet minimalism: restrained palette, centered balance, negative space and stillness.' },
  { value: 'street', label: '街头诗意', desc: 'Street-poetic: strong geometry, a human moment, layered reflections and painterly color blocks.' },
  { value: 'travel', label: '鲜明旅行', desc: 'Vibrant travel: vivid but controlled color, clear depth and an inviting sense of place.' },
  { value: 'grand', label: '壮阔风景', desc: 'Tonal grandeur: wide tonal range, luminous highlights, rich blacks, dramatic scale and atmosphere.' },
  { value: 'custom', label: '自定义方向', desc: '' },
]

const CROP_TEXT: Record<string, string> = {
  auto:
    'Composition — compare at least four framings: improved original framing, a tighter subject crop, an expressive aspect ratio (vertical / panoramic / square / cinematic wide), and a negative-space or geometry-led composition. Judge subject scale, edge cleanliness, leading lines, gaze or motion room, foreground-background relationship and thumbnail impact. Default to the strongest frame; do not keep accidental phone framing. Never cut through joints, fingertips, hair silhouette, key props, typography or product edges.',
  keep:
    'Composition — keep the original framing. Only straighten unintentional tilt, correct perspective, remove dead borders and clean the edges. Do not crop into the subject and do not change the aspect ratio.',
  tighter:
    'Composition — crop tighter around the subject for presence and clearer visual hierarchy, while keeping natural breathing room toward the gaze or motion direction. Do not cut through joints, fingertips, hair silhouette, key props, typography or product edges.',
  vertical:
    'Composition — recompose to a vertical portrait frame that emphasizes presence, scale or grandeur. Keep the subject dominant, leave natural breathing room, and avoid a cramped top or bottom edge.',
  panorama:
    'Composition — recompose to a panoramic wide frame for scale and atmosphere. Keep the horizon level, preserve leading lines, and keep the main subject from being lost at the edges.',
  square:
    'Composition — recompose to a square editorial frame for stillness and subject dignity. Center the visual weight deliberately and keep the corners clean.',
  cinematic:
    'Composition — recompose to a wide cinematic frame with atmospheric depth and deliberate negative space. Keep the subject clearly placed and the frame free of accidental tangencies.',
}

const VINTAGE_TEXT: Record<string, string> = {
  repair:
    'Restoration mode — structure only: repair damage, recover contrast and tone, but do not colorize. Keep the historical black-and-white or faded character.',
  colorize:
    'Restoration mode — restore first, then add restrained, plausible colorization. Infer colors from context; keep skin, fabric and background muted and believable. Never claim historical certainty and avoid neon or anachronistic color.',
  modern:
    'Restoration mode — modern archival clean: remove dust, scratches and tears, recover contrast, reduce heavy grain while keeping natural detail. Do not plasticize skin or erase fine texture.',
  grain:
    'Restoration mode — preserve age cues: repair damage and contrast but keep the original grain, paper tone and vintage texture. Avoid a digital-clean look.',
}

export function lumaRescueFields(values: Record<string, string>): TemplateField[] {
  const fields: TemplateField[] = [
    {
      key: 'photoType',
      label: '照片类型',
      type: 'select',
      options: PROFILES.map((p) => ({ value: p.value, label: p.label })),
    },
    {
      key: 'variant',
      label: '输出档位',
      type: 'select',
      options: [
        { value: 'ai-natural', label: 'AI 自然版（克制可信，像一张更好的原片）' },
        { value: 'ai-beauty', label: 'AI 美化版（高冲击，第一眼更震撼）' },
      ],
    },
    {
      key: 'aesthetic',
      label: '审美方向',
      type: 'select',
      options: AESTHETICS.map((a) => ({ value: a.value, label: a.label })),
    },
    { key: 'customStyle', label: '自定义审美方向', type: 'text', placeholder: '例：冷调北欧清晨，低饱和，柔和长阴影' },
    {
      key: 'issues',
      label: '现存问题（可多写）',
      type: 'textarea',
      placeholder: '例：欠曝、发灰、偏黄、噪点重、轻微手抖模糊、构图歪、玻璃反光、划痕与褪色',
    },
    {
      key: 'preservation',
      label: '保留强度',
      type: 'select',
      options: [
        { value: 'standard', label: '标准：保留硬锚点，放开软锚点' },
        { value: 'strict', label: '严格纪实：只修复校正，不重构图' },
        { value: 'bold', label: '自由美化：允许重打光 / 换天空 / 重构图' },
      ],
    },
    {
      key: 'crop',
      label: '构图 / 裁切',
      type: 'select',
      options: [
        { value: 'auto', label: '自动：对比四种构图取最强' },
        { value: 'keep', label: '保留原构图' },
        { value: 'tighter', label: '更紧的主体裁切' },
        { value: 'vertical', label: '竖版（强调气势 / 人像）' },
        { value: 'panorama', label: '全景宽幅（强调规模）' },
        { value: 'square', label: '方形（安静 / 庄重）' },
        { value: 'cinematic', label: '电影宽幅（氛围）' },
      ],
    },
    {
      key: 'size',
      label: '输出画幅',
      type: 'select',
      options: [
        { value: 'auto', label: '自动（按构图推断 / 沿用当前）' },
        { value: 'square', label: '方形 1024×1024' },
        { value: 'portrait', label: '竖版 1024×1536' },
        { value: 'landscape', label: '横版 1536×1024' },
      ],
    },
    {
      key: 'hardAnchors',
      label: '额外必须保留（可选）',
      type: 'text',
      placeholder: '例：本人痣与眼镜、牌匾文字、Logo、文物铭文',
    },
    {
      key: 'extra',
      label: '额外要求（可选）',
      type: 'textarea',
      placeholder: '例：天空可以换成火烧云但太阳方向不变；保留年代颗粒；不要磨皮',
    },
  ]

  // 仅老照片题材显示修复/上色模式
  if (values.photoType === 'oldphoto') {
    fields.splice(8, 0, {
      key: 'vintageMode',
      label: '老照片处理',
      type: 'select',
      options: [
        { value: 'repair', label: '只修复，不上色' },
        { value: 'colorize', label: '修复 + 克制的可信上色' },
        { value: 'modern', label: '现代干净修复（去重颗粒）' },
        { value: 'grain', label: '保留年代颗粒与纸感' },
      ],
    })
  }

  // 只有自定义审美方向时才显示输入框
  if (values.aesthetic !== 'custom') {
    return fields.filter((f) => f.key !== 'customStyle')
  }
  return fields
}

/** 构图 → 建议画幅（size 为 auto 时生效） */
function resolveSize(size: string, crop: string): string | undefined {
  if (size === 'square') return '1024x1024'
  if (size === 'portrait') return '1024x1536'
  if (size === 'landscape') return '1536x1024'
  if (crop === 'square') return '1024x1024'
  if (crop === 'vertical') return '1024x1536'
  if (crop === 'panorama' || crop === 'cinematic') return '1536x1024'
  return undefined
}

const SIZE_ASPECT: Record<string, string> = {
  '1024x1024': '1:1 square',
  '1024x1536': '2:3 vertical',
  '1536x1024': '3:2 horizontal',
}

export function buildLumaRescue(values: Record<string, string>): { prompt: string; params?: Partial<GenParams> } {
  const profile = PROFILES.find((p) => p.value === values.photoType) ?? PROFILES[0]
  const variant = values.variant === 'ai-beauty' ? 'ai-beauty' : 'ai-natural'
  const preservation = values.preservation || 'standard'
  // 严格纪实下：不允许重构图，美化档也只做忠实改善
  const effectiveCrop = preservation === 'strict' ? 'keep' : values.crop || 'auto'
  const aesthetic = AESTHETICS.find((a) => a.value === values.aesthetic) ?? AESTHETICS[0]
  const aestheticDesc =
    aesthetic.value === 'custom'
      ? values.customStyle?.trim() || AESTHETICS[0].desc
      : aesthetic.desc
  const vintageMode = values.vintageMode || 'repair'
  const size = resolveSize(values.size || 'auto', effectiveCrop)
  const extra = values.extra?.trim() || ''
  const hardExtra = values.hardAnchors?.trim() || ''

  const goal =
    variant === 'ai-beauty'
      ? preservation === 'strict'
        ? 'Goal — faithful documentary improvement (ai_beauty under strict mode): make the photo clearer, calmer and more dignified through better light balance, color truth, damage repair and edge cleanup. Do not invent, restyle or reinterpret the scene; beauty here means clarity, honesty and quiet presence, not drama.'
        : 'Goal — AI beauty transformation (ai_beauty): create a visibly more beautiful, premium photograph, not a clean repair. Treat the upload as subject and reference rather than a pixel-locked frame. Strengthen light direction, luminance hierarchy, mood, color harmony, depth, subject separation, sky/background quality, lens feel, crop and atmosphere until the image feels stunning and share-worthy at first glance. Preserve the hard anchors; deliberately allow the soft anchors to change.'
      : 'Goal — AI natural restoration (ai_natural): make it look like a better original photograph. Correct exposure, white balance, contrast, clarity, noise and minor damage; improve light shaping and framing only where clearly beneficial. Use generative repair, cleanup, outpainting or relighting only where the available pixels cannot carry the improvement. Keep the result plausible, restrained and faithful.'

  const preservationText =
    preservation === 'strict'
      ? 'Preservation mode — strict documentary: repair, correct, straighten and clean only. Do not move, invent, add or remove factual content; do not restyle the scene; keep colors, materials, labels and artifact truth faithful. No generative invention beyond damage repair and glare or dust cleanup.'
      : preservation === 'bold'
        ? 'Preservation mode — free beauty: hard anchors stay stable, but all soft anchors may be boldly rebuilt — light direction, time of day, sky, atmosphere, background simplification, outpainting, realistic lens separation and confident recomposition.'
        : 'Preservation mode — standard: keep hard anchors stable and improve the soft anchors enough that the photo is clearly more beautiful, not merely cleaner.'

  const aspectText = size
    ? `Output aspect ratio: ${SIZE_ASPECT[size]} (${size}). Compose the frame natively for this ratio; do not letterbox or add borders.`
    : 'Output aspect ratio: follow the current canvas ratio. If the canvas ratio is fixed, achieve the strongest composition within it rather than adding borders.'

  const blocks: string[] = [
    `Edit the uploaded reference photo. The upload is the subject and the only source of truth — do not replace it with a different scene or a different person. Photo type: ${profile.en} (${profile.label}).`,
    goal,
    `Photographic direction: ${aestheticDesc}`,
    `Hard anchors — must remain recognizable and factually unchanged: ${profile.hard}${hardExtra ? `; plus ${hardExtra}` : ''}. Do not change identity, anatomy, expression, pose, clothing, readable text, logos, landmarks, architecture identity, artifact facts or product design.`,
    `Soft anchors — allowed and expected to improve: ${profile.soft}. Do not over-preserve weak original lighting, dull color, accidental framing, clutter or flat phone-camera depth.`,
    preservationText,
    'Light first: define a clear key-light direction and a deliberate luminance hierarchy. Let highlights lead the eye and shadows create depth while retaining detail in both. Better light beats heavier color; avoid flat global brightening and one-click filter looks.',
    CROP_TEXT[effectiveCrop] ?? CROP_TEXT.auto,
    aspectText,
    profile.logic,
    ...(profile.value === 'oldphoto' ? [VINTAGE_TEXT[vintageMode] ?? VINTAGE_TEXT.repair] : []),
    'Quality constraints: photorealistic result. No fake HDR, halos, pasted clouds, mismatched sun direction, plastic or waxy skin, crushed blacks, clipped highlights, color banding, warped faces or buildings, invented landmarks, rewritten text, over-sharpening or over-filtered color. Protect fine detail in hair, eyes, fabric, text and material texture. If an area must be reconstructed, keep it plausible and do not add new factual elements.',
    'Deliver one edited photograph — the final frame only. No text overlays, borders, watermarks, comparison grids or before/after composites.',
    extra ? `Additional direction: ${extra}` : '',
  ]

  return {
    prompt: blocks.filter(Boolean).join('\n\n'),
    params: size ? { size } : undefined,
  }
}

/** 底部说明：按填写内容动态提示 */
export function lumaRescueNote(values: Record<string, string>): string {
  const notes: string[] = [
    '先把照片作为参考图上传（图生图，最多 4 张，第一张为主图），再填入提示词。',
    '本模板只生成 ai_natural / ai_beauty 两档编辑 Prompt；原技能的 program_natural / program_beauty 依赖本地确定性修图（曝光 / 曲线 / 降噪），工作台不提供，可先用 Lightroom 或原技能出底片再回来做 AI 版。',
  ]
  const type = values.photoType
  if ((type === 'museum' || type === 'doc') && values.preservation !== 'strict') {
    notes.push('展品与文档建议选「严格纪实」：只修复、校正、去反光，不重构图、不生成原图没有的内容。')
  }
  if (values.variant === 'ai-beauty' && values.preservation === 'bold') {
    notes.push('自由美化会重打光、换天空、重构图，只适合风景 / 旅行 / 概念类；人像、建筑、展品请改用标准或严格模式。')
  }
  if ((values.size || 'auto') === 'auto' && values.crop && values.crop !== 'auto' && values.crop !== 'keep' && values.crop !== 'tighter') {
    notes.push('尺寸选了自动时，会根据构图自动联动画幅。')
  }
  return notes.join(' ')
}