/**
 * GPT-Image2-Skill 精选画廊（wuyoscar/GPT-Image2-Skill）接入：
 * 31 个分类文件、171 条编号案例（完整 Prompt + 画幅元信息 + 示例图），
 * 外加 craft.md 的 18 条提示词工艺原则。按需拉取后缓存到 IndexedDB。
 */

export interface WyVariant {
  label: string
  prompt: string
}

export interface WyEntry {
  /** 稳定 id：wy-<编号> */
  id: string
  no: number
  title: string
  /** 带 emoji 的分类名，如「🎌 Anime & Manga」 */
  category: string
  /** 原始 Metadata 行文本，保留来源/引用信息 */
  meta: string
  /** 归一到本应用的三种输出尺寸 */
  size: string
  /** 示例图 raw 地址（可能为空） */
  imageUrl: string | null
  prompt: string
  /** 同一案例的附加变体（如「Adapted edit prompt」） */
  variants: WyVariant[]
}

export interface WyCraftPrinciple {
  no: string
  title: string
  body: string
}

export interface WyGalleryData {
  entries: WyEntry[]
  principles: WyCraftPrinciple[]
}

export const WY_KV_KEY = 'wy-gallery'

const REPO_RAW = 'https://raw.githubusercontent.com/wuyoscar/GPT-Image2-Skill/main/'
const REPO_CDN = 'https://cdn.jsdelivr.net/gh/wuyoscar/GPT-Image2-Skill@main/'
const REF_DIR = 'skills/gpt-image/references/'

/** 全部分类文件（顺序仅作兜底，实际按 Range 排序） */
const CATEGORY_FILES = [
  'gallery-anime-and-manga.md',
  'gallery-gaming.md',
  'gallery-retro-and-cyberpunk.md',
  'gallery-cinematic-and-animation.md',
  'gallery-character-design.md',
  'gallery-typography-and-posters.md',
  'gallery-illustration.md',
  'gallery-watercolor.md',
  'gallery-ink-and-chinese.md',
  'gallery-pixel-art.md',
  'gallery-isometric.md',
  'gallery-product-and-food.md',
  'gallery-brand-systems-and-identity.md',
  'gallery-photography.md',
  'gallery-infographics-and-field-guides.md',
  'gallery-research-paper-figures.md',
  'gallery-official-openai-cookbook-examples.md',
  'gallery-edit-endpoint-showcase.md',
  'gallery-ui-ux-mockups.md',
  'gallery-data-visualization.md',
  'gallery-technical-illustration.md',
  'gallery-architecture-and-interior.md',
  'gallery-scientific-and-educational.md',
  'gallery-fashion-editorial.md',
  'gallery-fine-art-painting.md',
  'gallery-more-illustration-styles.md',
  'gallery-cinematic-film-references.md',
  'gallery-beauty-and-lifestyle.md',
  'gallery-events-and-experience.md',
  'gallery-tattoo-design.md',
  'gallery-screen-photography.md',
]

