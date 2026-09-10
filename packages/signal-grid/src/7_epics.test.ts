// The epics asserted through `grid()`, because an epic is only ever reached that way: `createSlice`
// reduces on the dispatch call and a computed recomputes on read, so an epic is observed by
// looking at the state it wrote. `withEpics` is the suite's one subscription, and it lives in the
// kit so this file no longer owns a helper every other file wanted.
import { describe, expect, it } from "vitest"
import {
  at,
  cellClick,
  checkboxClick,
  expanderClick,
  flatGrid,
  headerClick,
  headerDown,
  keyPress,
  mods,
  pointerStreams,
  rowDown,
  scrollTo,
  treeGrid,
  withEpics,
  COLUMNS,
  FLAT,
  type Row,
} from "./test/0_kit.js"
import { Signal } from "@hafley66/signals"
import { cellId } from "./0_types.js"
import type { ColumnDef, GridIntent, GridState, Modifiers } from "./0_types.js"
import { rowNumberColumn } from "./5_columns.js"
import { grid, type Grid } from "./8_grid.js"
import { rangeOf, selectionTest } from "./15_selection.js"
import { selectColumnsOnDrag, type GridEpic } from "./7_epics.js"

describe("sortOnHeaderClick", () => {
  it("cycles one column asc, desc, off", () => {
    const { g } = withEpics(flatGrid())
    g.dispatch(headerClick("name"))
    expect(g.state.sort.$()).toEqual([{ field: "name", sort: "asc" }])
    g.dispatch(headerClick("name"))
    expect(g.state.sort.$()).toEqual([{ field: "name", sort: "desc" }])
    g.dispatch(headerClick("name"))
    expect(g.state.sort.$()).toEqual([])
  })

  it("replaces the model on a plain click", () => {
    const { g } = withEpics(flatGrid())
    g.dispatch(headerClick("name"))
    g.dispatch(headerClick("size"))
    expect(g.state.sort.$()).toEqual([{ field: "size", sort: "asc" }])
  })

  it("appends on shift-click and keeps the first column's position", () => {
    const { g } = withEpics(flatGrid())
    g.dispatch(headerClick("name"))
    g.dispatch(headerClick("size", { shift: true }))
    expect(g.state.sort.$()).toEqual([
      { field: "name", sort: "asc" },
      { field: "size", sort: "asc" },
    ])
    g.dispatch(headerClick("name", { shift: true }))
    expect(g.state.sort.$()).toEqual([
      { field: "name", sort: "desc" },
      { field: "size", sort: "asc" },
    ])
  })

  it("reorders the rows it sorted", () => {
    const { g } = withEpics(flatGrid())
    g.dispatch(headerClick("name"))
    expect(g.view.flat.$().map((n) => n.key)).toEqual(["a", "b", "c"])
  })
})

describe("expandOnExpanderClick", () => {
  it("toggles one row", () => {
    const { g } = withEpics(treeGrid())
    g.dispatch(expanderClick("src"))
    expect(g.view.flat.$().map((n) => n.key)).toEqual(["src", "src/a", "src/b", "readme"])
    g.dispatch(expanderClick("src"))
    expect(g.view.flat.$().map((n) => n.key)).toEqual(["src", "readme"])
  })

  it("opens the whole subtree on alt-click", () => {
    const { g } = withEpics(treeGrid())
    g.dispatch(expanderClick("src", { alt: true }))
    expect(g.state.expanded.$()).toEqual({ src: true, "src/a": true, "src/b": true, "src/b/x": true })
    expect(g.view.flat.$().map((n) => n.key)).toEqual([
      "src",
      "src/a",
      "src/b",
      "src/b/x",
      "readme",
    ])
  })

  it("closes the whole subtree on a second alt-click", () => {
    const { g } = withEpics(treeGrid())
    g.dispatch(expanderClick("src", { alt: true }))
    g.dispatch(expanderClick("src", { alt: true }))
    expect(g.view.flat.$().map((n) => n.key)).toEqual(["src", "readme"])
  })
})

