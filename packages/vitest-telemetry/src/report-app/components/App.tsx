// Top-level layout: header, resizable nav pane, title/events/pivot main column. Wires the layout
// tracks (nav width, overview height) and the theme/density/column data attributes onto the DOM.
import { useEffect, useMemo, useRef } from 'react'
import { z } from 'zod'
import { createGrid } from '@hafley66/grid'
import { localStorageAdapter, Signal } from '@hafley66/signals/react'
import type { Signal as SignalType } from '@hafley66/signals'
import { layout, gutter, EventsPanel, PivotStack, NavRail, NAV_RAIL_PX, popPivotsTo, useTheme, type Track } from '@hafley66/report-shell'
import { dismissDefaultViewHint, type Model, type NavNode } from '../model'
import type { Prefs } from '../prefs'
import { flattenLeaves } from '../adapter/navTree'
import { Header } from './Header'
import { Title } from './Title'
import { Nav } from './Nav'

const NAV_FALLBACK_PX = 380
const NAV_COLLAPSE_KEY = 'vitest-telemetry.tracks.nav.collapsed'

const TRACKS: Track[] = [
  { name: 'nav', min: NAV_RAIL_PX, max: 720, fallback: NAV_FALLBACK_PX, axis: 'x' },
  { name: 'overview', min: 48, max: 480, fallback: 160, axis: 'y' },
]

function applyColumnPrefs(current: Prefs): void {
  document.body.dataset.hideRealm = String(!current.columns.realm)
  document.body.dataset.hideCategory = String(!current.columns.category)
  document.body.dataset.hideLevel = String(!current.columns.level)
}

export function App({ model, prefs, meta }: { model: Model; prefs: SignalType<Prefs>; meta: string }) {
  useTheme(prefs, applyColumnPrefs)
  const navRef = useRef<HTMLElement>(null)
  const navGutterRef = useRef<HTMLDivElement>(null)
  const tracks = useMemo(() => layout(document.documentElement, TRACKS, localStorageAdapter('vitest-telemetry.tracks')), [])
  const navCollapseStorage = useMemo(() => localStorageAdapter(NAV_COLLAPSE_KEY), [])

  useEffect(() => {
    if (!navGutterRef.current) return
    return gutter(navGutterRef.current, tracks.nav!, { axis: 'x' })
  }, [tracks])

  const pivotBase = useMemo(
    () =>
      createGrid<NavNode>({
        schema: z.custom<NavNode>(),
        rows: Signal<NavNode[]>(() => flattenLeaves(model.nav.$())),
        getRowId: (node) => node.id,
        mode: 'client',
        columnDefs: [
          { id: 'label', header: 'name' },
          { id: 'status', header: 'status' },
          { id: 'durationMs', header: 'ms' },
        ],
      }),
    [model],
  )

  const dismissHint = () => dismissDefaultViewHint(model)

  return (
    <>
      <Header model={model} prefs={prefs} meta={meta} onInteract={dismissHint} />
      <nav ref={navRef} onClickCapture={dismissHint}>
        <NavRail track={tracks.nav!} storage={navCollapseStorage} expandedFallback={NAV_FALLBACK_PX} />
        <Nav model={model} prefs={prefs} />
        <div ref={navGutterRef} className="gutter gutter-x" data-testid="nav-gutter" />
      </nav>
      <main onClickCapture={dismissHint}>
        <Title model={model} />
        <EventsPanel marbler={model.marbler} overviewTrack={tracks.overview!} />
        <PivotStack pivotStack={model.pivotStack} baseGrid={pivotBase} onPop={(count) => popPivotsTo(model.pivotStack, count)} />
      </main>
    </>
  )
}
