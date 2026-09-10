// Every assertion is a synchronous read. The body slots build DOM, so only the two that hand back
// plain values (the select-all toggle, the ordinal) are invoked here; the rest are asserted as defs.
import { describe, expect, it } from "vitest"
import { isSignal } from "@hafley66/signals"
import {
  BUILT_IN_IDS,
  checkboxColumn,
  dataColumns,
  detailColumn,
  dragColumn,
  expandColumn,
  isBuiltIn,
  pinningFor,
  radioColumn,
  rowNumberColumn,
  rowSelectionMode,
  selectAllState,
  toggleSelectAll,
  type BuiltInColumnDef,
} from "./5_columns.js"
import { trackList } from "./4_slice.js"
import { grid } from "./8_grid.js"
import type { CellCtx, ColumnDef, FlatNode, HeaderCtx, RowId } from "./0_types.js"

type Row = { id: string; name: string; size: number }

const ROWS: readonly Row[] = [
  { id: "a", name: "alice", size: 10 },
  { id: "b", name: "bob", size: 20 },
  { id: "c", name: "carol", size: 30 },
]

const DATA: readonly ColumnDef<Row>[] = [
  { id: "name", flex: 1 },
  { id: "size", width: 80 },
]

const headerCtx = (col: string): HeaderCtx => ({
  col,
  node: { key: col, depth: 0, index: 0, parent: null, hasChildren: false },
  sort: null,
  pinned: undefined,
})

const cellCtx = (row: RowId, col: string, node: FlatNode<RowId>): CellCtx<Row> => ({
  row,
  col,
  data: { id: row, name: row, size: 0 },
  value: undefined,
  node,
  editing: false,
})

const node = (key: RowId, index: number, depth = 0): FlatNode<RowId> => ({
  key,
  depth,
  index,
  parent: null,
  hasChildren: false,
})

const ALL: readonly BuiltInColumnDef<Row>[] = [
  checkboxColumn<Row>(),
  radioColumn<Row>(),
  expandColumn<Row>(),
  dragColumn<Row>(),
  detailColumn<Row>(),
  rowNumberColumn<Row>(),
]

describe("selectAllState", () => {
  it("answers none for an empty list", () => {
    expect(selectAllState([], {})).toBe("none")
  })

  it("answers none when nothing in the list is selected", () => {
    expect(selectAllState(["a", "b"], { c: true })).toBe("none")
  })

  it("answers some for a partial selection", () => {
    expect(selectAllState(["a", "b"], { a: true })).toBe("some")
  })

  it("answers all only when every row in the list is selected", () => {
    expect(selectAllState(["a", "b"], { a: true, b: true })).toBe("all")
    expect(selectAllState(["a", "b"], { a: true, b: false })).toBe("some")
  })

  it("counts a row outside the list toward nothing", () => {
    expect(selectAllState(["a"], { a: true, z: true })).toBe("all")
  })
})

describe("toggleSelectAll", () => {
  it("fills from none and from some", () => {
    expect(toggleSelectAll(["a", "b"], {})).toEqual({ a: true, b: true })
    expect(toggleSelectAll(["a", "b"], { a: true })).toEqual({ a: true, b: true })
  })

  it("clears from all", () => {
    expect(toggleSelectAll(["a", "b"], { a: true, b: true })).toEqual({ a: false, b: false })
  })

  it("leaves a row outside the list alone", () => {
    expect(toggleSelectAll(["a"], { z: true })).toEqual({ a: true, z: true })
  })
})

describe("the select-all toggle header is live", () => {
  it("reads the tri-state off the grid it was handed", () => {
    const g = grid<Row>({ id: "t", rows: ROWS, columns: DATA, rowId: (r) => r.id })
    const col = checkboxColumn<Row>({ grid: () => g })
    const glyph = col.headerCell(headerCtx(col.id))
    if (!isSignal<string>(glyph)) throw new Error("the select-all toggle must be a signal")
    expect(glyph.$()).toBe("☐")
    g.dispatch({ phase: "change", type: "rowSelection", rowSelection: { a: true } })
    expect(glyph.$()).toBe("☑")
    g.dispatch({
      phase: "change",
      type: "rowSelection",
      rowSelection: { a: true, b: true, c: true },
    })
    expect(glyph.$()).toBe("☒")
  })

  it("falls back to the empty glyph with no grid to read", () => {
    expect(checkboxColumn<Row>().headerCell(headerCtx("__check"))).toBe("☐")
  })
})

