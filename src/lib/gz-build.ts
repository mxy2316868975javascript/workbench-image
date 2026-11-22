/**
 * 归藏社交卡片（op7418/guizang-social-card-skill）模板构建器：
 * Editorial Magazine × E-ink / Swiss International 两种视觉模式，
 * 10 套主题色板、28 种版式，产出设计卡生图 Prompt。
 */
import type { TemplateField, GenParams } from './types'
import { GZ_EDITORIAL_PALETTES, GZ_SWISS_PALETTES, GZ_LAYOUTS } from './gz-data'

export function gzFields(values: Record<string, string>): TemplateField[] {
  const mode = values.mode ?? 'editorial'
  const palettes = mode === 'swiss' ? GZ_SWISS_PALETTES : GZ_EDITORIAL_PALETTES
  const layouts = GZ_LAYOUTS.filter((l) => l.code.startsWith(mode === 'editorial' ? 'M' : 'S'))
  const fields: TemplateField[] = [
    { key: 'cardType', label: '卡片类型', type: 'select', options: [
      { value: 'rednote', label: '小红书图文（3:4 竖版轮播）' },
      { value: 'wechat-219', label: '公众号封面（21:9 横版）' },
      { value: 'wechat-11', label: '公众号封面（1:1 方形）' },
    ] },
    { key: 'mode', label: '风格模式', type: 'select', options: [
      { value: 'editorial', label: 'Editorial Magazine × E-ink（杂志专题感）' },
      { value: 'swiss', label: 'Swiss International（瑞士网格工程感）' },
    ] },
    { key: 'palette', label: '主题色板', type: 'select', options: palettes.map((p) => ({ value: p.value, label: p.label })) },
    { key: 'layout', label: '版式（28 选 1）', type: 'select', options: layouts.map((l) => ({ value: l.code, label: `${l.code} ${l.name}` })) },
    { key: 'title', label: '页面标题（叙事化）', type: 'text', required: true, placeholder: '例：用量 6 个月翻倍：交付体系如何跟上' },
    { key: 'topic', label: '本页内容 / 主题', type: 'textarea', required: true, placeholder: '这一页承载的内容、数据、观点或步骤' },
    { key: 'conclusion', label: '底部判断句（可选）', type: 'text', placeholder: '例：Agent 化之后，风险不只发生在文本输出' },
  ]
  return fields
}


export function buildGz(values: Record<string, string>): { prompt: string; params?: Partial<GenParams> } {
  const cardType = values.cardType ?? 'rednote'
  const mode = values.mode ?? 'editorial'
  const palettes = mode === 'swiss' ? GZ_SWISS_PALETTES : GZ_EDITORIAL_PALETTES
  const palId = values.palette ?? (mode === 'swiss' ? 'ikb' : 'ink-classic')
  const pal = palettes.find((p) => p.value === palId) ?? palettes[0]
  const layoutCode = values.layout ?? (mode === 'editorial' ? 'M01' : 'S01')
  const layout = GZ_LAYOUTS.find((l) => l.code === layoutCode) ?? { code: layoutCode, name: layoutCode, desc: '' }
  const title = values.title?.trim() || '未命名页面'
  const topic = values.topic?.trim() || ''
  const conclusion = values.conclusion?.trim() || ''
  const isEditorial = mode === 'editorial'

  const styleStance = isEditorial ? [
    'Style: Editorial Magazine × E-ink — slow magazine-feature pace.',
    'Typography stance (non-negotiable): display titles at weight 500 with wide tracking (+0.03em~+0.04em); small text is the only place using weight 500 + mono uppercase + wide letter-spacing (+0.20em~+0.22em); body uses serif-zh, NOT sans.',
    'Visual anchors: warm paper, deep ink, refined greys, restrained color; subtle paper texture allowed; documentary photography, field-note captions, issue labels; large purposeful whitespace; fine rules, magazine columns, pull quotes.',
    'Palette: paper ' + pal.paper + ', ink ' + pal.ink + ', accent ' + pal.accent + ' (one of the 6 magazine palettes; Midnight Ink is the only dark variant).',
    'Background: layered paper base + subtle grain + ink wash / contour field atmosphere — a flat paper color alone is not enough.',
  ].join('\n') : [
    'Style: Swiss International — engineered/quantified pace.',
    'Typography: Inter / Helvetica Neue feeling; very light display weights for huge type; stronger weights for small labels. Chinese titles are visually dense: shorten first, then reduce size.',
    'Layout: strict 12/16-column grid, left alignment, asymmetric whitespace; straight modules, hairline rules, no rounded cards, no shadows, no glassmorphism.',
    'Colors: ' + pal.paper + ' paper, ink ' + pal.ink + ', exactly one high-saturation accent ' + pal.accent + '; no gradients; pure color blocks, hairline rules, grid modules; huge text lighter, small text heavier.',
  ].join('\n')

  const densityRule = cardType === 'rednote'
    ? 'Content density rule (hard): content must cover ≥75% of canvas height; no pure-whitespace band >15% canvas height without a stated reason. If copy cannot reach the floor, shorten the canvas (1:1) or pick a different recipe — never publish under-filled.'
    : ''

  const blocks: string[] = [
    `Design a single ${cardType === 'rednote' ? 'Rednote 3:4 portrait' : cardType === 'wechat-219' ? '21:9 horizontal' : '1:1 square'} social card image: ${title}`,
    `Page content: ${topic}`,
    conclusion ? `Bottom takeaway line: 「${conclusion}」` : '',
    '',
    '=== Style system ===',
    styleStance,
    '',
    `Layout (${layoutCode} ${layout.name}): ${layout.desc}`,
    densityRule,
    '',
    'Copy rules: short titles and short points; one core claim per page; 2-4 text groups, no long paragraphs; only key titles and points rendered precisely; Chinese text accurate, no garbled characters. Do not draw real logos, QR codes, seals, or brand marks.',
  ].filter(Boolean)

  const prompt = blocks.filter(Boolean).join('\n\n')
  return { prompt, params: { size: cardType === 'rednote' ? '1024x1536' : cardType === 'wechat-11' ? '1024x1024' : '1536x1024' } }
}
