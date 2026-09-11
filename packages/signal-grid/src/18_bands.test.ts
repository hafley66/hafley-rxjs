// The arithmetic a header group rests on: how many tracks exist, how many cells go into them, and
// how far one band reaches. The geometry those numbers describe is asserted in `18_bands.dom.test.ts`
// under a real engine, because the defect this feature closes was a wrapped row that every count
// here was blind to.
import { describe, expect, it } from "vitest"
import { bandAncestors, bandDepth, bandRow, grid, headerGroup, isHeaderGroup } from "./index.js"
import type { ColumnDef, Grid } from "./index.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly size: number
  readonly note: string
}

const ROWS: readonly Row[] = [
  { id: "a", name: "Alpha", size: 1, note: "one" },
  { id: "b", name: "Beta", size: 2, note: "two" },
]

const gridOf = (columns: readonly ColumnDef<Row>[]): Grid<Row> =>
  grid<Row>({ id: "bands", rows: ROWS, columns, rowId: (it) => it.id })

/** Two levels: one band over two leaves, and one leaf standing outside it. */
const TWO_LEVEL: readonly ColumnDef<Row>[] = [
  headerGroup<Row>({ id: "info", header: "Info" }),
  { id: "name", header: "Name", group: "info" },
  { id: "size", header: "Size", group: "info" },
  { id: "note", header: "Note" },
]

/** Three levels: a band inside a band, so the middle level covers a strict subset of the outer. */
const THREE_LEVEL: readonly ColumnDef<Row>[] = [
  headerGroup<Row>({ id: "top", header: "Top" }),
  headerGroup<Row>({ id: "mid", header: "Mid", group: "top" }),
  { id: "name", header: "Name", group: "mid" },
  { id: "size", header: "Size", group: "mid" },
  { id: "note", header: "Note", group: "top" },
]

describe("a band holds no seat on either axis", () => {
  it("a two-level schema produces one track per leaf and none for the band", () => {
    const gauge = gridOf(TWO_LEVEL)
    expect(gauge.view.cols.$().map((it) => it.key)).toEqual(["info", "name", "size", "note"])
    expect(gauge.view.colLeaves.$()).toEqual(["name", "size", "note"])
    expect([...gauge.view.widths.$().keys()]).toEqual(["name", "size", "note"])
  })

  it("three levels drop both bands and keep the three leaves", () => {
    const gauge = gridOf(THREE_LEVEL)
    expect(gauge.view.colLeaves.$()).toEqual(["name", "size", "note"])
    expect(gauge.view.widths.$().has("top")).toBe(false)
    expect(gauge.view.widths.$().has("mid")).toBe(false)
  })

  it("a schema with no band leaves every entry a leaf", () => {
    const gauge = gridOf([{ id: "name" }, { id: "size" }])
    expect(gauge.view.colLeaves.$()).toEqual(["name", "size"])
    expect(bandDepth(gauge.view.horizontal.$().axis, gauge.view.colLeaves.$())).toBe(1)
  })

  it("the band standing vertical under the transpose renders no entry of the run", () => {
    const gauge = grid<Row>({
      id: "bands",
      rows: ROWS,
      columns: TWO_LEVEL,
      rowId: (it) => it.id,
      state: { orientation: "columns" },
    })
    gauge.viewport.$({ top: 0, left: 0, width: 600, height: 400 })
    expect(gauge.view.plan.$().center).toEqual(["name", "size", "note"])
  })
})

describe("a band's span is its leaf count", () => {
  it("the band covers exactly the leaves under it and the outsider stands alone", () => {
    const gauge = gridOf(TWO_LEVEL)
    const axis = gauge.view.horizontal.$().axis
    const leaves = gauge.view.colLeaves.$()
    expect(bandDepth(axis, leaves)).toBe(2)
    expect(bandRow(axis, leaves, 0, 2)).toEqual([
      { key: "info", span: 2 },
      { key: null, span: 1 },
    ])
  })

  it("the last row is one cell per leaf, whatever the depth above it", () => {
    const gauge = gridOf(TWO_LEVEL)
    const axis = gauge.view.horizontal.$().axis
    const leaves = gauge.view.colLeaves.$()
    expect(bandRow(axis, leaves, 1, 2)).toEqual([
      { key: "name", span: 1 },
      { key: "size", span: 1 },
      { key: "note", span: 1 },
    ])
  })

  it("the spans of one row sum to the leaf count, which is the track count", () => {
    const gauge = gridOf(THREE_LEVEL)
    const axis = gauge.view.horizontal.$().axis
    const leaves = gauge.view.colLeaves.$()
    const rows = bandDepth(axis, leaves)
    for (let depth = 0; depth < rows; depth++) {
      const total = bandRow(axis, leaves, depth, rows).reduce((sum, it) => sum + it.span, 0)
      expect(total).toBe(leaves.length)
    }
  })
})

describe("three levels nest", () => {
  it("the outer band spans every leaf and the middle one spans its own two", () => {
    const gauge = gridOf(THREE_LEVEL)
    const axis = gauge.view.horizontal.$().axis
    const leaves = gauge.view.colLeaves.$()
    expect(bandDepth(axis, leaves)).toBe(3)
    expect(bandRow(axis, leaves, 0, 3)).toEqual([{ key: "top", span: 3 }])
    expect(bandRow(axis, leaves, 1, 3)).toEqual([
      { key: "mid", span: 2 },
      { key: null, span: 1 },
    ])
  })

  it("the chain reads outermost first, which is the order the rows are drawn in", () => {
    const gauge = gridOf(THREE_LEVEL)
    const axis = gauge.view.horizontal.$().axis
    expect(bandAncestors(axis, "name")).toEqual(["top", "mid"])
    expect(bandAncestors(axis, "note")).toEqual(["top"])
  })

  it("a shallow leaf keeps its header on the bottom row beside the deep ones", () => {
    const gauge = gridOf(THREE_LEVEL)
    const axis = gauge.view.horizontal.$().axis
    const leaves = gauge.view.colLeaves.$()
    expect(bandRow(axis, leaves, 2, 3).map((it) => it.key)).toEqual(["name", "size", "note"])
  })
})

describe("the marker is what a band is", () => {
  it("the factory stamps it and a plain column carries nothing", () => {
    expect(isHeaderGroup(headerGroup({ id: "info" }))).toBe(true)
    expect(isHeaderGroup({ id: "name" })).toBe(false)
    expect(isHeaderGroup(undefined)).toBe(false)
  })

  it("a band that forgot its marker is rejected at construction", () => {
    expect(() => gridOf([{ id: "info" }, { id: "name", group: "info" }])).toThrow(
      /named as a header group and carries no band marker/,
    )
  })

  it("a group naming an id no column carries stays legal and becomes a root", () => {
    const gauge = gridOf([{ id: "name", group: "absent" }, { id: "size" }])
    expect(gauge.view.colLeaves.$()).toEqual(["name", "size"])
    expect(gauge.view.cols.$().map((it) => it.depth)).toEqual([0, 0])
  })

  it("a band takes the label off its own header field", () => {
    expect(headerGroup({ id: "info", header: "Info" }).header).toBe("Info")
    expect(headerGroup({ id: "info" }).header).toBe("info")
  })

  it("a band is never sortable, pinnable, or resizable", () => {
    const band = headerGroup({ id: "info" })
    expect([band.sortable, band.pinnable, band.resizable, band.movable]).toEqual([
      false,
      false,
      false,
      false,
    ])
  })
})
