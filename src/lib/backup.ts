/**
 * 本地数据备份：任务 + 图片 + 自定义模板 + 漫画项目 + 设置（排除 API Key）。
 * 图片 Blob 转 base64 data URL；缩略图不导出，导入时重建。
 */
import {
  FALLBACK_SETTINGS,
  getAllImages,
  getAllTasks,
  getRawMangaSettings,
  getRawSettings,
  listCustomTemplates,
  listMangaProjects,
  restoreAllData,
} from './db'
import { DEFAULT_MANGA_SETTINGS } from './types'
import { makeThumbBlob } from './image-utils'
import type {
  CustomTemplate,
  ImageRecord,
  MangaCharacter,
  MangaProject,
  MangaScene,
  MangaSettings,
  Settings,
  TaskRecord,
} from './types'

export const BACKUP_FORMAT = 'image-workbench-backup'
export const BACKUP_SCHEMA_VERSION = 1
export const BACKUP_APP_VERSION = '0.1.0'

export interface SerializedBlob {
  mime: string
  dataUrl: string
}

export type BackupImage = Omit<ImageRecord, 'blob' | 'thumbBlob'> & {
  blob?: SerializedBlob
}

export type BackupTask = Omit<TaskRecord, 'refImages'> & {
  refImages?: SerializedBlob[]
}

export type BackupCharacter = Omit<MangaCharacter, 'refBlobs' | 'sheetBlob' | 'sheetThumb'> & {
  refBlobs?: SerializedBlob[]
  sheetBlob?: SerializedBlob
}

export type BackupScene = Omit<MangaScene, 'imageBlob' | 'thumbBlob'> & {
  imageBlob?: SerializedBlob
}

export type BackupMangaProject = Omit<MangaProject, 'characters' | 'scenes'> & {
  characters: BackupCharacter[]
  scenes: BackupScene[]
}

export interface BackupPayload {
  format: typeof BACKUP_FORMAT
  schemaVersion: typeof BACKUP_SCHEMA_VERSION
  exportedAt: number
  appVersion: string
  settings: {
    app: Omit<Settings, 'apiKey'>
    manga: Omit<MangaSettings, 'textApiKey'>
  }
  tasks: BackupTask[]
  images: BackupImage[]
  customTemplates: CustomTemplate[]
  mangaProjects: BackupMangaProject[]
}

export interface BackupCounts {
  tasks: number
  images: number
  customTemplates: number
  mangaProjects: number
}

export type BackupValidation =
  | { ok: true; backup: BackupPayload; counts: BackupCounts }
  | { ok: false; error: string }

