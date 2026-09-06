// Collapse logic for a layout track, factored out of NavRail so it is testable without React.
// `collapsed` derives off `track`, so a manual gutter drag to rail width flips it too.
import { Signal, storageSignal, type Signal as SignalType, type Storage } from '@hafley66/signals'

export const NAV_RAIL_PX = 28

export type NavCollapse = {
  collapsed: SignalType<boolean>
  toggle: () => void
}

export function createNavCollapse(track: SignalType<number>, storage: Storage<string>, expandedFallback: number): NavCollapse {
  const previous = storageSignal<number>(storage, expandedFallback)
  const collapsed = Signal<boolean>(() => track.$() <= NAV_RAIL_PX)

  function toggle(): void {
    if (track.$() <= NAV_RAIL_PX) {
      track.$(previous.$())
      return
    }
    previous.$(track.$())
    track.$(NAV_RAIL_PX)
  }

  return { collapsed, toggle }
}
