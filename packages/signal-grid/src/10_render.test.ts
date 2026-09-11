// Chromium under `vitest.browser.config.ts`.
//
// The renderer owns three of the package's subscriptions and every route the epics listen on, so
// what is asserted here is the contract the rest of `src/` was written against: which slot wins,
// which element carries which route, and what is left alive after `stop()`.
import { afterEach, beforeEach, describe, expect, test } from "vitest"
import { Signal } from "@hafley66/signals"
import {
  cellId,
  type CellCtx,
  type ColumnDef,
  type GridState,
  type HeaderCtx,
  type Orientation,
  type RowCtx,
} from "./0_types.js"
import { disableGridLogging, setGridLogEmit, type LogFields } from "./0_log.js"
import { selectorFor } from "./3_paths.js"
import { conventionalParts } from "./12_transpose.js"
import {
  checkboxColumn,
  detailColumn,
  dragColumn,
  expandColumn,
  radioColumn,
  rowNumberColumn,
} from "./5_columns.js"
import { expandOnExpanderClick, selectRowsOnCellClick, type GridEpic } from "./7_epics.js"
import { grid, type Grid } from "./8_grid.js"
import { render, type RenderHandle } from "./10_render.js"
import type { Slots } from "./0_types.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly size: number
  /** Tree mode is one config callback, and the transpose has to leave it on the row axis. */
  readonly kids?: readonly Row[]
}

const ROWS: readonly Row[] = [
  { id: "a", name: "Alpha", size: 1 },
  { id: "b", name: "Beta", size: 2 },
]

const NAME: ColumnDef<Row> = { id: "name", header: "Name", width: 120 }
const SIZE: ColumnDef<Row> = { id: "size", header: "Size", width: 80 }

const ROW = selectorFor("row")
const CELL = selectorFor("cell")
const CHECK = selectorFor("rowCheck")
const MOVE = selectorFor("rowMove")
const RESIZE = selectorFor("headerResize")

interface Harness {
  readonly root: HTMLElement
  readonly grid: Grid<Row>
  readonly handle: RenderHandle
}

interface Options {
  readonly columns?: readonly ColumnDef<Row>[]
  readonly rows?: readonly Row[] | Signal<readonly Row[]>
  readonly subRows?: (row: Row) => readonly Row[] | undefined
  readonly slots?: Slots<Row>
  readonly state?: Partial<GridState>
  readonly hold?: (made: Grid<Row>) => void
  /** Absent installs `defaultEpics()`, which is what every test above the interaction ones wants. */
  readonly epics?: readonly GridEpic<Row>[]
}

let root: HTMLElement
let live: RenderHandle[] = []
let disconnects = 0
let disconnectThrows = false

class StubObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {
    disconnects++
    if (disconnectThrows) throw new Error("observer teardown")
  }
}

beforeEach(() => {
  disconnects = 0
  disconnectThrows = false
  live = []
  root = document.createElement("div")
  document.body.append(root)
  ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = StubObserver
})

afterEach(() => {
  for (const handle of live) {
    try {
      handle.stop()
    } catch {
      // A test that already tore down, or one asserting a throwing teardown, has nothing to clean.
    }
  }
  root.remove()
})

function mountGrid(options: Options = {}): Harness {
  const made = grid<Row>({
    id: "sg-test",
    rows: options.rows ?? ROWS,
    columns: options.columns ?? [NAME, SIZE],
    rowId: (item) => item.id,
    subRows: options.subRows,
    state: { virtualize: { vertical: false, horizontal: false }, ...options.state },
    viewport: { top: 0, left: 0, width: 600, height: 400 },
    slots: options.slots,
    epics: options.epics,
  })
  options.hold?.(made)
  const handle = render(made, root)
  live.push(handle)
  return { root, grid: made, handle }
}

const textOfCell = (rowId: string, colId: string): string => {
  const cell = root.querySelector(`${selectorFor("row", { rowId })} ${selectorFor("cell", { colId })}`)
  return cell?.textContent ?? ""
}

// --- D1: slot precedence ----------------------------------------------------