describe("selectRowsOnCheckboxClick", () => {
  it("toggles one row", () => {
    const { g } = withEpics(flatGrid())
    g.dispatch(checkboxClick("a"))
    expect(g.state.rowSelection.$()).toEqual({ a: true })
    g.dispatch(checkboxClick("a"))
    expect(g.state.rowSelection.$()).toEqual({ a: false })
  })

  it("selects the range through the last click on shift-click", () => {
    const { g } = withEpics(flatGrid())
    g.dispatch(checkboxClick("c"))
    g.dispatch(checkboxClick("b", { shift: true }))
    expect(g.state.rowSelection.$()).toEqual({ c: true, a: true, b: true })
  })

  it("walks the range in view order, not source order", () => {
    const { g } = withEpics(flatGrid())
    g.dispatch(headerClick("name"))
    g.dispatch(checkboxClick("a"))
    g.dispatch(checkboxClick("b", { shift: true }))
    expect(g.state.rowSelection.$()).toEqual({ a: true, b: true })
  })
})

describe("activateOnCellClick", () => {
  it("turns a plain click into an activate effect", () => {
    const { g, effects } = withEpics(flatGrid())
    g.dispatch(cellClick("a", "name"))
    expect(effects).toEqual([
      { phase: "effect", type: "activate", row: "a", col: "name", value: FLAT[1] },
    ])
  })

  it("stays out of the way of a modified click", () => {
    const { g, effects } = withEpics(flatGrid())
    g.dispatch(cellClick("a", "name", { shift: true }))
    g.dispatch(cellClick("a", "name", { meta: true }))
    expect(effects).toEqual([])
  })
})

describe("resizeOnHeaderDrag", () => {
  it("clamps to the column's minWidth", () => {
    const { move$ } = pointerStreams()
    const { g } = withEpics(flatGrid())
    g.dispatch(headerDown("name", "resize", 0))
    move$.next(at({ clientX: -20 }))
    expect(g.state.colWidth.$()["name"]).toBe(100)
    move$.next(at({ clientX: -200 }))
    expect(g.state.colWidth.$()["name"]).toBe(80)
  })

  it("clamps to the column's maxWidth and commits the last width", () => {
    const { move$, up$ } = pointerStreams()
    const { g } = withEpics(flatGrid())
    g.dispatch(headerDown("name", "resize", 0))
    move$.next(at({ clientX: 500 }))
    up$.next(at({ clientX: 500 }))
    expect(g.state.colWidth.$()["name"]).toBe(200)
  })

  it("stops listening after the pointer comes up", () => {
    const { move$, up$ } = pointerStreams()
    const { g } = withEpics(flatGrid())
    g.dispatch(headerDown("name", "resize", 0))
    move$.next(at({ clientX: 30 }))
    up$.next(at({ clientX: 30 }))
    move$.next(at({ clientX: -500 }))
    expect(g.state.colWidth.$()["name"]).toBe(150)
  })
})

describe("moveColumnOnHeaderDrag", () => {
  it("reorders once the pointer passes half of the next column", () => {
    const { move$ } = pointerStreams()
    const { g } = withEpics(flatGrid())
    g.dispatch(headerDown("name", "move", 0))
    move$.next(at({ clientX: 10 }))
    expect(g.view.cols.$().map((n) => n.key)).toEqual(["name", "size"])
    move$.next(at({ clientX: 60 }))
    expect(g.state.colOrder.$()).toEqual(["size", "name"])
    expect(g.view.cols.$().map((n) => n.key)).toEqual(["size", "name"])
  })

  it("restores the order when the drag returns to where it started", () => {
    const { move$, up$ } = pointerStreams()
    const { g } = withEpics(flatGrid())
    g.dispatch(headerDown("name", "move", 0))
    move$.next(at({ clientX: 60 }))
    up$.next(at({ clientX: 0 }))
    expect(g.state.colOrder.$()).toEqual(["name", "size"])
  })
})

describe("moveRowOnRowDrag", () => {
  it("emits one reorderRow effect on commit and none while moving", () => {
    const { move$, up$ } = pointerStreams()
    const { g, effects } = withEpics(flatGrid())
    g.dispatch(rowDown("c", 0))
    move$.next(at({ clientY: 40 }))
    expect(effects).toEqual([])
    up$.next(at({ clientY: 40 }))
    expect(effects).toEqual([{ phase: "effect", type: "reorderRow", row: "c", before: "b" }])
  })
})

