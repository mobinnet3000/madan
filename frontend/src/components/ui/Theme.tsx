import { useLayoutEffect, useState, type ReactNode, createContext, useContext, useCallback } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme: Theme
  resolved: 'light' | 'dark'
  toggleTheme: () => void
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function getSystemPref(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as Theme) ?? 'system'
    }
    return 'system'
  })
  const [system, setSystem] = useState<'light' | 'dark'>(getSystemPref)

  useLayoutEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setSystem(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const resolved = theme === 'system' ? system : theme

  useLayoutEffect(() => {
    const root = document.documentElement
    if (resolved === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    localStorage.setItem('theme', theme)
  }, [theme, resolved])

  const setTheme = useCallback((t: Theme) => setThemeState(t), [])
  const toggleTheme = useCallback(() => {
    setThemeState((t) => (t === 'light' ? 'dark' : t === 'dark' ? 'system' : 'light'))
  }, [])

  return <ThemeContext.Provider value={{ theme, resolved, toggleTheme, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

export function ThemeToggle() {
  const { theme, resolved, toggleTheme } = useTheme()
  const Icon = theme === 'dark' ? Sun : theme === 'system' ? Monitor : Moon
  const label = theme === 'light' ? 'تاریک' : theme === 'dark' ? 'سیستم' : 'روشن'
  return (
    <button
      onClick={toggleTheme}
      className="btn-ghost h-9 w-9 !px-0 rounded-xl transition relative"
      aria-label={`حالت ${label}`}
      title={`حالت ${label}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}
