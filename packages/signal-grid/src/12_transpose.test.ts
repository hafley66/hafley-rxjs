// The claim under test is that rows and columns are the same thing. Every assertion runs the
// transpose against the shape `8_grid.test.ts` already pins for the default orientation, so this
// file asserts only what changes when the seating chart moves. Reads are synchronous `.$()`, so
// nothing subscribes.
//
// The twelve cases that used to open this file restated `8_grid.test.ts` verbatim, two of them
// character for character, and are gone; the default-orientation shape is that file's to hold.
import { describe, expect, it } from "vitest"
import {
  cellId,
  cellParts,
  conventionalParts,
  defaultState,
  grid,
  neutralCell,
  transpose,
  transposeSpans,
} from "./index.js"
import { keysOf } from "./test/0_kit.js"
import type { CellId, ColumnDef, Grid, GridState, Orientation, SpanRelation } from "./index.js"

type Row = { id: string; name: string; size: number; note: string; kids?: Row[] }

const COLUMNS: readonly ColumnDef<Row>[] = [
  { id: "name", header: "b-name", width: 120 },
  { id: "size", header: "a-size", width: 80 },
  { id: "note", header: "c-note", width: 60 },
]

const ROWS: readonly Row[] = [
  { id: "r0", name: "carol", size: 30, note: "z" },
  { id: "r1", name: "alice", size: 10, note: "y" },
  { id: "r2", name: "bob", size: 20, note: "x" },
  { id: "r3", name: "dave", size: 40, note: "w" },
  { id: "r4", name: "erin", size: 50, note: "v" },
]

/** Every grid here starts unvirtualized: a zero-height viewport empties the window otherwise. */
const gridOf = (over: Partial<GridState> = {}, columns = COLUMNS): Grid<Row> =>
  grid<Row>({
    id: "t",
    rows: ROWS,
    columns,
    rowId: (row) => row.id,
    state: { virtualize: false, ...over },
  })

// --- The transpose ----------------------------------------------------------

describe("orientation columns swaps which axis scrolls", () => {
  it("seats rows on the vertical axis until something says otherwise", () => {
    expect(defaultState().orientation).toBe("rows")
    expect(keysOf(gridOf().view.vertical.$().nodes)).toEqual(["r0", "r1", "r2", "r3", "r4"])
  })

  it("a 3 column 5 row grid yields 3 vertical entries and 5 horizontal ones", () => {
    const gauge = gridOf({ orientation: "columns" })
    expect(gauge.view.plan.$().center).toEqual(["name", "size", "note"])
    expect(keysOf(gauge.view.cols.$())).toEqual(["r0", "r1", "r2", "r3", "r4"])
  })

  it("the facets name themselves by direction, not by axis", () => {
    const gauge = gridOf({ orientation: "columns" })
    expect(keysOf(gauge.view.vertical.$().nodes)).toEqual(["name", "size", "note"])
    expect(keysOf(gauge.view.horizontal.$().nodes)).toEqual(["r0", "r1", "r2", "r3", "r4"])
  })

  it("sorting sorts what is now vertical", () => {
    const gauge = gridOf({ orientation: "columns" })
    // Each axis reads the named field off its own values, and a ColumnDef's is its header.
    gauge.state.sort.$([{ field: "header", sort: "asc" }])
    expect(gauge.view.plan.$().center).toEqual(["size", "name", "note"])
    gauge.state.sort.$([{ field: "header", sort: "desc" }])
    expect(gauge.view.plan.$().center).toEqual(["note", "name", "size"])
  })

  it("the same write leaves the vertical axis alone when rows are vertical", () => {
    const gauge = gridOf()
    gauge.state.sort.$([{ field: "header", sort: "asc" }])
    expect(keysOf(gauge.view.cols.$())).toEqual(["name", "size", "note"])
  })

  it("pinning pins what is now vertical", () => {
    const gauge = gridOf({ orientation: "columns" })
    gauge.state.colPinning.note.$("start")
    gauge.state.colPinning.name.$("end")
    const plan = gauge.view.plan.$()
    expect(plan.start).toEqual(["note"])
    expect(plan.center).toEqual(["size"])
    expect(plan.end).toEqual(["name"])
  })

  it("row pinning stops reaching the vertical run once rows lie horizontal", () => {
    const gauge = gridOf({ orientation: "columns" })
    gauge.state.rowPinning.r0.$("start")
    expect(gauge.view.plan.$().start).toEqual([])
  })

  it("paging pages what is now vertical", () => {
    const gauge = gridOf({ orientation: "columns" })
    gauge.state.page.$({ mode: "pages", index: 1, size: 2, total: null })
    expect(gauge.view.plan.$().center).toEqual(["note"])
    gauge.state.page.$({ mode: "pages", index: 0, size: 2, total: null })
    expect(gauge.view.plan.$().center).toEqual(["name", "size"])
  })

  it("sizing reads the extent of whichever axis stands vertical", () => {
    const gauge = gridOf({ orientation: "columns", density: "standard" })
    // Three columns at the standard 36px, then one of them declares 100.
    expect(gauge.view.plan.$().centerTotal).toBe(108)
    gauge.state.colWidth.size.$(100)
    expect(gauge.view.plan.$().centerTotal).toBe(172)
  })

  it("a transpose twice returns the original plan", () => {
    const gauge = gridOf()
    const before = gauge.view.plan.$().center
    const once: Orientation = transpose(gauge.state.orientation.$())
    gauge.state.orientation.$(once)
    expect(gauge.view.plan.$().center).not.toEqual(before)
    gauge.state.orientation.$(transpose(once))
    expect(gauge.state.orientation.$()).toBe("rows")
    expect(gauge.view.plan.$().center).toEqual(before)
  })
})

