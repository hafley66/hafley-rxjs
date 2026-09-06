// Top bar: search/kind/level/failed-only filters (continuous, replaceState) plus the report meta
// line. Title/summary/failure for the current selection live in Title.tsx.
import type { Signal as SignalType } from '@hafley66/signals'
import { patchContinuous, type Model } from '../model'
import { SignalReact } from '@hafley66/signals/react'
import type { Prefs } from '../prefs'
import { PresetsMenu } from './PresetsMenu'
import { PrefsMenu } from './PrefsMenu'

const KINDS = ['log', 'span', 'playwright', 'metric']

function HeaderView({ model, prefs, meta, onInteract }: { model: Model; prefs: SignalType<Prefs>; meta: string; onInteract?: () => void }) {
  const cont = model.continuous.$()
  return (
    <header onClickCapture={onInteract}>
      <b>vitest-telemetry</b>
      <span id="meta">{meta}</span>
      <input
        type="text"
        placeholder="filter text / category / test"
        value={cont.search}
        onChange={(event) => patchContinuous(model, { search: event.target.value })}
      />
      {KINDS.map((kind) => (
        <label key={kind}>
          <input
            type="checkbox"
            checked={cont.kinds.includes(kind)}
            onChange={(event) => {
              const kinds = event.target.checked ? [...cont.kinds, kind] : cont.kinds.filter((k) => k !== kind)
              patchContinuous(model, { kinds })
            }}
          />
          {kind}
        </label>
      ))}
      <label>
        min{' '}
        <select value={cont.minLevel} onChange={(event) => patchContinuous(model, { minLevel: event.target.value })}>
          <option>trace</option>
          <option>debug</option>
          <option>info</option>
          <option>warning</option>
          <option>error</option>
        </select>
      </label>
      <label>
        <input type="checkbox" checked={cont.failedOnly} onChange={(event) => patchContinuous(model, { failedOnly: event.target.checked })} />
        failed only
      </label>
      <PresetsMenu model={model} prefs={prefs} />
      <PrefsMenu prefs={prefs} />
    </header>
  )
}

export const Header = SignalReact(HeaderView)
