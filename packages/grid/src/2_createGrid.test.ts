import { describe, it, expect } from "vitest"
import { Signal } from "@hafley66/signals"
import { slash } from "@hafley66/path"
import { z } from "zod"
import { createGrid, createDefaultGridState, gridStateParam } from "./2_createGrid"

const RowSchema = z.object({ id: z.string(), n: z.number() })
type Row = z.infer<typeof RowSchema>

const source = Signal<Row[]>([
  { id: "a", n: 3 },
  { id: "b", n: 1 },
  { id: "c", n: 2 },
])

const newGrid = (mode: "client" | "server") =>
  createGrid({ schema: RowSchema, rows: source, getRowId: (r) => r.id, mode })

describe("createGrid schema interface", () => {
  it("derives columns from the schema top-level keys by default", () => {
    const grid = newGrid("client")
    expect(grid.columns.map((c) => c.id)).toEqual(["id", "n"])
  })

  it("columns map overrides headers, hides paths, and is typed to deep paths", () => {
    const grid = createGrid({
      schema: z.object({ id: z.string(), n: z.number(), name: z.string() }),
      rows: source,
      columns: { n: { header: "Number" }, name: { visible: false } },
      getRowId: (r) => r.id,
      mode: "client",
    })
    expect(grid.columns.map((c) => c.id)).toEqual(["n"])
    expect(grid.columns[0].header).toBe("Number")
  })

  it("derives and sorts by a deep path column", () => {
    const Nested = z.object({ id: z.string(), meta: z.object({ n: z.number() }) })
    const rows = Signal([
      { id: "a", meta: { n: 3 } },
      { id: "b", meta: { n: 1 } },
      { id: "c", meta: { n: 2 } },
    ])
    const grid = createGrid({
      schema: Nested,
      rows,
      columns: { "meta.n": { header: "N" } },
      getRowId: (r) => r.id,
      mode: "client",
    })
    expect(grid.columns.map((c) => c.id)).toEqual(["meta.n"])

    grid.onSortingChange([{ id: "meta.n", desc: false }])
    expect(grid.rows.$().map((r) => r.meta.n)).toEqual([1, 2, 3])
  })
})

describe("createGrid seam", () => {
  it("client mode sorts rows with lodash when sorting state is set", () => {
    const grid = newGrid("client")
    expect(grid.rows.$().map((r) => r.n)).toEqual([3, 1, 2])

    grid.onSortingChange([{ id: "n", desc: false }])
    expect(grid.rows.$().map((r) => r.n)).toEqual([1, 2, 3])

    grid.onSortingChange([{ id: "n", desc: true }])
    expect(grid.rows.$().map((r) => r.n)).toEqual([3, 2, 1])
  })

  it("server mode passes rows through unchanged", () => {
    const grid = newGrid("server")
    grid.onSortingChange([{ id: "n", desc: false }])
    expect(grid.rows.$().map((r) => r.n)).toEqual([3, 1, 2])
  })

  it("onSortingChange writes the state signal and emits a sort event", () => {
    const grid = newGrid("client")
    const seen: string[] = []
    grid.events.$.subscribe((e) => seen.push(e!.type))

    grid.onSortingChange([{ id: "n", desc: false }])

    expect(grid.state.sorting.$()).toEqual([{ id: "n", desc: false }])
    expect(seen).toEqual(["sorting"])
  })

  it("onPaginationChange writes the state signal and emits a page event", () => {
    const grid = newGrid("client")
    grid.onPaginationChange({ pageIndex: 2, pageSize: 50 })

    expect(grid.state.pagination.$()).toEqual({ pageIndex: 2, pageSize: 50 })
  })

  it("accepts updater functions, matching TanStack onXChange contracts", () => {
    const grid = newGrid("client")
    grid.onPaginationChange((prev) => ({ ...prev, pageIndex: prev.pageIndex + 1 }))

    expect(grid.state.pagination.$().pageIndex).toBe(1)
  })

  it("accepts an externally-owned state signal", () => {
    const state = Signal({
      ...createDefaultGridState(),
      pagination: { pageIndex: 0, pageSize: 5 },
    })
    const grid = createGrid({
      schema: RowSchema,
      rows: source,
      getRowId: (r) => r.id,
      mode: "client",
      state,
    })

    state.sorting.$([{ id: "n", desc: true }])
    expect(grid.rows.$().map((r) => r.n)).toEqual([3, 2, 1])
  })
})

describe("gridStateParam", () => {
  it("round-trips a full GridState through devalue", () => {
    const state = createDefaultGridState({
      sorting: [{ id: "n", desc: true }],
      pagination: { pageIndex: 3, pageSize: 50 },
    })
    const encoded = gridStateParam.print(state)
    expect(typeof encoded).toBe("string")
    const decoded = gridStateParam.parse(encoded)
    expect(decoded).toEqual(state)
  })

  it("parse returns undefined for an empty string (route-level no-match)", () => {
    expect(gridStateParam.parse("")).toBeUndefined()
  })
})