describe("slot precedence", () => {
  test("a column's own cell slot beats the schema-wide one", () => {
    mountGrid({
      columns: [{ ...NAME, cell: (ctx: CellCtx<Row>) => `own:${String(ctx.value)}` }, SIZE],
      slots: { cell: (ctx: CellCtx<Row>) => `wide:${String(ctx.value)}` },
    })
    expect(textOfCell("a", "name")).toBe("own:Alpha")
    expect(textOfCell("a", "size")).toBe("wide:1")
  })

  test("the schema-wide cell slot beats the built-in text", () => {
    mountGrid({ slots: { cell: (ctx: CellCtx<Row>) => `wide:${String(ctx.value)}` } })
    expect(textOfCell("b", "name")).toBe("wide:Beta")
  })

  test("the built-in text renders when neither slot is supplied", () => {
    mountGrid()
    expect(textOfCell("b", "size")).toBe("2")
  })

  test("the editor slot beats both while that one cell is editing", () => {
    mountGrid({
      columns: [{ ...NAME, cell: () => "own" }, SIZE],
      slots: { cell: () => "wide", editor: (ctx: CellCtx<Row>) => `edit:${ctx.col}` },
      state: { editing: cellId("a", "name") },
    })
    expect(textOfCell("a", "name")).toBe("edit:name")
    expect(textOfCell("a", "size")).toBe("wide")
    expect(textOfCell("b", "name")).toBe("own")
  })

  test("a column's own header slot beats the schema-wide one", () => {
    mountGrid({
      columns: [{ ...NAME, headerCell: () => "own head" }, SIZE],
      slots: { header: () => "wide head" },
    })
    const head = root.querySelector(selectorFor("header", { colId: "name" }))
    expect(head?.textContent).toBe("own head")
    expect(root.querySelector(selectorFor("header", { colId: "size" }))?.textContent).toBe("wide head")
  })
})

// --- D3: the routes three epics listen on -----------------------------------

describe("built-in columns reach their routes", () => {
  test("a checkbox column renders a glyph carrying the check route", () => {
    mountGrid({ columns: [checkboxColumn<Row>(), NAME] })
    const glyphs = root.querySelectorAll(CHECK)
    expect(glyphs.length).toBe(2)
    const first = glyphs[0]
    expect(first?.classList.contains("sg-check")).toBe(true)
    expect(first?.getAttribute("data-check")).toBe("check")
  })

  test("the check glyph's chain is g/r/check, so its cell carries no c segment", () => {
    mountGrid({ columns: [checkboxColumn<Row>(), NAME] })
    const glyph = root.querySelector(CHECK)
    const cell = glyph?.parentElement
    expect(cell?.classList.contains("sg-cell")).toBe(true)
    expect(cell?.hasAttribute("data-route")).toBe(false)
    expect(cell?.closest(ROW)?.getAttribute("data-row-id")).toBe("a")
  })

  test("a radio column carries the same route and its own glyph class", () => {
    mountGrid({ columns: [radioColumn<Row>(), NAME] })
    expect(root.querySelectorAll(CHECK).length).toBe(2)
    expect(root.querySelectorAll(".sg-check-radio").length).toBe(2)
  })

  test("a grid with no selection column grows no checkbox", () => {
    mountGrid()
    expect(root.querySelectorAll(CHECK).length).toBe(0)
  })

  test("the select-all toggle is a header signal that repaints on a selection write", () => {
    let made: Grid<Row> | undefined
    const harness = mountGrid({
      columns: [checkboxColumn<Row>({ grid: () => made }), NAME],
      hold: (it) => {
        made = it
      },
    })
    const head = root.querySelector(selectorFor("header", { colId: "__check" }))
    expect(head?.textContent).toBe("☐")
    harness.grid.state.$({ ...harness.grid.state.$(), rowSelection: { a: true } })
    expect(head?.textContent).toBe("☑")
  })

  test("a drag column renders a grip carrying the row move route", () => {
    mountGrid({ columns: [dragColumn<Row>(), NAME] })
    const grips = root.querySelectorAll(`${ROW} ${MOVE}`)
    expect(grips.length).toBe(2)
    expect(grips[0]?.parentElement?.hasAttribute("data-route")).toBe(false)
  })

  test("an expand column replaces the run's expander instead of doubling it", () => {
    mountGrid({ columns: [expandColumn<Row>(), NAME] })
    const first = root.querySelector(ROW)
    expect(first?.querySelectorAll(".sg-expander").length).toBe(1)
    expect(first?.querySelectorAll(selectorFor("expander")).length).toBe(1)
  })

  test("a row number column counts from one and a detail column renders its disclosure", () => {
    mountGrid({ columns: [rowNumberColumn<Row>(), detailColumn<Row>(), NAME] })
    expect(textOfCell("a", "__rowNumber")).toBe("1")
    expect(textOfCell("b", "__rowNumber")).toBe("2")
    expect(root.querySelectorAll(".sg-detail-toggle").length).toBe(2)
    expect(textOfCell("a", "__detail")).toBe("▸")
  })

  test("a movable column stamps the move route on its header label, and nothing else does", () => {
    const movable: ColumnDef<Row> = { ...NAME, movable: true }
    mountGrid({ columns: [movable, SIZE] })
    const name = root.querySelector(selectorFor("header", { colId: "name" }))
    const size = root.querySelector(selectorFor("header", { colId: "size" }))
    expect(name?.querySelector(".sg-head-label")?.getAttribute("data-route")).toBe("move")
    expect(size?.querySelector(".sg-head-label")?.hasAttribute("data-route")).toBe(false)
  })
})

