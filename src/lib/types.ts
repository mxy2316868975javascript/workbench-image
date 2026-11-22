/** 领域类型定义 */

export type ImageStatus =
  | 'pending'      // 排队中
  | 'generating'   // 端点生成中（流式）
  | 'downloading'  // 下载图片字节中
  | 'done'
  | 'failed'
  | 'cancelled'

export type TaskStatus = 'running' | 'completed' | 'partial' | 'failed' | 'cancelled'

export interface GenParams {
  size: string          // 1024x1024 | 1024x1536 | 1536x1024 | auto
  quality: string       // low | medium | high | xhigh | max | auto
  background: string    // transparent | opaque | auto
  output_format: string // png | jpeg | webp
}

export interface UsageInfo {
  input_tokens: number
  output_tokens: number
  total_tokens: number
}

export type LogLevel = 'info' | 'success' | 'warn' | 'error'

export interface LogLine {
  t: number
  level: LogLevel
  imageId?: string // 属于哪张图（可缺省=全局）
  text: string
}

export interface ImageRecord {
  id: string
  taskId: string
  prompt: string
  params: GenParams
  status: ImageStatus
  progress: number       // 0-100
  phase: string          // 展示用阶段文案
  isEdit?: boolean       // 图生图（带参考图）
  blob?: Blob
  thumbBlob?: Blob
  mime?: string
  width?: number
  height?: number
  revisedPrompt?: string
  remoteUrl?: string     // 端点返回的临时 URL（仅日志参考，不作为存储）
  error?: string
  usage?: UsageInfo
  durationMs?: number
  retryCount: number
  createdAt: number
  doneAt?: number
  logs: LogLine[]
}

export interface TaskRecord {
  id: string
  prompt: string
  params: GenParams
  count: number
  status: TaskStatus
  createdAt: number
  finishedAt?: number
  imageIds: string[]
  refImages?: Blob[]     // 图生图参考图（任务级共享，原图存 IndexedDB）
}

export interface Settings {
  baseUrl: string
  apiKey: string
  model: string
  concurrency: number
  autoRetry: boolean
  defaultParams: GenParams
}

export interface StorageUsage {
  usage: number
  quota: number
}

/* ---------------- 提示词模板 ---------------- */

export type TemplateFieldType = 'text' | 'textarea' | 'select'

export interface TemplateField {
  key: string
  label: string
  type: TemplateFieldType
  placeholder?: string
  /** select 选项：纯字符串或 {value,label} 形态 */
  options?: string[] | { value: string; label: string }[]
  required?: boolean
}

/** 自定义模板（存 IndexedDB）：正文用 {{key}} 占位，按字段替换 */
export interface CustomTemplate {
  id: string
  name: string
  description: string
  fields: TemplateField[]
  body: string
  builtin: false
  createdAt: number
}

/** 内置模板（代码定义）：build 逻辑化组装 Prompt，并联动生成参数；fields 可按已填值动态变化 */
export interface BuiltinTemplate {
  id: string
  name: string
  description: string
  builtin: true
  /** 使用说明（显示在对话框底部，可按已填值动态变化） */
  note?: string | ((values: Record<string, string>) => string)
  fields: TemplateField[] | ((values: Record<string, string>) => TemplateField[])
  build: (values: Record<string, string>) => { prompt: string; params?: Partial<GenParams> }
}

export type AnyTemplate = BuiltinTemplate | CustomTemplate

export const DEFAULT_PARAMS: GenParams = {
  size: '1024x1024',
  quality: 'high',
  background: 'auto',
  output_format: 'png',
}

export const SIZE_OPTIONS = [
  { value: '1024x1024', label: '方形 1024×1024' },
  { value: '1024x1536', label: '竖版 1024×1536' },
  { value: '1536x1024', label: '横版 1536×1024' },
  { value: 'auto', label: '自动' },
]

export const QUALITY_OPTIONS = [
  { value: 'low', label: '低（快）' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'xhigh', label: '超高' },
  { value: 'max', label: '最高（慢）' },
  { value: 'auto', label: '自动' },
]

export const BACKGROUND_OPTIONS = [
  { value: 'auto', label: '自动' },
  { value: 'transparent', label: '透明（需 png/webp）' },
  { value: 'opaque', label: '不透明' },
]

export const FORMAT_OPTIONS = [
  { value: 'png', label: 'PNG' },
  { value: 'webp', label: 'WebP' },
  { value: 'jpeg', label: 'JPEG' },
]

/* ---------------- 漫画工作室 ---------------- */

/** 漫画内实体（角色 / 分镜格）的生成状态 */
export type MangaItemStatus = 'draft' | 'generating' | 'done' | 'failed'

/** 角色：描述 + 参考图 → AI 生成六宫格设定表，作为后续分镜的一致性参考 */
export interface MangaCharacter {
  id: string
  name: string
  description: string           // 外观设定（发色 / 服装 / 气质…）
  refBlobs?: Blob[]             // 用户上传的参考图（最多 4 张，原图存项目内）
  sheetBlob?: Blob              // AI 生成的角色设定表（六宫格）
  sheetThumb?: Blob             // 设定表缩略图
  status: MangaItemStatus
  error?: string
}