const IN_FLIGHT_IMAGE_STATUS = new Set<ImageRecord['status']>(['pending', 'generating', 'downloading'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function omit<T extends object, K extends keyof T>(value: T, keys: readonly K[]): Omit<T, K> {
  const out = { ...value }
  for (const key of keys) delete out[key]
  return out as Omit<T, K>
}

/** Uint8Array -> base64，分块避免大图触发参数数量上限 */
export function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export async function serializeBlob(blob: Blob): Promise<SerializedBlob> {
  const mime = blob.type || 'application/octet-stream'
  const bytes = new Uint8Array(await blob.arrayBuffer())
  return { mime, dataUrl: `data:${mime};base64,${bytesToBase64(bytes)}` }
}

export function deserializeBlob(item: SerializedBlob): Blob {
  const comma = item.dataUrl.indexOf(',')
  if (comma < 0) throw new Error('图片数据格式不正确')
  const bytes = base64ToBytes(item.dataUrl.slice(comma + 1))
  // 复制到独立的 ArrayBuffer，避免 Uint8Array<ArrayBufferLike> 与 BlobPart 的类型冲突
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return new Blob([buffer], { type: item.mime || 'application/octet-stream' })
}

function countsOf(backup: Pick<BackupPayload, 'tasks' | 'images' | 'customTemplates' | 'mangaProjects'>): BackupCounts {
  return {
    tasks: backup.tasks.length,
    images: backup.images.length,
    customTemplates: backup.customTemplates.length,
    mangaProjects: backup.mangaProjects.length,
  }
}

export function backupFilename(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return [
    `image-workbench-backup-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`,
    `${pad(date.getHours())}${pad(date.getMinutes())}`,
  ].join('-') + '.json'
}

/** 从 IndexedDB 全量读取并生成备份文件 */
export async function createBackup(): Promise<{
  blob: Blob
  filename: string
  counts: BackupCounts
}> {
  const [tasksRaw, imagesRaw, customs, mangaRaw, appRaw, mangaSettingsRaw] = await Promise.all([
    getAllTasks(),
    getAllImages(),
    listCustomTemplates(),
    listMangaProjects(),
    getRawSettings(),
    getRawMangaSettings(),
  ])

  const now = Date.now()
  const tasks: BackupTask[] = []
  for (const task of tasksRaw) {
    const refImages = task.refImages?.length
      ? await Promise.all(task.refImages.map((blob) => serializeBlob(blob)))
      : undefined
    tasks.push({
      ...omit(task, ['refImages']),
      status: task.status === 'running' ? 'failed' : task.status,
      refImages,
    })
  }

  const images: BackupImage[] = []
  for (const image of imagesRaw) {
    const inFlight = IN_FLIGHT_IMAGE_STATUS.has(image.status)
    images.push({
      ...omit(image, ['blob', 'thumbBlob']),
      blob: image.blob ? await serializeBlob(image.blob) : undefined,
      status: inFlight ? 'failed' : image.status,
      ...(inFlight && !image.error ? { error: '导出时任务尚未完成' } : {}),
      doneAt: inFlight ? now : image.doneAt,
    })
  }

  const mangaProjects: BackupMangaProject[] = []
  for (const project of mangaRaw) {
    const characters: BackupCharacter[] = []
    for (const character of project.characters) {
      characters.push({
        ...omit(character, ['refBlobs', 'sheetBlob', 'sheetThumb']),
        refBlobs: character.refBlobs?.length
          ? await Promise.all(character.refBlobs.map((blob) => serializeBlob(blob)))
          : undefined,
        sheetBlob: character.sheetBlob ? await serializeBlob(character.sheetBlob) : undefined,
      })
    }
    const scenes: BackupScene[] = []
    for (const scene of project.scenes) {
      scenes.push({
        ...omit(scene, ['imageBlob', 'thumbBlob']),
        imageBlob: scene.imageBlob ? await serializeBlob(scene.imageBlob) : undefined,
      })
    }
    mangaProjects.push({ ...omit(project, ['characters', 'scenes']), characters, scenes })
  }

  const appSettings = omit(appRaw ?? FALLBACK_SETTINGS, ['apiKey'])
  const mangaSettings = omit(mangaSettingsRaw ?? DEFAULT_MANGA_SETTINGS, ['textApiKey'])

  const backup: BackupPayload = {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now,
    appVersion: BACKUP_APP_VERSION,
    settings: { app: appSettings, manga: mangaSettings },
    tasks,
    images,
    customTemplates: customs,
    mangaProjects,
  }

  return {
    blob: new Blob([JSON.stringify(backup)], { type: 'application/json' }),
    filename: backupFilename(),
    counts: countsOf(backup),
  }
}

function isSerializedBlob(value: unknown): value is SerializedBlob {
  return (
    isRecord(value) &&
    typeof value.mime === 'string' &&
    typeof value.dataUrl === 'string' &&
    value.dataUrl.startsWith('data:')
  )
}

/** 校验备份结构；不通过时给出可读原因 */
export function validateBackup(raw: unknown): BackupValidation {
  if (!isRecord(raw)) return { ok: false, error: '备份内容不是对象' }
  if (raw.format !== BACKUP_FORMAT) return { ok: false, error: '不是本应用的备份文件' }
  if (raw.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    return { ok: false, error: `备份版本不支持：${String(raw.schemaVersion)}` }
  }
  if (!isRecord(raw.settings) || !isRecord(raw.settings.app) || !isRecord(raw.settings.manga)) {
    return { ok: false, error: '备份缺少设置数据' }
  }
  if (!Array.isArray(raw.tasks) || !Array.isArray(raw.images)) {
    return { ok: false, error: '备份缺少任务或图片数据' }
  }
  if (!Array.isArray(raw.customTemplates) || !Array.isArray(raw.mangaProjects)) {
    return { ok: false, error: '备份缺少模板或漫画数据' }
  }

  for (const task of raw.tasks) {
    if (!isRecord(task) || typeof task.id !== 'string' || !Array.isArray(task.imageIds)) {
      return { ok: false, error: '任务数据格式不正确' }
    }
    if (task.refImages !== undefined) {
      if (!Array.isArray(task.refImages) || !task.refImages.every(isSerializedBlob)) {
        return { ok: false, error: '任务参考图数据格式不正确' }
      }
    }
  }

  for (const image of raw.images) {
    if (!isRecord(image) || typeof image.id !== 'string' || typeof image.taskId !== 'string') {
      return { ok: false, error: '图片数据格式不正确' }
    }
    if (image.blob !== undefined && !isSerializedBlob(image.blob)) {
      return { ok: false, error: '图片数据格式不正确' }
    }
  }

  for (const template of raw.customTemplates) {
    if (!isRecord(template) || typeof template.id !== 'string' || typeof template.body !== 'string') {
      return { ok: false, error: '自定义模板数据格式不正确' }
    }
  }

  for (const project of raw.mangaProjects) {
    if (!isRecord(project) || typeof project.id !== 'string' || typeof project.title !== 'string') {
      return { ok: false, error: '漫画项目数据格式不正确' }
    }
    if (!Array.isArray(project.characters) || !Array.isArray(project.scenes)) {
      return { ok: false, error: '漫画项目缺少角色或分镜数据' }
    }
  }

  return {
    ok: true,
    backup: raw as unknown as BackupPayload,
    counts: countsOf(raw as unknown as BackupPayload),
  }
}

export function parseBackup(text: string): BackupValidation {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: '不是有效的 JSON 文件' }
  }
  return validateBackup(raw)
}