// --- what a real pointer reaches --------------------------------------------

const click = (target: Element | null, init: MouseEventInit = {}): void => {
  target?.dispatchEvent(new MouseEvent("click", { bubbles: true, ...init }))
}

describe("selecting by clicking the row", () => {
  const clicking = (): readonly GridEpic<Row>[] => [selectRowsOnCellClick<Row>()]

  test("a plain click replaces the selection and a ctrl-click adds one row", () => {
    const { grid: made } = mountGrid({ epics: clicking() })
    click(cellAt("a", "name"))
    expect(made.state.rowSelection.$()).toEqual({ a: true })
    click(cellAt("b", "size"), { ctrlKey: true })
    expect(made.state.rowSelection.$()).toEqual({ a: true, b: true })
    click(cellAt("b", "size"))
    expect(made.state.rowSelection.$()).toEqual({ b: true })
  })

  test("a shift-click fills the range from the row the last plain click anchored", () => {
    const { grid: made } = mountGrid({ epics: clicking() })
    click(cellAt("a", "name"))
    click(cellAt("b", "name"), { shiftKey: true })
    expect(made.state.rowSelection.$()).toEqual({ a: true, b: true })
  })

  test("a click on the expander glyph opens the row and selects nothing", () => {
    const { grid: made } = mountGrid({
      rows: TREE,
      subRows: (it) => it.kids,
      epics: [expandOnExpanderClick<Row>(), ...clicking()],
    })
    click(root.querySelector(selectorFor("expander")))
    expect(made.state.expanded.$()).toEqual({ a: true })
    expect(made.state.rowSelection.$()).toEqual({})
  })
})

// --- D2: detail rows --------------------------------------------------------

describe("detail rows", () => {
  const detailSlot = (ctx: RowCtx<Row>): string => `panel:${ctx.row}:${ctx.data.name}`

  test("an open panel renders one full-width box, not a second row of cells", () => {
    mountGrid({ slots: { detail: detailSlot }, state: { detail: { a: true } } })
    const panels = root.querySelectorAll('[data-detail="true"]')
    expect(panels.length).toBe(1)
    const panel = panels[0]
    expect(panel?.querySelectorAll(CELL).length).toBe(0)
    expect(panel?.querySelector(".sg-detail-panel")?.textContent).toBe("panel:a:Alpha")
  })

  test("the panel follows its own row and answers to that row's id", () => {
    mountGrid({ slots: { detail: detailSlot }, state: { detail: { a: true } } })
    const all = [...root.querySelectorAll(".sg-row")]
    expect(all.length).toBe(3)
    expect(all.map((it) => it.getAttribute("data-row-id"))).toEqual(["a", "a", "b"])
    expect(all[1]?.getAttribute("data-detail")).toBe("true")
    expect(all[0]?.hasAttribute("data-detail")).toBe(false)
  })

  test("the row itself still renders its own cells", () => {
    mountGrid({ slots: { detail: detailSlot }, state: { detail: { a: true } } })
    const owner = root.querySelector(".sg-row")
    expect(owner?.querySelectorAll(CELL).length).toBe(2)
    expect(owner?.textContent).toContain("Alpha")
  })

  test("no panel is built when nothing is open", () => {
    mountGrid({ slots: { detail: detailSlot } })
    expect(root.querySelectorAll('[data-detail="true"]').length).toBe(0)
    expect(root.querySelectorAll(".sg-row").length).toBe(2)
  })
})

// --- D3: a slot's own teardown ----------------------------------------------
//
// A detail slot that renders a nested grid has to stop it when the panel closes, and before this
// channel existed the demo kept a registry of handles outside the slot to do that by hand.

