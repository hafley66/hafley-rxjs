// Preferences persist only in this storageSignal; localStorage is the sole source of truth.
// continuous/selected/pivotStack live in the URL instead (model.ts). A named preset is a snapshot
// of continuous + selected, stored here so it survives across reports/URLs.
import { localStorageAdapter, storageSignal, type Signal as SignalType } from '@hafley66/signals'
import type { ContinuousState, Selection } from './model'

export type Density = 'compact' | 'cozy'
export type Theme = 'auto' | 'dark' | 'light'
export type ColumnPrefs = { realm: boolean; category: boolean; level: boolean }
export type SavedFilters = ContinuousState & { selected: Selection }
export type PresetPrefs = Record<string, SavedFilters>

export type Prefs = {
  density: Density
  theme: Theme
  columns: ColumnPrefs
  presets: PresetPrefs
  // JetBrains-style compact-middle-packages toggle for the nav tree grid.
  compactChains: boolean
}

export const PREFS_KEY = 'vitest-telemetry.prefs'
export const TRACKS_KEY = 'vitest-telemetry.tracks'

export const DEFAULT_PREFS: Prefs = {
  density: 'compact',
  theme: 'auto',
  columns: { realm: true, category: true, level: true },
  presets: {},
  compactChains: false,
}

// Unknown keys from an older report.html (e.g. the retired `renderer` / `navWidth`) are ignored:
// storageSignal decodes into DEFAULT_PREFS's shape and only known fields survive the spread.
function parsePrefs(raw: string): Prefs {
  return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) }
}

export function createPrefs(): SignalType<Prefs> {
  return storageSignal(localStorageAdapter(PREFS_KEY), DEFAULT_PREFS, { parse: parsePrefs })
}