// --- List view is the same lever one notch further ---------------------------

describe("list view collapses the horizontal axis", () => {
  it("list view produces exactly one horizontal entry", () => {
    const gauge = gridOf()
    expect(gauge.view.cols.$()).toHaveLength(3)
    gauge.state.listView.$(true)
    expect(keysOf(gauge.view.cols.$())).toEqual(["name"])
  })

  it("the vertical run is untouched, so a list is still paged and pinned", () => {
    const gauge = gridOf({ listView: true })
    gauge.state.rowPinning.r4.$("end")
    const plan = gauge.view.plan.$()
    expect(plan.center).toEqual(["r0", "r1", "r2", "r3"])
    expect(plan.end).toEqual(["r4"])
  })

  it("the survivor is a leaf, not the header group standing over it", () => {
    const gauge = gridOf({ listView: true }, [
      { id: "meta" },
      { id: "name", group: "meta" },
      { id: "size", group: "meta" },
    ])
    // "meta" is a band over its leaves, and a band of one leaf is the leaf. Keeping the group node
    // instead would leave a run whose only entry has no cell under it.
    expect(gauge.view.cols.$().map((node) => [node.key, node.depth, node.parent])).toEqual([
      ["name", 0, null],
    ])
  })

  it("list view under the transpose collapses the axis that is horizontal there", () => {
    const gauge = gridOf({ orientation: "columns", listView: true })
    expect(keysOf(gauge.view.cols.$())).toEqual(["r0"])
    expect(gauge.view.plan.$().center).toEqual(["name", "size", "note"])
  })
})

// --- The acceptance test: spanning transposes -------------------------------

const SPANNING: readonly ColumnDef<Row>[] = [
  {
    id: "name",
    header: "b-name",
    // Two entries down and three across, in the conventional vocabulary a config still speaks.
    span: (row) => (row.id === "r1" ? { rows: 2, cols: 3 } : undefined),
  },
  { id: "size", header: "a-size" },
  { id: "note", header: "c-note" },
]

const swapped = (ids: Iterable<CellId>): ReadonlySet<CellId> => {
  const out = new Set<CellId>()
  for (const id of ids) {
    const parts = cellParts(id)
    out.add(cellId(parts[1], parts[0]))
  }
  return out
}

const spanEntries = (spans: SpanRelation): [CellId, { vertical: number; horizontal: number }][] =>
  [...spans].sort((left, right) => (left[0] < right[0] ? -1 : 1))

describe("a span of 2 vertical and 3 horizontal, transposed, is 3 vertical and 2 horizontal", () => {
  const upright = gridOf({}, SPANNING)
  const rotated = gridOf({ orientation: "columns" }, SPANNING)

  it("the relation is keyed by the cross and counted by direction", () => {
    expect(spanEntries(upright.view.spans.$())).toEqual([
      [cellId("r1", "name"), { vertical: 2, horizontal: 3 }],
    ])
    expect(spanEntries(rotated.view.spans.$())).toEqual([
      [cellId("name", "r1"), { vertical: 3, horizontal: 2 }],
    ])
  })

  it("transposing the relation by hand lands on the relation the transposed grid built", () => {
    expect(spanEntries(transposeSpans(upright.view.spans.$()))).toEqual(
      spanEntries(rotated.view.spans.$()),
    )
    expect(spanEntries(transposeSpans(transposeSpans(upright.view.spans.$())))).toEqual(
      spanEntries(upright.view.spans.$()),
    )
  })

  it("the covered set transposes with it", () => {
    const before = upright.view.covered.$()
    expect([...before].sort()).toEqual(
      [
        cellId("r1", "size"),
        cellId("r1", "note"),
        cellId("r2", "name"),
        cellId("r2", "size"),
        cellId("r2", "note"),
      ].sort(),
    )
    const after = rotated.view.covered.$()
    expect([...after].sort()).toEqual([...swapped(before)].sort())
    expect([...swapped(after)].sort()).toEqual([...before].sort())
  })

  it("the crossing is its own inverse, so a renderer reads the pair back for free", () => {
    for (const orientation of ["rows", "columns"] as const) {
      const neutral = cellParts(neutralCell("r1", "name", orientation))
      expect(conventionalParts(neutral[0], neutral[1], orientation)).toEqual(["r1", "name"])
    }
  })

  it("a cell with no span covers nothing, so the relation stays empty", () => {
    expect(gridOf().view.spans.$().size).toBe(0)
    expect(gridOf().view.covered.$().size).toBe(0)
  })
})