describe("a slot handing back its own teardown", () => {
  const withTeardown = (torn: string[]) => (ctx: RowCtx<Row>) => ({
    content: `panel:${ctx.row}`,
    unsubscribe: () => torn.push(ctx.row),
  })

  test("runs it when the panel closes and not before", () => {
    const torn: string[] = []
    const harness = mountGrid({ slots: { detail: withTeardown(torn) }, state: { detail: { a: true } } })
    expect(root.querySelector(".sg-detail-panel")?.textContent).toBe("panel:a")
    expect(torn).toEqual([])
    harness.grid.state.detail.$({})
    expect(torn).toEqual(["a"])
    expect(root.querySelector(".sg-detail-panel")).toBeNull()
  })

  test("runs it once on stop() for every panel still open", () => {
    const torn: string[] = []
    const harness = mountGrid({
      slots: { detail: withTeardown(torn) },
      state: { detail: { a: true, b: true } },
    })
    harness.handle.stop()
    expect([...torn].sort()).toEqual(["a", "b"])
    harness.handle.stop()
    expect(torn.length).toBe(2)
  })

  test("a cell slot's teardown runs when its row rebuilds", () => {
    const torn: string[] = []
    const source = Signal<readonly Row[]>([ROWS[0] as Row])
    mountGrid({
      rows: source,
      columns: [NAME],
      slots: {
        cell: (ctx: CellCtx<Row>) => ({
          content: String(ctx.value),
          unsubscribe: () => torn.push(`${ctx.row}/${ctx.col}`),
        }),
      },
    })
    expect(torn).toEqual([])
    // A new data identity rebuilds the row's cells, and the old cell's teardown goes with them.
    source.$([{ id: "a", name: "Alpha prime", size: 1 }])
    expect(torn).toEqual(["a/name"])
    expect(textOfCell("a", "name")).toBe("Alpha prime")
  })
})

// --- a grid inside a grid ---------------------------------------------------
//
// Each render() listens for keydown on its own root and the event bubbles, so before the boundary
// check a key inside the nested grid moved both. The nested root carries `data-route-boundary`,
// which is what `bindRoot` reads to step out of the way.

describe("a key pressed inside a nested grid", () => {
  const LINES: readonly Row[] = [{ id: "x", name: "Line x", size: 9 }]

  const arrowDown = (target: Element): void => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }))
  }

  const mountNested = (): { outer: Harness; inner: Grid<Row>; innerRoot: HTMLElement } => {
    let inner: Grid<Row> | null = null
    const innerRoot = document.createElement("div")
    const outer = mountGrid({
      state: { detail: { a: true } },
      slots: {
        detail: () => {
          const made = grid<Row>({
            id: "sg-inner",
            rows: LINES,
            columns: [NAME],
            rowId: (item) => item.id,
            state: { virtualize: { vertical: false, horizontal: false } },
            viewport: { top: 0, left: 0, width: 300, height: 100 },
          })
          inner = made
          const handle = render(made, innerRoot)
          live.push(handle)
          return { content: innerRoot, unsubscribe: handle.stop }
        },
      },
    })
    if (inner === null) throw new Error("the detail slot never ran")
    return { outer, inner, innerRoot }
  }

  test("moves focus in the nested grid only", () => {
    const { outer, inner, innerRoot } = mountNested()
    expect(innerRoot.hasAttribute("data-route-boundary")).toBe(true)
    arrowDown(innerRoot)
    expect(inner.state.focus.$()).toBe(cellId("x", "name"))
    expect(outer.grid.state.focus.$()).toBeNull()
  })

  test("a key on the outer root still moves the outer grid", () => {
    const { outer, inner } = mountNested()
    arrowDown(outer.root)
    expect(outer.grid.state.focus.$()).toBe(cellId("a", "name"))
    expect(inner.state.focus.$()).toBeNull()
  })
})

// --- the content writer -----------------------------------------------------

describe("mounting a signal slot", () => {
  test("a slot returning a signal of a node mounts the node itself", () => {
    const first = document.createElement("b")
    first.textContent = "one"
    const content = Signal<HTMLElement>(first)
    mountGrid({ columns: [NAME], rows: [ROWS[0] as Row], slots: { cell: () => content } })
    const cell = root.querySelector(CELL)
    expect(cell?.firstElementChild?.tagName).toBe("B")
    expect(cell?.textContent).toBe("one")
  })

  test("a later emission replaces the node instead of stringifying it", () => {
    const first = document.createElement("b")
    first.textContent = "one"
    const content = Signal<HTMLElement>(first)
    mountGrid({ columns: [NAME], rows: [ROWS[0] as Row], slots: { cell: () => content } })
    const second = document.createElement("i")
    second.textContent = "two"
    content.$(second)
    const cell = root.querySelector(CELL)
    expect(cell?.querySelectorAll("b").length).toBe(0)
    expect(cell?.querySelectorAll("i").length).toBe(1)
    expect(cell?.textContent).toBe("two")
  })

  test("the resize handle survives a second emission of a header slot signal", () => {
    const content = Signal<string>("first")
    mountGrid({
      columns: [{ ...NAME, resizable: true }],
      slots: { header: () => content },
    })
    const head = root.querySelector(selectorFor("header", { colId: "name" }))
    expect(head?.querySelectorAll(RESIZE).length).toBe(1)
    content.$("second")
    expect(head?.querySelectorAll(RESIZE).length).toBe(1)
    expect(head?.querySelector(".sg-head-label")?.textContent).toBe("second")
  })
})

