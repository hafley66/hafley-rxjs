import { describe, expect, it } from "vitest"
import { filter, map } from "rxjs"
import { runEpics, Signal } from "@hafley66/signals"
import { z } from "zod"
import { createGrid } from "./2_createGrid"
import type { TreeColumn } from "./10_treeColumn"
import { columnEpics, selectOnPlainClick } from "./10a_columnEpics"
import type { GridAction, GridEpic, Modifiers } from "./1_types"

type Row = { id: string; status: string; n: number; children?: Row[] }

const MODS: Modifiers = { alt: false, ctrl: false, meta: false, shift: false, button: 0 }
const ALT: Modifiers = { ...MODS, alt: true }

const rows = Signal<Row[]>([
  { id: "a", status: "fail", n: 3 },
  { id: "b", status: "pass", n: 1 },
])

const newGrid = (epics: GridEpic<Row>[] = []) =>
  createGrid<Row>({
    schema: z.custom<Row>(),
    rows,
    getRowId: (r) => r.id,
    mode: "client",
    epics,
  })

const click = (column: string, row: Row, mods = MODS): GridAction<Row> => ({
  phase: "intent",
  type: "cell.click",
  column,
  rowId: row.id,
  row,
  mods,
})

describe("grid actions", () => {
  it("onSortingChange dispatches one change action and writes state", () => {
    const grid = newGrid()
    const seen: GridAction<Row>[] = []
    grid.actions$.subscribe((a) => seen.push(a))
    grid.onSortingChange([{ id: "n", desc: true }])
    expect(seen).toEqual([{ phase: "change", type: "sorting", sorting: [{ id: "n", desc: true }] }])
    expect(grid.state.sorting.$()).toEqual([{ id: "n", desc: true }])
  })

  it("phase$ and column$ narrow the bus", () => {
    const grid = newGrid()
    const intents: string[] = []
    const statusOnly: string[] = []
    grid.epicCtx.phase$.intent.subscribe((a) => intents.push(a.type))
    grid.epicCtx.column$("status").subscribe((a) => statusOnly.push(a.column))
    grid.dispatch(click("status", rows.$()[0]!))
    grid.dispatch(click("n", rows.$()[0]!))
    grid.onSortingChange([])
    expect(intents).toEqual(["cell.click", "cell.click"])
    expect(statusOnly).toEqual(["status"])
  })

  it("grid-level epics run only while epics$ is subscribed", () => {
    const sortOnAltClick: GridEpic<Row> = (_a, _s, ctx) =>
      ctx.phase$.intent.pipe(
        filter((a) => a.type === "cell.click" && a.mods.alt),
        map((a) => ({ phase: "change", type: "sorting", sorting: [{ id: (a as { column: string }).column, desc: false }] }) as GridAction<Row>),
      )
    const grid = newGrid([sortOnAltClick])
    grid.dispatch(click("n", rows.$()[0]!, ALT))
    expect(grid.state.sorting.$()).toEqual([])

    const sub = grid.epics$.subscribe()
    grid.dispatch(click("n", rows.$()[0]!, ALT))
    expect(grid.state.sorting.$()).toEqual([{ id: "n", desc: false }])
    sub.unsubscribe()
  })
})

describe("tree column epics", () => {
  const columns: TreeColumn<Row>[] = [
    { id: "id", header: "id", tree: true, cell: (r) => r.id },
    {
      id: "status",
      header: "status",
      cell: (r) => r.status,
      epic: ({ column$, id }) =>
        column$.pipe(
          filter((a) => a.type === "cell.click" && a.mods.alt),
          map((a) => ({ phase: "effect", type: "pivot", column: id, value: (a as { row: Row }).row.status, row: (a as { row: Row }).row }) as GridAction<Row>),
        ),
    },
    { id: "n", header: "n", cell: (r) => r.n, noRowClick: true },
  ]

  const attach = (grid: ReturnType<typeof newGrid>) =>
    runEpics(grid.actions$, grid.state, grid.epicCtx, [selectOnPlainClick(columns), ...columnEpics(columns)], grid.dispatch).subscribe()

  it("plain click becomes effect select; noRowClick columns are skipped", () => {
    const grid = newGrid()
    const effects: string[] = []
    grid.epicCtx.phase$.effect.subscribe((a) => effects.push(`${a.type}:${a.row.id}`))
    const sub = attach(grid)
    grid.dispatch(click("id", rows.$()[1]!))
    grid.dispatch(click("n", rows.$()[0]!))
    expect(effects).toEqual(["select:b"])
    sub.unsubscribe()
  })

  it("a column epic sees only its column and its output is dispatched", () => {
    const grid = newGrid()
    const effects: GridAction<Row>[] = []
    grid.epicCtx.phase$.effect.subscribe((a) => effects.push(a))
    const sub = attach(grid)
    grid.dispatch(click("id", rows.$()[0]!, ALT))
    grid.dispatch(click("status", rows.$()[0]!, ALT))
    expect(effects).toEqual([{ phase: "effect", type: "pivot", column: "status", value: "fail", row: rows.$()[0] }])
    sub.unsubscribe()
  })
})