describe("keyboardNav", () => {
  it("moves focus down the flat list and back up", () => {
    const { g } = withEpics(flatGrid())
    g.dispatch(keyPress("ArrowDown"))
    expect(g.state.focus.$()).toBe(cellId("c", "name"))
    g.dispatch(keyPress("ArrowDown"))
    expect(g.state.focus.$()).toBe(cellId("a", "name"))
    g.dispatch(keyPress("ArrowUp"))
    expect(g.state.focus.$()).toBe(cellId("c", "name"))
  })

  it("expands with ArrowRight and collapses with ArrowLeft", () => {
    const { g } = withEpics(treeGrid())
    g.dispatch(keyPress("ArrowDown"))
    g.dispatch(keyPress("ArrowRight"))
    expect(g.view.flat.$().map((n) => n.key)).toEqual(["src", "src/a", "src/b", "readme"])
    g.dispatch(keyPress("ArrowLeft"))
    expect(g.view.flat.$().map((n) => n.key)).toEqual(["src", "readme"])
  })

  it("steps to the parent when ArrowLeft has nothing to collapse", () => {
    const { g } = withEpics(treeGrid())
    g.dispatch(expanderClick("src"))
    g.dispatch(keyPress("ArrowDown"))
    g.dispatch(keyPress("ArrowDown"))
    expect(g.state.focus.$()).toBe(cellId("src/a", "name"))
    g.dispatch(keyPress("ArrowLeft"))
    expect(g.state.focus.$()).toBe(cellId("src", "name"))
  })

  it("toggles selection with Space and activates with Enter", () => {
    const { g, effects } = withEpics(flatGrid())
    g.dispatch(keyPress("ArrowDown"))
    g.dispatch(keyPress(" "))
    expect(g.state.rowSelection.$()).toEqual({ c: true })
    g.dispatch(keyPress("Enter"))
    expect(effects).toEqual([
      { phase: "effect", type: "activate", row: "c", col: "name", value: FLAT[0] },
    ])
  })
})

describe("pageOnScrollNearEnd", () => {
  const infinite = () =>
    flatGrid({ page: { mode: "infinite", index: 0, size: 2, total: null } }, 0)

  it("raises the index once per boundary, not once per scroll event", () => {
    const { g } = withEpics(infinite())
    g.dispatch(scrollTo(0))
    expect(g.state.page.$().index).toBe(0)
    g.dispatch(scrollTo(80))
    expect(g.state.page.$().index).toBe(1)
    g.dispatch(scrollTo(80))
    g.dispatch(scrollTo(90))
    expect(g.state.page.$().index).toBe(1)
  })

  it("stops at a known total", () => {
    const { g } = withEpics(flatGrid({ page: { mode: "infinite", index: 0, size: 2, total: 2 } }, 0))
    g.dispatch(scrollTo(500))
    expect(g.state.page.$().index).toBe(0)
  })

  it("leaves a paged grid alone", () => {
    const { g } = withEpics(flatGrid({ page: { mode: "pages", index: 0, size: 2, total: null } }, 0))
    g.dispatch(scrollTo(500))
    expect(g.state.page.$().index).toBe(0)
  })
})

// --- Range selection --------------------------------------------------------

const cellDown = (row: string, col: string, over: Partial<Modifiers> = {}): GridIntent => ({
  phase: "intent",
  type: "cell.pointerdown",
  row,
  col,
  mods: mods(over),
})

/** No modifiers: the pointerdown that opened the drag already said what they were. */
const cellEnter = (row: string, col: string): GridIntent => ({
  phase: "intent",
  type: "cell.pointerenter",
  row,
  col,
})

/** Three columns and three rows, so a rectangle has an inside as well as two edges. */
const RANGE_COLUMNS: readonly ColumnDef<Row>[] = [...COLUMNS, { id: "id", width: 80 }]

const rangeGrid = (
  over: Partial<GridState> = {},
  columns: readonly ColumnDef<Row>[] = RANGE_COLUMNS,
  epics?: readonly GridEpic<Row>[],
): Grid<Row> =>
  grid<Row>({
    id: "t",
    rows: FLAT,
    columns,
    rowId: (row) => row.id,
    state: Signal<Partial<GridState>>(over),
    epics,
  })

