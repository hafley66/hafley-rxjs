// Top-level layout: header, resizable nav pane (a TreeTable sidebar), title/events/pivot main
// column. Wires the layout tracks and theme/density onto the DOM.
import { useCallback, useEffect, useMemo, useRef } from "react"
import { z } from "zod"
import { createGrid, createDefaultGridState, type Grid } from "@hafley66/grid"
import { TreeTable, useGridEffect } from "@hafley66/grid/react"
import { NavRail, EventsPanel, PivotStack, layout, gutter, type Track } from "@hafley66/report-shell"
import { Signal, localStorageAdapter, type Signal as SignalType } from "@hafley66/signals/react"
import type { MarbleEvent } from "@hafley66/marbler"
import { formatAge } from "../../lib/time.js"
import { OLDER_FOLD_ID, popPivotsTo, pushPivot, type Model, type NetworkNavRow, type Prefs } from "../model"
import type { PivotRow } from "../nav.js"
import { SESSION_COLUMNS } from "./sessionColumns"
import { Header } from "./Header"
import { Title } from "./Title"
import { FrameDetail } from "./FrameDetail"

const TRACKS: Track[] = [
  { name: "nav", min: 200, max: 720, fallback: 380, axis: "x" },
  { name: "overview", min: 48, max: 480, fallback: 160, axis: "y" },
]

function useTheme(prefs: SignalType<Prefs>): void {
  useEffect(() => {
    const apply = (current: Prefs) => {
      if (current.theme === "auto") delete document.documentElement.dataset.theme
      else document.documentElement.dataset.theme = current.theme
      document.body.dataset.density = current.density
    }
    apply(prefs.$())
    const sub = prefs.$.subscribe(apply)
    return () => sub.unsubscribe()
  }, [prefs])
}

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
      columnDefs: SESSION_COLUMNS.map((column) => ({ id: column.id, header: column.header })),
    })
  }, [model])
}

export function App({ model, prefs, meta }: { model: Model; prefs: SignalType<Prefs>; meta: string }) {
  useTheme(prefs)
  const navGutterRef = useRef<HTMLDivElement>(null)
  const tracks = useMemo(() => layout(document.documentElement, TRACKS, localStorageAdapter("boop-network.tracks")), [])
  const navGrid = useSessionGrid(model)
  const detail = useMemo(() => sessionDetail(model), [model])
  useGridEffect(
    navGrid,
    "pivot",
    useCallback(
      (effect: { value: unknown }) => {
        const status = String(effect.value)
        pushPivot(model, { columnId: "status", value: status, label: `status=${status}` })
      },
      [model],
    ),
  )

  useEffect(() => {
    if (!navGutterRef.current) return
    return gutter(navGutterRef.current, tracks.nav!, { axis: "x" })
  }, [tracks])

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
    <>
      <Header model={model} prefs={prefs} meta={meta} />
      <nav>
        <NavRail track={tracks.nav!} storage={localStorageAdapter("boop-network.nav-collapsed")} expandedFallback={380} />
        <TreeTable<NetworkNavRow>
          grid={navGrid}
          columns={SESSION_COLUMNS}
          rowClassName={(row) => `${row.kind} status-${row.status}${row.selected ? " selected" : ""}`}
          onRowClick={(row) => {
            if (row.id !== OLDER_FOLD_ID) model.selected.$(row.id)
          }}
        />
        <div ref={navGutterRef} className="gutter gutter-x" data-testid="nav-gutter" />
      </nav>
      <main>
        <Title model={model} />
        <EventsPanel marbler={model.marbler} overviewTrack={tracks.overview!} detail={detail} />
        <FrameDetail model={model} />
        <PivotStack pivotStack={model.pivotStack} baseGrid={pivotBase} onPop={(count) => popPivotsTo(model, count)} />
      </main>
    </>
  )
}