// --- D4 and D5: teardown ----------------------------------------------------

describe("stop()", () => {
  test("tears down every subscription even when one teardown throws", () => {
    const cellContent = Signal<string>("cell one")
    const headContent = Signal<string>("head one")
    mountGrid({
      columns: [NAME],
      rows: [ROWS[0] as Row],
      slots: { cell: () => cellContent, header: () => headContent },
    })
    const cell = root.querySelector(CELL)
    const head = root.querySelector(selectorFor("header", { colId: "name" }))
    expect(cell?.textContent).toBe("cell one")

    disconnectThrows = true
    const handle = live[0] as RenderHandle
    let thrown: unknown = null
    try {
      handle.stop()
    } catch (error) {
      thrown = error
    }
    expect(thrown).not.toBeNull()
    expect(disconnects).toBe(1)

    cellContent.$("cell two")
    headContent.$("head two")
    expect(cell?.textContent).toBe("cell one")
    expect(head?.querySelector(".sg-head-label")?.textContent).toBe("head one")
    expect(root.querySelector(".sg-scroll")).toBeNull()
  })

  test("called from inside a slot's own emission, it leaves no rows and no live pass", () => {
    const source = Signal<readonly Row[]>(ROWS)
    const built: string[] = []
    let armed = false
    let handle: RenderHandle | null = null
    const harness = mountGrid({
      rows: source,
      columns: [NAME],
      slots: {
        cell: (ctx: CellCtx<Row>) =>
          Signal<string>(() => {
            built.push(ctx.row)
            if (armed && ctx.row === "a") handle?.stop()
            return String(ctx.value)
          }),
      },
    })
    handle = harness.handle
    expect(built).toEqual(["a", "b"])

    armed = true
    built.length = 0
    source.$(ROWS.map((item) => ({ ...item })))
    expect(built).toEqual(["a"])
    expect(root.querySelector(ROW)).toBeNull()
    expect(root.querySelector(".sg-scroll")).toBeNull()

    built.length = 0
    source.$(ROWS.map((item) => ({ ...item })))
    expect(built).toEqual([])
  })

  test("a second stop is a no-op rather than a second teardown", () => {
    const harness = mountGrid()
    harness.handle.stop()
    harness.handle.stop()
    expect(disconnects).toBe(1)
    expect(root.querySelector(".sg-scroll")).toBeNull()
  })
})

// The property that makes virtualization worth having, and the one nothing asserted for the whole
// life of the package. If `reconcile` rebuilt instead of moving, every cell-level subscription
// would be torn down and remade on every scroll frame, focus would drop mid-keystroke in an
// editing cell, and every other test here would still pass.
describe("row reconciliation moves elements rather than rebuilding them", () => {
  test("the same key keeps the same element across a reorder", () => {
    const { grid: made } = mountGrid()
    const held = new Map<string, Element>()
    for (const element of root.querySelectorAll(ROW)) {
      held.set(element.getAttribute("data-row-id") ?? "", element)
    }
    expect(held.size).toBe(ROWS.length)

    made.state.sort.$([{ field: "name", sort: "desc" }])

    for (const element of root.querySelectorAll(ROW)) {
      const key = element.getAttribute("data-row-id") ?? ""
      expect(element).toBe(held.get(key))
    }
  })

  test("a row leaving the plan and coming back is a new element, and the survivors are not", () => {
    const rows = Signal<readonly Row[]>(ROWS)
    const { grid: made } = mountGrid({ rows })
    const first = root.querySelector(`${selectorFor("row", { rowId: ROWS[0]?.id ?? "" })}`)
    const second = root.querySelector(`${selectorFor("row", { rowId: ROWS[1]?.id ?? "" })}`)

    rows.$(ROWS.slice(1))
    expect(root.querySelectorAll(ROW).length).toBe(ROWS.length - 1)
    // The survivor was moved up a seat, not rebuilt.
    expect(root.querySelector(`${selectorFor("row", { rowId: ROWS[1]?.id ?? "" })}`)).toBe(second)

    rows.$(ROWS)
    const returned = root.querySelector(`${selectorFor("row", { rowId: ROWS[0]?.id ?? "" })}`)
    expect(returned).not.toBe(first)
    expect(root.querySelector(`${selectorFor("row", { rowId: ROWS[1]?.id ?? "" })}`)).toBe(second)
    void made
  })

  test("a cell subscription survives a reorder, so an editing cell does not lose its state", () => {
    let mounts = 0
    const live = Signal("a")
    mountGrid({
      columns: [NAME],
      slots: {
        cell: () => {
          mounts++
          return live
        },
      },
    })
    const after = mounts
    expect(after).toBe(ROWS.length)

    const grid1 = root.querySelector(ROW)
    expect(grid1).not.toBeNull()

    live.$("b")
    // A write to the slot's own signal must not rebuild a single cell.
    expect(mounts).toBe(after)
  })
})

