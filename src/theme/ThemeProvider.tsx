/**
 * 主题：深 / 浅 / 跟随系统。localStorage 记忆，html 根元素切换 .dark。
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type ThemeMode = 'dark' | 'light' | 'system'

const STORAGE_KEY = 'image-workbench-theme'

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function resolve(mode: ThemeMode): 'dark' | 'light' {
  return mode === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : mode
}

const ThemeContext = createContext<{ mode: ThemeMode; resolved: 'dark' | 'light'; setMode: (m: ThemeMode) => void }>({
  mode: 'system',
  resolved: 'dark',
  setMode: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem(STORAGE_KEY) as ThemeMode) || 'dark'
  })
  const [resolved, setResolved] = useState<'dark' | 'light'>(() => resolve(mode))

  useEffect(() => {
    const apply = () => {
      const r = resolve(mode)
      setResolved(r)
      document.documentElement.classList.toggle('dark', r === 'dark')
    }
    apply()
    localStorage.setItem(STORAGE_KEY, mode)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    if (mode === 'system') {
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
  }, [mode])

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode: setModeState }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