/** 单个分镜格：每格一张图（条漫式） */
export interface MangaScene {
  id: string
  description: string           // 画面描述（交给生图的核心文本）
  dialogue?: string             // 对白（bubbleDialogue 开启时画进气泡）
  narration?: string            // 旁白
  shotType: string              // 镜头类型（远景 / 中景 / 特写…）
  characterIds: string[]        // 出场角色（其设定表作参考图传入）
  imageBlob?: Blob
  thumbBlob?: Blob
  status: MangaSceneStatus
  error?: string
}

/** 漫画项目：一个项目 = 脚本 + 角色 + 分镜，整体存 IndexedDB */
export interface MangaProject {
  id: string
  title: string
  idea: string                  // 故事创意（AI 写剧本的素材输入）
  /** Markdown 剧本文档（分镜的唯一来源；旧项目由 summary 迁移而来） */
  scriptDoc?: string
  /** AI 写剧本的提示词（与正文分离存储，Toonflow 同款设计；空则用内置默认） */
  scriptPrompt?: string
  /** 旧版故事梗概，仅作兼容保留，新逻辑不再写入 */
  summary?: string
  styleId: string               // 画风预设 id（STYLE_PRESETS）
  customStyle?: string          // 自定义画风补充描述
  colorMode: 'color' | 'monochrome'
  bubbleDialogue: boolean       // 对白是否画进气泡
  size: '1536x1024' | '1024x1536'  // 分镜画幅：横版 / 竖版
  characters: MangaCharacter[]
  scenes: MangaScene[]
  createdAt: number
  updatedAt: number
}

/** 漫画工作室独立设置（存 settings store 的 'manga' 键）；文本端点与生图端点解耦 */
export interface MangaSettings {
  textBaseUrl: string           // 脚本创作用的对话端点（chat/completions）
  textApiKey: string
  textModel: string
}

const env = import.meta.env

export const DEFAULT_MANGA_SETTINGS: MangaSettings = {
  textBaseUrl: (env.VITE_TEXT_BASE_URL as string) || '/api/relay/v1',
  textApiKey: (env.VITE_TEXT_API_KEY as string) || '',
  textModel: (env.VITE_TEXT_MODEL as string) || 'gpt-4o-mini',
}

/** 画风预设：锁定跨格风格一致性（英文描述对生图端点更稳） */
export interface MangaStylePreset {
  id: string
  name: string
  prompt: string
}

export const STYLE_PRESETS: MangaStylePreset[] = [
  { id: 'shonen', name: '日漫少年漫', prompt: 'Japanese shonen manga style, dynamic sharp linework, expressive action poses, screentone shading, high contrast ink' },
  { id: 'shojo', name: '日漫少女漫', prompt: 'Japanese shojo manga style, delicate thin lines, sparkling eyes, floral decorative backgrounds, soft screentones, romantic atmosphere' },
  { id: 'seinen', name: '日漫青年漫', prompt: 'Japanese seinen manga style, realistic detailed linework, mature atmosphere, heavy cross-hatching, cinematic framing' },
  { id: 'cel', name: '赛璐璐动漫', prompt: 'cel-shaded anime style, clean flat colors, crisp outlines, vibrant palette, TV anime aesthetic' },
  { id: 'american', name: '美漫', prompt: 'American comic book style, bold heavy inks, dramatic chiaroscuro shading, dynamic perspective, vivid saturated colors' },
  { id: 'inkwash', name: '水墨国风', prompt: 'Chinese ink wash painting style, flowing brush strokes, misty negative space, monochrome ink gradations with subtle color accents' },
  { id: 'chibi', name: 'Q版卡通', prompt: 'chibi cartoon style, cute oversized heads, rounded simplified bodies, bright cheerful colors, thick outlines' },
  { id: 'pixel', name: '像素风', prompt: 'retro pixel art style, 16-bit limited palette, dithered shading, chunky pixels, video game sprite aesthetic' },
]

/** 镜头类型选项（写入分镜 prompt 的构图指令） */
export const SHOT_OPTIONS = [
  { value: 'wide', label: '远景（大环境）', prompt: 'extreme wide establishing shot, full environment visible, characters small in frame' },
  { value: 'full', label: '全景（全身）', prompt: 'full-body shot, characters fully visible head to toe, clear spatial context' },
  { value: 'medium', label: '中景（腰上）', prompt: 'medium shot from waist up, balanced framing of characters and background' },
  { value: 'closeup', label: '近景（胸像）', prompt: 'close-up shot from chest up, facial expression clearly visible' },
  { value: 'extreme', label: '特写（面部/细节）', prompt: 'extreme close-up on face or key detail, dramatic emphasis, background blurred away' },
  { value: 'high', label: '俯视', prompt: 'high-angle bird\'s eye view looking down on the scene' },
  { value: 'low', label: '仰视', prompt: 'low-angle worm\'s eye view looking up, imposing dramatic perspective' },
]

/** 分镜格生成状态（在 MangaItemStatus 基础上补充排队态） */
export type MangaSceneStatus = MangaItemStatus | 'queued'
