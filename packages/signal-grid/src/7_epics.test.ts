// The epics asserted through `grid()`, because an epic is only ever reached that way: `createSlice`
// reduces on the dispatch call and a computed recomputes on read, so an epic is observed by
// looking at the state it wrote. `withEpics` is the suite's one subscription, and it lives in the
// kit so this file no longer owns a helper every other file wanted.
import { describe, expect, it } from "vitest"
import {
  at,
  cellClick,
  cellDoubleClick,
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
  TREE,
  treeGrid,
  withEpics,
  COLUMNS,
  FLAT,
  type Row,
} from "./test/0_kit.js"
import { Signal } from "@hafley66/signals"
import { cellId } from "./0_types.js"
import type { ColumnDef, GridIntent, GridState, Modifiers } from "./0_types.js"
import { BUILT_IN_IDS, checkboxColumn, expandColumn, radioColumn, rowNumberColumn } from "./5_columns.js"
import { grid, type Grid } from "./8_grid.js"
import { rangeOf, selectionTest } from "./15_selection.js"
import {
  expandOnCellDoubleClick,
  expandOnExpanderClick,
  type DragMode,
  selectColumnsOnDrag,
  selectRowsOnCellClick,
  toggleExpandAllOnHeaderClick,
  toggleSelectAllOnHeaderClick,
  type GridEpic,
} from "./7_epics.js"

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

