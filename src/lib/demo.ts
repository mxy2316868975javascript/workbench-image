/**
 * 只读演示模式：`?demo=1` 时注入示例任务与图片，不读取任务/设置数据、不调用真实端点。
 * 用于 GitHub Pages / README 演示，避免访客必须配置 API Key 才能看到界面。
 */
import { DEFAULT_PARAMS, type ImageRecord, type Settings, type TaskRecord } from './types'

export const DEMO_QUERY = 'demo'

export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return new URLSearchParams(window.location.search).get(DEMO_QUERY) === '1'
  } catch {
    return false
  }
}

export const DEMO_SETTINGS: Settings = {
  baseUrl: 'https://demo.invalid/v1',
  apiKey: 'demo-mode',
  model: 'gpt-image-1',
  concurrency: 2,
  autoRetry: false,
  defaultParams: { ...DEFAULT_PARAMS },
}

export const DEMO_PROMPT =
  '雨后的东京小巷，自动售货机微光，湿润石板路，电影感广角，霓虹倒影，35mm 胶片颗粒'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function svgImage(title: string, subtitle: string, from: string, to: string): Blob {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.72" cy="0.2" r="0.7">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.42"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#g)"/>
  <rect width="1024" height="1024" fill="url(#glow)"/>
  <g fill="none" stroke="#ffffff" stroke-opacity="0.22">
    <circle cx="720" cy="330" r="250"/>
    <circle cx="720" cy="330" r="170"/>
    <circle cx="720" cy="330" r="90"/>
    <path d="M0 760 Q 260 620 512 760 T 1024 760" stroke-width="2"/>
  </g>
  <rect x="72" y="72" width="880" height="880" rx="28" fill="none" stroke="#ffffff" stroke-opacity="0.28"/>
  <text x="96" y="846" fill="#ffffff" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="62" font-weight="700">${escapeXml(title)}</text>
  <text x="98" y="900" fill="#ffffff" fill-opacity="0.72" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="28">${escapeXml(subtitle)}</text>
  <text x="96" y="126" fill="#ffffff" fill-opacity="0.62" font-family="ui-monospace, monospace" font-size="22">DEMO · Image Workbench</text>
</svg>`
  return new Blob([svg], { type: 'image/svg+xml' })
}

function demoImage(
  id: string,
  taskId: string,
  prompt: string,
  title: string,
  subtitle: string,
  from: string,
  to: string,
  createdAt: number,
): ImageRecord {
  const blob = svgImage(title, subtitle, from, to)
  return {
    id,
    taskId,
    prompt,
    params: { ...DEFAULT_PARAMS },
    status: 'done',
    progress: 100,
    phase: '完成',
    model: 'gpt-image-1',
    blob,
    thumbBlob: blob,
    mime: 'image/svg+xml',
    width: 1024,
    height: 1024,
    retryCount: 0,
    createdAt,
    doneAt: createdAt + 18_000,
    durationMs: 18_000,
    usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    logs: [
      { t: createdAt, level: 'info', text: '演示数据：不会调用真实端点' },
      { t: createdAt + 18_000, level: 'success', text: '示例图片已生成' },
    ],
  }
}

export interface DemoState {
  tasks: Record<string, TaskRecord>
  images: Record<string, ImageRecord>
  taskOrder: string[]
}

/** 固定示例数据，覆盖生成、历史、多图任务三种界面状态 */
export function createDemoState(): DemoState {
  const now = Date.now()
  const t0 = now - 1000 * 8
  const t1 = now - 1000 * 60 * 34
  const t2 = now - 1000 * 60 * 12
  const t3 = now - 1000 * 60 * 3

  const runningBase = demoImage(
    'demo-img-0a',
    'demo-task-0',
    DEMO_PROMPT,
    '雨后的小巷',
    '电影感 / 广角 / 霓虹',
    '#111827',
    '#1d4ed8',
    t0,
  )
  const runningImage: ImageRecord = {
    ...demoImage(
      'demo-img-0b',
      'demo-task-0',
      DEMO_PROMPT,
      '霓虹倒影',
      '生成中 64%',
      '#1e1b4b',
      '#7c3aed',
      t0 + 1000,
    ),
    status: 'generating',
    progress: 64,
    phase: '生成中',
    doneAt: undefined,
    logs: [{ t: t0 + 1000, level: 'info', text: '演示：SSE 进度块已到达' }],
  }

  const images: Record<string, ImageRecord> = {
    'demo-img-0a': runningBase,
    'demo-img-0b': runningImage,
    'demo-img-1': demoImage(
      'demo-img-1',
      'demo-task-1',
      '深夜便利店，玻璃上的雨痕，霓虹灯反射，电影感色彩，35mm 胶片颗粒',
      '雨夜便利店',
      '电影感 / 霓虹 / 35mm',
      '#0f172a',
      '#4338ca',
      t1,
    ),
    'demo-img-2': demoImage(
      'demo-img-2',
      'demo-task-1',
      '深夜便利店，暖色招牌与冷色街灯对比，湿润路面，广角构图',
      '街角的光',
      '冷暖对比 / 广角',
      '#1e1b4b',
      '#0e7490',
      t1 + 1000,
    ),
    'demo-img-3': demoImage(
      'demo-img-3',
      'demo-task-2',
      '磨砂玻璃香水瓶产品主图，柔和棚拍光，米白背景，留白排版，高端美妆广告',
      '产品主图',
      '棚拍 / 留白 / 高端',
      '#3f3f46',
      '#a16207',
      t2,
    ),
    'demo-img-4': demoImage(
      'demo-img-4',
      'demo-task-3',
      '信息图：本地优先的 AI 生图工作流，IndexedDB 存储、批量队列、模板库，扁平矢量风格',
      '本地优先工作流',
      '信息图 / 扁平矢量',
      '#064e3b',
      '#0d9488',
      t3,
    ),
  }

  const tasks: Record<string, TaskRecord> = {
    'demo-task-0': {
      id: 'demo-task-0',
      prompt: DEMO_PROMPT,
      params: { ...DEFAULT_PARAMS },
      count: 2,
      status: 'running',
      createdAt: t0,
      imageIds: ['demo-img-0a', 'demo-img-0b'],
      model: 'gpt-image-1',
    },
    'demo-task-1': {
      id: 'demo-task-1',
      prompt: '深夜便利店，玻璃上的雨痕，霓虹灯反射，电影感色彩，35mm 胶片颗粒',
      params: { ...DEFAULT_PARAMS },
      count: 2,
      status: 'completed',
      createdAt: t1,
      finishedAt: t1 + 24_000,
      imageIds: ['demo-img-1', 'demo-img-2'],
      model: 'gpt-image-1',
    },
    'demo-task-2': {
      id: 'demo-task-2',
      prompt: '磨砂玻璃香水瓶产品主图，柔和棚拍光，米白背景，留白排版，高端美妆广告',
      params: { ...DEFAULT_PARAMS },
      count: 1,
      status: 'completed',
      createdAt: t2,
      finishedAt: t2 + 18_000,
      imageIds: ['demo-img-3'],
      model: 'gpt-image-1',
    },
    'demo-task-3': {
      id: 'demo-task-3',
      prompt: '信息图：本地优先的 AI 生图工作流，IndexedDB 存储、批量队列、模板库，扁平矢量风格',
      params: { ...DEFAULT_PARAMS },
      count: 1,
      status: 'completed',
      createdAt: t3,
      finishedAt: t3 + 21_000,
      imageIds: ['demo-img-4'],
      model: 'gpt-image-1',
    },
  }

  return {
    tasks,
    images,
    taskOrder: ['demo-task-0', 'demo-task-3', 'demo-task-2', 'demo-task-1'],
  }
}
