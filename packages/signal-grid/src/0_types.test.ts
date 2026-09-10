// The column read, on its own and through the two stages that use it. `Row` is an interface on
// purpose: `IsRecursive` calls one a leaf, so a path type that stopped there would type nothing.
import { describe, expect, it } from "vitest"
import { columnReader, fieldValue } from "./0_types.js"
import type { ColumnDef } from "./0_types.js"
import { grid } from "./8_grid.js"

interface Address {
  readonly city: string
  readonly zip?: number
}

interface Row {
  readonly id: string
  readonly name: string
  readonly size: number
  readonly owner: { readonly name: string; readonly address?: Address }
  readonly tags: readonly string[]
}

const address = (city: string, zip?: number): Address => ({ city, zip })

const ROWS: readonly Row[] = [
  { id: "a", name: "alpha", size: 30, owner: { name: "ada", address: address("boston", 2) }, tags: ["x"] },
  { id: "b", name: "beta", size: 10, owner: { name: "grace", address: address("austin", 7) }, tags: ["y"] },
  { id: "c", name: "gamma", size: 20, owner: { name: "linus" }, tags: ["z"] },
]

const first = ROWS[0] as Row
const last = ROWS[2] as Row

describe("columnReader", () => {
  it("falls back to the column id when the def carries neither half", () => {
    const col: ColumnDef<Row> = { id: "name" }
    expect(columnReader(col, "name")(first)).toBe("alpha")
  })

  it("falls back to the column id when there is no def at all", () => {
    expect(columnReader<Row>(undefined, "size")(first)).toBe(30)
  })

  it("reads a one-segment field without walking", () => {
    const col: ColumnDef<Row> = { id: "label", field: "name" }
    expect(columnReader(col, "label")(first)).toBe("alpha")
  })

  it("reads a dotted field two levels down", () => {
    const col: ColumnDef<Row> = { id: "city", field: "owner.address.city" }
    expect(columnReader(col, "city")(first)).toBe("boston")
  })

  it("reads an array seat by its numeric segment", () => {
    const col: ColumnDef<Row> = { id: "tag", field: "tags.0" }
    expect(columnReader(col, "tag")(first)).toBe("x")
  })

  it("reads undefined through an absent branch rather than throwing", () => {
    const col: ColumnDef<Row> = { id: "city", field: "owner.address.city" }
    expect(columnReader(col, "city")(last)).toBeUndefined()
  })

  it("uses value when it is the only half given", () => {
    const col: ColumnDef<Row> = { id: "loud", value: (it) => it.name.toUpperCase() }
    expect(columnReader(col, "loud")(first)).toBe("ALPHA")
  })

  it("rejects a column carrying both halves, naming it", () => {
    const col: ColumnDef<Row> = { id: "city", field: "owner.name", value: (it) => it.name }
    expect(() => columnReader(col, "city")).toThrow(/column "city" carries both field and value/)
  })

  it("compiles one reader per def, so a cell render never re-splits a path", () => {
    const col: ColumnDef<Row> = { id: "city", field: "owner.address.city" }
    expect(columnReader(col, "city")).toBe(columnReader(col, "city"))
  })

  it("rejects a field the row has no such path for, while the id stays loose", () => {
    // @ts-expect-error `citty` is a typo, and a path is checked where an id is not
    const typo: ColumnDef<Row> = { id: "anything-at-all", field: "owner.address.citty" }
    const loose: ColumnDef<Row> = { id: "anything-at-all" }
    expect([typo.id, loose.id]).toEqual(["anything-at-all", "anything-at-all"])
  })
})

describe("fieldValue", () => {
  it("reads a checked path off a row", () => {
    expect(fieldValue(first, "owner.address.city")).toBe("boston")
    expect(fieldValue(first, "tags.0")).toBe("x")
  })

  it("reads undefined through an absent branch", () => {
    expect(fieldValue(last, "owner.address.zip")).toBeUndefined()
  })
})

describe("field through the grid", () => {
  const made = (columns: readonly ColumnDef<Row>[]) =>
    grid<Row>({ id: "field-grid", rows: ROWS, columns, rowId: (it) => it.id })

  it("sorts by the value a dotted field names", () => {
    const made0 = made([{ id: "city", field: "owner.address.city" }])
    made0.state.sort.$([{ field: "city", sort: "asc" }])
    expect(made0.view.sorted.$().roots).toEqual(["b", "a", "c"])
  })

  it("groups by the value a dotted field names", () => {
    const made0 = made([{ id: "who", field: "owner.name" }])
    made0.state.group.$(["who"])
    const keys = made0.view.grouped.$().roots
    expect(keys).toHaveLength(3)
  })

  it("rejects a both-carrying column at construction", () => {
    expect(() =>
      made([{ id: "city", field: "owner.name", value: (it) => it.name }]),
    ).toThrow(/carries both field and value/)
  })
})
