/**
 * 花叔 Design 风格库（alchaincyf/huashu-design）接入：
 * 92 种设计风格（网页 20 / PPT 20 / 信息图 20 / App 12 / 中文东亚 12 / 小红书 8）+ 9 款 AI 生图专用风格。
 * 按官方「生图提示词心法（Mood, Not Layout）」产出短提示词：描述情绪与内容，不堆布局细节。
 * 数据按需拉取 references/design-styles.md 并缓存到 IndexedDB。
 */

export interface HuashuStyle {
  group: string
  sub: string
  name: string
  tag: string
  dna: string
  fit: string
  ref: string
  aiNative?: boolean
}

const DATA_BASES = [
  'https://raw.githubusercontent.com/alchaincyf/huashu-design/master/references/design-styles.md',
  'https://cdn.jsdelivr.net/gh/alchaincyf/huashu-design@master/references/design-styles.md',
]

export const HUASHU_KV_KEY = 'huashu-styles'

/** AI 生图专用风格（灵魂在 AI 直出图，HTML 做不了） */
const AI_NATIVE_NAMES = [
  'Active Theory',
  'Field.io',
  'Resn',
  'Zach Lieberman',
  'Raven Kwok',
  'Ash Thorp',
  'Territory Studio',
  'Neo Shen',
  'Sagmeister & Walsh',
]

export async function fetchHuashuStyles(): Promise<HuashuStyle[]> {
  let lastErr: unknown
  let md = ''
  for (const base of DATA_BASES) {
    try {
      const res = await fetch(base, { signal: AbortSignal.timeout(60000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      md = await res.text()
      break
    } catch (err) {
      lastErr = err
    }
  }
  if (!md) throw new Error(`拉取 design-styles.md 失败（所有源均不可达）：${lastErr instanceof Error ? lastErr.message : lastErr}`)
  return parseHuashuStyles(md)
}

/** 解析 design-styles.md：分组 → 子分类 → 风格条目（**名称**`tag` + 字段行） */
export function parseHuashuStyles(md: string): HuashuStyle[] {
  const styles: HuashuStyle[] = []
  let group = ''
  let sub = ''
  let cur: HuashuStyle | null = null
  for (const rawLine of md.split('\n')) {
    const line = rawLine.trim()
    const groupMatch = line.match(/^## (.+?)\((\d+)种\)/)
    if (groupMatch) {
      group = groupMatch[1].trim()
      sub = ''
      cur = null
      continue
    }
    const subMatch = line.match(/^#### (.+)$/)
    if (subMatch) {
      sub = subMatch[1].trim()
      continue
    }
    const styleMatch = line.match(/^\*\*(.+?)\*\*\s*`([^`]*)`/)
    if (styleMatch) {
      const name = styleMatch[1].trim()
      const aiNative = AI_NATIVE_NAMES.some((n) => name.includes(n))
      cur = { group, sub, name, tag: styleMatch[2].trim(), dna: '', fit: '', ref: '', aiNative }
      styles.push(cur)
      continue
    }
    if (!cur) continue
    const fieldMatch = line.match(/^- (视觉DNA|适配|参考|HTML实现|字体|样张)[:：]\s*(.*)$/)
    if (fieldMatch) {
      const key = fieldMatch[1]
      const val = fieldMatch[2]
      if (key === '视觉DNA') cur.dna = val
      else if (key === '适配') cur.fit = val
      else if (key === '参考') cur.ref = val
    }
  }
  return styles
}

/** Mood, Not Layout：按官方生图心法产出短提示词（描述情绪与内容，不堆布局） */
export function buildHuashuPrompt(
  style: HuashuStyle,
  values: { topic: string; mood?: string; feel?: string; ratio?: '16:9' | '3:4' | '1:1' },
): string {
  const topic = values.topic.trim() || '一个视觉设计主题'
  const mood = values.mood?.trim() || '与主题匹配的、有作者意图的氛围'
  const feel = values.feel?.trim() || ''
  const carrier = huashuCarrier(style.group)
  const aiNativeNote = style.aiNative
    ? '此风格的灵魂在 AI 直出图（动态视觉 / 光影 / 手作质感），正是生图模型擅长呈现的方向。'
    : ''
  const lines = [
    `设计视觉稿示意图（illustrative design mockup，非可交互成品）：为「${topic}」设计一张${carrier}的视觉稿。`,
    `设计风格美学：${style.name}——${style.dna}`,
    style.ref ? `（参考美学：${style.ref}）` : '',
    `情绪：${mood}。`,
    feel ? `观众应该感受到：${feel}。` : '',
    `中文内容呈现，标题清晰；整体氛围贴合所选风格美学，有作者意图，不做无意义堆砌。`,
    `画幅：${values.ratio === '3:4' ? '3:4 竖版' : values.ratio === '1:1' ? '1:1 方形' : '16:9 横版'}。`,
    `明确约束：这是视觉示意稿（design mockup illustration），不是可交互网页成品；无真实 logo，无水印。${aiNativeNote}`,
  ].filter(Boolean)
  return lines.join('\n')
}

function huashuCarrier(group: string): string {
  if (group.includes('网页')) return '网页 / 落地页'
  if (group.includes('PPT')) return '演示文稿页面'
  if (group.includes('信息图')) return '信息图'
  if (group.includes('App')) return 'App 界面'
  if (group.includes('中文') || group.includes('东亚')) return '中文视觉版面'
  if (group.includes('小红书')) return '小红书图文'
  return '视觉设计'
}
