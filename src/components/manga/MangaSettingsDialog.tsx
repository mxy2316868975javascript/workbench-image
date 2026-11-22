/** 漫画设置弹窗：脚本创作的文本端点三件套（地址 / 密钥 / 模型），与生图端点解耦 */
import { useState } from 'react'
import { mangaStore, useMangaStore } from '../../store/mangaStore'
import type { MangaSettings } from '../../lib/types'
import { Button, Field, Modal } from '../ui'

export function MangaSettingsDialog() {
  const { mangaSettingsOpen, mangaSettings } = useMangaStore()
  const [draft, setDraft] = useState<MangaSettings>(mangaSettings)

  // 打开时同步当前设置
  if (mangaSettingsOpen && draft !== mangaSettings) setDraft(mangaSettings)

  return (
    <Modal open={mangaSettingsOpen} onClose={() => mangaStore.closeMangaSettings()} title="漫画设置">
      <div className="flex flex-col gap-4">
        <Field label="文本端点" hint="脚本创作走这里的对话接口（chat/completions）">
          <input
            value={draft.textBaseUrl}
            onChange={(e) => setDraft({ ...draft, textBaseUrl: e.target.value })}
            placeholder="如 https://api.example.com/v1"
            className="p-2.5 text-[13px]"
          />
        </Field>
        <Field label="文本端点密钥">
          <input
            type="password"
            value={draft.textApiKey}
            onChange={(e) => setDraft({ ...draft, textApiKey: e.target.value })}
            placeholder="sk-…（仅存本浏览器 IndexedDB）"
            className="p-2.5 text-[13px]"
          />
        </Field>
        <Field label="文本模型" hint="支持 JSON 输出的对话模型">
          <input
            value={draft.textModel}
            onChange={(e) => setDraft({ ...draft, textModel: e.target.value })}
            placeholder="如 gpt-4o-mini"
            className="p-2.5 text-[13px]"
          />
        </Field>
        <div className="rounded-lg bg-subtle px-3 py-2.5 text-xs leading-relaxed text-ink-2">
          脚本创作使用上方独立的文本端点；<span className="font-medium text-ink">分镜与设定表的生图</span>
          仍走生图工作台设置里的端点与模型。若对话接口不可用，脚本可手动编写，不影响生图。
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={() => mangaStore.closeMangaSettings()}>取消</Button>
          <Button variant="primary" onClick={() => void mangaStore.updateMangaSettings(draft)}>
            保存
          </Button>
        </div>
      </div>
    </Modal>
  )
}
