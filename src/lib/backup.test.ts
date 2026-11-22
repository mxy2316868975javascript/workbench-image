import { beforeEach, describe, expect, it } from 'vitest'
import {
  base64ToBytes,
  bytesToBase64,
  createBackup,
  deserializeBlob,
  parseBackup,
  restoreBackup,
  serializeBlob,
  validateBackup,
} from './backup'
import {
  getImage,
  getRawMangaSettings,
  getRawSettings,
  getTask,
  putCustomTemplate,
  putImage,
  putTask,
  restoreAllData,
  saveSettings,
  setKV,
} from './db'
import { DEFAULT_MANGA_SETTINGS, DEFAULT_PARAMS, type ImageRecord, type TaskRecord } from './types'

const params = { ...DEFAULT_PARAMS }

function task(id: string): TaskRecord {
  return {
    id,
    prompt: 'test prompt',
    params,
    count: 1,
    status: 'completed',
    createdAt: 1,
    finishedAt: 2,
    imageIds: [`img-${id}`],
    model: 'gpt-image-1',
  }
}

function image(id: string, taskId: string, blob: Blob): ImageRecord {
  return {
    id,
    taskId,
    prompt: 'test prompt',
    params,
    status: 'done',
    progress: 100,
    phase: '完成',
    model: 'gpt-image-1',
    blob,
    thumbBlob: blob,
    mime: blob.type,
    width: 1,
    height: 1,
    retryCount: 0,
    createdAt: 1,
    doneAt: 2,
    logs: [],
  }
}

beforeEach(async () => {
  await restoreAllData({
    tasks: [],
    images: [],
    customTemplates: [],
    mangaProjects: [],
    appSettings: {
      baseUrl: 'http://localhost:5173/v1',
      model: 'gpt-image-1',
      concurrency: 2,
      autoRetry: true,
      defaultParams: params,
    },
    mangaSettings: {
      textBaseUrl: 'http://localhost:5173/v1',
      textModel: 'gpt-4o-mini',
    },
  })
})

describe('blob 序列化', () => {
  it('base64 往返', () => {
    const bytes = new Uint8Array([0, 1, 2, 255])
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual([0, 1, 2, 255])
  })

  it('Blob 转 data URL 再还原', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' })
    const serialized = await serializeBlob(blob)
    expect(serialized.dataUrl.startsWith('data:text/plain;base64,')).toBe(true)
    const restored = deserializeBlob(serialized)
    expect(restored.type).toBe('text/plain')
    expect(await restored.text()).toBe('hello')
  })
})

describe('备份校验', () => {
  it('拒绝非本应用、版本不符和缺字段的文件', () => {
    expect(validateBackup(null)).toMatchObject({ ok: false })
    expect(validateBackup({ format: 'other' })).toMatchObject({ ok: false })
    expect(validateBackup({ format: 'image-workbench-backup', schemaVersion: 99 })).toMatchObject({
      ok: false,
    })
    expect(
      validateBackup({
        format: 'image-workbench-backup',
        schemaVersion: 1,
        settings: { app: {}, manga: {} },
      }),
    ).toMatchObject({ ok: false })
  })

  it('JSON 解析失败给出可读错误', () => {
    expect(parseBackup('{')).toMatchObject({ ok: false, error: '不是有效的 JSON 文件' })
  })
})

describe('备份导出与恢复', () => {
  it('导出不含 API Key，恢复后保留当前 Key 并还原数据', async () => {
    await saveSettings({
      baseUrl: 'http://current.example/v1',
      apiKey: 'current-key',
      model: 'gpt-image-1',
      concurrency: 2,
      autoRetry: true,
      defaultParams: params,
    })
    await setKV('manga', { ...DEFAULT_MANGA_SETTINGS, textApiKey: 'current-text-key' })
    await putTask(task('t1'))
    await putImage(image('img-t1', 't1', new Blob(['image-bytes'], { type: 'image/png' })))
    await putCustomTemplate({
      id: 'custom-1',
      name: '自定义',
      description: 'test',
      fields: [],
      body: '{{subject}}',
      builtin: false,
      createdAt: 1,
    })

    const exported = await createBackup()
    const text = await exported.blob.text()
    expect(exported.counts).toEqual({ tasks: 1, images: 1, customTemplates: 1, mangaProjects: 0 })
    expect(text).not.toContain('current-key')
    expect(text).not.toContain('current-text-key')

    const parsed = parseBackup(text)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    await restoreBackup(parsed.backup)

    const restoredTask = await getTask('t1')
    const restoredImage = await getImage('img-t1')
    expect(restoredTask?.status).toBe('completed')
    expect(await restoredImage?.blob?.text()).toBe('image-bytes')

    const appSettings = await getRawSettings()
    expect(appSettings?.baseUrl).toBe('http://current.example/v1')
    expect(appSettings?.apiKey).toBe('current-key')
    const mangaSettings = await getRawMangaSettings()
    expect(mangaSettings?.textApiKey).toBe('current-text-key')
  })
})