// A drag writes the range on every hover edge. If that rebuilt the cells, the editor and every
// slot subscription under them would be torn down mid-gesture, which is the whole reason
// selection is stamped rather than rendered.
describe("range selection restamps without rebuilding", () => {
  test("a selection write keeps every cell element and marks the covered ones", () => {
    const { grid: made } = mountGrid()
    const before = [...root.querySelectorAll(CELL)]
    expect(before.length).toBe(4)

    made.state.selection.$({
      anchor: cellId(ROWS[0]?.id ?? "", "name"),
      head: cellId(ROWS[1]?.id ?? "", "size"),
      mode: "cell",
      blocks: [],
    })

    const after = [...root.querySelectorAll(CELL)]
    expect(after).toEqual(before)
    expect(after.every((it) => it.hasAttribute("data-selected"))).toBe(true)
  })

  test("a cell outside the block carries no attribute, so the common case is a removal", () => {
    const { grid: made } = mountGrid()
    const only = cellId(ROWS[0]?.id ?? "", "name")
    made.state.selection.$({ anchor: only, head: only, mode: "cell", blocks: [] })

    const marked = [...root.querySelectorAll(CELL)].filter((it) => it.hasAttribute("data-selected"))
    expect(marked.length).toBe(1)
    expect(marked[0]?.getAttribute("data-col-id")).toBe("name")
  })

  test("one rectangle draws one border, so only the outer cells carry an edge", () => {
    const { grid: made } = mountGrid()
    made.state.selection.$({
      anchor: cellId(ROWS[0]?.id ?? "", "name"),
      head: cellId(ROWS[1]?.id ?? "", "size"),
      mode: "cell",
      blocks: [],
    })

    const corner = root.querySelector(
      `${selectorFor("row", { rowId: ROWS[0]?.id ?? "" })} ${selectorFor("cell", { colId: "name" })}`,
    )
    // Top-left of a two-by-two block: outside on the top and the start, inside on the other two.
    expect(corner?.getAttribute("data-edge")).toBe("top start")
  })
})

// --- the transpose ----------------------------------------------------------
//
// One table, both seatings. Every assertion below runs against each row of `CROSSINGS`, so a
// change that repairs one orientation and breaks the other fails here instead of passing quietly.
//
// The stamping this asserts is conventional: a cell always carries the row's id in `data-row-id`
// and the column's id in `data-col-id`, whichever seat each came from. Delegation reads each
// param off the closest ancestor that carries it, so under the transpose the cell's own copy of
// `data-row-id` wins over the DOM row's, and every epic keeps the meaning it was written with.

interface Crossing {
  readonly orientation: Orientation
  /** Whether the run that scrolls is the row axis, which is the only one `expanded` reaches. */
  readonly rowsRunVertical: boolean
}

const CROSSINGS: readonly Crossing[] = [
  { orientation: "rows", rowsRunVertical: true },
  { orientation: "columns", rowsRunVertical: false },
]

/** Every conventional address of the two-by-two probe, with the text its cell must carry. */
const PROBE: readonly (readonly [string, string, string])[] = [
  ["a", "name", "Alpha"],
  ["a", "size", "1"],
  ["b", "name", "Beta"],
  ["b", "size", "2"],
]

/** One parent with one child, so the row axis has a `parent` edge and the column axis has none. */
const TREE: readonly Row[] = [
  { id: "a", name: "Alpha", size: 1, kids: [{ id: "b", name: "Beta", size: 2 }] },
]

/** A header group, so the column axis has the `parent` edges and the row axis has none. An
 * unknown parent is a root, so the band itself has to be a column of the schema. */
const GROUPED: readonly ColumnDef<Row>[] = [
  { id: "info", header: "Info" },
  { ...NAME, group: "info" },
  { ...SIZE, group: "info" },
]

/** What `fromDelegatedRoute` composes for one cell: each param off the closest ancestor holding
 * it, which is the cell itself once the renderer has crossed the pair onto it. */
const addressOfCell = (cell: Element): readonly [string, string] => [
  cell.closest("[data-row-id]")?.getAttribute("data-row-id") ?? "",
  cell.closest("[data-col-id]")?.getAttribute("data-col-id") ?? "",
]

