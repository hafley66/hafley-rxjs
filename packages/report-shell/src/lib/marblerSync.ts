import type { Observable, Subscription } from 'rxjs'
import type { Signal } from '@hafley66/signals'
import { createTimeViewport, eventRange, reduceTimeViewport, type Marbler, type MarbleEvent } from '@hafley66/marbler'

// Feeds events into a Marbler; a new selection refits the viewport, same selection keeps it.
export function syncMarbler<Sel>(
  marbler: Marbler,
  events$: Observable<MarbleEvent[]>,
  selection: Signal<Sel>,
  sameSelection: (a: Sel, b: Sel) => boolean = Object.is,
): Subscription {
  let last = selection.$()
  return events$.subscribe((events) => {
    marbler.source.$(events)
    const current = selection.$()
    const changed = !sameSelection(current, last)
    last = current
    const range = eventRange(events)
    marbler.viewport.$(changed ? createTimeViewport(range) : reduceTimeViewport(marbler.viewport.$(), { type: 'full', range }))
  })
}
