import { describe, it, expect } from "vitest"
import { Signal } from "@hafley66/signals"
import { createGrid } from "./2_createGrid"

type Row = { id: string; n: number }

const source = Signal<Row[]>([
  { id: "a", n: 3 },
  { id: "b", n: 1 },
  { id: "c", n: 2 },
])

const newGrid = (mode: "client" | "server") =>
  createGrid({ rows: source, columns: [], getRowId: (r) => r.id, mode })

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
    grid.events.$.subscribe((e) => seen.push(e.type))

    grid.onSortingChange([{ id: "n", desc: false }])

    expect(grid.state.sorting.$()).toEqual([{ id: "n", desc: false }])
    expect(seen).toEqual(["sort"])
  })

  it("onPaginationChange writes the state signal and emits a page event", () => {
    const grid = newGrid("client")
    const seen: string[] = []
    grid.events.$.subscribe((e) => seen.push(e.type))

    grid.onPaginationChange({ pageIndex: 2, pageSize: 50 })

    expect(grid.state.pagination.$()).toEqual({ pageIndex: 2, pageSize: 50 })
    expect(seen).toEqual(["page"])
  })

  it("accepts updater functions, matching TanStack onXChange contracts", () => {
    const grid = newGrid("client")
    grid.onSortingChange([{ id: "n", desc: false }])

    grid.onPaginationChange((prev) => ({ ...prev, pageIndex: prev.pageIndex + 1 }))

    expect(grid.state.pagination.$().pageIndex).toBe(1)
  })

  it("accepts an externally-owned state signal", () => {
    const state = Signal({
      sorting: [],
      pagination: { pageIndex: 0, pageSize: 5 },
    })
    const grid = createGrid({
      rows: source,
      columns: [],
      getRowId: (r) => r.id,
      mode: "client",
      state,
    })

    state.sorting.$([{ id: "n", desc: true }])
    expect(grid.rows.$().map((r) => r.n)).toEqual([3, 2, 1])
  })

  it("re-derives rows when the source rows signal changes", () => {
    const grid = newGrid("client")
    grid.onSortingChange([{ id: "n", desc: false }])

    source.$([{ id: "x", n: 0 }, { id: "y", n: 5 }])
    expect(grid.rows.$().map((r) => r.n)).toEqual([0, 5])

    source.$([
      { id: "a", n: 3 },
      { id: "b", n: 1 },
      { id: "c", n: 2 },
    ])
  })
})
