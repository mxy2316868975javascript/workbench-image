/**
 * 漫画工作室容器：左栏项目列表（宽屏）+ 中栏步骤条（脚本创作 / 角色风格 / 分镜设计）。
 * 灯箱与漫画设置弹窗挂载于此；项目删除走主 store 的统一 ConfirmDialog。
 */
import { useEffect } from 'react'
import { BookOpen, Images, PanelLeftClose, PanelLeftOpen, Plus, ScrollText, Trash2, Users } from 'lucide-react'
import { mangaStore, useMangaStore } from '../../store/mangaStore'
import { store, useStore } from '../../store/store'
import { Button } from '../ui'
import { BlobImage } from './blob-image'
import { CharacterStep } from './CharacterStep'
import { MangaLightbox } from './MangaLightbox'
import { MangaSettingsDialog } from './MangaSettingsDialog'
import { ScriptStep } from './ScriptStep'
import { StoryboardStep } from './StoryboardStep'

const STEPS = [
  { id: 'script' as const, icon: ScrollText, label: '脚本创作' },
  { id: 'characters' as const, icon: Users, label: '角色风格' },
  { id: 'storyboard' as const, icon: Images, label: '分镜设计' },
]

export function MangaWorkspace() {
  const { loaded, projects, projectOrder, activeProjectId, activeStep } = useMangaStore()
  const { mangaLeftOpen } = useStore()

  // 挂载兜底触发初始化（幂等）：App 级 effect 在 HMR 局部更新时可能不重跑
  useEffect(() => {
    void mangaStore.init()
  }, [])

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-ink-3">正在打开漫画项目…</div>
    )
  }

  const project = activeProjectId ? projects[activeProjectId] : undefined

  return (
    <>
      <div className="flex h-full min-h-0 w-full">
        {/* 左栏：项目列表（宽屏），宽度过渡收起 */}
        <aside
          className={`hidden min-h-0 shrink-0 flex-col overflow-hidden bg-panel transition-[width] duration-300 ease-in-out lg:flex ${
            mangaLeftOpen ? 'w-[280px]' : 'w-0'
          }`}
        >
          <div className="flex h-full w-[280px] shrink-0 flex-col border-r border-line">
            <ProjectList />
          </div>
        </aside>

        {/* 中栏 */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* 窄屏项目切换条 */}
          <div className="flex shrink-0 items-center gap-2 border-b border-line bg-panel px-3 py-2 lg:hidden">
            <BookOpen className="h-4 w-4 shrink-0 text-accent" />
            <select
              value={activeProjectId ?? ''}
              onChange={(e) => mangaStore.setActiveProject(e.target.value)}
              className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-bg px-2 text-[13px] text-ink"
            >
              {projectOrder.length === 0 && <option value="">（无项目）</option>}
              {projectOrder.map((id) => (
                <option key={id} value={id}>
                  {projects[id].title}
                </option>
              ))}
            </select>
            <Button size="sm" onClick={() => mangaStore.createProject()}>
              <Plus className="h-3.5 w-3.5" /> 新建
            </Button>
          </div>

          {/* 步骤条：宽屏 tab 居中，窄屏页签互斥；宽屏左端带左栏收起切换 */}
          <div className="flex shrink-0 items-center border-b border-line bg-panel px-3">
            <button
              onClick={() => store.toggleMangaLeftPanel()}
              title={mangaLeftOpen ? '收起项目列表' : '展开项目列表'}
              className={`hidden h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors cursor-pointer lg:flex ${
                mangaLeftOpen ? 'text-accent hover:bg-accent-soft' : 'text-ink-3 hover:bg-hover hover:text-ink'
              }`}
            >
              {mangaLeftOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>
            {STEPS.map(({ id, icon: Icon, label }, i) => {
              const active = activeStep === id
              return (
                <button
                  key={id}
                  onClick={() => mangaStore.setActiveStep(id)}
                  className={`relative flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium transition-colors cursor-pointer ${
                    active ? 'text-accent' : 'text-ink-2 hover:text-ink'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {i < STEPS.length - 1 && <span className="ml-1 text-ink-3">→</span>}
                  {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />}
                </button>
              )
            })}
          </div>

          {/* 步骤内容 */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {!project ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-3">
                <BookOpen className="h-10 w-10 opacity-40" />
                <div className="text-sm">还没有漫画项目</div>
                <Button variant="primary" onClick={() => mangaStore.createProject()}>
                  <Plus className="h-4 w-4" /> 新建漫画项目
                </Button>
              </div>
            ) : (
              <>
                <div className={activeStep === 'script' ? 'block' : 'hidden'}>
                  <ScriptStep />
                </div>
                <div className={activeStep === 'characters' ? 'block' : 'hidden'}>
                  <CharacterStep />
                </div>
                <div className={activeStep === 'storyboard' ? 'block' : 'hidden'}>
                  <StoryboardStep />
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      <MangaLightbox />
      <MangaSettingsDialog />
    </>
  )
}

/** 项目列表（宽屏左栏）：新建 + 项目卡（标题 / 进度 / 删除） */
function ProjectList() {
  const { projects, projectOrder, activeProjectId } = useMangaStore()

  return (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-line px-3 py-2.5">
        <span className="text-xs font-semibold text-ink">漫画项目</span>
        <Button size="sm" onClick={() => mangaStore.createProject()}>
          <Plus className="h-3.5 w-3.5" /> 新建
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2.5">
        {projectOrder.map((id) => {
          const p = projects[id]
          const done = p.scenes.filter((s) => s.status === 'done').length
          const active = id === activeProjectId
          return (
            <div
              key={id}
              onClick={() => mangaStore.setActiveProject(id)}
              className={`group flex cursor-pointer items-center gap-2.5 rounded-xl border p-2.5 transition-colors ${
                active ? 'border-accent bg-accent-soft' : 'border-line bg-bg hover:border-accent'
              }`}
            >
              {/* 封面：第一张完成的分镜缩略图，没有则占位 */}
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-line bg-subtle">
                {p.scenes.find((s) => s.thumbBlob)?.thumbBlob ? (
                  <BlobImage blob={p.scenes.find((s) => s.thumbBlob)!.thumbBlob} alt={p.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <BookOpen className="h-4 w-4 text-ink-3" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <div className={`truncate text-[13px] font-medium ${active ? 'text-accent' : 'text-ink'}`}>{p.title}</div>
                <div className="truncate text-[11px] text-ink-3">
                  {p.characters.length} 角色 · {done}/{p.scenes.length} 格完成
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  store.requestConfirm({
                    title: '删除漫画项目',
                    message: `删除「${p.title}」？项目的角色、脚本与全部分镜图都会一并删除，不可恢复。`,
                    confirmText: '删除',
                    run: () => void mangaStore.deleteProject(id),
                  })
                }}
                title="删除项目"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-3 opacity-0 transition-opacity hover:bg-danger-soft hover:text-danger group-hover:opacity-100 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
        {projectOrder.length === 0 && (
          <div className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-ink-3">
            还没有项目，点击「新建」开始创作漫画。
          </div>
        )}
      </div>
    </>
  )
}
