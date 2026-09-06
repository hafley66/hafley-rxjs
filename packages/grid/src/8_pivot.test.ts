import { describe, expect, it } from "vitest"
import { Signal } from "@hafley66/signals"
import { z } from "zod"
import { createGrid } from "./2_createGrid"

const RowSchema = z.object({ id: z.string(), level: z.string(), n: z.number() })
type Row = z.infer<typeof RowSchema>

const source = Signal<Row[]>([
  { id: "a", level: "error", n: 1 },
  { id: "b", level: "info", n: 2 },
  { id: "c", level: "error", n: 3 },
])

describe("grid.pivot", () => {
  it("returns a derived grid filtered to rows matching the column value", () => {
    const grid = createGrid({ schema: RowSchema, rows: source, getRowId: (r) => r.id, mode: "client" })
    const errors = grid.pivot("level", "error")
    expect(errors.rows.$().map((r) => r.id)).toEqual(["a", "c"])
  })

  it("drops the pivoted column from the derived grid's columns", () => {
    const grid = createGrid({ schema: RowSchema, rows: source, getRowId: (r) => r.id, mode: "client" })
    const errors = grid.pivot("level", "error")
    expect(errors.columns.map((c) => c.id)).toEqual(["id", "n"])
  })

  it("stays live: the source grid's own rows are unaffected", () => {
    const grid = createGrid({ schema: RowSchema, rows: source, getRowId: (r) => r.id, mode: "client" })
    grid.pivot("level", "error")
    expect(grid.rows.$().map((r) => r.id)).toEqual(["a", "b", "c"])
  })

  it("can be pivoted again, narrowing further", () => {
    const grid = createGrid({ schema: RowSchema, rows: source, getRowId: (r) => r.id, mode: "client" })
    const errors = grid.pivot("level", "error")
    const errorC = errors.pivot("id", "c")
    expect(errorC.rows.$().map((r) => r.n)).toEqual([3])
  })
})