/** 恢复备份：覆盖任务/图片/模板/漫画，合并非密钥设置，保留当前 Key */
export async function restoreBackup(backup: BackupPayload): Promise<BackupCounts> {
  const images: ImageRecord[] = []
  for (const image of backup.images) {
    const { blob: serialized, ...rest } = image
    const blob = serialized ? deserializeBlob(serialized) : undefined
    images.push({
      ...rest,
      blob,
      thumbBlob: blob ? await makeThumbBlob(blob) : undefined,
    })
  }

  const tasks: TaskRecord[] = backup.tasks.map((task) => {
    const { refImages, ...rest } = task
    return {
      ...rest,
      refImages: refImages?.map(deserializeBlob),
    }
  })

  const mangaProjects: MangaProject[] = []
  for (const project of backup.mangaProjects) {
    const characters: MangaCharacter[] = []
    for (const character of project.characters) {
      const { refBlobs, sheetBlob, ...rest } = character
      const sheet = sheetBlob ? deserializeBlob(sheetBlob) : undefined
      characters.push({
        ...rest,
        refBlobs: refBlobs?.map(deserializeBlob),
        sheetBlob: sheet,
        sheetThumb: sheet ? await makeThumbBlob(sheet) : undefined,
      })
    }
    const scenes: MangaScene[] = []
    for (const scene of project.scenes) {
      const { imageBlob, ...rest } = scene
      const image = imageBlob ? deserializeBlob(imageBlob) : undefined
      scenes.push({
        ...rest,
        imageBlob: image,
        thumbBlob: image ? await makeThumbBlob(image) : undefined,
      })
    }
    mangaProjects.push({ ...project, characters, scenes })
  }

  await restoreAllData({
    tasks,
    images,
    customTemplates: backup.customTemplates,
    mangaProjects,
    appSettings: backup.settings.app,
    mangaSettings: backup.settings.manga,
  })

  return countsOf(backup)
}
