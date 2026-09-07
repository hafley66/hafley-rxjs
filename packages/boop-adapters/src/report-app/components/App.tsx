import { useMemo } from "react"
import { z } from "zod"
import { createGrid, createDefaultGridState, type Grid } from "@hafley66/grid"
import { TreeTable, treeColumnDefs } from "@hafley66/grid/react"
import { PivotStack, ReportShell, popPivotsTo, usePivotEffect, useTheme, type Track } from "@hafley66/report-shell"
import { EventsPanel } from "@hafley66/report-shell/marbler"
import { Signal, type Signal as SignalType } from "@hafley66/signals/react"
import type { MarbleEvent } from "@hafley66/marbler"
import { formatAge } from "../../lib/time.js"
import { OLDER_FOLD_ID, type Model, type NetworkNavRow, type Prefs } from "../model"
import type { PivotRow } from "../nav.js"
import { SESSION_COLUMNS } from "./sessionColumns"
import { Header } from "./Header"
import { Title } from "./Title"
import { FrameDetail } from "./FrameDetail"

const TRACKS: Track[] = [
  { name: "nav", min: 200, max: 720, fallback: 380, axis: "x" },
  { name: "overview", min: 48, max: 480, fallback: 160, axis: "y" },
]

function sessionDetail(model: Model) {
  return (event: MarbleEvent): [string, string][] => {
    const session = model.sessionById.$().get(event.id)
    if (!session) return []
    const now = Date.now()
    return [
      ["harness", session.harness],
      ["cwd", session.cwd ?? ""],
      ["branch", session.branch || ""],
      ["opened", session.openedTs ? formatAge(session.openedTs, now) : ""],
      ["closed", session.closedTs ? formatAge(session.closedTs, now) : "live"],
      ["tokens", session.tokens ? String(session.tokens) : ""],
    ]
  }
}

function useSessionGrid(model: Model): Grid<NetworkNavRow> {
  return useMemo(() => {
    const rootIds = model.networkTree.$().map((node) => node.id)
    const expanded = Object.fromEntries(rootIds.map((id) => [id, true]))
    return createGrid<NetworkNavRow>({
      schema: z.custom<NetworkNavRow>(),
      rows: model.navRows,
      getRowId: (row) => row.id,
      getSubRows: (row) => row.children,
      getRowCanExpand: (row) => (row.children?.length ?? 0) > 0,
      mode: "client",
      state: Signal(createDefaultGridState({ expanded, sorting: [{ id: "age", desc: true }] })),
      columnDefs: treeColumnDefs(SESSION_COLUMNS),
    })
  }, [model])
}

export function App({ model, prefs, meta }: { model: Model; prefs: SignalType<Prefs>; meta: string }) {
  useTheme(prefs)
  const navGrid = useSessionGrid(model)
  const detail = useMemo(() => sessionDetail(model), [model])
  usePivotEffect(navGrid, model.pivotStack)

  const pivotBase = useMemo(
    () =>
      createGrid<PivotRow>({
        schema: z.custom<PivotRow>(),
        rows: model.pivotRows,
        getRowId: (row) => row.id,
        mode: "client",
        columnDefs: [
          { id: "label", header: "name" },
          { id: "status", header: "status" },
          { id: "durationMs", header: "" },
        ],
      }),
    [model],
  )

  return (
    <ReportShell
      tracks={TRACKS}
      storageKey="boop-network"
      header={<Header model={model} prefs={prefs} meta={meta} />}
      nav={
        <TreeTable<NetworkNavRow>
          grid={navGrid}
          rowClassName={(row) => `${row.kind} status-${row.status}${row.selected ? " selected" : ""}`}
          onRowClick={(row) => {
            if (row.id !== OLDER_FOLD_ID) model.selected.$(row.id)
          }}
        />
      }
    >
      {(tracks) => (
        <>
          <Title model={model} />
          <EventsPanel marbler={model.marbler} overviewTrack={tracks.overview!} detail={detail} />
          <FrameDetail model={model} />
          <PivotStack pivotStack={model.pivotStack} baseGrid={pivotBase} onPop={(count) => popPivotsTo(model.pivotStack, count)} />
        </>
      )}
    </ReportShell>
  )
}
