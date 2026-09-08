// Marbler embed + a SubTable driven by whichever row is selected in it. `detail` turns a
// MarbleEvent into attr rows; the default covers type/initiator/from/to/status/duration.
// Three tracks resize it: overview (navigator strip), events (marbler height), drawer (detail width).
import { useCallback, useEffect, useRef } from 'react'
import { SignalReact } from '@hafley66/signals/react'
import type { Signal as SignalType } from '@hafley66/signals'
import { MarblerPanel, type Marbler, type MarbleEvent } from '@hafley66/marbler'
import { gutter, type GutterOptions } from '../layout'
import { SubTable } from './SubTable'

function findRow(rows: MarbleEvent[], id: string | null): MarbleEvent | null {
  if (!id) return null
  for (const row of rows) {
    if (row.id === id) return row
    const found = row.children ? findRow(row.children, id) : null
    if (found) return found
  }
  return null
}

export function defaultEventDetail(event: MarbleEvent): [string, string][] {
  return [
    ['type', event.type],
    ['initiator', event.initiator],
    ['from', event.from],
    ['to', event.to],
    ['status', String(event.status)],
    ['duration', `${event.duration ?? 0}ms`],
  ]
}

export type EventsPanelProps = {
  marbler: Marbler
  overviewTrack: SignalType<number>
  eventsTrack?: SignalType<number>
  drawerTrack?: SignalType<number>
  detail?: (event: MarbleEvent) => [string, string][]
}

// Callback ref: the drawer gutter mounts only while a row is selected, so attach on the element itself.
function useGutter(track: SignalType<number> | undefined, options: GutterOptions) {
  const el = useRef<HTMLDivElement | null>(null)
  const detach = useRef<(() => void) | null>(null)
  const attach = useCallback(
    (node: HTMLDivElement | null) => {
      detach.current?.()
      detach.current = null
      el.current = node
      if (node && track) detach.current = gutter(node, track, options)
    },
    // options is a literal per call site; the track is the identity that matters
    // biome-ignore lint/correctness/useExhaustiveDependencies: see above
    [track],
  )
  return { ref: attach, el }
}

function EventsPanelView({ marbler, overviewTrack, eventsTrack, drawerTrack, detail = defaultEventDetail }: EventsPanelProps) {
  const selected = findRow(marbler.rows.$(), marbler.selectedId.$())
  const summary = selected ? [`${marbler.rows.$().length} rows`, `${selected.frames?.length ?? 0} frames`] : [`${marbler.rows.$().length} rows`]
  const overviewHeight = overviewTrack.$()
  const eventsHeight = eventsTrack?.$()
  const drawerWidth = drawerTrack?.$()
  const overviewGutter = useGutter(overviewTrack, { axis: 'y' })
  const eventsGutter = useGutter(eventsTrack, { axis: 'y' })
  const drawerGutter = useGutter(drawerTrack, { axis: 'x', invert: true })

  useEffect(() => {
    const gutterEl = overviewGutter.el.current
    const panel = gutterEl?.parentElement
    const navigator = panel?.querySelector<HTMLElement>('.time-navigator')
    if (!gutterEl || !panel || !navigator) return
    const bottom = navigator.getBoundingClientRect().bottom - panel.getBoundingClientRect().top + panel.scrollTop
    gutterEl.style.top = `${bottom}px`
  }, [overviewHeight, overviewGutter])

  return (
    <section className="events-panel">
      <MarblerPanel model={marbler} embedded={{ chips: true }} summary={summary} navigatorHeight={overviewHeight} />
      <div ref={overviewGutter.ref} className="gutter gutter-y" data-testid="overview-gutter" title="drag to resize the overview strip" />
      {eventsTrack && (
        <div ref={eventsGutter.ref} className="gutter gutter-y" data-testid="events-gutter" title="drag to resize the events panel" style={{ top: eventsHeight }} />
      )}
      {drawerTrack && selected && (
        <div
          ref={drawerGutter.ref}
          className="gutter gutter-x"
          data-testid="drawer-gutter"
          title="drag to resize the detail drawer"
          style={{ top: 0, height: eventsHeight ?? '60vh', right: (drawerWidth ?? 390) - 3 }}
        />
      )}
      {selected && (
        <div className="event-attrs" data-testid="event-attrs">
          <h4>attrs</h4>
          <SubTable columns={['attr', 'value']} rows={detail(selected)} />
        </div>
      )}
    </section>
  )
}

export const EventsPanel = SignalReact(EventsPanelView)
