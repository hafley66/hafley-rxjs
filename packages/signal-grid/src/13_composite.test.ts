// @vitest-environment jsdom
//
// jsdom because the default cell slot builds DOM. Every other assertion reads the def.
import { describe, expect, test } from "vitest"
import {
  COMPOSITE_PREFIX,
  compositeColumn,
  compositeParts,
  isComposite,
} from "./13_composite.js"
import { defaultState, grid } from "./8_grid.js"
import type { CellCtx, ColumnDef, FlatNode, Renderable, RowId } from "./0_types.js"

type Row = { id: string; name: string; email: string; size: number; note: string }

const CAROL: Row = { id: "r0", name: "carol", email: "carol@x", size: 30, note: "z" }
const ALICE: Row = { id: "r1", name: "alice", email: "alice@x", size: 10, note: "y" }
const BOB: Row = { id: "r2", name: "bob", email: "bob@x", size: 20, note: "x" }
const ROWS: readonly Row[] = [CAROL, ALICE, BOB]

const SOURCE: readonly ColumnDef<Row>[] = [
  { id: "name", width: 120 },
  { id: "email", width: 160, value: (row) => row.email.toUpperCase() },
  { id: "size", width: 80, sortComparator: (left, right) => Number(right) - Number(left) },
  { id: "note", width: 60 },
]

const node = (key: RowId, index: number): FlatNode<RowId> => ({
  key,
  depth: 0,
  index,
  parent: null,
  hasChildren: false,
})

const ctxFor = (data: Row, col: string): CellCtx<Row> => ({
  row: data.id,
  col,
  data,
  value: undefined,
  node: node(data.id, 0),
  editing: false,
})

const asElement = (value: Renderable | { readonly $: unknown }): HTMLElement => {
  if (!(value instanceof HTMLElement)) throw new Error("the default stack returns an element")
  return value
}

const renderCell = (def: ColumnDef<Row>, data: Row): HTMLElement => {
  const slot = def.cell
  if (slot === undefined) throw new Error("a composite always carries a cell slot")
  return asElement(slot(ctxFor(data, def.id)))
}

const ranksOf = (host: HTMLElement): string[] =>
  Array.from(host.querySelectorAll(".sg-composite-part")).map(
    (part) => part.getAttribute("data-rank") ?? "",
  )

describe("parts", () => {
  test("a bare id takes its rank by position, and everything past the second is tertiary", () => {
    const def = compositeColumn<Row>({ parts: ["name", "email", "size", "note"] })
    expect(compositeParts(def)).toEqual([
      { col: "name", rank: "primary" },
      { col: "email", rank: "secondary" },
      { col: "size", rank: "tertiary" },
      { col: "note", rank: "tertiary" },
    ])
  })

  test("an explicit part keeps its declared rank whatever position it sits in", () => {
    const def = compositeColumn<Row>({
      parts: [{ col: "size", rank: "tertiary" }, "name", { col: "note", rank: "primary" }],
    })
    expect(compositeParts(def)).toEqual([
      { col: "size", rank: "tertiary" },
      { col: "name", rank: "secondary" },
      { col: "note", rank: "primary" },
    ])
  })

  test("compositeParts answers empty for a plain column, so a caller need not test first", () => {
    expect(compositeParts<Row>({ id: "name" })).toEqual([])
    expect(isComposite<Row>({ id: "name" })).toBe(false)
  })

  test("the generated id is namespaced by the parts it was built from", () => {
    const def = compositeColumn<Row>({ parts: ["name", "email"] })
    expect(def.id).toBe(`${COMPOSITE_PREFIX}name+email`)
    expect(compositeColumn<Row>({ id: "who", parts: ["name"] }).id).toBe("who")
  })
})

