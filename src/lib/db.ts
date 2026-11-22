/**
 * IndexedDB 封装：库 image-workbench v1
 * 四个 store：settings（键值）、tasks（批量任务）、images（单张图片，含 Blob）、mangaProjects（漫画项目）
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { ComposerDraft, ImageRecord, MangaProject, MangaSettings, Settings, TaskRecord } from './types'
import { DEFAULT_MANGA_SETTINGS, DEFAULT_PARAMS } from './types'

interface WorkbenchDB extends DBSchema {
  settings: { key: string; value: unknown }
  tasks: { key: string; value: TaskRecord; indexes: { 'by-created': number } }
  images: {
    key: string
    value: ImageRecord
    indexes: { 'by-task': string; 'by-created': number }
  }
  templates: { key: string; value: import('./types').CustomTemplate }
  mangaProjects: { key: string; value: MangaProject }
  /** 左栏草稿：键固定为 composer（单草稿） */
  drafts: { key: string; value: ComposerDraft }
}

const DB_NAME = 'image-workbench'
const DB_VERSION = 4

let dbPromise: Promise<IDBPDatabase<WorkbenchDB>> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<WorkbenchDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings')
        }
        if (!db.objectStoreNames.contains('tasks')) {
          const tasks = db.createObjectStore('tasks', { keyPath: 'id' })
          tasks.createIndex('by-created', 'createdAt')
        }
        if (!db.objectStoreNames.contains('images')) {
          const images = db.createObjectStore('images', { keyPath: 'id' })
          images.createIndex('by-task', 'taskId')
          images.createIndex('by-created', 'createdAt')
        }
        if (!db.objectStoreNames.contains('templates')) {
          db.createObjectStore('templates', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('mangaProjects')) {
          db.createObjectStore('mangaProjects', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('drafts')) {
          // 单草稿，使用外部键（'composer'），值本身不带 id
          db.createObjectStore('drafts')
        }
      },
      // 其他标签页请求升级时主动让出连接，避免新版本标签页卡在打开数据库
      blocking(_currentVersion, blockedVersion, event) {
        try {
          ;(event.target as IDBDatabase | null)?.close()
        } catch {
          /* 忽略关闭异常 */
        }
        dbPromise = null
        console.warn(`[IndexedDB] 其他标签页请求升级到 v${blockedVersion}，已关闭当前连接`)
      },
      blocked(currentVersion, blockedVersion) {
        console.warn(
          `[IndexedDB] 升级到 v${blockedVersion} 被其他标签页阻塞（当前 v${currentVersion}），请关闭旧标签页`,
        )
      },
      terminated() {
        dbPromise = null
      },
    })
  }
  return dbPromise
}

/* ---------------- settings ---------------- */

export const FALLBACK_SETTINGS: Settings = {
  baseUrl: import.meta.env.VITE_DEFAULT_BASE_URL || '/api/relay/v1',
  // 仅开发环境允许从 env 读 Key；生产构建必须通过设置面板填写
  apiKey: import.meta.env.DEV ? (import.meta.env.VITE_DEFAULT_API_KEY ?? '') : '',
  model: import.meta.env.VITE_DEFAULT_MODEL || 'gpt-image-1',
  concurrency: 2,
  autoRetry: true,
  defaultParams: { ...DEFAULT_PARAMS },
}

export async function loadSettings(): Promise<Settings> {
  try {
    const db = await getDB()
    const saved = (await db.get('settings', 'app')) as Settings | undefined
    if (!saved) return { ...FALLBACK_SETTINGS }
    // 合并默认值，防止旧版本缺字段
    return {
      ...FALLBACK_SETTINGS,
      ...saved,
      defaultParams: { ...DEFAULT_PARAMS, ...(saved.defaultParams ?? {}) },
    }
  } catch {
    return { ...FALLBACK_SETTINGS }
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  const db = await getDB()
  await db.put('settings', s, 'app')
}

export async function getRawSettings(): Promise<Settings | undefined> {
  const db = await getDB()
  return (await db.get('settings', 'app')) as Settings | undefined
}

/* ---------------- tasks ---------------- */

export async function putTask(task: TaskRecord): Promise<void> {
  const db = await getDB()
  await db.put('tasks', task)
}

export async function getTask(id: string): Promise<TaskRecord | undefined> {
  const db = await getDB()
  return db.get('tasks', id)
}

export async function deleteTask(id: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['tasks', 'images'], 'readwrite')
  await tx.objectStore('tasks').delete(id)
  const idx = tx.objectStore('images').index('by-task')
  let cursor = await idx.openCursor(IDBKeyRange.only(id))
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }
  await tx.done
}