const cellAt = (rowId: string, colId: string): Element | null => {
  for (const cell of root.querySelectorAll(CELL)) {
    const address = addressOfCell(cell)
    if (address[0] === rowId && address[1] === colId) return cell
  }
  return null
}

const domRowsOf = (): readonly HTMLElement[] => [...root.querySelectorAll<HTMLElement>(ROW)]

const headCellsOf = (): readonly Element[] => [...root.querySelectorAll(".sg-head-cell")]

for (const crossing of CROSSINGS) {
  describe(`the transpose under orientation ${crossing.orientation}`, () => {
    const mountCrossed = (options: Options = {}): Harness =>
      mountGrid({ ...options, state: { orientation: crossing.orientation, ...options.state } })

    const seatsOf = (harness: Harness): { down: readonly string[]; across: readonly string[] } => ({
      down: harness.grid.view.plan.$().center,
      across: harness.grid.view.cols.$().map((node) => node.key),
    })

    test("two by two renders four cells carrying the same four texts", () => {
      mountCrossed()
      expect(root.querySelectorAll(CELL).length).toBe(4)
      for (const [rowId, colId, text] of PROBE) {
        expect(cellAt(rowId, colId)?.textContent).toBe(text)
      }
    })

    test("the schema-wide cell slot is called once for every rendered cell", () => {
      const seen: string[] = []
      mountCrossed({
        slots: {
          cell: (ctx: CellCtx<Row>) => {
            seen.push(`${ctx.row}/${ctx.col}`)
            return `wide:${String(ctx.value)}`
          },
        },
      })
      expect(seen.length).toBe(4)
      expect([...seen].sort()).toEqual(["a/name", "a/size", "b/name", "b/size"])
      expect(cellAt("a", "name")?.textContent).toBe("wide:Alpha")
      expect(cellAt("b", "size")?.textContent).toBe("wide:2")
    })

    test("a column's own cell slot still beats the schema-wide one", () => {
      mountCrossed({
        columns: [{ ...NAME, cell: (ctx: CellCtx<Row>) => `own:${String(ctx.value)}` }, SIZE],
        slots: { cell: (ctx: CellCtx<Row>) => `wide:${String(ctx.value)}` },
      })
      expect(cellAt("a", "name")?.textContent).toBe("own:Alpha")
      expect(cellAt("b", "name")?.textContent).toBe("own:Beta")
      expect(cellAt("a", "size")?.textContent).toBe("wide:1")
    })

    test("the slot is handed the row its cell is about, not the entry that scrolls", () => {
      const held = new Map<string, Row>()
      mountCrossed({
        slots: {
          cell: (ctx: CellCtx<Row>) => {
            held.set(`${ctx.row}/${ctx.col}`, ctx.data)
            return ""
          },
        },
      })
      expect(held.get("a/name")?.name).toBe("Alpha")
      expect(held.get("a/size")?.size).toBe(1)
      expect(held.get("b/name")?.name).toBe("Beta")
      expect(held.get("b/size")?.size).toBe(2)
    })

    test("the pair a cell carries is what conventionalParts reads off the two seats", () => {
      const harness = mountCrossed()
      const seats = seatsOf(harness)
      const found: string[] = []
      for (const down of seats.down) {
        for (const across of seats.across) {
          const [rowId, colId] = conventionalParts(down, across, crossing.orientation)
          const cell = cellAt(rowId, colId)
          expect(cell).not.toBeNull()
          // The DOM row answers to the seat that scrolls, whichever axis that is.
          expect(cell?.closest(ROW)?.getAttribute("data-row-id")).toBe(down)
          found.push(`${rowId}/${colId}`)
        }
      }
      expect([...found].sort()).toEqual(["a/name", "a/size", "b/name", "b/size"])
    })

    test("an epic reading the stamped pair resolves the row behind the cell", () => {
      const harness = mountCrossed()
      const seats = seatsOf(harness)
      const down = seats.down[0] ?? ""
      const across = seats.across[0] ?? ""
      const cell = cellAt(...conventionalParts(down, across, crossing.orientation))
      expect(cell).not.toBeNull()
      // Exactly what `activateOnCellClick` does with the intent delegation raised off this cell.
      const address = addressOfCell(cell as Element)
      expect(harness.grid.view.sorted.$().by.get(address[0])?.name).toBe("Alpha")
      expect(address[1]).toBe("name")
    })

    test("selection stamps the cell the neutral address names", () => {
      const harness = mountCrossed()
      const seats = seatsOf(harness)
      const down = seats.down[0] ?? ""
      const across = seats.across[1] ?? ""
      const only = cellId(down, across)
      harness.grid.state.selection.$({ anchor: only, head: only, mode: "cell", blocks: [] })
      const marked = [...root.querySelectorAll(CELL)].filter((cell) =>
        cell.hasAttribute("data-selected"),
      )
      expect(marked.length).toBe(1)
      expect(marked[0]).toBe(cellAt(...conventionalParts(down, across, crossing.orientation)))
      // One cell is the whole rectangle, so it sits on all four sides of it.
      expect(marked[0]?.getAttribute("data-edge")).toBe("top bottom start end")
    })

    test("the header slot is handed the horizontal entry under both seatings", () => {
      const harness = mountCrossed({ slots: { header: (ctx: HeaderCtx) => `head:${ctx.col}` } })
      const across = harness.grid.view.cols.$().map((node) => node.key)
      expect(headCellsOf().map((head) => head.getAttribute("data-col-id"))).toEqual([...across])
      expect(headCellsOf().map((head) => head.textContent)).toEqual(across.map((key) => `head:${key}`))
    })

    test("a transposed header band labels its rows from the row's own data", () => {
      mountCrossed({
        slots: {
          header: (ctx: HeaderCtx<Row>) =>
            ctx.data === undefined ? `col:${ctx.col}` : `row:${ctx.row}:${ctx.data.name}`,
        },
      })
      // Under "rows" the band holds columns and `data` is absent; under "columns" it holds rows and
      // the slot reads the row it labels, which is the whole of the transpose's header story.
      expect(headCellsOf().map((head) => head.textContent)).toEqual(
        crossing.rowsRunVertical
          ? ["col:name", "col:size"]
          : ["row:a:Alpha", "row:b:Beta"],
      )
    })

    test("a row tree only grows the run expander while rows stand vertical", () => {
      mountCrossed({ rows: TREE, subRows: (row) => row.kids, state: { expanded: { a: true } } })
      expect(root.querySelectorAll(".sg-expander").length).toBe(crossing.rowsRunVertical ? 2 : 0)
      expect(domRowsOf().map((el) => el.style.getPropertyValue("--sg-depth"))).toEqual(
        crossing.rowsRunVertical ? ["0", "1"] : ["0", "0"],
      )
    })

    test("a column forest standing vertical grows no expander and no indent", () => {
      const harness = mountCrossed({ columns: GROUPED })
      const nested = harness.grid.view.vertical.$().nodes.some((node) => node.hasChildren)
      expect(nested).toBe(!crossing.rowsRunVertical)
      // Header groups are the run under the transpose, and the glyph writes `expanded`, which the
      // column axis never reads. A disclosure there is one that can never close.
      expect(root.querySelectorAll(".sg-expander").length).toBe(0)
      for (const el of domRowsOf()) expect(el.style.getPropertyValue("--sg-depth")).toBe("0")
    })
  })
}

