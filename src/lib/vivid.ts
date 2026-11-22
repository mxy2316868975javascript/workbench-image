/**
 * vivid-illustration-skill（yjz211/vivid-illustration-skill）的科研图表配方库接入：
 * 148 个 matplotlib 配方卡（数据图），转成「示意版数据图表」生图 Prompt——
 * 明确标注为示意呈现（非精确数据图），适合文章配图 / PPT 插图场景。
 * 数据按需拉取 catalog/cards.json 并缓存到 IndexedDB。
 */

export interface VividCard {
  id: string
  display_name: string
  tags: string[]
  purpose: string
  data_requirements: string[]
  composition: string
  visual_features: string[]
  adaptation_notes?: string
  previews?: Array<{ path: string; thumbnail: string; palette?: string[] }>
}

const DATA_BASES = [
  'https://raw.githubusercontent.com/yjz211/vivid-illustration-skill/main/channels/vivid-figure-skill/catalog',
  'https://cdn.jsdelivr.net/gh/yjz211/vivid-illustration-skill@main/channels/vivid-figure-skill/catalog',
]

export const VIVID_KV_KEY = 'vivid-cards'

export async function fetchVividCards(): Promise<VividCard[]> {
  let lastErr: unknown
  for (const base of DATA_BASES) {
    try {
      const res = await fetch(`${base}/cards.json`, { signal: AbortSignal.timeout(60000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d = (await res.json()) as { cards: VividCard[] }
      return d.cards
    } catch (err) {
      lastErr = err
    }
  }
  throw new Error(`拉取 cards.json 失败（所有源均不可达）：${lastErr instanceof Error ? lastErr.message : lastErr}`)
}

/** 配方缩略图地址（懒加载用） */
export function vividThumbnail(card: VividCard): string | null {
  const thumb = card.previews?.[0]?.thumbnail
  if (!thumb) return null
  return `${DATA_BASES[0]}/${thumb}`
}

/** 示意版数据图表生图 Prompt */
export function buildVividPrompt(card: VividCard, values: { data: string; title: string; vivid: boolean }): string {
  const data = values.data.trim() || '（在此描述数据要点，示意呈现）'
  const title = values.title.trim() || card.display_name
  const palette = card.previews?.[0]?.palette
  const paletteLine = palette?.length
    ? `配色（按配方色板）：${palette.slice(0, 6).join('、')}。`
    : '配色：科研图表风格，低饱和、主色突出。'
  const modeLine = values.vivid
    ? '配色鲜艳明快、对比强烈。'
    : '配色稳重克制、低饱和。'
  const features = card.visual_features?.length
    ? `视觉特征：${card.visual_features.join('；')}。`
    : ''
  const requirements = card.data_requirements?.length
    ? `数据形态参考：${card.data_requirements.join('；')}。`
    : ''
  const lines = [
    `示意版科研数据图表（illustrative data chart，非精确数据图）：绘制一张「${card.display_name}」风格的图表。`,
    `图表构图：${card.composition}。`,
    features,
    requirements,
    `数据要点（示意化呈现，比例与标签近似即可，不必精确）：${data}`,
    `图表标题：「${title}」。系列图例按数据系列命名，标签用简体中文。`,
    paletteLine,
    modeLine,
    '质感：白底科研图表风格，字体清晰易读，整体干净专业。',
    '明确约束：本图为示意呈现——数值比例与文字由 AI 近似渲染，可能不准确；不要将本图用于需要精确数据的科研或正式陈述。',
  ].filter(Boolean)
  return lines.join('\n')
}
