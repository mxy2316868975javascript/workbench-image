/** 删除类操作的统一确认弹窗（内容由 store.confirmRequest 驱动） */
import { Trash2 } from 'lucide-react'
import { store, useStore } from '../store/store'
import { Button, Modal } from './ui'

export function ConfirmDialog() {
  const { confirmRequest } = useStore()
  if (!confirmRequest) return null
  return (
    <Modal open onClose={() => store.cancelConfirm()} title={confirmRequest.title} width="max-w-md">
      <div className="space-y-4">
        <p className="text-[13px] leading-relaxed text-ink-2">{confirmRequest.message}</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => store.cancelConfirm()}>取消</Button>
          <Button variant="danger" autoFocus onClick={() => void store.acceptConfirm()}>
            <Trash2 className="h-3.5 w-3.5" />
            {confirmRequest.confirmText ?? '删除'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