// Read back through the two seats rather than through rows and columns, so one reader serves both
// orientations and the transposed case asserts the same way the plain one does.
const selected = (g: Grid<Row>): string[] => {
  const range = rangeOf(g.state.selection.$())
  const vertical = g.view.vertical.$().nodes.map((node) => node.key)
  const horizontal = g.view.horizontal.$().nodes.map((node) => node.key)
  const covers = selectionTest(range, vertical, horizontal)
  const out: string[] = []
  for (const down of vertical) {
    for (const across of horizontal) {
      if (covers(cellId(down, across))) out.push(`${down}/${across}`)
    }
  }
  return out
}

describe("selectCellsOnDrag", () => {
  it("selects the nine cells a three-by-three drag crossed", () => {
    const { up$ } = pointerStreams()
    const { g } = withEpics(rangeGrid())
    g.dispatch(cellDown("c", "name"))
    g.dispatch(cellEnter("a", "size"))
    g.dispatch(cellEnter("b", "id"))
    up$.next(at({}))
    expect(selected(g)).toEqual([
      "c/name", "c/size", "c/id",
      "a/name", "a/size", "a/id",
      "b/name", "b/size", "b/id",
    ])
  })

  it("selects the same nine dragging backwards", () => {
    const { up$ } = pointerStreams()
    const { g } = withEpics(rangeGrid())
    g.dispatch(cellDown("b", "id"))
    g.dispatch(cellEnter("c", "name"))
    up$.next(at({}))
    expect(selected(g)).toHaveLength(9)
    expect(selected(g)[0]).toBe("c/name")
  })

  it("writes the rectangle while the drag is still open", () => {
    pointerStreams()
    const { g } = withEpics(rangeGrid())
    g.dispatch(cellDown("c", "name"))
    g.dispatch(cellEnter("a", "size"))
    expect(selected(g)).toEqual(["c/name", "c/size", "a/name", "a/size"])
  })

  it("writes nothing for a repeated hover over the cell the head already names", () => {
    pointerStreams()
    const { g } = withEpics(rangeGrid())
    g.dispatch(cellDown("c", "name"))
    g.dispatch(cellEnter("a", "size"))
    const written = g.state.selection.$()
    g.dispatch(cellEnter("a", "size"))
    expect(g.state.selection.$()).toBe(written)
  })

  it("collapses a plain click with no movement to one cell", () => {
    const { up$ } = pointerStreams()
    const { g } = withEpics(rangeGrid())
    g.dispatch(cellDown("a", "size"))
    up$.next(at({}))
    expect(selected(g)).toEqual(["a/size"])
  })

  it("ignores a hover with no button held", () => {
    const { up$ } = pointerStreams()
    const { g } = withEpics(rangeGrid())
    g.dispatch(cellEnter("a", "size"))
    expect(selected(g)).toEqual([])
    g.dispatch(cellDown("a", "size"))
    up$.next(at({}))
    g.dispatch(cellEnter("b", "id"))
    expect(selected(g)).toEqual(["a/size"])
  })

  it("extends the anchor on shift instead of starting fresh", () => {
    const { up$ } = pointerStreams()
    const { g } = withEpics(rangeGrid())
    g.dispatch(cellDown("c", "name"))
    up$.next(at({}))
    g.dispatch(cellDown("b", "id", { shift: true }))
    up$.next(at({}))
    expect(selected(g)).toHaveLength(9)
  })

  it("adds a second block on ctrl and replaces it without", () => {
    const { up$ } = pointerStreams()
    const { g } = withEpics(rangeGrid())
    g.dispatch(cellDown("c", "name"))
    up$.next(at({}))
    g.dispatch(cellDown("b", "id", { ctrl: true }))
    up$.next(at({}))
    expect(selected(g)).toEqual(["c/name", "b/id"])
    g.dispatch(cellDown("a", "size"))
    up$.next(at({}))
    expect(selected(g)).toEqual(["a/size"])
  })

  it("adds a second block on meta as well", () => {
    const { up$ } = pointerStreams()
    const { g } = withEpics(rangeGrid())
    g.dispatch(cellDown("c", "name"))
    up$.next(at({}))
    g.dispatch(cellDown("b", "id", { meta: true }))
    up$.next(at({}))
    expect(selected(g)).toEqual(["c/name", "b/id"])
  })

  it("leaves a secondary button alone", () => {
    const { up$ } = pointerStreams()
    const { g } = withEpics(rangeGrid())
    g.dispatch(cellDown("c", "name", { button: 2 }))
    g.dispatch(cellEnter("a", "size"))
    up$.next(at({}))
    expect(selected(g)).toEqual([])
  })

  it("clears on Escape", () => {
    const { up$ } = pointerStreams()
    const { g } = withEpics(rangeGrid())
    g.dispatch(cellDown("c", "name"))
    g.dispatch(cellEnter("b", "id"))
    up$.next(at({}))
    g.dispatch(keyPress("Escape"))
    expect(selected(g)).toEqual([])
  })

  it("selects the transposed rectangle under orientation columns", () => {
    const { up$ } = pointerStreams()
    const { g } = withEpics(rangeGrid({ orientation: "columns" }))
    g.dispatch(cellDown("c", "name"))
    g.dispatch(cellEnter("a", "size"))
    up$.next(at({}))
    expect(selected(g)).toEqual(["name/c", "name/a", "size/c", "size/a"])
  })
})

