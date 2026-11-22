/**
 * awesome-gpt-image-2 模板大全（freestylefly/awesome-gpt-image-2）接入：
 * 13 个分类 × 46 个模板代码块（含常规模板 + JSON 进阶模板 + 防坑指南），
 * 按需拉取 docs/templates.md 并缓存到 IndexedDB，浏览 / 检索 / 填空使用。
 */

export interface CookbookTemplate {
  title: string
  body: string
  type: 'text' | 'json'
}

export interface CookbookCategory {
  name: string
  templates: CookbookTemplate[]
  tips: string[]
}

// 固定到 commit，避免上游 main 变动导致内容漂移
const DOC_BASES = [
  'https://raw.githubusercontent.com/freestylefly/awesome-gpt-image-2/af24cae98d95cc308260b1d637fb1227f9a6e5ca/docs/templates.md',
  'https://cdn.jsdelivr.net/gh/freestylefly/awesome-gpt-image-2@af24cae98d95cc308260b1d637fb1227f9a6e5ca/docs/templates.md',
]

export const CC2LIB_KV_KEY = 'cc2-cookbook'

export async function fetchCookbook(): Promise<CookbookCategory[]> {
  let lastErr: unknown
  let md = ''
  for (const url of DOC_BASES) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      md = await res.text()
      break
    } catch (err) {
      lastErr = err
    }
  }
  if (!md) throw new Error(`拉取 templates.md 失败（所有源均不可达）：${lastErr instanceof Error ? lastErr.message : lastErr}`)
  return parseCookbook(md)
}

/** 解析 templates.md：### 分类 → 代码块（text/json）+ 防坑指南行 */
export function parseCookbook(md: string): CookbookCategory[] {
  const categories: CookbookCategory[] = []
  const sections = md.split(/^### /m).slice(1)
  for (const section of sections) {
    const name = section.split('\n')[0].trim()
    if (!name || name.startsWith('工业级')) continue
    const templates: CookbookTemplate[] = []
    const tips: string[] = []
    // 提取代码块（text 或 json）
    const blockRe = /```(text|json)\n([\s\S]*?)```/g
    let bm: RegExpExecArray | null
    let idx = 0
    while ((bm = blockRe.exec(section)) !== null) {
      const type = bm[1] as 'text' | 'json'
      const body = bm[2].trim()
      if (!body) continue
      // 标题：取代码块前的最近 **粗体** 行
      const before = section.slice(0, bm.index)
      const titleMatches = [...before.matchAll(/\*\*(.+?)\*\*/g)]
      const title = titleMatches.length > 0
        ? titleMatches[titleMatches.length - 1][1].trim()
        : `${name} · 模板 ${++idx}`
      templates.push({ title, body, type })
    }
    // 提取防坑提示（"避免" / "不要" / "注意" 开头的行）
    for (const line of section.split('\n')) {
      const t = line.trim()
      if ((t.startsWith('- 避') || t.startsWith('- 不') || t.startsWith('- 注意')) && t.length > 6 && !t.includes('```')) {
        tips.push(t.replace(/^-\s*/, ''))
      }
    }
    if (templates.length > 0) {
      categories.push({ name, templates, tips })
    }
  }
  return categories
}
