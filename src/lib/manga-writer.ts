/**
 * 漫画剧本创作（LLM）：统一走 {baseUrl}/chat/completions。
 * 剧本方法论吸收自 Toonflow 的编剧规范（sourceAndScript / storyDevelopment）：
 *  - 故事命题先行（谁/目标/阻碍/代价）
 *  - 因果链与五维升级，高潮 = 代价选择
 *  - 剧本是「场次结构」而非「格数列表」：先写完整场次剧本，格数只用于下游切分
 *  两个环节：
 *  1. streamScriptDoc —— 流式生成 Markdown 场次剧本
 *  2. scenesFromScriptDoc —— 把剧本全部场次切分为结构化分镜格（JSON，容错解析）
 */
import { sseEvents } from './sse'
import { SHOT_OPTIONS } from './types'
import type { MangaCharacter, MangaSettings } from './types'

/** LLM 返回的单格脚本（characters 是角色名，需映射回 id） */
export interface ScriptSceneDraft {
  description: string
  dialogue?: string
  narration?: string
  shotType: string
  characters: string[]
}

export interface ScriptDraft {
  summary: string
  scenes: ScriptSceneDraft[]
}

/** 剧本上下文（写剧本 / 切分镜共用的素材） */
export interface ScriptContext {
  idea: string
  styleName: string
  colorMode: 'color' | 'monochrome'
  characters: MangaCharacter[]
}

/* ---------------- prompt 构建 ---------------- */

function characterLines(characters: MangaCharacter[]): string {
  if (characters.length === 0) {
    return '【角色设定】暂无角色，请只依靠环境叙事，或自行提出 1-2 个新角色。'
  }
  return `【角色设定】\n${characters.map((c) => `- ${c.name}：${c.description || '（无详细设定）'}`).join('\n')}`
}

const DEFAULT_SCRIPT_PROMPT =
  '把故事创意改编成结构完整的漫画剧本：先明确故事命题，再按场次展开，写完整的事件与对白。'

/**
 * 剧本 system prompt：完整吸收 Toonflow 编剧规范
 * （故事命题 → 因果链升级 → 场次模板 → 代价选择高潮 → 连续性）
 */
function buildScriptSystemPrompt(): string {
  return [
    '你是一位资深漫画编剧。请把用户提供的素材改编成中文漫画剧本，输出为 Markdown 文档，不要输出任何解释或代码块标记。',
    '',
    '## 第一步：先构思故事核心（不必输出，直接体现在剧本里）',
    '- 故事命题：什么人，必须完成什么，受什么阻碍，失败会失去什么。',
    '- 主角要有外在目标与内在需要；他的惯常策略这次为什么失灵。',
    '- 事件用因果链连接：预期 → 行动 → 实际后果 → 被迫改用新策略（用「因为/所以/但是」检验）。',
    '- 压力要逐步升级，至少在两个维度上加码：时间空间（机会窗口缩短）、资源（工具/帮助耗损）、信息（新事实推翻旧判断）、关系（合作附条件）、失败代价（从可恢复变成具体损失）。',
    '- 高潮是一次代价选择：人物最不愿同时失去的两样东西，压力使二者难兼得；用行动与后果呈现，不由人物讲道理。',
    '- 结尾要改变什么（处境/关系/物件），并与开头形成对照。',
    '',
    '## 剧本格式（场次结构，必须遵守）',
    '# 剧本标题',
    '> 一句话梗概',
    '',
    '## 场01｜空间与时段｜出场人物',
    '人物的位置、起始状态、行动、阻力与可见结果——写完整的动作与过程，梗概不能代替正文。',
    '人物名：完整对白（一句台词完整写出，不用省略号压缩）。',
    '（OS／VO／音乐／音效／画内文字，必要时标注）',
    '本场结束状态与转场。',
    '（场02、场03……依次编号，场次数量由故事需要决定）',
    '',
    '## 硬性要求',
    '- 写完整的故事：每一场都推进一个明确事件或信息；不为篇幅砍事件、不烂尾、不省略高潮。',
    '- 情绪用可拍出来的行为表达（动作、表情、道具），不写「他很紧张」这类心理形容词。',
    '- 对白完整且符合角色身份；角色说话方式要有区分。',
    '- 连续性：出场道具的起止状态、人物外观与关系的变化要前后一致。',
    '- 严格使用给定的角色名；未给定的背景细节保持含蓄，不凭空新增有名字的实体人物（除非剧本必需）。',
  ].join('\n')
}

