import { useEffect } from 'react'
import type { Signal as SignalType } from '@hafley66/signals'

export type ThemePrefs = { theme: 'auto' | 'light' | 'dark'; density: string }

// Mirrors prefs onto <html data-theme> and <body data-density>; `extra` adds per-app attributes.
export function useTheme<P extends ThemePrefs>(prefs: SignalType<P>, extra?: (current: P) => void): void {
  useEffect(() => {
    const apply = (current: P) => {
      if (current.theme === 'auto') delete document.documentElement.dataset.theme
      else document.documentElement.dataset.theme = current.theme
      document.body.dataset.density = current.density
      extra?.(current)
    }
    apply(prefs.$())
    const sub = prefs.$.subscribe(apply)
    return () => sub.unsubscribe()
  }, [prefs, extra])
}
