/** 顶栏：工作区切换、左右栏开关、存储用量、主题切换、设置入口 */
import {
  BookOpen,
  Database,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Settings,
  Sun,
  SunMoon,
  Wand2,
} from 'lucide-react'
import { store, useStore } from '../store/store'
import { mangaStore, useMangaStore } from '../store/mangaStore'
import { useTheme, type ThemeMode } from '../theme/ThemeProvider'
import { formatBytes } from '../lib/image-utils'

const THEME_OPTIONS: Array<{ mode: ThemeMode; icon: typeof Sun; title: string }> = [
  { mode: 'dark', icon: Moon, title: '深色' },
  { mode: 'light', icon: Sun, title: '浅色' },
  { mode: 'system', icon: SunMoon, title: '跟随系统' },
]

const WORKSPACES = [
  { id: 'image' as const, icon: Wand2, label: '生图' },
  { id: 'manga' as const, icon: BookOpen, label: '漫画' },
]

export function TopBar() {
  const { settings, storageUsage, settingsOpen, historyOpen, leftOpen, workspace } = useStore()
  const { activeProjectId, projects, loaded: mangaLoaded, mangaSettingsOpen } = useMangaStore()
  const { mode, setMode } = useTheme()
  const activeProject = activeProjectId ? projects[activeProjectId] : undefined

  return (
    <header className="flex h-13 shrink-0 items-center justify-between border-b border-line bg-panel px-4">
      <div className="flex items-center gap-2.5">
        {/* 左栏切换（仅生图工作台有三栏面板；漫画工作台自带项目栏，隐藏该按钮） */}
        <button
          onClick={() => store.toggleLeftPanel()}
          title={leftOpen ? '收起生成面板' : '展开生成面板'}
          className={`${workspace === 'image' ? 'lg:flex' : 'hidden'} hidden h-9 w-9 items-center justify-center rounded-lg border border-line transition-colors cursor-pointer ${
            leftOpen ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-hover hover:text-ink'
          }`}
        >
          {leftOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </button>

        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">
          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="9" cy="9" r="2" />
            <path d="M21 15l-4.5-5.5L10 16l-2.5-3L3 18" />
          </svg>
        </div>

        {/* 工作区切换：生图工作台 / 漫画工作室 */}
        <div className="flex rounded-lg border border-line p-0.5">
          {WORKSPACES.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => store.setWorkspace(id)}
              title={id === 'manga' ? '漫画工作室' : '生图工作台'}
              className={`flex h-7.5 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors cursor-pointer ${
                workspace === id ? 'bg-accent-soft text-accent' : 'text-ink-3 hover:text-ink'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        <div className="hidden min-w-0 leading-tight sm:block">
          <div className="truncate text-[13px] font-medium text-ink">
            {workspace === 'manga'
              ? activeProject?.title ?? (mangaLoaded ? '未选择项目' : '…')
              : '生图工作台'}
          </div>
          <div className="truncate text-[11px] text-ink-3">
            {workspace === 'manga'
              ? `${activeProject?.scenes.length ?? 0} 格 · 数据仅存本浏览器`
              : `${settings.model} · 数据仅存本浏览器`}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div
          className="hidden items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink-2 sm:flex"
          title={storageUsage ? `已用 ${formatBytes(storageUsage.usage)} / 配额约 ${formatBytes(storageUsage.quota)}` : 'IndexedDB 存储用量'}
        >
          <Database className="h-3.5 w-3.5" />
          {storageUsage ? formatBytes(storageUsage.usage) : '…'}
        </div>

        <div className="flex rounded-lg border border-line p-0.5">
          {THEME_OPTIONS.map(({ mode: m, icon: Icon, title }) => (
            <button
              key={m}
              title={title}
              onClick={() => setMode(m)}
              className={`flex h-7 w-8 items-center justify-center rounded-md transition-colors cursor-pointer ${
                mode === m ? 'bg-accent-soft text-accent' : 'text-ink-3 hover:text-ink'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>

        <button
          onClick={() => store.toggleHistoryPanel()}
          title={historyOpen ? '收起历史记录' : '展开历史记录'}
          className={`${workspace === 'image' ? 'flex' : 'hidden'} h-9 w-9 items-center justify-center rounded-lg border border-line transition-colors cursor-pointer ${
            historyOpen ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-hover hover:text-ink'
          }`}
        >
          {historyOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
        </button>

        <button
          onClick={() => (workspace === 'manga' ? mangaStore.openMangaSettings() : store.openSettings())}
          title={workspace === 'manga' ? '漫画设置' : '设置'}
          className={`flex h-9 w-9 items-center justify-center rounded-lg border border-line transition-colors cursor-pointer ${
            settingsOpen || (workspace === 'manga' && mangaSettingsOpen) ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-hover hover:text-ink'
          }`}
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
