// Presets button + popover: apply a saved snapshot, save the current one, or reset to defaults.
// The saved-snapshot type T and its storage backend are both domain-supplied.
import { useMemo, type FC, type ReactElement } from 'react'
import { SignalReact } from '@hafley66/signals/react'
import { storageSignal, type Storage } from '@hafley66/signals'
import { GearButton, PopoverPanel } from './Popover'

export type PresetsMenuProps<T> = {
  storage: Storage<string>
  serialize?: (presets: Record<string, T>) => string
  parse?: (raw: string) => Record<string, T>
  current: () => T
  onApply: (value: T) => void
  onReset: () => void
  label?: string
}

function PresetsMenuView<T>({ storage, serialize, parse, current, onApply, onReset, label = 'presets' }: PresetsMenuProps<T>) {
  const presets = useMemo(() => storageSignal<Record<string, T>>(storage, {}, { serialize, parse }), [storage])
  const names = Object.keys(presets.$())

  const applyByName = (name: string) => {
    const preset = presets.$()[name]
    if (preset) onApply(preset)
  }
  const onSave = () => {
    const name = prompt('Save current filters as:')
    if (!name) return
    presets.$({ ...presets.$(), [name]: current() })
  }

  return (
    <>
      <GearButton id="presets-gear" popoverTargetId="presets-popover" label={label} title="filter presets" />
      <PopoverPanel id="presets-popover">
        <select id="preset-select" value="" onChange={(event) => { if (event.target.value) applyByName(event.target.value) }}>
          <option value="">apply preset…</option>
          {names.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <button type="button" className="preset-save" onClick={onSave}>save current as…</button>
        <button type="button" className="preset-reset" onClick={onReset}>reset filters</button>
      </PopoverPanel>
    </>
  )
}

const WrappedPresetsMenu = SignalReact(PresetsMenuView as FC<PresetsMenuProps<unknown>>)

export function PresetsMenu<T>(props: PresetsMenuProps<T>): ReactElement {
  return <WrappedPresetsMenu {...(props as PresetsMenuProps<unknown>)} />
}