/** 双源回退拉取（raw.githubusercontent → jsDelivr） */
async function fetchText(path: string): Promise<string> {
  let lastErr: unknown
  for (const base of [REPO_RAW, REPO_CDN]) {
    try {
      const res = await fetch(base + path, { signal: AbortSignal.timeout(30000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.text()
    } catch (err) {
      lastErr = err
    }
  }
  throw new Error(`拉取 ${path} 失败：${lastErr instanceof Error ? lastErr.message : String(lastErr)}`)
}

/** 按并发上限执行，避免一次向 GitHub 发 30 多个请求 */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (true) {
      const i = next++
      if (i >= items.length) return
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

/** 解析示例图路径为可访问 URL（raw 源，组件内失败会切 jsDelivr） */
export function wyImageUrl(path: string): string {
  return REPO_RAW + path.split('/').map((s) => encodeURIComponent(s)).join('/')
}

/** raw 地址切到 jsDelivr 备用源 */
export function wyImageCdnUrl(url: string): string {
  return url.startsWith(REPO_RAW) ? REPO_CDN + url.slice(REPO_RAW.length) : url
}

/** 把画廊的画幅元信息归一为本应用支持的三种尺寸 */
export function normalizeWySize(meta: string): string {
  const m = meta.match(/(\d{3,4})\s*[x×]\s*(\d{3,4})/)
  if (m) {
    const w = Number(m[1])
    const h = Number(m[2])
    if (w > h * 1.15) return '1536x1024'
    if (h > w * 1.15) return '1024x1536'
    return '1024x1024'
  }
  if (/portrait|tall/i.test(meta)) return '1024x1536'
  if (/landscape|wide/i.test(meta)) return '1536x1024'
  return '1024x1024'
}

/**
 * 提取 section 内的 text 代码块。
 * label 取代码块前最后一个非空行（去掉列表符号、加粗与尾部冒号），
 * 用于给「变体 Prompt」命名。
 */
function extractTextBlocks(section: string): WyVariant[] {
  const blocks: WyVariant[] = []
  const re = /```text\s*\n([\s\S]*?)```/g
  let m: RegExpExecArray | null
  while ((m = re.exec(section)) !== null) {
    const body = m[1].trim()
    if (!body) continue
    const before = section.slice(0, m.index)
    const lines = before
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('```'))
    let label = ''
    if (lines.length > 0) {
      label = lines[lines.length - 1]
        .replace(/^[-*]\s*/, '')
        .replace(/^\*\*(.+)\*\*$/, '$1')
        .replace(/[:·]\s*Curated\s*$/i, '')
        .replace(/:$/, '')
        .trim()
    }
    blocks.push({ label, prompt: body })
  }
  return blocks
}

/** 解析单个分类文件：H1 → 分类名，Range → 排序号，### → 案例 */
export function parseWyCategory(md: string): { category: string; order: number; entries: WyEntry[] } {
  const category = (md.match(/^# (.+)$/m)?.[1] ?? '未分类').trim()
  const range = md.match(/^Range:\s*No\.\s*(\d+)/m)
  const order = range ? Number(range[1]) : 9999
  const entries: WyEntry[] = []

  for (const section of md.split(/^### /m).slice(1)) {
    const head = section.split('\n')[0].trim()
    // 只接受标准「No. N · 标题」，跳过动画/网页变体等非标准小节
    const hm = head.match(/^No\.\s*(\d+)\s*·\s*(.+)$/)
    if (!hm) continue
    const no = Number(hm[1])
    const title = hm[2].trim()

    const meta = section.match(/^- Metadata:\s*(.+)$/m)?.[1]?.trim() ?? ''
    // 图片路径可能出现在 - Image: 行，也可能在正文首行
    const imgPath = section.match(/`(docs\/[^`\s]+\.(?:png|jpe?g|webp|gif))`/)?.[1]
    const blocks = extractTextBlocks(section)
    if (blocks.length === 0) continue

    entries.push({
      id: `wy-${no}`,
      no,
      title,
      category,
      meta,
      size: normalizeWySize(meta),
      imageUrl: imgPath ? wyImageUrl(imgPath) : null,
      prompt: blocks[0].prompt,
      variants: blocks.slice(1).map((b, i) => ({ label: b.label || `变体 ${i + 1}`, prompt: b.prompt })),
    })
  }
  return { category, order, entries }
}

/** 解析 craft.md：`## N. 标题` → 原则编号 + 标题 + 正文 */
export function parseWyCraft(md: string): WyCraftPrinciple[] {
  const principles: WyCraftPrinciple[] = []
  for (const section of md.split(/^## /m).slice(1)) {
    const firstLine = section.split('\n')[0].trim()
    const m = firstLine.match(/^(\d+)\.\s*(.+)$/)
    if (!m) continue
    const body = section.split('\n').slice(1).join('\n').trim()
    principles.push({ no: m[1], title: m[2].trim(), body })
  }
  return principles
}

/** 全量拉取：31 个分类文件（并发 4）+ craft.md，任一分类失败则整体失败 */
export async function fetchWyGallery(onProgress?: (done: number, total: number) => void): Promise<WyGalleryData> {
  const total = CATEGORY_FILES.length
  let done = 0
  const parsed = await mapLimit(CATEGORY_FILES, 4, async (file) => {
    const md = await fetchText(REF_DIR + file)
    const result = parseWyCategory(md)
    done++
    onProgress?.(done, total + 1)
    return result
  })

  // craft.md 拉取失败不阻塞画廊使用
  let principles: WyCraftPrinciple[] = []
  try {
    const craftMd = await fetchText(REF_DIR + 'craft.md')
    principles = parseWyCraft(craftMd)
  } catch {
    principles = []
  }
  onProgress?.(total + 1, total + 1)

  parsed.sort((a, b) => a.order - b.order)
  const entries = parsed.flatMap((p) => p.entries).sort((a, b) => a.no - b.no)
  return { entries, principles }
}
