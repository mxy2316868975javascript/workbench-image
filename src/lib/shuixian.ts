/**
 * 水仙提示词库（BaYue-SYJ/shuixian-prompts）接入：
 * 6600+ 中文生图提示词，按需从 GitHub 拉取数据（双源回退），存入 IndexedDB 后本地检索使用。
 * 每条提示词内含 {argument name="X" default="Y"} 可填参数，按字段填空后产出最终提示词。
 */

export interface ShuixianPrompt {
  id: number
  title: string
  category: string
  prompt: string
  likes: number
}

export interface ShuixianCategory {
  count: number
  major: string
}

export interface ShuixianArgument {
  name: string
  defaultValue: string
}

const DATA_BASES = [
  'https://raw.githubusercontent.com/BaYue-SYJ/shuixian-prompts/main/shuixian-unified/data',
  'https://cdn.jsdelivr.net/gh/BaYue-SYJ/shuixian-prompts@main/shuixian-unified/data',
]

export const SHUIXIAN_KV_KEY = 'shuixian-library'

/** 单个文件多源回退拉取 */
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

/** 拉取并合并全部提示词与分类 */
export async function fetchShuixianLibrary(): Promise<{ prompts: ShuixianPrompt[]; categories: Record<string, ShuixianCategory> }> {
  const partTexts = await Promise.all([
    fetchWithFallback('prompts.part1.json'),
    fetchWithFallback('prompts.part2.json'),
    fetchWithFallback('prompts.part3.json'),
  ])
  const catText = await fetchWithFallback('categories.json').catch(() => '{}')

  const prompts: ShuixianPrompt[] = []
  for (const text of partTexts) {
    const part = JSON.parse(text) as Array<Record<string, unknown>>
    for (const it of part) {
      prompts.push({
        id: Number(it.id),
        title: String(it.title ?? ''),
        category: String(it.category ?? '未归类'),
        prompt: String(it.prompt ?? ''),
        likes: Number(it.likes ?? 0),
      })
    }
  }
  const categories = JSON.parse(catText) as Record<string, ShuixianCategory>
  return { prompts, categories }
}

/** 解析提示词里的可填参数 */
export function parseShuixianArguments(prompt: string): ShuixianArgument[] {
  const seen = new Set<string>()
  const out: ShuixianArgument[] = []
  for (const m of prompt.matchAll(/\{argument name="([^"]+)" default="([^"]*)"\}/g)) {
    const name = m[1]
    if (seen.has(name)) continue
    seen.add(name)
    out.push({ name, defaultValue: m[2] })
  }
  return out
}

/** 按填好的参数渲染最终提示词；未填写的参数保留默认值 */
export function renderShuixianPrompt(prompt: string, values: Record<string, string>): string {
  return prompt.replace(/\{argument name="([^"]+)" default="([^"]*)"\}/g, (_, name: string, def: string) => {
    const v = values[name]?.trim()
    return v || def
  })
}

/** 提示词的示例图地址（懒加载单张，加载失败由调用方隐藏） */
export function shuixianImageUrl(id: number): string {
  return `${DATA_BASES[0].replace('/data', '')}/images/originals/${id}.jpg`
}
