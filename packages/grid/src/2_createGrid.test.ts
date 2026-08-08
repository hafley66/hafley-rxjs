import { describe, it, expect } from "vitest"
import { Signal } from "@hafley66/signals"
import { z } from "zod"
import { createGrid } from "./2_createGrid"

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
    expect(seen).toEqual(["sort"])
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
      sorting: [],
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
