// Marbler embed + a SubTable driven by whichever row is selected in it. `detail` turns a
// MarbleEvent into attr rows; the default covers type/initiator/from/to/status/duration.
import { useEffect, useRef } from 'react'
import { SignalReact } from '@hafley66/signals/react'
import type { Signal as SignalType } from '@hafley66/signals'
import { MarblerPanel, type Marbler, type MarbleEvent } from '@hafley66/marbler'
import { gutter } from '../layout'
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
  detail?: (event: MarbleEvent) => [string, string][]
}

function EventsPanelView({ marbler, overviewTrack, detail = defaultEventDetail }: EventsPanelProps) {
  const selected = findRow(marbler.rows.$(), marbler.selectedId.$())
  const summary = selected ? [`${marbler.rows.$().length} rows`, `${selected.frames?.length ?? 0} frames`] : [`${marbler.rows.$().length} rows`]
  const overviewHeight = overviewTrack.$()
  const overviewGutterRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!overviewGutterRef.current) return
    return gutter(overviewGutterRef.current, overviewTrack, { axis: 'y' })
  }, [overviewTrack])

  useEffect(() => {
    const gutterEl = overviewGutterRef.current
    const panel = gutterEl?.parentElement
    const navigator = panel?.querySelector<HTMLElement>('.time-navigator')
    if (!gutterEl || !panel || !navigator) return
    const bottom = navigator.getBoundingClientRect().bottom - panel.getBoundingClientRect().top + panel.scrollTop
    gutterEl.style.top = `${bottom}px`
  }, [overviewHeight])

  return (
    <section className="events-panel">
      <MarblerPanel model={marbler} embedded={{ chips: true }} summary={summary} navigatorHeight={overviewHeight} />
      <div ref={overviewGutterRef} className="gutter gutter-y" data-testid="overview-gutter" title="drag to resize the overview strip" />
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