export async function listTasks(limit = 100, offset = 0): Promise<TaskRecord[]> {
  const db = await getDB()
  const idx = db.transaction('tasks').store.index('by-created')
  const out: TaskRecord[] = []
  let cursor = await idx.openCursor(null, 'prev') // 新→旧
  let skipped = 0
  while (cursor && out.length < limit) {
    if (skipped < offset) { skipped++; cursor = await cursor.continue(); continue }
    out.push(cursor.value)
    cursor = await cursor.continue()
  }
  return out
}

/** 全量读取任务（备份导出用，不走 200 条上限） */
export async function getAllTasks(): Promise<TaskRecord[]> {
  const db = await getDB()
  return db.getAll('tasks')
}

/* ---------------- images ---------------- */

export async function putImage(image: ImageRecord): Promise<void> {
  const db = await getDB()
  await db.put('images', image)
}

export async function getImage(id: string): Promise<ImageRecord | undefined> {
  const db = await getDB()
  return db.get('images', id)
}

export async function getImagesByTask(taskId: string): Promise<ImageRecord[]> {
  const db = await getDB()
  const idx = db.transaction('images').store.index('by-task')
  return idx.getAll(taskId)
}

/** 全量读取图片（备份导出用，含完整 Blob） */
export async function getAllImages(): Promise<ImageRecord[]> {
  const db = await getDB()
  return db.getAll('images')
}

export async function deleteImage(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('images', id)
}

export async function countImages(): Promise<number> {
  const db = await getDB()
  return db.count('images')
}

/** 清空任务与图片两个 store（保留 settings），用于"清空数据库"功能 */
export async function clearAllData(): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['tasks', 'images'], 'readwrite')
  await Promise.all([
    tx.objectStore('tasks').clear(),
    tx.objectStore('images').clear(),
  ])
  await tx.done
}

export interface RestoreData {
  tasks: TaskRecord[]
  images: ImageRecord[]
  customTemplates: import('./types').CustomTemplate[]
  mangaProjects: MangaProject[]
  appSettings: Omit<Settings, 'apiKey'>
  mangaSettings: Omit<MangaSettings, 'textApiKey'>
}

/**
 * 备份恢复：覆盖任务/图片/自定义模板/漫画项目，合并设置但保留当前浏览器里的 Key。
 * 整个写入放在一个事务里，避免恢复到一半留下半套数据。
 */
export async function restoreAllData(data: RestoreData): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['tasks', 'images', 'templates', 'mangaProjects', 'settings'], 'readwrite')
  const tasksStore = tx.objectStore('tasks')
  const imagesStore = tx.objectStore('images')
  const templatesStore = tx.objectStore('templates')
  const mangaStore = tx.objectStore('mangaProjects')
  const settingsStore = tx.objectStore('settings')

  await Promise.all([
    tasksStore.clear(),
    imagesStore.clear(),
    templatesStore.clear(),
    mangaStore.clear(),
  ])

  const [currentApp, currentManga] = await Promise.all([
    settingsStore.get('app') as Promise<Settings | undefined>,
    settingsStore.get('manga') as Promise<MangaSettings | undefined>,
  ])

  await Promise.all([
    ...data.tasks.map((task) => tasksStore.put(task)),
    ...data.images.map((image) => imagesStore.put(image)),
    ...data.customTemplates.map((template) => templatesStore.put(template)),
    ...data.mangaProjects.map((project) => mangaStore.put(project)),
    settingsStore.put(
      { ...FALLBACK_SETTINGS, ...currentApp, ...data.appSettings, apiKey: currentApp?.apiKey ?? '' },
      'app',
    ),
    settingsStore.put(
      {
        ...DEFAULT_MANGA_SETTINGS,
        ...currentManga,
        ...data.mangaSettings,
        textApiKey: currentManga?.textApiKey ?? '',
      },
      'manga',
    ),
  ])
  await tx.done
}

/**
 * 启动清扫：上次会话遗留在 pending/generating/downloading 的图片标记为失败（会话中断），
 * 让用户可以手动重试。
 */
export async function sweepStaleImages(): Promise<number> {
  const db = await getDB()
  const tx = db.transaction('images', 'readwrite')
  let cursor = await tx.store.openCursor()
  let n = 0
  const stale = new Set(['pending', 'generating', 'downloading'])
  while (cursor) {
    const rec = cursor.value
    if (stale.has(rec.status)) {
      rec.status = 'failed'
      rec.error = '应用关闭或页面刷新导致中断，可重试'
      rec.doneAt = Date.now()
      rec.logs = [
        ...rec.logs,
        { t: Date.now(), level: 'error' as const, text: '会话中断，任务标记为失败' },
      ].slice(-500)
      await cursor.update(rec)
      n++
    }
    cursor = await cursor.continue()
  }
  await tx.done
  return n
}

