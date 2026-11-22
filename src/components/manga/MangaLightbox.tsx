/** 分镜灯箱：全屏查看单格大图，左右切换相邻格，Esc 关闭 */
import { useEffect } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { mangaStore, useMangaStore } from '../../store/mangaStore'
import { BlobImage } from './blob-image'

export function MangaLightbox() {
  const { lightbox, projects, activeProjectId } = useMangaStore()
  const project = activeProjectId ? projects[activeProjectId] : undefined

  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') mangaStore.closeLightbox()
      else if (e.key === 'ArrowLeft') mangaStore.lightboxNav(-1)
      else if (e.key === 'ArrowRight') mangaStore.lightboxNav(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  if (!lightbox || !project) return null
  const scene = project.scenes.find((s) => s.id === lightbox.sceneIds[lightbox.index])
  if (!scene) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/85" onClick={() => mangaStore.closeLightbox()}>
      {/* 顶部信息条 */}
      <div className="flex shrink-0 items-center justify-between px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="text-xs text-white/80">
          第 {project.scenes.findIndex((s) => s.id === scene.id) + 1} / {project.scenes.length} 格
          {scene.dialogue && <span className="ml-3">对白「{scene.dialogue}」</span>}
          {scene.narration && <span className="ml-3">旁白「{scene.narration}」</span>}
        </div>
        <button
          onClick={() => mangaStore.closeLightbox()}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white cursor-pointer"
          title="关闭（Esc）"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      {/* 大图 */}
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-4">
        <BlobImage
          blob={scene.imageBlob}
          alt={`分镜 ${lightbox.index + 1}`}
          className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
        />
      </div>
      {/* 左右切换 */}
      {lightbox.sceneIds.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation()
              mangaStore.lightboxNav(-1)
            }}
            className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 cursor-pointer"
            title="上一格（←）"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              mangaStore.lightboxNav(1)
            }}
            className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 cursor-pointer"
            title="下一格（→）"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}
    </div>
  )
}