describe("expandOnCellDoubleClick", () => {
  const treeEpics = (over: readonly GridEpic<Row>[] = []): readonly GridEpic<Row>[] => [
    expandOnCellDoubleClick<Row>(),
    ...over,
  ]

  const doubleClickGrid = (epics: readonly GridEpic<Row>[]): Grid<Row> =>
    grid<Row>({
      id: "t",
      rows: TREE,
      columns: COLUMNS,
      rowId: (row) => row.id,
      subRows: (row) => row.kids,
      state: Signal<Partial<GridState>>({}),
      epics,
    })

  it("opens the row the double click named, and closes it on the next one", () => {
    const { g } = withEpics(doubleClickGrid(treeEpics()))
    g.dispatch(cellDoubleClick("src", "name"))
    expect(g.view.flat.$().map((n) => n.key)).toEqual(["src", "src/a", "src/b", "readme"])
    g.dispatch(cellDoubleClick("src", "name"))
    expect(g.view.flat.$().map((n) => n.key)).toEqual(["src", "readme"])
  })

  it("writes nothing for a leaf, which has nothing to open", () => {
    const { g } = withEpics(doubleClickGrid(treeEpics()))
    g.dispatch(cellDoubleClick("readme", "name"))
    expect(g.state.expanded.$()).toEqual({})
  })

  it("opens the whole branch on alt, the same modifier the glyph reads", () => {
    const { g } = withEpics(doubleClickGrid(treeEpics()))
    g.dispatch(cellDoubleClick("src", "name", { alt: true }))
    expect(g.state.expanded.$()).toEqual({ src: true, "src/a": true, "src/b": true, "src/b/x": true })
  })

  it("leaves the glyph's own double click to the two clicks under it", () => {
    const { g } = withEpics(doubleClickGrid(treeEpics([expandOnExpanderClick<Row>()])))
    g.dispatch(expanderClick("src"))
    g.dispatch(expanderClick("src"))
    g.dispatch(cellDoubleClick("src", "name", {}, true))
    expect(g.view.flat.$().map((n) => n.key)).toEqual(["src", "readme"])
  })

  it("leaves the row selected beside it, because a plain click replaces the selection twice", () => {
    const { g } = withEpics(doubleClickGrid(treeEpics([selectRowsOnCellClick<Row>()])))
    g.dispatch(cellClick("src", "name"))
    g.dispatch(cellClick("src", "name"))
    g.dispatch(cellDoubleClick("src", "name"))
    expect(g.state.rowSelection.$()).toEqual({ src: true })
    expect(g.state.expanded.$()).toEqual({ src: true })
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

describe("selectRowsOnCellClick", () => {
  const clickGrid = (columns: readonly ColumnDef<Row>[] = COLUMNS): Grid<Row> =>
    grid<Row>({
      id: "t",
      rows: FLAT,
      columns,
      rowId: (row) => row.id,
      epics: [selectRowsOnCellClick<Row>()],
    })

  it("replaces the selection on a plain click", () => {
    const { g } = withEpics(clickGrid())
    g.dispatch(cellClick("c", "name"))
    expect(g.state.rowSelection.$()).toEqual({ c: true })
    g.dispatch(cellClick("a", "size"))
    expect(g.state.rowSelection.$()).toEqual({ a: true })
  })

  it("toggles one row on ctrl and on meta, leaving the rest alone", () => {
    const { g } = withEpics(clickGrid())
    g.dispatch(cellClick("c", "name"))
    g.dispatch(cellClick("a", "name", { ctrl: true }))
    expect(g.state.rowSelection.$()).toEqual({ c: true, a: true })
    g.dispatch(cellClick("a", "name", { meta: true }))
    expect(g.state.rowSelection.$()).toEqual({ c: true, a: false })
  })

  it("fills the range from the anchor the last plain click left", () => {
    const { g } = withEpics(clickGrid())
    g.dispatch(cellClick("c", "name"))
    g.dispatch(cellClick("b", "name", { shift: true }))
    expect(g.state.rowSelection.$()).toEqual({ c: true, a: true, b: true })
  })

  it("selects one row at a time behind a radio column", () => {
    const { g } = withEpics(clickGrid([radioColumn<Row>(), ...COLUMNS]))
    g.dispatch(cellClick("c", "name"))
    g.dispatch(cellClick("a", "name", { ctrl: true }))
    expect(g.state.rowSelection.$()).toEqual({ a: true })
  })

  it("leaves a click that landed on a link or a glyph to the control", () => {
    const { g } = withEpics(clickGrid())
    g.dispatch(cellClick("c", "name", {}, true))
    expect(g.state.rowSelection.$()).toEqual({})
  })

  it("leaves a secondary button alone", () => {
    const { g } = withEpics(clickGrid())
    g.dispatch(cellClick("c", "name", { button: 2 }))
    expect(g.state.rowSelection.$()).toEqual({})
  })
})

describe("the two tri-state header toggles", () => {
  const toggleGrid = (
    columns: readonly ColumnDef<Row>[],
    epics: readonly GridEpic<Row>[],
  ): Grid<Row> =>
    grid<Row>({
      id: "t",
      rows: TREE,
      columns,
      rowId: (row) => row.id,
      subRows: (row) => row.kids,
      epics,
    })

  it("fills every selectable row from the checkbox header, and clears it on the next click", () => {
    const columns = [checkboxColumn<Row>(), ...COLUMNS]
    const { g } = withEpics(toggleGrid(columns, [toggleSelectAllOnHeaderClick<Row>()]))
    g.dispatch(headerClick(BUILT_IN_IDS.check))
    expect(g.state.rowSelection.$()).toEqual({ src: true, readme: true })
    g.dispatch(headerClick(BUILT_IN_IDS.check))
    expect(g.state.rowSelection.$()).toEqual({ src: false, readme: false })
  })

  it("opens every branch from the expand header, including the ones the flat list hides", () => {
    const columns = [expandColumn<Row>(), ...COLUMNS]
    const { g } = withEpics(toggleGrid(columns, [toggleExpandAllOnHeaderClick<Row>()]))
    g.dispatch(headerClick(BUILT_IN_IDS.expand))
    expect(g.state.expanded.$()).toEqual({ src: true, "src/b": true })
    expect(g.view.flat.$().map((n) => n.key)).toEqual([
      "src",
      "src/a",
      "src/b",
      "src/b/x",
      "readme",
    ])
    g.dispatch(headerClick(BUILT_IN_IDS.expand))
    expect(g.view.flat.$().map((n) => n.key)).toEqual(["src", "readme"])
  })

  it("answers to its own column and to no other header", () => {
    const columns = [checkboxColumn<Row>(), expandColumn<Row>(), ...COLUMNS]
    const { g } = withEpics(
      toggleGrid(columns, [toggleSelectAllOnHeaderClick<Row>(), toggleExpandAllOnHeaderClick<Row>()]),
    )
    g.dispatch(headerClick("name"))
    expect(g.state.rowSelection.$()).toEqual({})
    expect(g.state.expanded.$()).toEqual({})
    g.dispatch(headerClick(BUILT_IN_IDS.check))
    expect(g.state.expanded.$()).toEqual({})
    expect(g.state.rowSelection.$()).toEqual({ src: true, readme: true })
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

/** The mode is a `grid()` option rather than an epic argument here, because that is the seat a
 * consumer writes it in and `defaultEpics` is what reads it. */
const dragGrid = (mode: DragMode): Grid<Row> =>
  grid<Row>({ id: "t", rows: FLAT, columns: COLUMNS, rowId: (row) => row.id, drag: mode })

describe("resizeOnHeaderDrag, live", () => {
  it("clamps to the column's minWidth", () => {
    const { move$ } = pointerStreams()
    const { g } = withEpics(dragGrid("live"))
    g.dispatch(headerDown("name", "resize", 0))
    move$.next(at({ clientX: -20 }))
    expect(g.state.colWidth.$()["name"]).toBe(100)
    move$.next(at({ clientX: -200 }))
    expect(g.state.colWidth.$()["name"]).toBe(80)
  })

  it("clamps to the column's maxWidth and commits the last width", () => {
    const { move$, up$ } = pointerStreams()
    const { g } = withEpics(dragGrid("live"))
    g.dispatch(headerDown("name", "resize", 0))
    move$.next(at({ clientX: 500 }))
    up$.next(at({ clientX: 500 }))
    expect(g.state.colWidth.$()["name"]).toBe(200)
  })

  it("stops listening after the pointer comes up", () => {
    const { move$, up$ } = pointerStreams()
    const { g } = withEpics(dragGrid("live"))
    g.dispatch(headerDown("name", "resize", 0))
    move$.next(at({ clientX: 30 }))
    up$.next(at({ clientX: 30 }))
    move$.next(at({ clientX: -500 }))
    expect(g.state.colWidth.$()["name"]).toBe(150)
  })
})

describe("resizeOnHeaderDrag, deferred", () => {
  it("publishes the prospective width and leaves every column at the width it is painting", () => {
    const { move$ } = pointerStreams()
    const { g } = withEpics(flatGrid())
    g.dispatch(headerDown("name", "resize", 0))
    move$.next(at({ clientX: 30 }))
    expect(g.state.drag.$()).toEqual({ kind: "colSize", col: "name", width: 150 })
    expect(g.state.colWidth.$()).toEqual({})
    move$.next(at({ clientX: 500 }))
    expect(g.state.drag.$()).toEqual({ kind: "colSize", col: "name", width: 200 })
    expect(g.state.colWidth.$()).toEqual({})
  })

  it("writes the clamped width once on the lift and clears the preview", () => {
    const { move$, up$ } = pointerStreams()
    const { g } = withEpics(flatGrid())
    g.dispatch(headerDown("name", "resize", 0))
    move$.next(at({ clientX: -500 }))
    up$.next(at({ clientX: -500 }))
    expect(g.state.colWidth.$()["name"]).toBe(80)
    expect(g.state.drag.$()).toBe(null)
  })
})

describe("moveColumnOnHeaderDrag, live", () => {
  it("reorders once the pointer passes half of the next column", () => {
    const { move$ } = pointerStreams()
    const { g } = withEpics(dragGrid("live"))
    g.dispatch(headerDown("name", "move", 0))
    move$.next(at({ clientX: 10 }))
    expect(g.view.cols.$().map((n) => n.key)).toEqual(["name", "size"])
    move$.next(at({ clientX: 60 }))
    expect(g.state.colOrder.$()).toEqual(["size", "name"])
    expect(g.view.cols.$().map((n) => n.key)).toEqual(["size", "name"])
  })

  it("restores the order when the drag returns to where it started", () => {
    const { move$, up$ } = pointerStreams()
    const { g } = withEpics(dragGrid("live"))
    g.dispatch(headerDown("name", "move", 0))
    move$.next(at({ clientX: 60 }))
    up$.next(at({ clientX: 0 }))
    expect(g.state.colOrder.$()).toEqual(["name", "size"])
  })
})

describe("moveColumnOnHeaderDrag, deferred", () => {
  it("names the landing column while the pointer is down and moves no column", () => {
    const { move$ } = pointerStreams()
    const { g } = withEpics(flatGrid())
    g.dispatch(headerDown("name", "move", 0))
    move$.next(at({ clientX: 10 }))
    expect(g.state.drag.$()).toEqual({ kind: "colMove", col: "name", over: "name", side: "start" })
    move$.next(at({ clientX: 60 }))
    expect(g.state.drag.$()).toEqual({ kind: "colMove", col: "name", over: "size", side: "end" })
    expect(g.state.colOrder.$()).toEqual([])
    expect(g.view.cols.$().map((n) => n.key)).toEqual(["name", "size"])
  })

  it("writes colOrder once on the lift and clears the preview", () => {
    const { move$, up$ } = pointerStreams()
    const { g } = withEpics(flatGrid())
    g.dispatch(headerDown("name", "move", 0))
    move$.next(at({ clientX: 60 }))
    up$.next(at({ clientX: 60 }))
    expect(g.state.colOrder.$()).toEqual(["size", "name"])
    expect(g.state.drag.$()).toBe(null)
  })

  it("leaves the order alone when the drag returns to where it started", () => {
    const { move$, up$ } = pointerStreams()
    const { g } = withEpics(flatGrid())
    g.dispatch(headerDown("name", "move", 0))
    move$.next(at({ clientX: 60 }))
    up$.next(at({ clientX: 0 }))
    // The schema order written out, which is the same seating the empty model already meant.
    expect(g.state.colOrder.$()).toEqual(["name", "size"])
    expect(g.view.cols.$().map((n) => n.key)).toEqual(["name", "size"])
    expect(g.state.drag.$()).toBe(null)
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

  it("names the landing row while the pointer is down and moves nothing", () => {
    const { move$ } = pointerStreams()
    const { g } = withEpics(flatGrid())
    g.dispatch(rowDown("c", 0))
    move$.next(at({ clientY: 40 }))
    expect(g.state.drag.$()).toEqual({ kind: "rowMove", row: "c", over: "a", side: "end" })
    expect(g.view.flat.$().map((n) => n.key)).toEqual(["c", "a", "b"])
  })

  it("clears the preview on the lift, and on a lift that landed where it started", () => {
    const { move$, up$ } = pointerStreams()
    const { g, effects } = withEpics(flatGrid())
    g.dispatch(rowDown("c", 0))
    move$.next(at({ clientY: 40 }))
    up$.next(at({ clientY: 40 }))
    expect(g.state.drag.$()).toBe(null)
    g.dispatch(rowDown("c", 0))
    move$.next(at({ clientY: 4 }))
    expect(g.state.drag.$()).not.toBe(null)
    up$.next(at({ clientY: 4 }))
    expect(g.state.drag.$()).toBe(null)
    expect(effects).toHaveLength(1)
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
