/**
 * 手绘风格配方库（threerocks/hand-drawn-styles）接入：
 * 23 个编号手绘画风的中文 Prompt 配方（【主体】【文字】占位符），按需拉取 STYLES.md + 选型指导并缓存。
 * 比例规则来自 PROTOCOL.md：用户传了就用；纯风格不注入；版式风格（1/4）只注入软结构提示。
 */

export interface HandDrawnStyle {
  id: string
  name: string
  aliases: string[]
  body: string
  cue: string
}

export interface HandDrawnRenderOptions {
  subject: string
  text?: string
  aspect?: string
}

// 固定到 commit，避免上游 main 变动导致内容漂移
const DATA_BASES = [
  'https://raw.githubusercontent.com/threerocks/hand-drawn-styles/b3727de45a2a40f3f3e2ce93f19d4a3c7a0c5f4b',
  'https://cdn.jsdelivr.net/gh/threerocks/hand-drawn-styles@b3727de45a2a40f3f3e2ce93f19d4a3c7a0c5f4b',
]

export const HANDDRAWN_KV_KEY = 'hand-drawn-library'

/** 单文件多源回退拉取 */
async function fetchWithFallback(path: string): Promise<string> {
  let lastErr: unknown
  for (const base of DATA_BASES) {
    try {
      const res = await fetch(`${base}/${path}`, { signal: AbortSignal.timeout(60000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.text()
    } catch (err) {
      lastErr = err
    }
  }
  throw new Error(`拉取 ${path} 失败（所有源均不可达）：${lastErr instanceof Error ? lastErr.message : lastErr}`)
}

/** 解析 STYLES.md：## <编号> <名称> 分节；正文取含【主体】的代码块（无则取首个）；只收纯数字编号画风 */
export function parseHandDrawnStyles(md: string, catalog: { styles: Record<string, { selection_cues?: { description?: string }[] }> }): HandDrawnStyle[] {
  const styles: HandDrawnStyle[] = []
  const sections = md.split(/^## /m).slice(1)
  for (const section of sections) {
    const headerMatch = section.match(/^(\S+)\s+(.+?)\s*$/m)
    if (!headerMatch) continue
    const id = headerMatch[1].replace(/\.$/, '')
    if (!/^\d+(\.\d+)?$/.test(id)) continue // 跳过附录等非画风分节
    const name = headerMatch[2]
    const blocks = [...section.matchAll(/```\n([\s\S]*?)```/g)].map((m) => m[1])
    if (blocks.length === 0) {
      // 22/23 等专属工作流画风：无模板正文，仍收录并标注
      const aliasMatch0 = section.match(/别名[：:]([^\n]+)/)
      styles.push({
        id,
        name,
        aliases: aliasMatch0 ? aliasMatch0[1].split(/[、,，]/).map((a) => a.replace(/[`*]/g, '').trim()).filter(Boolean) : [],
        body: '',
        cue: '原仓库为专属工作流画风，暂无模板正文',
      })
      continue
    }
    const withSubject = blocks.find((b) => b.includes('【主体】'))
    const body = (withSubject ?? blocks[0]).trim()
    const aliasMatch = section.match(/别名[：:]([^\n]+)/)
    const aliases = aliasMatch
      ? aliasMatch[1].split(/[、,，]/).map((a) => a.replace(/[`*]/g, '').trim()).filter(Boolean)
      : []
    const cues = catalog.styles?.[id]?.selection_cues ?? []
    styles.push({
      id,
      name,
      aliases,
      body,
      cue: cues[0]?.description?.slice(0, 60) ?? '',
    })
  }
  return styles
}

export async function fetchHandDrawnLibrary(): Promise<HandDrawnStyle[]> {
  const md = await fetchWithFallback('STYLES.md')
  const catalogText = await fetchWithFallback('catalog/style-guidance.json').catch(() => '{}')
  let catalog: { styles: Record<string, { selection_cues?: { description?: string }[] }> } = { styles: {} }
  try {
    catalog = JSON.parse(catalogText)
  } catch {
    /* 选型指导解析失败不影响配方 */
  }
  return parseHandDrawnStyles(md, catalog)
}

/** 提取配方里的占位符（如 主体 / 文字 / 构图） */
export function handDrawnPlaceholders(body: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of body.matchAll(/【([^】]+)】/g)) {
    if (!seen.has(m[1])) {
      seen.add(m[1])
      out.push(m[1])
    }
  }
  return out
}

/** 各画风【文字】占位符的默认值（来自 PROTOCOL.md 的处理规则） */
const TEXT_DEFAULTS: Record<string, string> = {
  '18': 'No text anywhere.',
  '19': 'No text anywhere.',
  '20': 'No text anywhere.',
}
const TEXT_DEFAULT_FALLBACK = '不加任何文字。'

/** 版式风格的软结构提示（不写具体数字比例） */
const SOFT_HINTS: Record<string, string> = {
  '1': '多格网格排版。',
  '4': '竖版、多格自上而下堆叠。',
}

/** 填充占位符 + 按协议处理比例 */
export function renderHandDrawnPrompt(style: HandDrawnStyle, opts: HandDrawnRenderOptions): string {
  let prompt = style.body
  prompt = prompt.replace(/【主体】/g, opts.subject.trim() || '画面主体')

  const placeholders = handDrawnPlaceholders(style.body)
  for (const ph of placeholders) {
    if (ph === '主体') continue
    if (ph === '文字') {
      const text = opts.text?.trim() || TEXT_DEFAULTS[style.id] || TEXT_DEFAULT_FALLBACK
      prompt = prompt.replace(/【文字】/g, text)
      continue
    }
    if (ph === '构图' && style.id === '18') {
      prompt = prompt.replace(/【构图】/g, 'full-body, centered in the lower-middle with huge calm negative space')
      continue
    }
    prompt = prompt.replace(new RegExp(`【${ph}】`, 'g'), opts.text?.trim() || '')
  }

  // 比例：用户传了就用；纯风格不注入；版式风格（1/4）注入软结构提示
  if (opts.aspect) {
    prompt += `\n画幅比例：${opts.aspect}。`
  } else if (SOFT_HINTS[style.id]) {
    prompt += `\n${SOFT_HINTS[style.id]}`
  }
  return prompt
}
