// Presets are stored inside the localStorage prefs object (they should survive across different
// report URLs, unlike continuous/selected which live in this URL). This wraps prefs.presets as a
// Storage<string> so @hafley66/report-shell's generic PresetsMenu can own the apply/save/reset UI.
import { useMemo } from 'react'
import { Observable } from 'rxjs'
import type { Signal as SignalType, Storage } from '@hafley66/signals'
import { PresetsMenu as GenericPresetsMenu } from '@hafley66/report-shell'
import { DEFAULT_CONTINUOUS_STATE, DEFAULT_SELECTION, type Model } from '../model'
import type { Prefs, SavedFilters } from '../prefs'

function presetsStorage(prefs: SignalType<Prefs>): Storage<string> {
  return {
    read: new Observable<string>((subscriber) => {
      subscriber.next(JSON.stringify(prefs.$().presets))
      const subscription = prefs.$.subscribe((current) => subscriber.next(JSON.stringify(current.presets)))
      return () => subscription.unsubscribe()
    }),
    write: {
      // prefs.$ is also this Storage's read source: writing back on every read tick (any prefs
      // change, not just presets) would loop forever, so a no-op write is dropped here.
      next: (raw) => {
        const current = prefs.$()
        if (JSON.stringify(current.presets) === raw) return
        prefs.$({ ...current, presets: JSON.parse(raw) })
      },
      error() {},
      complete() {},
    },
  }
}

export function PresetsMenu({ model, prefs }: { model: Model; prefs: SignalType<Prefs> }) {
  const storage = useMemo(() => presetsStorage(prefs), [prefs])
  return (
    <GenericPresetsMenu<SavedFilters>
      storage={storage}
      current={() => ({ ...model.continuous.$(), selected: model.selected.$() })}
      onApply={(preset) => {
        const { selected, ...continuous } = preset
        model.continuous.$(continuous)
        model.selected.$(selected)
      }}
      onReset={() => {
        model.continuous.$(DEFAULT_CONTINUOUS_STATE)
        model.selected.$(DEFAULT_SELECTION)
      }}
    />
  )
}