/* ---------------- 自定义提示词模板 ---------------- */

export async function listCustomTemplates(): Promise<import('./types').CustomTemplate[]> {
  const db = await getDB()
  const all = await db.getAll('templates')
  return all.sort((a, b) => b.createdAt - a.createdAt)
}

export async function putCustomTemplate(t: import('./types').CustomTemplate): Promise<void> {
  const db = await getDB()
  await db.put('templates', t)
}

export async function deleteCustomTemplate(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('templates', id)
}

/* ---------------- 通用 KV（settings store 内的独立键，存提示词库数据等大对象） ---------------- */

export async function getKV<T>(key: string): Promise<T | undefined> {
  const db = await getDB()
  return (await db.get('settings', key)) as T | undefined
}

export async function setKV(key: string, value: unknown): Promise<void> {
  const db = await getDB()
  await db.put('settings', value, key)
}

export async function deleteKV(key: string): Promise<void> {
  const db = await getDB()
  await db.delete('settings', key)
}

/** 清理已移除模板库遗留的缓存，避免旧版本缓存继续占用空间 */
export async function cleanupRemovedLibraryCaches(): Promise<void> {
  const removedKeys = ['vivid-cards', 'shuixian-library', 'ecom-templates']
  for (const key of removedKeys) {
    try {
      await deleteKV(key)
    } catch {
      /* 单个缓存清理失败不影响启动 */
    }
  }
}

/* ---------------- 漫画工作室 ---------------- */

/** 漫画设置（settings store 的 'manga' 键），合并默认值防旧版本缺字段；
 *  旧版本记录只有 textModel 字段（无独立文本端点），整体让位给新默认值 */
export async function loadMangaSettings(): Promise<MangaSettings> {
  try {
    const saved = (await getKV<Partial<MangaSettings>>('manga')) ?? {}
    if (saved && !saved.textBaseUrl) return { ...DEFAULT_MANGA_SETTINGS }
    return { ...DEFAULT_MANGA_SETTINGS, ...saved }
  } catch {
    return { ...DEFAULT_MANGA_SETTINGS }
  }
}

export async function saveMangaSettings(s: MangaSettings): Promise<void> {
  await setKV('manga', s)
}

export async function getRawMangaSettings(): Promise<MangaSettings | undefined> {
  return getKV<MangaSettings>('manga')
}

export async function putMangaProject(project: MangaProject): Promise<void> {
  const db = await getDB()
  await db.put('mangaProjects', project)
}

export async function getMangaProject(id: string): Promise<MangaProject | undefined> {
  const db = await getDB()
  return db.get('mangaProjects', id)
}

export async function deleteMangaProject(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('mangaProjects', id)
}

export async function listMangaProjects(): Promise<MangaProject[]> {
  const db = await getDB()
  const all = await db.getAll('mangaProjects')
  return all.sort((a, b) => b.updatedAt - a.updatedAt) // 新→旧
}

/** 启动清扫：上次会话遗留的 generating/queued 状态标记为失败，让用户可重试 */
export async function sweepStaleManga(): Promise<number> {
  const db = await getDB()
  const all = await db.getAll('mangaProjects')
  const stale = new Set(['generating', 'queued'])
  let n = 0
  for (const project of all) {
    let dirty = false
    const fix = (item: { status: string; error?: string }) => {
      if (stale.has(item.status)) {
        item.status = 'failed'
        item.error = '应用关闭或页面刷新导致中断，可重试'
        dirty = true
        n++
      }
    }
    for (const c of project.characters) fix(c)
    for (const s of project.scenes) fix(s)
    if (dirty) await putMangaProject(project)
  }
  return n
}

/* ---------------- 输入草稿 ---------------- */

export const COMPOSER_DRAFT_KEY = 'composer'

export async function getComposerDraft(): Promise<ComposerDraft | undefined> {
  const db = await getDB()
  return db.get('drafts', COMPOSER_DRAFT_KEY)
}

export async function putComposerDraft(draft: ComposerDraft): Promise<void> {
  const db = await getDB()
  await db.put('drafts', draft, COMPOSER_DRAFT_KEY)
}

export async function deleteComposerDraft(): Promise<void> {
  const db = await getDB()
  await db.delete('drafts', COMPOSER_DRAFT_KEY)
}

export async function estimateStorage(): Promise<{ usage: number; quota: number }> {
  try {
    if (navigator.storage?.estimate) {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate()
      return { usage, quota }
    }
  } catch {
    /* 某些隐私模式会拒绝 estimate，按未知处理，不影响启动 */
  }
  return { usage: 0, quota: 0 }
}
