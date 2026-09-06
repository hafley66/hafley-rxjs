// Gear button + popover: density, theme, column toggles, and the compact-chains toggle. Built on
// @hafley66/report-shell's GearButton/PopoverPanel primitives.
import { SignalReact } from '@hafley66/signals/react'
import type { Signal as SignalType } from '@hafley66/signals'
import { GearButton, PopoverPanel } from '@hafley66/report-shell'
import type { ColumnPrefs, Density, Prefs, Theme } from '../prefs'

const COLUMNS: (keyof ColumnPrefs)[] = ['realm', 'category', 'level']

function PrefsMenuView({ prefs }: { prefs: SignalType<Prefs> }) {
  const current = prefs.$()
  return (
    <>
      <GearButton id="prefs-gear" popoverTargetId="prefs-popover" label="⚙" title="preferences" />
      <PopoverPanel id="prefs-popover">
        <fieldset>
          <legend>density</legend>
          {(['compact', 'cozy'] as Density[]).map((value) => (
            <label key={value}>
              <input type="radio" name="density" value={value} checked={current.density === value} onChange={() => prefs.$({ ...current, density: value })} />
              {value}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>theme</legend>
          {(['auto', 'dark', 'light'] as Theme[]).map((value) => (
            <label key={value}>
              <input type="radio" name="theme" value={value} checked={current.theme === value} onChange={() => prefs.$({ ...current, theme: value })} />
              {value}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>columns</legend>
          {COLUMNS.map((column) => (
            <label key={column}>
              <input
                type="checkbox"
                checked={current.columns[column]}
                onChange={(event) => prefs.$({ ...current, columns: { ...current.columns, [column]: event.target.checked } })}
              />
              {column}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>tree</legend>
          <label>
            <input type="checkbox" checked={current.compactChains} onChange={(event) => prefs.$({ ...current, compactChains: event.target.checked })} />
            compact single-child chains
          </label>
        </fieldset>
      </PopoverPanel>
    </>
  )
}

export const PrefsMenu = SignalReact(PrefsMenuView)
