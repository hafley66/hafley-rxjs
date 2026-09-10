// The renderer's addressing, asserted without a document. `cellFor` and `headerCell` in
// `10_render.ts` both cross their seat keys through `addressedEntry`, so these cases run that call.
//
// What a box looks like stays `tests/1_render.e2e.test.ts`'s job. Nothing subscribes: every read is
// a synchronous `.$()`, matching `12_transpose.test.ts`.
import { describe, expect, it } from "vitest"
import { addressedEntry, grid, NO_ENTRY } from "./index.js"
import type { ColumnDef, Grid, GridState, Orientation } from "./index.js"

type Metric = { id: string; region: string; q1: number; total: number }

const COLUMNS: readonly ColumnDef<Metric>[] = [
  { id: "region", header: "Region" },
  { id: "q1", header: "Q1" },
  // A declared reader, so one column answers something the bare field fallback never would.
  { id: "total", header: "Total", value: (row) => `$${row.total}` },
]

const ROWS: readonly Metric[] = [
  { id: "north", region: "North", q1: 120, total: 480 },
  { id: "south", region: "South", q1: 157, total: 628 },
]

/** Unvirtualized, because a zero-height viewport empties the window and the runs with it. */
const gridOf = (orientation: Orientation): Grid<Metric> =>
  grid<Metric>({
    id: "m",
    rows: ROWS,
    columns: COLUMNS,
    rowId: (it) => it.id,
    state: { virtualize: false, orientation } satisfies Partial<GridState>,
  })

const defsOf = (gauge: Grid<Metric>): ReadonlyMap<string, ColumnDef<Metric>> =>
  new Map(gauge.columns.$().map((it) => [it.id, it] as const))

/** Every cell the two runs cross, keyed by the conventional pair the crossing hands back. Two
 * seatings walk opposite runs and must still land on one table, which is the whole claim. */
const valuesOf = (gauge: Grid<Metric>): Record<string, unknown> => {
  const defs = defsOf(gauge)
  const by = gauge.view.detailed.$().by
  const orientation = gauge.state.orientation.$()
  const out: Record<string, unknown> = {}
  for (const down of gauge.view.plan.$().center) {
    for (const across of gauge.view.cols.$().map((it) => it.key)) {
      const entry = addressedEntry(down, across, orientation, defs, by)
      if (entry.data === undefined) {
        out[`${entry.row}/${entry.col}`] = undefined
        continue
      }
      const read = entry.def?.value
      out[`${entry.row}/${entry.col}`] =
        read === undefined ? (entry.data as Record<string, unknown>)[entry.col] : read(entry.data)
    }
  }
  return out
}

// --- Task 1: a transposed cell renders its own value -------------------------

const WANT: Record<string, unknown> = {
  "north/region": "North",
  "north/q1": 120,
  "north/total": "$480",
  "south/region": "South",
  "south/q1": 157,
  "south/total": "$628",
}

describe("a transposed cell addresses the row its own seat pair names", () => {
  it("the upright grid fills every cell of a 2 by 3 table", () => {
    expect(valuesOf(gridOf("rows"))).toEqual(WANT)
  })

  it("the transposed grid fills the same table from the opposite runs", () => {
    const gauge = gridOf("columns")
    expect(gauge.view.plan.$().center).toEqual(["region", "q1", "total"])
    expect(gauge.view.cols.$().map((it) => it.key)).toEqual(["north", "south"])
    expect(valuesOf(gauge)).toEqual(WANT)
  })

  it("the vertical key under the transpose is a column, which owns no row value", () => {
    const gauge = gridOf("columns")
    const by = gauge.view.detailed.$().by
    // The defect, spelled as an assertion: a renderer keyed on the vertical seat looks a column id
    // up in the row map, misses on every entry, and paints an empty grid.
    for (const key of gauge.view.plan.$().center) expect(by.get(key)).toBeUndefined()
    for (const node of gauge.view.cols.$()) expect(by.get(node.key)).toBeDefined()
  })
})

// --- Task 2: the vertical entry carries a label under the transpose ----------

const bandOf = (gauge: Grid<Metric>): readonly ReturnType<typeof addressedEntry<ColumnDef<Metric>, Metric>>[] => {
  const defs = defsOf(gauge)
  const by = gauge.view.detailed.$().by
  const orientation = gauge.state.orientation.$()
  // `NO_ENTRY` on the vertical seat: the band stands over the horizontal run and on no row of its
  // own, so the seat table is what decides which half of the pair the entry key lands in.
  return gauge.view.cols.$().map((it) => addressedEntry(NO_ENTRY, it.key, orientation, defs, by))
}

describe("the header band carries a label under both seatings", () => {
  it("the band over columns resolves a def, and the def's header string labels it", () => {
    const band = bandOf(gridOf("rows"))
    expect(band.map((it) => [it.col, it.def?.header, it.row, it.data])).toEqual([
      ["region", "Region", NO_ENTRY, undefined],
      ["q1", "Q1", NO_ENTRY, undefined],
      ["total", "Total", NO_ENTRY, undefined],
    ])
  })

  it("the band over rows resolves the row and its data, which is what labels it", () => {
    const band = bandOf(gridOf("columns"))
    expect(band.map((it) => [it.row, it.data?.region, it.col, it.def])).toEqual([
      ["north", "North", NO_ENTRY, undefined],
      ["south", "South", NO_ENTRY, undefined],
    ])
  })

  it("no def stands behind a row, so the header string fallback would print a raw id", () => {
    const band = bandOf(gridOf("columns"))
    // What a consumer reads instead of that id is `data`, which is why `HeaderCtx` carries it.
    expect(band.every((it) => it.def === undefined)).toBe(true)
    expect(band.map((it) => it.data?.region)).toEqual(["North", "South"])
  })
})
