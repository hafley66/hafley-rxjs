// Sizing store: one persisted record of what the user did to each resizable thing (pane
// track, grid column, nav width), shared enough to restore sensibly at a different viewport.
import { storageSignal, type Signal as SignalType, type Storage } from '@hafley66/signals'
import { restoreSizing } from './sizingRestore'

export type Sizing = {
  id: string
  px: number
  share: number
  viewportPx: number
  manual: boolean
  at: number
}

export type SizingStore = {
  record: (id: string, px: number, viewportPx: number, manual?: boolean) => void
  restore: (
    ids: string[],
    viewportPx: number,
    mins: Record<string, number>,
    priority?: string[],
  ) => Record<string, number>
  isManual: (id: string) => boolean
  clear: (id?: string) => void
  state: SignalType<Record<string, Sizing>>
}

export function createSizingStore(storage: Storage<string>): SizingStore {
  const state = storageSignal<Record<string, Sizing>>(storage, {})

  function record(id: string, px: number, viewportPx: number, manual = true): void {
    const share = viewportPx === 0 ? 0 : px / viewportPx
    const next: Sizing = { id, px, share, viewportPx, manual, at: Date.now() }
    state.$({ ...state.$(), [id]: next })
  }

  function restore(
    ids: string[],
    viewportPx: number,
    mins: Record<string, number>,
    priority: string[] = [],
  ): Record<string, number> {
    return restoreSizing(state.$(), ids, viewportPx, mins, priority)
  }

  function isManual(id: string): boolean {
    return state.$()[id]?.manual === true
  }

  function clear(id?: string): void {
    if (id === undefined) {
      state.$({})
      return
    }
    const next = { ...state.$() }
    delete next[id]
    state.$(next)
  }

  return { record, restore, isManual, clear, state }
}
