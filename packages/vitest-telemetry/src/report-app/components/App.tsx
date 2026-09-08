import { useMemo } from 'react'
import { z } from 'zod'
import { createGrid } from '@hafley66/grid'
import { treeColumnDefs } from '@hafley66/grid/react'
import { Signal } from '@hafley66/signals/react'
import type { Signal as SignalType } from '@hafley66/signals'
import { PivotStack, ReportShell, NAV_RAIL_PX, pivotColumns, popPivotsTo, useTheme, type Track } from '@hafley66/report-shell'
import { EventsPanel } from '@hafley66/report-shell/marbler'
import { dismissDefaultViewHint, type Model, type NavNode } from '../model'
import type { Prefs } from '../prefs'
import { flattenLeaves } from '../adapter/navTree'
import { Header } from './Header'
import { Title } from './Title'
import { Nav } from './Nav'

const TRACKS: Track[] = [
  { name: 'nav', min: NAV_RAIL_PX, max: 720, fallback: 380, axis: 'x' },
  { name: 'overview', min: 48, max: 480, fallback: 160, axis: 'y' },
]

function applyColumnPrefs(current: Prefs): void {
  document.body.dataset.hideRealm = String(!current.columns.realm)
  document.body.dataset.hideCategory = String(!current.columns.category)
  document.body.dataset.hideLevel = String(!current.columns.level)
}

export function App({ model, prefs, meta }: { model: Model; prefs: SignalType<Prefs>; meta: string }) {
  useTheme(prefs, applyColumnPrefs)

  const pivotBase = useMemo(
    () =>
      createGrid<NavNode>({
        schema: z.custom<NavNode>(),
        rows: Signal<NavNode[]>(() => flattenLeaves(model.nav.$())),
        getRowId: (node) => node.id,
        mode: 'client',
        columnDefs: treeColumnDefs(pivotColumns<NavNode>()),
      }),
    [model],
  )

  const dismissHint = () => dismissDefaultViewHint(model)

  return (
    <ReportShell
      tracks={TRACKS}
      storageKey="vitest-telemetry"
      onInteract={dismissHint}
      header={<Header model={model} prefs={prefs} meta={meta} onInteract={dismissHint} />}
      nav={<Nav model={model} prefs={prefs} />}
    >
      {(tracks) => (
        <>
          <Title model={model} />
          <EventsPanel marbler={model.marbler} overviewTrack={tracks.overview!} />
          <PivotStack pivotStack={model.pivotStack} baseGrid={pivotBase} onPop={(count) => popPivotsTo(model.pivotStack, count)} />
        </>
      )}
    </ReportShell>
  )
}