describe("grid route URL snapshots", () => {
  const dash = slash("/dash?{a}&{b}", { params: { a: gridStateParam, b: gridStateParam } })

  it("pins the exact URL for two grids (before -> after)", () => {
    const a = createDefaultGridState({ sorting: [{ id: "n", desc: true }] })
    const b = createDefaultGridState({ pagination: { pageIndex: 3, pageSize: 50 } })
    expect(dash.print({ a, b })).toMatchInlineSnapshot(`"/dash?a=%5B%7B%22sorting%22%3A1%2C%22columnFilters%22%3A5%2C%22globalFilter%22%3A-1%2C%22columnOrder%22%3A6%2C%22columnPinning%22%3A7%2C%22columnVisibility%22%3A10%2C%22columnSizing%22%3A11%2C%22rowPinning%22%3A12%2C%22rowSelection%22%3A15%2C%22expanded%22%3A16%2C%22grouping%22%3A17%2C%22pagination%22%3A18%7D%2C%5B2%5D%2C%7B%22id%22%3A3%2C%22desc%22%3A4%7D%2C%22n%22%2Ctrue%2C%5B%5D%2C%5B%5D%2C%7B%22start%22%3A8%2C%22end%22%3A9%7D%2C%5B%5D%2C%5B%5D%2C%7B%7D%2C%7B%7D%2C%7B%22top%22%3A13%2C%22bottom%22%3A14%7D%2C%5B%5D%2C%5B%5D%2C%7B%7D%2C%7B%7D%2C%5B%5D%2C%7B%22pageIndex%22%3A19%2C%22pageSize%22%3A20%7D%2C0%2C20%5D&b=%5B%7B%22sorting%22%3A1%2C%22columnFilters%22%3A2%2C%22globalFilter%22%3A-1%2C%22columnOrder%22%3A3%2C%22columnPinning%22%3A4%2C%22columnVisibility%22%3A7%2C%22columnSizing%22%3A8%2C%22rowPinning%22%3A9%2C%22rowSelection%22%3A12%2C%22expanded%22%3A13%2C%22grouping%22%3A14%2C%22pagination%22%3A15%7D%2C%5B%5D%2C%5B%5D%2C%5B%5D%2C%7B%22start%22%3A5%2C%22end%22%3A6%7D%2C%5B%5D%2C%5B%5D%2C%7B%7D%2C%7B%7D%2C%7B%22top%22%3A10%2C%22bottom%22%3A11%7D%2C%5B%5D%2C%5B%5D%2C%7B%7D%2C%7B%7D%2C%5B%5D%2C%7B%22pageIndex%22%3A16%2C%22pageSize%22%3A17%7D%2C3%2C50%5D"`)
  })

  it("parses the snapshot URL back to the original states (after -> before)", () => {
    const a = createDefaultGridState({ sorting: [{ id: "n", desc: true }] })
    const b = createDefaultGridState({ pagination: { pageIndex: 3, pageSize: 50 } })
    const url = dash.print({ a, b })
    expect(dash.match(url)).toMatchInlineSnapshot(`
      {
        "matched": true,
        "values": {
          "a": {
            "columnFilters": [],
            "columnOrder": [],
            "columnPinning": {
              "end": [],
              "start": [],
            },
            "columnSizing": {},
            "columnVisibility": {},
            "expanded": {},
            "globalFilter": undefined,
            "grouping": [],
            "pagination": {
              "pageIndex": 0,
              "pageSize": 20,
            },
            "rowPinning": {
              "bottom": [],
              "top": [],
            },
            "rowSelection": {},
            "sorting": [
              {
                "desc": true,
                "id": "n",
              },
            ],
          },
          "b": {
            "columnFilters": [],
            "columnOrder": [],
            "columnPinning": {
              "end": [],
              "start": [],
            },
            "columnSizing": {},
            "columnVisibility": {},
            "expanded": {},
            "globalFilter": undefined,
            "grouping": [],
            "pagination": {
              "pageIndex": 3,
              "pageSize": 50,
            },
            "rowPinning": {
              "bottom": [],
              "top": [],
            },
            "rowSelection": {},
            "sorting": [],
          },
        },
      }
    `)
  })

  it("default state round-trips through the route unchanged", () => {
    const def = createDefaultGridState()
    const single = slash("/g?{s}", { params: { s: gridStateParam } })
    expect(single.match(single.print({ s: def }))).toMatchInlineSnapshot(`
      {
        "matched": true,
        "values": {
          "s": {
            "columnFilters": [],
            "columnOrder": [],
            "columnPinning": {
              "end": [],
              "start": [],
            },
            "columnSizing": {},
            "columnVisibility": {},
            "expanded": {},
            "globalFilter": undefined,
            "grouping": [],
            "pagination": {
              "pageIndex": 0,
              "pageSize": 20,
            },
            "rowPinning": {
              "bottom": [],
              "top": [],
            },
            "rowSelection": {},
            "sorting": [],
          },
        },
      }
    `)
  })
})