describe("built-in columns are excluded from grouping and from flex", () => {
  it("opts out of every data affordance, because a glyph box has no value to act on", () => {
    for (const col of ALL) {
      expect(col.groupable).toBe(false)
      expect(col.sortable).toBe(false)
      expect(col.filterable).toBe(false)
      expect(col.resizable).toBe(false)
      expect(col.editable).toBe(false)
    }
  })

  it("declares no flex and bounds its width on both sides", () => {
    for (const col of ALL) {
      expect(col.flex).toBeUndefined()
      expect(col.minWidth).toBe(col.width)
      expect(col.maxWidth).toBe(col.width)
    }
  })

  it("emits a fixed track while a data column takes the leftover", () => {
    // Distribution moved to the browser: the track list is the whole contract now, and a built-in
    // must never emit an `fr`, or a checkbox would grow with the viewport.
    const track = trackList(
      [checkboxColumn<Row>(), ...DATA].map((column) => ({
        id: column.id,
        width: column.width,
        minWidth: column.minWidth,
        maxWidth: column.maxWidth,
        flex: column.flex,
      })),
    )
    // Pinned on both sides, so the browser cannot grow it, while the data column keeps its `fr`.
    expect(track).toBe("minmax(36px, 36px) 1fr 80px")
  })

  it("emits no fr for a built-in, so the viewport cannot grow it", () => {
    const track = trackList(
      [rowNumberColumn<Row>(), ...DATA].map((column) => ({
        id: column.id,
        width: column.width,
        minWidth: column.minWidth,
        maxWidth: column.maxWidth,
        flex: column.flex,
      })),
    )
    expect(track.startsWith("minmax(56px, 56px)")).toBe(true)
    expect(track).not.toContain("56fr")
  })
})

describe("telling a built-in from a data column", () => {
  it("gives every factory a distinct default id", () => {
    expect(new Set(Object.values(BUILT_IN_IDS)).size).toBe(Object.keys(BUILT_IN_IDS).length)
    expect(ALL.map((c) => c.id)).toEqual(Object.values(BUILT_IN_IDS))
  })

  it("recognizes a renamed built-in by its discriminator", () => {
    const renamed = checkboxColumn<Row>({ id: "pick" })
    expect(renamed.id).toBe("pick")
    expect(isBuiltIn(renamed)).toBe(true)
  })

  it("leaves data columns alone", () => {
    for (const col of DATA) expect(isBuiltIn(col)).toBe(false)
    expect(dataColumns([checkboxColumn<Row>(), ...DATA])).toEqual(DATA)
  })
})

describe("pinning and selection mode ride on the schema", () => {
  it("pins every built-in to the start by default", () => {
    expect(pinningFor([checkboxColumn<Row>(), expandColumn<Row>(), ...DATA])).toEqual({
      [BUILT_IN_IDS.check]: "start",
      [BUILT_IN_IDS.expand]: "start",
    })
  })

  it("takes the side the caller asked for", () => {
    expect(pinningFor([detailColumn<Row>({ pin: "end" })])).toEqual({
      [BUILT_IN_IDS.detail]: "end",
    })
  })

  it("reads single select off the presence of a radio column", () => {
    expect(rowSelectionMode([checkboxColumn<Row>(), ...DATA])).toBe("multi")
    expect(rowSelectionMode(DATA)).toBe("multi")
    expect(rowSelectionMode([radioColumn<Row>(), ...DATA])).toBe("single")
  })
})

describe("rowNumberColumn", () => {
  it("counts from one off the flat index", () => {
    const col = rowNumberColumn<Row>()
    expect(col.cell(cellCtx("a", col.id, node("a", 0)))).toBe("1")
    expect(col.cell(cellCtx("c", col.id, node("c", 2)))).toBe("3")
  })

  it("takes the start the caller asked for", () => {
    const col = rowNumberColumn<Row>({ start: 0 })
    expect(col.cell(cellCtx("a", col.id, node("a", 0)))).toBe("0")
  })

  it("adds the page origin a server mode caller supplies", () => {
    const col = rowNumberColumn<Row>({ offset: () => 200 })
    expect(col.cell(cellCtx("a", col.id, node("a", 0)))).toBe("201")
  })

  it("stays at zero offset in client mode, where the flat index is already absolute", () => {
    const g = grid<Row>({ id: "t", rows: ROWS, columns: DATA, rowId: (r) => r.id })
    const col = rowNumberColumn<Row>({ grid: () => g })
    expect(col.cell(cellCtx("c", col.id, node("c", 2)))).toBe("3")
  })
})

describe("every factory takes an override", () => {
  it("keeps the wiring while swapping the slot", () => {
    const col = expandColumn<Row>({ id: "tree", width: 20, pin: "end", cell: () => "x" })
    expect(col.id).toBe("tree")
    expect(col.width).toBe(20)
    expect(col.maxWidth).toBe(20)
    expect(col.pin).toBe("end")
    expect(col.builtIn).toBe("expand")
    expect(col.groupable).toBe(false)
    expect(col.cell(cellCtx("a", "tree", node("a", 0, 3)))).toBe("x")
  })

  it("swaps the header without losing the tri-state rules", () => {
    const col = checkboxColumn<Row>({ header: () => "pick" })
    expect(col.headerCell(headerCtx(col.id))).toBe("pick")
    expect(col.builtIn).toBe("check")
  })
})
