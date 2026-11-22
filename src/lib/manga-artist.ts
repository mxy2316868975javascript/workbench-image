/**
 * 漫画绘图层：构建角色设定表 / 分镜格的生图 prompt，并组装参考图
 * 调用现有 generateOne()（参考图 > 0 时自动走 /images/edits 图生图）。
 * 一致性机制参考 aimangastudio：角色六宫格设定表作为 "Character Reference N" 传入，
 * prompt 中按名字锁定外观、按镜头类型锁定构图。
 */
import { generateOne } from './generator'
import { SHOT_OPTIONS, STYLE_PRESETS } from './types'
import type { MangaCharacter, MangaProject, MangaScene, Settings } from './types'

/** 单张图生成的输入 */
export interface MangaGenerateOptions {
  settings: Settings
  prompt: string
  size: string
  quality?: string
  referenceImages?: Blob[]
  signal: AbortSignal
  log: (level: 'info' | 'success' | 'warn' | 'error', text: string) => void
  onProgress: (progress: number, phase: string) => void
}

/** 复用主管线 generateOne，统一尺寸 / 质量参数 */
export async function generateMangaImage(opts: MangaGenerateOptions) {
  return generateOne({
    settings: opts.settings,
    prompt: opts.prompt,
    params: {
      size: opts.size,
      quality: opts.quality ?? 'high',
      background: 'auto',
      output_format: 'png',
    },
    signal: opts.signal,
    referenceImages: opts.referenceImages,
    log: opts.log,
    onProgress: opts.onProgress,
    onPartial: () => { /* 端点无局部帧，预留 */ },
  })
}

/* ---------------- 画风 ---------------- */

/** 解析项目当前画风：预设 + 自定义补充合并为一段英文风格描述 */
export function resolveStyle(project: Pick<MangaProject, 'styleId' | 'customStyle' | 'colorMode'>): string {
  const preset = STYLE_PRESETS.find((p) => p.id === project.styleId)
  const parts: string[] = []
  if (preset) parts.push(preset.prompt)
  if (project.customStyle?.trim()) parts.push(project.customStyle.trim())
  if (project.colorMode === 'monochrome') {
    parts.push('black and white monochrome manga page, screentone shading only, no color')
  } else {
    parts.push('full color artwork')
  }
  return parts.join(', ')
}

/* ---------------- 角色设定表 ---------------- */

/**
 * 六宫格角色设定表（上排 3 头像、下排 3 全身）——跨格一致性的视觉锚点。
 * 有参考图时要求融合全部参考图特征；无参考图时纯文本生成。
 */
export function buildCharacterSheetPrompt(character: MangaCharacter, style: string): string {
  const name = character.name || '角色'
  const desc = character.description?.trim()
  return [
    `Create a professional character reference sheet (model sheet) for a manga character named "${name}".`,
    desc ? `Character design description: ${desc}.` : '',
    `Layout: a single sheet with exactly 6 poses arranged in a 2x3 grid — top row: 3 head-and-shoulders portraits with different expressions (neutral, smiling, angry or surprised); bottom row: 3 full-body poses (front view, side view, back view).`,
    `All 6 views must depict the SAME character with identical hairstyle, outfit, proportions and color scheme.`,
    `Clean pure white background, no text, no labels, no watermarks, no color palette chips.`,
    `Art style (strictly follow): ${style}.`,
    character.refBlobs?.length
      ? `Reference images are provided: merge the consistent features across ALL reference images (if one shows a scar and another shows the hairstyle, keep both). They describe the same character from different angles or moments.`
      : '',
    'Output the final character sheet image only.',
  ].filter(Boolean).join('\n')
}

/* ---------------- 分镜格 ---------------- */

/** 每个角色最多占用的参考图位（3 角色表 + prompt 体量可控） */
const MAX_SHEET_REFS = 3

/**
 * 分镜格 prompt：画风 + 镜头构图 + 画面描述 + 出场角色外观锁定 + 对白处理。
 * 角色一致性靠两条腿：文本描述锁定 + 设定表参考图（"Character Reference N"）。
 */
export function buildScenePrompt(
  scene: MangaScene,
  project: MangaProject,
  characters: MangaCharacter[],
): { prompt: string; referenceImages: Blob[] } {
  const style = resolveStyle(project)
  const shot = SHOT_OPTIONS.find((o) => o.value === scene.shotType)
  const parts: string[] = []

  parts.push(`Manga panel illustration, ${style}.`)
  if (shot) parts.push(`Camera: ${shot.prompt}.`)

  // 出场角色：文本锁定 + 参考图编号说明
  const present = scene.characterIds
    .map((id) => characters.find((c) => c.id === id))
    .filter((c): c is MangaCharacter => !!c)
  const sheets: Blob[] = []
  for (const c of present.slice(0, MAX_SHEET_REFS)) {
    if (!c.sheetBlob) continue
    sheets.push(c.sheetBlob)
    const n = sheets.length
    const desc = c.description?.trim() ? ` Appearance: ${c.description.trim()}.` : ''
    parts.push(
      `Use the character sheet provided as "Character Reference ${n}" — it is "${c.name}". Draw ${c.name} EXACTLY as shown in that sheet (face, hairstyle, outfit, colors).${desc}`,
    )
  }
  // 有名无表的角色退化为纯文本锁定
  for (const c of present.slice(0, MAX_SHEET_REFS)) {
    if (c.sheetBlob) continue
    parts.push(`Character in this panel: ${c.name}.${c.description?.trim() ? ` Appearance: ${c.description.trim()}.` : ''}`)
  }

  parts.push(`Scene: ${scene.description.trim()}`)

  // 对白与旁白的落图方式：bubbleDialogue 开启时把文字写进图形；关闭时画空壳留给手工排版
  const dialogueText = scene.dialogue?.trim() ?? ''
  const narrationText = scene.narration?.trim() ?? ''
  if (project.bubbleDialogue) {
    if (dialogueText) {
      parts.push(
        `Draw ONE speech bubble and write the dialogue text inside it EXACTLY as given (keep the original language and punctuation): "${dialogueText}". Hand-lettered manga style, text must be legible.`,
      )
    }
    if (narrationText) {
      parts.push(
        `Draw ONE rectangular narration caption box at a top corner and write the narration text inside it EXACTLY as given (keep the original language and punctuation): "${narrationText}". Text must be legible.`,
      )
    }
    if (dialogueText || narrationText) {
      // 中文等非拉丁文字模型常渲染失败：宁可留空也不画乱码
      parts.push(
        `If you cannot render a text reliably in that language, leave THAT bubble or box EMPTY instead of drawing garbled or fake characters.`,
      )
    }
  } else if (dialogueText || narrationText) {
    parts.push(
      `Draw speech bubble / caption shapes with EMPTY interiors (no text at all), leaving room for lettering.`,
    )
  }

  parts.push(
    `Single panel only, no page grid, no panel borders with other panels. Do not add any other text, watermark or signature. Aspect ratio ${project.size.replace('x', ':')}.`,
  )

  return { prompt: parts.filter(Boolean).join('\n'), referenceImages: sheets }
}
