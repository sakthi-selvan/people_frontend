import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { THEMES, type ThemeId } from './types'

const KEY = 'people.theme'

function applyTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id
}

const ThemeContext = createContext<{
  theme: ThemeId
  setTheme: (id: ThemeId) => void
} | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    const saved = localStorage.getItem(KEY)
    return THEMES.some((t) => t.id === saved) ? (saved as ThemeId) : 'atlas'
  })

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem(KEY, theme)
  }, [theme])

  const value = useMemo(() => ({ theme, setTheme: setThemeState }), [theme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('Theme missing')
  return ctx
}
