/**
 * 电商场景模板库（liangdabiao/ecom-details-image）接入：
 * 25 个编号场景模板（白底主图 / 场景图 / 平铺图 / UGC / 直播…），
 * 每个模板含 prompt_template 字段组、defaults 与命名变体（luxury / fresh / tech…）。
 * 数据按需拉取 references/templates/*.json 并缓存到 IndexedDB。
 * Prompt 组装遵循该技能的 GPT-Image 铁律：hex 颜色 / 产品占比数字化 / 留白显式声明 / 平台预留 / 否定清单。
 */

export interface EcomSkinVariant {
  description: string
  overrides: Record<string, string>
}

export interface EcomSkin {
  id: string
  name: string
  keywords: string[]
  trigger_phrases?: string[]
  prompt_template: Record<string, string>
  defaults: Record<string, string>
  variants: Record<string, EcomSkinVariant>
}

const DATA_BASES = [
  'https://raw.githubusercontent.com/liangdabiao/ecom-details-image/main/references/templates',
  'https://cdn.jsdelivr.net/gh/liangdabiao/ecom-details-image@main/references/templates',
]

export const ECOSKINS_KV_KEY = 'ecom-templates'

/** 25 个场景模板（来自 SKILL.md 模板匹配表） */
export const ECOSKIN_SLUGS = [
  '01-hero-image', '02-lifestyle-scene', '03-flat-lay', '04-detail-macro', '05-poster-banner',
  '06-social-media', '07-ugc-style', '08-model-showcase', '09-before-after', '10-packaging',
  '11-infographic', '12-creative-concept', '13-size-spec', '14-multi-product', '15-livestream',
  '16-try-on-virtual', '17-exploded-view', '18-ghost-mannequin', '19-multi-angle-grid',
  '20-magazine-editorial', '21-seasonal-campaign', '22-luxury-atmospherics', '23-device-mockup',
  '24-storefront', '25-sports-campaign',
]

export async function fetchEcomSkins(): Promise<EcomSkin[]> {
  const results = await Promise.all(
    ECOSKIN_SLUGS.map(async (slug) => {
      let lastErr: unknown
      for (const base of DATA_BASES) {
        try {
          const res = await fetch(`${base}/${slug}.json`, { signal: AbortSignal.timeout(30000) })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return (await res.json()) as EcomSkin
        } catch (err) {
          lastErr = err
        }
      }
      throw lastErr
    }),
  )
  return results.sort((a, b) => a.id.localeCompare(b.id))
}

/** 铁律 2：不同图型的产品占比黄金区间 */
const OCCUPANCY: Record<string, string> = {
  '01-hero-image': '35-40%',
  '02-lifestyle-scene': '20-25%',
  '03-flat-lay': '40-50%（俯拍平铺整体）',
  '04-detail-macro': '50-70%（特写主体）',
  '05-poster-banner': '30-40%',
  '06-social-media': '40%',
  '07-ugc-style': '30-40%',
  '08-model-showcase': '30-40%（模特整体）',
  '09-before-after': '50%（对比主体）',
  '10-packaging': '40-50%',
  '11-infographic': '25-35%',
  '12-creative-concept': '25-35%',
  '13-size-spec': '30-40%',
  '14-multi-product': '60-70%（整体）',
  '15-livestream': '25-35%',
  '16-try-on-virtual': '40-60%',
  '17-exploded-view': '60-70%',
  '18-ghost-mannequin': '40-50%',
  '19-multi-angle-grid': '60-70%（整体网格）',
  '20-magazine-editorial': '25-35%',
  '21-seasonal-campaign': '30-40%',
  '22-luxury-atmospherics': '20-30%',
  '23-device-mockup': '30-40%',
  '24-storefront': '20-30%',
  '25-sports-campaign': '25-35%',
}

const NEGATIVE_DEFAULT =
  'no props, no hands, no watermark, no fake logo, no extra text, no decorative gradients, no distorted packaging, no wrong logo, no garbled characters'

/** 组装最终英文 Prompt（按铁律注入 hex 色 / 占比 / 留白 / 平台预留 / 否定清单） */
export function buildEcomSkinPrompt(
  skin: EcomSkin,
  values: { product: string; variant: string; corePromise: string; evidence: string; cta: string; bgHex: string },
): string {
  const t = skin.prompt_template
  const variant = values.variant ? skin.variants?.[values.variant] : undefined
  const bg = values.bgHex?.trim() || variant?.overrides.background || skin.defaults.background || t.background || 'clean white background #FFFFFF'
  const lighting = variant?.overrides.lighting || skin.defaults.lighting || t.lighting || 'soft diffused studio lighting'
  const composition = skin.defaults.composition || t.composition || 'centered, front view'
  const occupancy = OCCUPANCY[skin.id] ?? '25-40%'
  const quality = t.quality || '8K, commercial e-commerce photography'

  const lines = [
    `E-commerce product image (${skin.name}, type: ${t.type ?? 'product photography'}).`,
    `Subject: ${values.product?.trim() || '{product_description}'} — keep packaging structure, logo, colors and key details exactly as the reference.`,
    `Background: ${bg}. Lighting: ${lighting}. Composition: ${composition}.`,
    `Product occupies ${occupancy} of the frame. Negative space: at least 45% (50%+ for lifestyle/scene shots).`,
    `Platform reserved zones: keep top-center 200x100 px empty (price overlay area), keep top-left 200x100 px empty (logo area).`,
  ]
  if (values.corePromise?.trim() || values.evidence?.trim() || values.cta?.trim()) {
    lines.push('Text overlay (3-layer information architecture, simplified Chinese, quoted with 「」, print-quality):')
    if (values.corePromise?.trim()) lines.push(`  - Core promise (≤15 chars): 「${values.corePromise.trim()}」`)
    if (values.evidence?.trim()) lines.push(`  - Key evidence badges (2-3): 「${values.evidence.trim()}」`)
    if (values.cta?.trim()) lines.push(`  - CTA (≤8 chars): 「${values.cta.trim()}」`)
  }
  lines.push(`Quality: ${quality}.`)
  lines.push(`Negative constraints: ${NEGATIVE_DEFAULT}.`)
  if (variant) lines.push(`Style variant: ${variant.description}.`)
  return lines.join('\n')
}