describe("the default stack", () => {
  test("emits one element per part carrying data-rank and data-col, and no inline style", () => {
    const def = compositeColumn<Row>({ parts: ["name", "email", "size"], columns: SOURCE })
    const host = renderCell(def, CAROL)
    expect(host.className).toBe("sg-composite")
    expect(ranksOf(host)).toEqual(["primary", "secondary", "tertiary"])
    const lines = Array.from(host.querySelectorAll(".sg-composite-part"))
    expect(lines.map((part) => part.getAttribute("data-col"))).toEqual(["name", "email", "size"])
    expect(host.getAttribute("style")).toBe(null)
    expect(lines.every((part) => part.getAttribute("style") === null)).toBe(true)
  })

  test("a part reads through the source column's value accessor when it has one", () => {
    const def = compositeColumn<Row>({ parts: ["name", "email"], columns: SOURCE })
    const host = renderCell(def, ALICE)
    expect(host.textContent).toBe("aliceALICE@X")
  })

  test("a part with no accessor behind it falls back to row[col]", () => {
    const def = compositeColumn<Row>({ parts: ["name", "note"] })
    const host = renderCell(def, BOB)
    expect(host.textContent).toBe("bobx")
  })

  test("a part naming a column the schema dropped is skipped rather than thrown", () => {
    const shrunk = SOURCE.filter((col) => col.id !== "email")
    const def = compositeColumn<Row>({ parts: ["name", "email", "size"], columns: () => shrunk })
    const host = renderCell(def, CAROL)
    expect(ranksOf(host)).toEqual(["primary", "tertiary"])
    expect(compositeParts(def, shrunk).map((part) => part.col)).toEqual(["name", "size"])
  })

  test("an explicit cell slot replaces the stack and the ranks stay readable", () => {
    const def = compositeColumn<Row>({
      parts: ["name", "email"],
      columns: SOURCE,
      cell: (cell) => `${cell.row}:one line`,
    })
    expect(def.cell?.(ctxFor(CAROL, def.id))).toBe("r0:one line")
    expect(compositeParts(def).map((part) => part.rank)).toEqual(["primary", "secondary"])
  })
})

describe("sorting", () => {
  test("the composite is sortable and its value is the primary part's", () => {
    const def = compositeColumn<Row>({ parts: ["name", "email"], columns: SOURCE })
    expect(def.sortable).toBe(true)
    expect(def.value?.(CAROL)).toBe("carol")
  })

  test("sortable: false leaves no value-shaped sort and no comparator", () => {
    const def = compositeColumn<Row>({ parts: ["name"], columns: SOURCE, sortable: false })
    expect(def.sortable).toBe(false)
    expect(def.sortComparator).toBe(undefined)
  })

  test("the primary part's comparator comes along, so a reversed column stays reversed", () => {
    const def = compositeColumn<Row>({ parts: ["size", "name"], columns: SOURCE })
    expect(def.sortComparator?.(10, 30)).toBe(20)
  })

  test("clicking the composite header orders the grid by the primary part", () => {
    const def = compositeColumn<Row>({ parts: ["name", "email"], columns: SOURCE })
    const view = grid<Row>({
      id: "composite-sort",
      rows: ROWS,
      columns: [def],
      rowId: (row) => row.id,
      state: defaultState({ sort: [{ field: def.id, sort: "asc" }] }),
    })
    expect(view.view.flat.$().map((entry) => entry.key)).toEqual(["r1", "r2", "r0"])
  })
})

describe("list view", () => {
  test("one composite column plus listView is MUI's listViewColumn, from parts already present", () => {
    const def = compositeColumn<Row>({
      parts: ["name", { col: "email", rank: "secondary" }, { col: "note", rank: "tertiary" }],
      columns: SOURCE,
      flex: 1,
    })
    const view = grid<Row>({
      id: "composite-list",
      rows: ROWS,
      columns: [def],
      rowId: (row) => row.id,
      state: defaultState({ listView: true }),
    })
    const cols = view.view.cols.$()
    expect(cols.map((entry) => entry.key)).toEqual([def.id])
    const host = renderCell(def, CAROL)
    expect(ranksOf(host)).toEqual(["primary", "secondary", "tertiary"])
    expect(host.textContent).toBe("carolCAROL@Xz")
  })
})
