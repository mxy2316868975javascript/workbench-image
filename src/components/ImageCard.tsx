/** 单张图片卡片：流式进度、状态、操作；批量管理模式下点击整卡切换选中 */
import { memo, useEffect, useState } from 'react'
import {
  AlertCircle,
  Ban,
  Download,
  RotateCcw,
  ScrollText,
  Loader2,
  Maximize2,
  Trash2,
  Check as CheckIcon,
} from 'lucide-react'
import type { ImageRecord } from '../lib/types'
import { store } from '../store/store'
import { downloadBlobAs, formatDuration } from '../lib/image-utils'

const ASPECT: Record<string, string> = {
  '1024x1024': 'aspect-square',
  '1024x1536': 'aspect-[2/3]',
  '1536x1024': 'aspect-[3/2]',
}

export const ImageCard = memo(function ImageCard({
  image,
  index,
  selectionMode = false,
  selected = false,
  onToggleSelect,
  onPreview,
  onShowLog,
}: {
  image: ImageRecord
  index: number
  selectionMode?: boolean
  selected?: boolean
  onToggleSelect?: () => void
  onPreview: () => void
  onShowLog: () => void
}) {
  const aspect = ASPECT[image.params.size] ?? 'aspect-square'
  const running = image.status === 'generating' || image.status === 'downloading'

  const confirmDelete = () => {
    store.requestConfirm({
      title: '删除图片',
      message: '将永久删除这张图片，不可恢复。',
      confirmText: '删除',
      run: () => store.deleteImage(image.id),
    })
  }

  return (
    <div
      onClick={selectionMode ? onToggleSelect : undefined}
      className={`group relative overflow-hidden rounded-xl border bg-panel shadow-[var(--shadow)] transition-shadow ${
        selected ? 'border-accent ring-2 ring-accent/40' : 'border-line'
      } hover:shadow-lg ${selectionMode ? 'cursor-pointer' : ''}`}
    >
      <div className={`relative ${aspect} w-full ${running ? 'shimmer' : image.status === 'failed' ? 'bg-danger-soft' : image.status === 'pending' || image.status === 'cancelled' ? 'bg-subtle' : ''}`}>
        {image.status === 'done' ? <DoneBody image={image} selectionMode={selectionMode} onPreview={onPreview} /> : null}
        {image.status === 'pending' ? <PendingBody image={image} /> : null}
        {running ? <RunningBody image={image} selectionMode={selectionMode} /> : null}
        {image.status === 'failed' ? <FailedBody image={image} /> : null}
        {image.status === 'cancelled' ? <CancelledBody /> : null}

        {/* 批量选择勾选框 */}
        {selectionMode && (
          <span className="absolute left-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 p-1 backdrop-blur">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                selected ? 'border-accent bg-accent text-white' : 'border-white/70 bg-transparent text-transparent'
              }`}
            >
              <CheckIcon className="h-3.5 w-3.5" />
            </span>
          </span>
        )}
      </div>

      {/* 底部信息条 */}
      <div className="flex items-center justify-between gap-2 px-2.5 py-2">
        <span className="text-[11px] font-medium text-ink-3">
          #{index}
          {selectionMode && selected ? <span className="ml-1 text-accent">已选</span> : null}
        </span>
        {!selectionMode && (
          <div className="flex items-center gap-1">
            {image.status === 'done' && (
              <>
                <CardBtn title="查看日志" onClick={onShowLog}><ScrollText className="h-3.5 w-3.5" /></CardBtn>
                <CardBtn
                  title="下载"
                  onClick={async () => {
                    const full = await store.getFullImage(image.id)
                    if (full?.blob) {
                      const ext = full.mime?.split('/')[1] ?? 'png'
                      downloadBlobAs(full.blob, `image-${image.id.slice(-6)}.${ext}`)
                    }
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                </CardBtn>
                <CardBtn title="删除" onClick={confirmDelete}>
                  <Trash2 className="h-3.5 w-3.5" />
                </CardBtn>
              </>
            )}
            {(image.status === 'failed' || image.status === 'cancelled') && (
              <>
                <CardBtn title="重试" onClick={() => store.retryImage(image.id)}>
                  <RotateCcw className="h-3.5 w-3.5" />
                </CardBtn>
                <CardBtn title="删除" onClick={confirmDelete}>
                  <Trash2 className="h-3.5 w-3.5" />
                </CardBtn>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
})

function CardBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="flex h-7 w-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-hover hover:text-ink cursor-pointer"
    >
      {children}
    </button>
  )
}

/* ---------------- 各状态主体 ---------------- */

function DoneBody({
  image,
  selectionMode,
  onPreview,
}: {
  image: ImageRecord
  selectionMode: boolean
  onPreview: () => void
}) {
  const [url, setUrl] = useState<string>()

  useEffect(() => {
    if (!image.thumbBlob) return
    const u = URL.createObjectURL(image.thumbBlob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [image.thumbBlob])

  return (
    <>
      {url && <img src={url} alt={image.prompt} className="h-full w-full object-cover" draggable={false} />}
      {/* 整卡可点预览（批量选择模式下整卡用于切换选中，不显示预览遮罩） */}
      {!selectionMode && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onPreview()
          }}
          className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all hover:bg-black/30 hover:opacity-100 cursor-zoom-in"
          title="预览大图"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-neutral-800 shadow-lg">
            <Maximize2 className="h-4.5 w-4.5" />
          </span>
        </button>
      )}
      {image.width && !selectionMode && (
        <span className="absolute left-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {image.width}×{image.height}
        </span>
      )}
    </>
  )
}

function PendingBody({ image }: { image: ImageRecord }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-3">
      <Loader2 className="h-5 w-5 animate-spin" />
      <div className="text-xs">{image.phase || '排队中'}</div>
      {image.retryCount > 0 && (
        <div className="text-[10px] text-warn">第 {image.retryCount} 次重试</div>
      )}
    </div>
  )
}

function RunningBody({ image, selectionMode }: { image: ImageRecord; selectionMode: boolean }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const start = Date.now() - (image.durationMs ?? 0)
    const t = setInterval(() => setElapsed(Date.now() - start), 200)
    return () => clearInterval(t)
  }, [image.durationMs])

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
      <div className="text-3xl font-bold tabular-nums text-ink">{image.progress}%</div>
      <div className="flex items-center gap-1.5 text-xs text-ink-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {image.phase}
      </div>
      <div className="text-[11px] tabular-nums text-ink-3">{formatDuration(elapsed)}</div>
      {/* 进度条 */}
      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/10">
        <div
          className="h-full bg-accent transition-[width] duration-300 ease-out"
          style={{ width: `${image.progress}%` }}
        />
      </div>
      {/* 取消 */}
      {!selectionMode && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            store.cancelImage(image.id)
          }}
          title="取消"
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md bg-black/40 text-white/90 backdrop-blur transition-colors hover:bg-danger cursor-pointer"
        >
          <Ban className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

function FailedBody({ image }: { image: ImageRecord }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
      <AlertCircle className="h-6 w-6 text-danger" />
      <div className="text-xs font-medium text-danger">生成失败</div>
      <div className="max-h-16 overflow-y-auto text-[11px] leading-snug text-ink-2 break-all">
        {image.error || '未知错误'}
      </div>
    </div>
  )
}

function CancelledBody() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 text-ink-3">
      <Ban className="h-5 w-5" />
      <div className="text-xs">已取消</div>
    </div>
  )
}