describe("selectRowsOnDrag", () => {
  const gutter = (): readonly ColumnDef<Row>[] => [rowNumberColumn<Row>(), ...RANGE_COLUMNS]

  it("covers every column of every row the gutter drag crossed", () => {
    const { up$ } = pointerStreams()
    const { g } = withEpics(rangeGrid({}, gutter()))
    g.dispatch(cellDown("c", "__rowNumber"))
    g.dispatch(cellEnter("a", "name"))
    up$.next(at({}))
    expect(selected(g)).toEqual([
      "c/__rowNumber", "c/name", "c/size", "c/id",
      "a/__rowNumber", "a/name", "a/size", "a/id",
    ])
  })

  it("covers one whole row for a click that never moved", () => {
    const { up$ } = pointerStreams()
    const { g } = withEpics(rangeGrid({}, gutter()))
    g.dispatch(cellDown("b", "__rowNumber"))
    up$.next(at({}))
    expect(selected(g)).toEqual(["b/__rowNumber", "b/name", "b/size", "b/id"])
  })

  it("leaves the gutter to the row epic, so a cell block never opens there", () => {
    const { up$ } = pointerStreams()
    const { g } = withEpics(rangeGrid({}, gutter()))
    g.dispatch(cellDown("b", "__rowNumber"))
    up$.next(at({}))
    expect(rangeOf(g.state.selection.$()).mode).toBe("row")
  })
})

describe("selectColumnsOnDrag", () => {
  // The default opener waits for the header part the `0_types.ts` patch adds, so the test names
  // the part that exists today and drives the same gesture through it.
  const columnEpics = (): readonly GridEpic<Row>[] => [
    selectColumnsOnDrag<Row>(undefined, (part) => part === "move"),
  ]

  it("covers every row of the columns the header drag crossed", () => {
    const { up$ } = pointerStreams()
    const { g } = withEpics(rangeGrid({}, RANGE_COLUMNS, columnEpics()))
    g.dispatch(headerDown("size", "move", 0))
    g.dispatch(cellEnter("a", "id"))
    up$.next(at({}))
    expect(selected(g)).toEqual(["c/size", "c/id", "a/size", "a/id", "b/size", "b/id"])
  })

  it("covers one whole column for a header click that never moved", () => {
    const { up$ } = pointerStreams()
    const { g } = withEpics(rangeGrid({}, RANGE_COLUMNS, columnEpics()))
    g.dispatch(headerDown("name", "move", 0))
    up$.next(at({}))
    expect(selected(g)).toEqual(["c/name", "a/name", "b/name"])
  })

  it("stays shut for the two header parts already spoken for", () => {
    const { up$ } = pointerStreams()
    const { g } = withEpics(rangeGrid())
    g.dispatch(headerDown("name", "move", 0))
    g.dispatch(headerDown("name", "resize", 0))
    up$.next(at({}))
    expect(selected(g)).toEqual([])
  })
})
