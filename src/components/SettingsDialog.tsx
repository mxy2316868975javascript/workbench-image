/** 设置对话框：端点 / 密钥 / 模型 / 默认参数 / 数据管理，全部仅存本浏览器 IndexedDB */
import { useEffect, useState } from 'react'
import { AlertTriangle, Eye, EyeOff, PlugZap, Trash2 } from 'lucide-react'
import { store, useStore } from '../store/store'
import { FALLBACK_SETTINGS } from '../lib/db'
import {
  BACKGROUND_OPTIONS,
  FORMAT_OPTIONS,
  QUALITY_OPTIONS,
  SIZE_OPTIONS,
  type Settings,
} from '../lib/types'
import { Button, Field, Modal, Select } from './ui'

type TestState = { status: 'idle' | 'testing' | 'ok' | 'error'; message?: string }

export function SettingsDialog() {
  const { settingsOpen, settings, taskOrder, images, storageUsage } = useStore()
  const [draft, setDraft] = useState<Settings>(settings)
  const [showKey, setShowKey] = useState(false)
  const [test, setTest] = useState<TestState>({ status: 'idle' })
  const [clearOpen, setClearOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [clearing, setClearing] = useState(false)

  // 每次打开时同步当前设置
  useEffect(() => {
    if (settingsOpen) {
      setDraft(settings)
      setTest({ status: 'idle' })
    }
  }, [settingsOpen, settings])

  if (!settingsOpen) return null

  const save = () => void store.updateSettings(draft)

  const testConnection = async () => {
    setTest({ status: 'testing' })
    try {
      const base = draft.baseUrl.replace(/\/+$/, '')
      const res = await fetch(`${base}/models`, {
        headers: draft.apiKey ? { Authorization: `Bearer ${draft.apiKey}` } : undefined,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const ids: string[] = (json?.data ?? []).map((m: any) => m.id).filter(Boolean)
      setTest({ status: 'ok', message: ids.length ? `连接正常，可用模型：${ids.join('、')}` : '连接正常' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setTest({ status: 'error', message: `连接失败：${msg}` })
    }
  }

  return (
    <>
      <Modal open={settingsOpen} onClose={() => store.closeSettings()} title="设置" width="max-w-xl">
      <div className="space-y-4">
        <div className="rounded-lg bg-accent-soft px-3 py-2 text-xs leading-relaxed text-accent">
          所有配置（含密钥）仅保存在本浏览器的 IndexedDB 中，不经过任何后端存储。默认端点通过本地转发访问以绕过 CORS。
        </div>

        <Field label="API 端点 (Base URL)" hint="默认走本地转发 /api/relay/v1">
          <input
            value={draft.baseUrl}
            onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
            placeholder="/api/relay/v1 或 https://api.example.com/v1"
            className="h-9 w-full px-3 text-[13px]"
          />
        </Field>

        <Field label="API Key" hint="仅存本地">
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={draft.apiKey}
              onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
              placeholder="sk-…"
              className="h-9 w-full px-3 pr-9 text-[13px]"
            />
            <button
              onClick={() => setShowKey((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink cursor-pointer"
              title={showKey ? '隐藏' : '显示'}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <Field label="模型">
          <input
            value={draft.model}
            onChange={(e) => setDraft({ ...draft, model: e.target.value })}
            placeholder="gpt-image-1"
            className="h-9 w-full px-3 text-[13px]"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="默认尺寸">
            <Select
              value={draft.defaultParams.size}
              options={SIZE_OPTIONS}
              onChange={(v) => setDraft({ ...draft, defaultParams: { ...draft.defaultParams, size: v } })}
            />
          </Field>
          <Field label="默认质量">
            <Select
              value={draft.defaultParams.quality}
              options={QUALITY_OPTIONS}
              onChange={(v) => setDraft({ ...draft, defaultParams: { ...draft.defaultParams, quality: v } })}
            />
          </Field>
          <Field label="默认背景">
            <Select
              value={draft.defaultParams.background}
              options={BACKGROUND_OPTIONS}
              onChange={(v) => setDraft({ ...draft, defaultParams: { ...draft.defaultParams, background: v } })}
            />
          </Field>
          <Field label="默认格式">
            <Select
              value={draft.defaultParams.output_format}
              options={FORMAT_OPTIONS}
              onChange={(v) => setDraft({ ...draft, defaultParams: { ...draft.defaultParams, output_format: v } })}
            />
          </Field>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink">
          <input
            type="checkbox"
            checked={draft.autoRetry}
            onChange={(e) => setDraft({ ...draft, autoRetry: e.target.checked })}
            className="accent-[var(--accent)]"
          />
          失败后自动重试一次（间隔 1.5 秒）
        </label>

        {/* 连接测试 */}
        <div className="flex items-center gap-2">
          <Button variant="default" onClick={testConnection} disabled={test.status === 'testing'}>
            <PlugZap className="h-4 w-4" />
            {test.status === 'testing' ? '测试中…' : '测试连接'}
          </Button>
          {test.status === 'ok' && <span className="text-xs text-success">{test.message}</span>}
          {test.status === 'error' && <span className="text-xs text-danger break-all">{test.message}</span>}
        </div>

        {/* 数据管理 */}
        <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
          <div className="min-w-0 text-[11px] leading-5 text-ink-3">
            <div className="text-[13px] font-medium text-ink">数据管理</div>
            <div className="mt-0.5">
              已存 {taskOrder.length} 个任务 / {Object.keys(images).length} 张图片
              {storageUsage ? `（${(storageUsage.usage / 1024 / 1024).toFixed(1)} MB）` : ''}
            </div>
            <div>清空后设置与密钥保留，任务与图片不可恢复</div>
          </div>
          <Button
            variant="danger"
            size="sm"
            className="shrink-0 self-center"
            disabled={taskOrder.length === 0}
            onClick={() => {
              setConfirmText('')
              setClearOpen(true)
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> 清空数据库
          </Button>
        </div>

        <div className="flex items-center justify-between border-t border-line pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDraft({ ...FALLBACK_SETTINGS, apiKey: '', baseUrl: FALLBACK_SETTINGS.baseUrl, model: FALLBACK_SETTINGS.model })}
          >
            重置为默认
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => store.closeSettings()}>取消</Button>
            <Button variant="primary" onClick={save} disabled={!draft.baseUrl || !draft.apiKey}>保存</Button>
          </div>
        </div>
      </div>
    </Modal>

    {/* 清空数据库二次确认：需输入「清空」才能执行 */}
    <Modal open={clearOpen} onClose={() => setClearOpen(false)} title="确认清空数据库" width="max-w-md">
      <div className="space-y-3">
        <div className="flex gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-xs leading-relaxed text-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            将永久删除全部任务与图片（当前 {taskOrder.length} 个任务 / {Object.keys(images).length} 张图片），
            此操作不可恢复。设置与 API 密钥会保留。
          </span>
        </div>
        <Field label="安全确认" hint={`输入「清空」以启用按钮`}>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="清空"
            className="h-9 w-full px-3 text-[13px]"
            autoFocus
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setClearOpen(false)}>取消</Button>
          <Button
            variant="danger"
            disabled={confirmText !== '清空' || clearing}
            onClick={async () => {
              setClearing(true)
              try {
                await store.clearDatabase()
                setClearOpen(false)
                store.closeSettings()
              } finally {
                setClearing(false)
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> {clearing ? '清空中…' : '确认清空'}
          </Button>
        </div>
      </div>
      </Modal>
    </>
  )
}
