/** 全屏预览灯箱：缩放/平移、上下张导航、下载、复制提示词、元信息 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Download,
  Loader2,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { store, useStore } from '../store/store'
import type { ImageRecord } from '../lib/types'
import { downloadBlobAs, formatDuration } from '../lib/image-utils'

export function Lightbox() {
  const { lightbox, images } = useStore()
  const [full, setFull] = useState<ImageRecord | null>(null)
  const [url, setUrl] = useState<string>()
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [copied, setCopied] = useState(false)
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  const imageId = lightbox ? lightbox.imageIds[lightbox.index] : null

  // 加载完整图（含 Blob）
  useEffect(() => {
    if (!imageId) { setFull(null); setUrl(undefined); return }
    let revoked: string | undefined
    let alive = true
    setFull(null)
    setUrl(undefined)
    void (async () => {
      const rec = await store.getFullImage(imageId)
      if (!alive || !rec?.blob) return
      setFull(rec)
      const u = URL.createObjectURL(rec.blob)
      revoked = u
      setUrl(u)
    })()
    return () => {
      alive = false
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [imageId])

  // 每次切图重置视图
  useEffect(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }, [imageId])

  const onKey = useCallback((e: KeyboardEvent) => {
    if (!lightbox) return
    if (e.key === 'Escape') store.closeLightbox()
    if (e.key === 'ArrowLeft') store.lightboxNav(-1)
    if (e.key === 'ArrowRight') store.lightboxNav(1)
  }, [lightbox])

  useEffect(() => {
    if (!lightbox) return
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, onKey])

  if (!lightbox || !imageId) return null
  const meta = full ?? images[imageId]

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-sm" onMouseDown={() => store.closeLightbox()}>
      {/* 顶栏 */}
      <div className="flex h-12 shrink-0 items-center justify-between px-4 text-white/90" onMouseDown={(e) => e.stopPropagation()}>
        <span className="text-sm tabular-nums">
          {lightbox.index + 1} / {lightbox.imageIds.length}
        </span>
        <div className="flex items-center gap-1.5">
          <LbBtn title="缩小" onClick={() => setScale((s) => Math.max(0.2, s / 1.25))}><ZoomOut className="h-4 w-4" /></LbBtn>
          <span className="w-12 text-center text-xs tabular-nums">{Math.round(scale * 100)}%</span>
          <LbBtn title="放大" onClick={() => setScale((s) => Math.min(5, s * 1.25))}><ZoomIn className="h-4 w-4" /></LbBtn>
          <LbBtn title="重置" onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }) }}>
            <span className="px-1 text-xs">1:1</span>
          </LbBtn>
          <LbBtn title="关闭 (Esc)" onClick={() => store.closeLightbox()}><X className="h-4 w-4" /></LbBtn>
        </div>
      </div>

      {/* 图片区 */}
      <div
        className="relative min-h-0 flex-1 overflow-hidden"
        onMouseDown={(e) => {
          e.stopPropagation()
          dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
        }}
        onMouseMove={(e) => {
          if (!dragRef.current) return
          setOffset({
            x: dragRef.current.ox + (e.clientX - dragRef.current.x),
            y: dragRef.current.oy + (e.clientY - dragRef.current.y),
          })
        }}
        onMouseUp={() => (dragRef.current = null)}
        onMouseLeave={() => (dragRef.current = null)}
        onWheel={(e) => {
          e.preventDefault()
          setScale((s) => Math.min(5, Math.max(0.2, s * (e.deltaY < 0 ? 1.15 : 0.87))))
        }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transition: dragRef.current ? 'none' : 'transform 0.15s ease-out' }}
        >
          {url ? (
            <img
              src={url}
              alt={meta?.prompt ?? ''}
              className="max-h-full max-w-full rounded-lg shadow-2xl"
              draggable={false}
              style={{ cursor: scale > 1 ? 'grab' : 'default' }}
            />
          ) : (
            <Loader2 className="h-8 w-8 animate-spin text-white/60" />
          )}
        </div>

        {lightbox.imageIds.length > 1 && (
          <>
            <NavBtn side="left" onClick={() => store.lightboxNav(-1)}><ChevronLeft className="h-5 w-5" /></NavBtn>
            <NavBtn side="right" onClick={() => store.lightboxNav(1)}><ChevronRight className="h-5 w-5" /></NavBtn>
          </>
        )}
      </div>

      {/* 底部信息 */}
      <div
        className="max-h-32 shrink-0 overflow-y-auto border-t border-white/10 bg-black/60 px-4 py-2.5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {meta ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 flex-1 text-xs leading-relaxed text-white/85 break-words">{meta.prompt}</p>
              <div className="flex shrink-0 items-center gap-1.5">
                <LbBtn
                  title="复制提示词"
                  onClick={() => {
                    navigator.clipboard.writeText(meta.prompt).then(() => {
                      setCopied(true)
                      setTimeout(() => setCopied(false), 1200)
                    })
                  }}
                >
                  <span className="flex items-center gap-1 px-1 text-xs">
                    <ClipboardCopy className="h-3.5 w-3.5" /> {copied ? '已复制' : '复制'}
                  </span>
                </LbBtn>
                <LbBtn
                  title="下载原图"
                  onClick={async () => {
                    const rec = full ?? (await store.getFullImage(imageId))
                    if (rec?.blob) {
                      const ext = rec.mime?.split('/')[1] ?? 'png'
                      downloadBlobAs(rec.blob, `image-${imageId.slice(-6)}.${ext}`)
                    }
                  }}
                >
                  <span className="flex items-center gap-1 px-1 text-xs"><Download className="h-3.5 w-3.5" /> 下载</span>
                </LbBtn>
                <LbBtn
                  title="删除这张图片"
                  onClick={() => {
                    store.requestConfirm({
                      title: '删除图片',
                      message: '将永久删除这张图片，不可恢复。',
                      confirmText: '删除',
                      run: () => store.deleteImage(imageId),
                    })
                  }}
                >
                  <span className="flex items-center gap-1 px-1 text-xs"><Trash2 className="h-3.5 w-3.5" /> 删除</span>
                </LbBtn>
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-white/50 tabular-nums">
              {meta.width && <span>{meta.width}×{meta.height}</span>}
              {meta.durationMs && <span>耗时 {formatDuration(meta.durationMs)}</span>}
              {meta.usage && <span>tokens {meta.usage.total_tokens}（出图 {meta.usage.output_tokens}）</span>}
              {meta.revisedPrompt && meta.revisedPrompt !== meta.prompt && (
                <span className="max-w-[50%] truncate" title={meta.revisedPrompt}>改写：{meta.revisedPrompt}</span>
              )}
              <span className="uppercase">{meta.mime?.replace('image/', '')}</span>
            </div>
          </>
        ) : (
          <div className="h-5 text-xs text-white/40">加载元信息…</div>
        )}
      </div>
    </div>
  )
}

function LbBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-white/10 px-2 text-white/90 transition-colors hover:bg-white/20 cursor-pointer"
    >
      {children}
    </button>
  )
}

function NavBtn({ side, onClick, children }: { side: 'left' | 'right'; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white/90 backdrop-blur transition-colors hover:bg-white/25 cursor-pointer ${
        side === 'left' ? 'left-3' : 'right-3'
      }`}
    >
      {children}
    </button>
  )
}