function buildScriptUserPrompt(ctx: ScriptContext, userPrompt: string, currentDoc: string | undefined): string {
  const parts: string[] = []
  parts.push(`【故事创意】\n${ctx.idea || '（未提供创意，请基于角色设定自拟短篇故事）'}`)
  parts.push(`【画风基调】${ctx.styleName}，${ctx.colorMode === 'monochrome' ? '黑白漫画' : '彩色漫画'}`)
  parts.push(characterLines(ctx.characters))
  const prompt = userPrompt.trim() || DEFAULT_SCRIPT_PROMPT
  parts.push(`【创作要求】\n${prompt}`)
  if (currentDoc?.trim()) {
    parts.push(
      `【当前剧本】以下是已有剧本。请在保持整体连贯的前提下修改、扩写或续写它（而不是完全推翻）：\n\n${currentDoc.trim()}`,
    )
  }
  return parts.join('\n\n')
}

function buildScenesSystemPrompt(): string {
  return [
    '你是漫画分镜师。请把给定的中文漫画剧本（场次结构）切分为分镜格，只输出一个 JSON 对象，不要任何解释或代码块标记。',
    'JSON 结构：',
    '{ "summary": "整篇梗概（80-150字）", "scenes": [ { "description": "画面描述", "dialogue": "台词", "narration": "旁白", "shotType": "镜头类型", "characters": ["角色名"] } ] }',
    '规则：',
    '- 把剧本的全部场次内容映射为分镜格：事件不能丢、对白不能丢；每场拆 1-2 格，节奏转折处优先拆格。',
    '- description 是给 AI 绘图的核心文本：该格的画面内容、构图与情绪，具体可画（人物位置、动作、环境、光线），60-120 字；不要出现气泡内文字说明。',
    '- dialogue 只填台词本身（一句以内），不要带角色名前缀；角色归属用 characters 表达。没有台词则为空字符串。',
    '- narration 填该格的旁白／画内文字（一句以内）；没有则为空字符串。',
    `- shotType 必须从这些值里选：${SHOT_OPTIONS.map((o) => o.value).join(' / ')}。相邻格镜头要有变化（远景接特写等）。`,
    '- characters 用剧本中的角色名原文；没有角色则为空数组。',
  ].join('\n')
}

function buildScenesUserPrompt(scriptDoc: string, ctx: ScriptContext, panelCount: number): string {
  const parts: string[] = []
  parts.push(`【漫画剧本】\n\n${scriptDoc.trim()}`)
  parts.push(characterLines(ctx.characters))
  parts.push(
    `【切分目标】约 ${panelCount} 格为参考值，可在 ±2 内浮动；优先保证剧本事件与对白完整不丢，不为凑格数砍内容。`,
  )
  return parts.join('\n\n')
}

/* ---------------- 响应解析 ---------------- */

function extractJson(text: string): unknown {
  // 剥 markdown 围栏
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  let raw = fenced ? fenced[1] : text
  // 截取第一个 { 到最后一个 }，容忍模型在前后带说明文字
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start >= 0 && end > start) raw = raw.slice(start, end + 1)
  return JSON.parse(raw)
}

function normalizeDraft(json: unknown): ScriptDraft {
  const obj = json as { summary?: unknown; scenes?: unknown }
  if (typeof obj?.summary !== 'string' || !Array.isArray(obj.scenes)) {
    throw new Error('模型返回的 JSON 结构不符合预期（缺少 summary 或 scenes）')
  }
  const validShots = new Set(SHOT_OPTIONS.map((o) => o.value))
  const scenes: ScriptSceneDraft[] = obj.scenes.map((s: any) => ({
    description: typeof s?.description === 'string' ? s.description : '',
    dialogue: typeof s?.dialogue === 'string' && s.dialogue ? s.dialogue : undefined,
    narration: typeof s?.narration === 'string' && s.narration ? s.narration : undefined,
    shotType: validShots.has(s?.shotType) ? s.shotType : 'medium',
    characters: Array.isArray(s?.characters)
      ? s.characters.filter((n: unknown) => typeof n === 'string' && n)
      : [],
  })).filter((s) => s.description)
  if (scenes.length === 0) throw new Error('模型没有返回有效的分镜内容')
  return { summary: obj.summary, scenes }
}

/* ---------------- 请求底层 ---------------- */

/** 显式上限，防端点默认值截断长剧本；推理模型的思考与正文共享该额度，需留足 */
const SCRIPT_MAX_TOKENS = 16384

