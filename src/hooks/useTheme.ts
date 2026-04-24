import { useCallback, useLayoutEffect, useSyncExternalStore } from 'react'

type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'reparteix-theme'
const MEDIA_QUERY = '(prefers-color-scheme: dark)'

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    /* localStorage unavailable */
  }

  return 'system'
}

function getResolvedTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    if (typeof window === 'undefined') return 'light'
    return window.matchMedia(MEDIA_QUERY).matches ? 'dark' : 'light'
  }
  return theme
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return

  const resolved = getResolvedTheme(theme)
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

let currentTheme: Theme = typeof window === 'undefined' ? 'system' : getStoredTheme()
const listeners = new Set<() => void>()
let mediaQueryCleanup: (() => void) | null = null

function emit() {
  listeners.forEach((listener) => listener())
}

function ensureSystemThemeListener() {
  if (typeof window === 'undefined' || mediaQueryCleanup) return

  const media = window.matchMedia(MEDIA_QUERY)
  const handleChange = () => {
    if (currentTheme === 'system') {
      applyTheme('system')
      emit()
    }
  }

  media.addEventListener('change', handleChange)
  mediaQueryCleanup = () => {
    media.removeEventListener('change', handleChange)
    mediaQueryCleanup = null
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  ensureSystemThemeListener()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && mediaQueryCleanup) {
      mediaQueryCleanup()
    }
  }
}

function getSnapshot(): Theme {
  return currentTheme
}

export function useTheme() {
  const theme = useSyncExternalStore<Theme>(subscribe, getSnapshot, () => 'system')

  useLayoutEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    currentTheme = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* localStorage unavailable */
    }
    applyTheme(next)
    emit()
  }, [])

  const resolvedTheme = getResolvedTheme(theme)

  return { theme, resolvedTheme, setTheme } as const
}