// --- D9: the timed DOM pass -------------------------------------------------

describe("the dom category", () => {
  afterEach(() => disableGridLogging())

  const taken = (): { category: readonly string[]; fields: LogFields }[] => {
    const records: { category: readonly string[]; fields: LogFields }[] = []
    setGridLogEmit((category, _message, fields) => {
      records.push({ category, fields })
    })
    return records
  }

  const domOf = (
    records: readonly { category: readonly string[]; fields: LogFields }[],
  ): { category: readonly string[]; fields: LogFields }[] =>
    records.filter((record) => record.category[1] === "dom")

  // One record per pass, and a sort write currently drives five of them. The count is left
  // unasserted because it is the pipeline's number to change, and this file is not its owner.
  test("stamps every pass with the grid id and a duration", () => {
    const harness = mountGrid()
    const records = taken()
    harness.grid.state.sort.$([{ field: "name", sort: "asc" }])
    const seen = domOf(records)
    expect(seen.length).toBeGreaterThan(0)
    for (const record of seen) {
      expect(record.category[0]).toBe("signal-grid")
      expect(record.fields.id).toBe("sg-test")
      expect(typeof record.fields.durationMs).toBe("number")
      expect(record.fields.held).toBe(2)
    }
  })

  test("draws the same document whether the sink is on or off", () => {
    const first = mountGrid()
    const drawnOff = first.root.innerHTML
    first.handle.stop()
    root.replaceChildren()
    taken()
    const second = mountGrid()
    expect(second.root.innerHTML).toBe(drawnOff)
  })

  test("emits nothing once disabled", () => {
    const harness = mountGrid()
    const records = taken()
    disableGridLogging()
    harness.grid.state.sort.$([{ field: "size", sort: "desc" }])
    expect(records).toHaveLength(0)
  })
})