interface ChatRequestOptions {
  textSettings: MangaSettings
  system: string
  user: string
  signal?: AbortSignal
}

/** 上游错误信息提取 */
async function readError(res: Response): Promise<string> {
  let detail = res.statusText || '请求失败'
  try {
    const text = await res.text()
    try {
      const json = JSON.parse(text)
      detail = json?.error?.message ?? json?.error?.msg ?? detail
    } catch {
      if (text) detail = text.slice(0, 300)
    }
  } catch { /* 保留默认 */
  }
  return `HTTP ${res.status}：${detail}`
}

function assertNotTruncated(reason: string | undefined): void {
  if (reason === 'length') {
    throw new Error('输出被 max_tokens 截断，内容不完整；请重试或在创作要求中缩小范围')
  }
}

/** 非流式对话：返回完整文本（检查 finish_reason） */
async function chatOnce(opts: ChatRequestOptions): Promise<string> {
  const base = opts.textSettings.textBaseUrl.replace(/\/+$/, '')
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.textSettings.textApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.textSettings.textModel,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
      temperature: 0.7,
      max_tokens: SCRIPT_MAX_TOKENS,
      stream: false,
    }),
    signal: opts.signal,
  })
  if (!res.ok) throw new Error(await readError(res))
  const json = await res.json()
  const choice = json?.choices?.[0]
  const content: string | undefined = choice?.message?.content
  if (!content) throw new Error('模型未返回文本内容')
  assertNotTruncated(choice?.finish_reason)
  return content
}

/* ---------------- 环节一：流式写剧本 ---------------- */

export interface StreamScriptOptions extends ScriptContext {
  textSettings: MangaSettings
  /** 用户自定义创作要求（空则用内置默认） */
  userPrompt?: string
  /** 当前剧本文档（有值时进入修改/扩写模式而非重写） */
  currentDoc?: string
  signal?: AbortSignal
  onDelta: (delta: string) => void
  /** 推理模型的思考增量（不进剧本正文，仅供 UI 显示进度） */
  onReasoning?: (delta: string) => void
}

/** 流式生成 Markdown 场次剧本；返回完整文本 */
export async function streamScriptDoc(opts: StreamScriptOptions): Promise<string> {
  const base = opts.textSettings.textBaseUrl.replace(/\/+$/, '')
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.textSettings.textApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.textSettings.textModel,
      messages: [
        { role: 'system', content: buildScriptSystemPrompt() },
        { role: 'user', content: buildScriptUserPrompt(opts, opts.userPrompt ?? '', opts.currentDoc) },
      ],
      temperature: 0.7,
      max_tokens: SCRIPT_MAX_TOKENS,
      stream: true,
    }),
    signal: opts.signal,
  })
  if (!res.ok) throw new Error(await readError(res))
  if (!res.body) throw new Error('端点未返回流式响应体')

  let full = ''
  let finishReason: string | undefined
  for await (const ev of sseEvents(res.body)) {
    if (ev.data === '[DONE]') break
    if (!ev.data) continue
    let json: any
    try { json = JSON.parse(ev.data) } catch { continue }
    if (json?.error) throw new Error(json.error?.message ?? '端点返回错误')
    const choice = json?.choices?.[0]
    if (choice?.finish_reason) finishReason = choice.finish_reason
    // 推理模型的思考增量：不进正文，回调给 UI 显示进度
    const reasoning: string | undefined = choice?.delta?.reasoning_content
    if (typeof reasoning === 'string' && reasoning) opts.onReasoning?.(reasoning)
    // 只取正文增量（防思考过程混入剧本）
    const delta: string | undefined = choice?.delta?.content
    if (typeof delta === 'string' && delta) {
      full += delta
      opts.onDelta(delta)
    }
  }
  if (!full.trim()) throw new Error('模型没有返回剧本内容')
  assertNotTruncated(finishReason)
  return full
}

/* ---------------- 环节二：从剧本切分分镜 ---------------- */

export interface ScenesFromDocOptions extends ScriptContext {
  textSettings: MangaSettings
  scriptDoc: string
  panelCount: number
  signal?: AbortSignal
}

export async function scenesFromScriptDoc(opts: ScenesFromDocOptions): Promise<ScriptDraft> {
  const content = await chatOnce({
    textSettings: opts.textSettings,
    system: buildScenesSystemPrompt(),
    user: buildScenesUserPrompt(opts.scriptDoc, opts, opts.panelCount),
    signal: opts.signal,
  })
  return normalizeDraft(extractJson(content))
}
