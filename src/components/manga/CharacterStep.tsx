/**
 * 角色风格控制：全局画风（预设 + 自定义补充 + 彩色/黑白）+ 角色卡
 * 角色卡：名称 / 外观描述 / 参考图上传（最多 4 张）→ AI 生成六宫格设定表
 */
import { useRef, useState } from 'react'
import { ImagePlus, Loader2, RefreshCw, Trash2, X } from 'lucide-react'
import { mangaStore, useMangaStore } from '../../store/mangaStore'
import { store } from '../../store/store'
import { STYLE_PRESETS } from '../../lib/types'
import type { MangaCharacter } from '../../lib/types'
import { Badge, Button, Field, Select } from '../ui'
import { BlobImage } from './blob-image'

const MAX_REFS = 4
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp']

function normalizeFiles(files: FileList | File[] | DataTransferItemList): Blob[] {
  const out: Blob[] = []
  const list = Array.from(files as ArrayLike<File>)
  for (const f of list) {
    if (ACCEPTED.includes(f.type) && out.length < MAX_REFS) out.push(f)
  }
  return out
}

export function CharacterStep() {
  const { activeProjectId, projects } = useMangaStore()
  const project = activeProjectId ? projects[activeProjectId] : undefined
  if (!project) return null

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      {/* 全局画风卡 */}
      <div className="rounded-xl border border-line bg-panel p-4">
        <div className="mb-3 text-xs font-medium text-ink-2">全局画风 · 锁定全部角色的绘制风格</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="画风预设">
            <Select
              value={project.styleId}
              options={STYLE_PRESETS.map((p) => ({ value: p.id, label: p.name }))}
              onChange={(v) => mangaStore.updateProjectText(project.id, { styleId: v })}
            />
          </Field>
          <Field label="色彩模式">
            <div className="flex rounded-lg border border-line p-0.5">
              {(
                [
                  { id: 'color', label: '彩色' },
                  { id: 'monochrome', label: '黑白（网点）' },
                ] as const
              ).map((o) => (
                <button
                  key={o.id}
                  onClick={() => mangaStore.updateProjectText(project.id, { colorMode: o.id })}
                  className={`flex h-9 flex-1 items-center justify-center rounded-md text-[13px] transition-colors cursor-pointer ${
                    project.colorMode === o.id ? 'bg-accent-soft text-accent' : 'text-ink-3 hover:text-ink'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <div className="mt-3">
          <Field label="自定义风格补充" hint="追加到画风描述，如「赛博朋克霓虹色调」">
            <input
              value={project.customStyle ?? ''}
              onChange={(e) => mangaStore.updateProjectText(project.id, { customStyle: e.target.value || undefined })}
              placeholder="英文效果更好，如 cyberpunk neon palette, rainy city"
              className="p-2.5 text-[13px]"
            />
          </Field>
        </div>
      </div>

      {/* 角色列表 */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-2">角色 · {project.characters.length}</span>
        <Button size="sm" onClick={() => mangaStore.addCharacter()}>
          添加角色
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {project.characters.map((c) => (
          <CharacterCard key={c.id} character={c} />
        ))}
        {project.characters.length === 0 && (
          <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-xs text-ink-3">
            还没有角色。点击「添加角色」，填写外观设定并生成设定表；设定表会作为分镜生成的参考图锁定外观。
          </div>
        )}
      </div>
    </div>
  )
}

/** 单个角色卡：设定表缩略图 + 名称 / 描述 / 参考图 / 生成按钮 */
function CharacterCard({ character }: { character: MangaCharacter }) {
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const refUrls = character.refBlobs ?? []

  const addRefs = (blobs: Blob[]) => {
    const merged = [...refUrls, ...blobs].slice(0, MAX_REFS)
    mangaStore.updateCharacter(character.id, { refBlobs: merged })
  }

  return (
    <div
      className="rounded-xl border border-line bg-panel p-3"
      onDragOver={(e) => {
        e.preventDefault()
        if (e.dataTransfer.types.includes('Files')) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        const blobs = normalizeFiles(e.dataTransfer.files)
        if (blobs.length) addRefs(blobs)
      }}
    >
      <div className="flex gap-3">
        {/* 设定表缩略图 / 生成态 */}
        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-lg border border-line bg-subtle">
          {character.status === 'generating' ? (
            <div className="shimmer absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
            </div>
          ) : character.sheetBlob ? (
            <BlobImage blob={character.sheetThumb ?? character.sheetBlob} alt={character.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-[11px] leading-tight text-ink-3">
              {character.status === 'failed' ? (
                <span className="px-2 text-center text-danger">{character.error ?? '生成失败'}</span>
              ) : (
                '尚未生成设定表'
              )}
            </div>
          )}
        </div>

        {/* 名称 + 描述 */}
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <input
              value={character.name}
              onChange={(e) => mangaStore.updateCharacter(character.id, { name: e.target.value })}
              placeholder="角色名"
              className="h-8 flex-1 p-2 text-[13px] font-medium"
            />
            <div className="flex items-center gap-0.5">
              {character.status === 'done' && <Badge tone="success">已锁定</Badge>}
              {character.status === 'failed' && <Badge tone="danger">失败</Badge>}
              <button
                onClick={() => mangaStore.generateCharacterSheet(character.id)}
                disabled={character.status === 'generating'}
                title={character.sheetBlob ? '重新生成设定表' : '生成设定表'}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-accent-soft px-2.5 text-xs font-medium text-accent transition-colors hover:bg-accent hover:text-white disabled:opacity-45 cursor-pointer"
              >
                {character.status === 'generating' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {character.sheetBlob ? '重生成' : '生成设定表'}
              </button>
              {character.status === 'generating' ? (
                <button
                  onClick={() => mangaStore.cancelCharacterSheet(character.id)}
                  title="取消"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-3 hover:text-danger cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  onClick={() =>
                    store.requestConfirm({
                      title: '删除角色',
                      message: `删除角色「${character.name}」？相关分镜格会同步摘除该角色。`,
                      confirmText: '删除',
                      run: () => mangaStore.removeCharacter(character.id),
                    })
                  }
                  title="删除角色"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-3 hover:bg-danger-soft hover:text-danger cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <textarea
            value={character.description}
            onChange={(e) => mangaStore.updateCharacter(character.id, { description: e.target.value })}
            placeholder="外观设定：发色发型、瞳色、服装、体格、气质…（越具体设定表越准）"
            className="min-h-16 w-full resize-y p-2.5 text-[13px] leading-relaxed placeholder:text-ink-3"
          />
        </div>
      </div>

      {/* 参考图上传行 */}
      <div className="mt-2.5 flex items-center gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          className={`flex shrink-0 items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs transition-colors cursor-pointer ${
            dragging ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-3 hover:border-accent hover:text-accent'
          }`}
        >
          <ImagePlus className="h-3.5 w-3.5" />
          {dragging ? '松手添加' : '参考图（可选，最多 4 张）'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED.join(',')}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addRefs(normalizeFiles(e.target.files))
            e.target.value = ''
          }}
        />
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
          {refUrls.map((blob, i) => (
            <div key={i} className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md border border-line">
              <BlobImage blob={blob} alt={`参考图 ${i + 1}`} className="h-full w-full object-cover" />
              <button
                onClick={() =>
                  mangaStore.updateCharacter(character.id, { refBlobs: refUrls.filter((_, j) => j !== i) })
                }
                className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-bl-md bg-black/60 text-white hover:bg-danger cursor-pointer"
                title="移除"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
