import { useEffect, useState } from 'react'
import { Images, Wand2 } from 'lucide-react'
import { store, useStore } from './store/store'
import { mangaStore } from './store/mangaStore'
import { ThemeProvider } from './theme/ThemeProvider'
import { TopBar } from './components/TopBar'
import { PromptPanel } from './components/PromptPanel'
import { TaskBoard } from './components/TaskBoard'
import { LogConsole } from './components/LogConsole'
import { HistoryPanel } from './components/HistoryPanel'
import { Lightbox } from './components/Lightbox'
import { SettingsDialog } from './components/SettingsDialog'
import { ConfirmDialog } from './components/ConfirmDialog'
import { TemplateDialog } from './components/TemplateDialog'
import { MangaWorkspace } from './components/manga/MangaWorkspace'

export default function App() {
  const { settingsLoaded, historyOpen, leftOpen, narrowView, tasks, taskOrder, workspace } = useStore()

  const [slowOpen, setSlowOpen] = useState(false)

  useEffect(() => {
    void store.init()
    void mangaStore.init()
  }, [])

  // 数据库升级被其他标签页占用时，给出可操作的提示，而不是一直停在加载态
  useEffect(() => {
    if (settingsLoaded) return
    const timer = window.setTimeout(() => setSlowOpen(true), 6000)
    return () => window.clearTimeout(timer)
  }, [settingsLoaded])

  // 窄屏页签：看板上是否有进行中的任务（角标提示）
  const runningCount = taskOrder.filter((id) => tasks[id]?.status === 'running').length

  if (!settingsLoaded) {
    return (
      <ThemeProvider>
        <div className="flex h-full flex-col items-center justify-center gap-1.5 bg-bg text-sm text-ink-3">
          <span>正在打开本地数据库…</span>
          {slowOpen && (
            <span className="text-xs text-ink-3">
              如果长时间停在这里，请关闭其他打开本应用的标签页后刷新。
            </span>
          )}
        </div>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider>
      <div className="grid h-full grid-rows-[auto_1fr_auto] overflow-hidden">
        <TopBar />
        {/* 窄屏页签（生成 / 看板），面板全高互斥显示，避免挤压重叠；仅生图工作台显示 */}
        <div className={`shrink-0 border-b border-line bg-panel lg:hidden ${workspace === 'image' ? 'flex' : 'hidden'}`}>
          <button
            onClick={() => store.setNarrowView('generate')}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[13px] font-medium transition-colors cursor-pointer ${
              narrowView === 'generate' ? 'border-b-2 border-accent text-accent' : 'text-ink-2 hover:text-ink'
            }`}
          >
            <Wand2 className="h-4 w-4" /> 生成
          </button>
          <button
            onClick={() => store.setNarrowView('board')}
            className={`relative flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[13px] font-medium transition-colors cursor-pointer ${
              narrowView === 'board' ? 'border-b-2 border-accent text-accent' : 'text-ink-2 hover:text-ink'
            }`}
          >
            <Images className="h-4 w-4" /> 看板
            {runningCount > 0 && (
              <span className="absolute right-1/2 translate-x-[42px] flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
                {runningCount}
              </span>
            )}
          </button>
        </div>
        <main className="flex min-h-0 flex-col overflow-hidden lg:flex-row">
          {/* 漫画工作室：与生图三栏互斥显示，保持挂载以保留草稿与滚动位置 */}
          <div className={`h-full min-h-0 w-full flex-col ${workspace === 'manga' ? 'flex' : 'hidden'}`}>
            <MangaWorkspace />
          </div>
          {/* 生成面板：宽屏常驻左栏，窄屏为「生成」页签页；保持挂载以保留草稿。
              收起时用宽度过渡而不是 display 切换，内层固定宽度防止内容在动画中回流。 */}
          <div
            className={`min-h-0 h-full w-full flex-col transition-[width] duration-300 ease-in-out lg:h-full lg:shrink-0 lg:overflow-hidden ${
              workspace === 'image' && narrowView === 'generate' ? 'flex' : 'hidden'
            } ${
              workspace === 'image'
                ? `lg:flex ${leftOpen ? 'lg:w-[300px] xl:w-[320px]' : 'lg:w-0'}`
                : 'lg:hidden'
            }`}
          >
            <div className="h-full w-full shrink-0 lg:w-[300px] xl:w-[320px]">
              <PromptPanel />
            </div>
          </div>
          {/* 任务看板：宽屏常驻中间，窄屏为「看板」页签页；仅生图工作台显示 */}
          <div
            className={`min-h-0 min-w-0 flex-1 border-t border-line lg:border-t-0 ${
              workspace === 'image'
                ? `${narrowView === 'board' ? 'block' : 'hidden'} lg:block`
                : 'hidden'
            }`}
          >
            <TaskBoard />
          </div>
          {/* 右栏（历史）：宽度过渡收起，内容靠右锚定；内层 shrink-0 防止 flex 压缩内容 */}
          <div
            className={`${workspace === 'image' ? 'xl:flex' : 'xl:hidden'} hidden min-h-0 shrink-0 justify-end overflow-hidden transition-[width] duration-300 ease-in-out ${
              historyOpen ? 'w-[340px]' : 'w-0'
            }`}
          >
            <div className="h-full w-[340px] shrink-0">
              <HistoryPanel />
            </div>
          </div>
        </main>
        <LogConsole />

        {/* 窄屏历史抽屉（仅生图工作台） */}
        <div
          className={`fixed inset-0 z-40 bg-black/40 transition-opacity xl:hidden ${
            workspace === 'image' && historyOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          onClick={() => store.toggleHistoryPanel(false)}
        />
        <div
          className={`fixed bottom-9 right-0 top-13 z-[45] w-86 max-w-[92vw] shadow-2xl transition-transform duration-200 xl:hidden ${
            workspace === 'image' && historyOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <HistoryPanel />
        </div>

        <Lightbox />
        <SettingsDialog />
        <TemplateDialog />
        <ConfirmDialog />
      </div>
    </ThemeProvider>
  )
}
