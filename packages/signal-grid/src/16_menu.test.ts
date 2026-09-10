// Chromium under `vitest.browser.config.ts`. Two claims are under test.
//
// The first is that a right click resolves to exactly one part, which is
// a property of the route chain the renderer stamps rather than of any listener order, so it is
// asserted against a live `gridDom` and a real `contextmenu` event. The second is that a target
// crosses the transpose and cleans up after itself.
import { afterEach, beforeEach, describe, expect, test } from "vitest"
import { Subscription } from "rxjs"
import type { ColumnDef, GridIntent, GridState, Modifiers } from "./0_types.js"
import { gridDom, selectorFor } from "./3_paths.js"
import { expandColumn } from "./5_columns.js"
import { grid, type Grid } from "./8_grid.js"
import { render, type RenderHandle } from "./10_render.js"
import { anchorTo, menuTargetOf, supportsAnchorPositioning } from "./16_menu.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly size: number
}

const ROWS: readonly Row[] = [
  { id: "a", name: "Alpha", size: 1 },
  { id: "b", name: "Beta", size: 2 },
]

const NAME: ColumnDef<Row> = { id: "name", header: "Name", width: 120 }
const SIZE: ColumnDef<Row> = { id: "size", header: "Size", width: 80 }

const ROW = selectorFor("row")
const CELL = selectorFor("cell")
const HEADER = selectorFor("header")

const MODS: Modifiers = { alt: false, ctrl: false, meta: false, shift: false, button: 2 }

const cellMenu = (row: string, col: string, x = 40, y = 60): GridIntent => ({
  phase: "intent",
  type: "cell.contextmenu",
  row,
  col,
  x,
  y,
  mods: MODS,
})

const rowMenu = (row: string, x = 12, y = 24): GridIntent => ({
  phase: "intent",
  type: "row.contextmenu",
  row,
  x,
  y,
  mods: MODS,
})

const headerMenu = (col: string, x = 8, y = 4): GridIntent => ({
  phase: "intent",
  type: "header.contextmenu",
  col,
  x,
  y,
  mods: MODS,
})

class StubObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

type SupportsStub = { supports: (property: string, value: string) => boolean }
type CssHost = { CSS?: SupportsStub }

let root: HTMLElement
let live: RenderHandle[] = []
let originalCss: SupportsStub | undefined

const answerSupports = (answer: boolean): void => {
  ;(globalThis as CssHost).CSS = { supports: () => answer }
}

const dropSupports = (): void => {
  delete (globalThis as CssHost).CSS
}

interface Harness {
  readonly root: HTMLElement
  readonly grid: Grid<Row>
}

function mount(options: {
  readonly columns?: readonly ColumnDef<Row>[]
  readonly state?: Partial<GridState>
} = {}): Harness {
  const made = grid<Row>({
    id: "menu",
    rows: ROWS,
    columns: options.columns ?? [NAME, SIZE],
    rowId: (row) => row.id,
    state: { virtualize: { vertical: false, horizontal: false }, ...options.state },
  })
  live.push(render(made, root))
  return { root, grid: made }
}

beforeEach(() => {
  live = []
  root = document.createElement("div")
  document.body.append(root)
  ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = StubObserver
  originalCss = (globalThis as CssHost).CSS
})

afterEach(() => {
  for (const handle of live) handle.stop()
  root.remove()
  if (originalCss === undefined) dropSupports()
  else (globalThis as CssHost).CSS = originalCss
})

const rightClick = (element: Element, at: { x: number; y: number }): void => {
  element.dispatchEvent(
    new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      button: 2,
      clientX: at.x,
      clientY: at.y,
    }),
  )
}

/** Every route `bindRoot` would subscribe for a menu, recorded by the segment chain that matched. */
function watchRoutes(gridId: string): { readonly seen: string[]; readonly stop: () => void } {
  const dom = gridDom(gridId)
  const seen: string[] = []
  const subs = new Subscription()
  subs.add(dom.cell.route.contextmenu.subscribe(() => seen.push("cell")))
  subs.add(dom.row.route.contextmenu.subscribe(() => seen.push("row")))
  subs.add(dom.header.route.contextmenu.subscribe(() => seen.push("header")))
  return { seen, stop: () => subs.unsubscribe() }
}

describe("one right click resolves to one part", () => {
  test("a cell composes g/r/c, so the row route does not also match", () => {
    const made = mount()
    const watch = watchRoutes(made.grid.id.$())
    const cell = root.querySelector(`${ROW} ${CELL}`)
    expect(cell).not.toBeNull()
    if (cell !== null) rightClick(cell, { x: 40, y: 60 })
    watch.stop()
    expect(watch.seen).toEqual(["cell"])
  })

  test("a header cell composes g/h", () => {
    const made = mount()
    const watch = watchRoutes(made.grid.id.$())
    const header = root.querySelector(HEADER)
    expect(header).not.toBeNull()
    if (header !== null) rightClick(header, { x: 8, y: 4 })
    watch.stop()
    expect(watch.seen).toEqual(["header"])
  })

  test("the routeless part of an expander column's cell composes g/r, which is what reaches a row", () => {
    const made = mount({ columns: [expandColumn<Row>(), NAME] })
    const watch = watchRoutes(made.grid.id.$())
    // The glyph inside carries `expand`; the cell around it carries nothing, so the cell's own box
    // is one of the three gestures that reach a row target.
    const glyphCell = root.querySelector(`${ROW} .sg-cell-glyph`)
    expect(glyphCell).not.toBeNull()
    if (glyphCell !== null) rightClick(glyphCell, { x: 12, y: 24 })
    watch.stop()
    expect(watch.seen).toEqual(["row"])
  })

  test("the row element itself composes g/r, which is the empty inline space past the last column", () => {
    const made = mount()
    const watch = watchRoutes(made.grid.id.$())
    const row = root.querySelector(ROW)
    expect(row).not.toBeNull()
    if (row !== null) rightClick(row, { x: 300, y: 60 })
    watch.stop()
    expect(watch.seen).toEqual(["row"])
  })

  test("the grid box below the last row composes g, so no menu intent is raised there", () => {
    const made = mount()
    const watch = watchRoutes(made.grid.id.$())
    rightClick(root, { x: 4, y: 400 })
    watch.stop()
    expect(watch.seen).toEqual([])
  })
})

describe("the target names an element and an address", () => {
  test("a cell target resolves the element selectorFor spells", () => {
    const made = mount()
    const target = menuTargetOf(cellMenu("a", "size"), root, made.grid.state.orientation.$())
    const expected = root.querySelector(
      `${selectorFor("row", { rowId: "a" })} ${selectorFor("cell", { colId: "size" })}`,
    )
    expect(expected).not.toBeNull()
    expect(target?.anchor).toBe(expected)
    expect(target?.kind).toBe("cell")
    expect([target?.row, target?.col]).toEqual(["a", "size"])
    expect(target?.at).toEqual({ x: 40, y: 60 })
  })

  test("a row target carries a row and no column", () => {
    const made = mount()
    const target = menuTargetOf(rowMenu("b"), root, made.grid.state.orientation.$())
    expect(target?.anchor).toBe(root.querySelector(selectorFor("row", { rowId: "b" })))
    expect([target?.row, target?.col]).toEqual(["b", null])
  })

  test("a header target carries a column and no row", () => {
    const made = mount()
    const target = menuTargetOf(headerMenu("name"), root, made.grid.state.orientation.$())
    expect(target?.anchor).toBe(root.querySelector(selectorFor("header", { colId: "name" })))
    expect([target?.row, target?.col]).toEqual([null, "name"])
  })

  test("an intent that is not one of the three has no target", () => {
    const made = mount()
    const target = menuTargetOf(
      { phase: "intent", type: "cell.click", row: "a", col: "name", mods: MODS },
      root,
      made.grid.state.orientation.$(),
    )
    expect(target).toBeNull()
  })

  test("an element that has left the DOM is a null target, not a target at the origin", () => {
    const made = mount()
    const orientation = made.grid.state.orientation.$()
    expect(menuTargetOf(cellMenu("a", "name"), root, orientation)).not.toBeNull()
    const row = root.querySelector(selectorFor("row", { rowId: "a" }))
    row?.remove()
    expect(menuTargetOf(cellMenu("a", "name"), root, orientation)).toBeNull()
    expect(menuTargetOf(rowMenu("a"), root, orientation)).toBeNull()
  })
})

describe("the transpose crosses back before the target leaves", () => {
  test("under columns the row element is keyed by a column and the cell still resolves", () => {
    const made = mount({ state: { orientation: "columns" } })
    const orientation = made.grid.state.orientation.$()
    expect(orientation).toBe("columns")
    // The vertical run holds columns now, so `data-row-id` on a row element is a column id.
    const stamped = root.querySelector(selectorFor("row", { rowId: "name" }))
    expect(stamped).not.toBeNull()
    const target = menuTargetOf(cellMenu("a", "name"), root, orientation)
    expect(target?.kind).toBe("cell")
    expect([target?.row, target?.col]).toEqual(["a", "name"])
    // Two cells in that row carry `data-col-id="name"`, one per data row, so the conventional row
    // is what picks between them.
    expect(target?.anchor?.dataset.rowId).toBe("a")
    const other = menuTargetOf(cellMenu("b", "name"), root, orientation)
    expect(other?.anchor).not.toBe(target?.anchor)
    expect(other?.anchor?.dataset.rowId).toBe("b")
  })

  test("under columns a row target names a column of the schema", () => {
    const made = mount({ state: { orientation: "columns" } })
    const target = menuTargetOf(rowMenu("size"), root, made.grid.state.orientation.$())
    expect([target?.row, target?.col]).toEqual([null, "size"])
  })

  test("under columns a header target names a row of the data", () => {
    const made = mount({ state: { orientation: "columns" } })
    const target = menuTargetOf(headerMenu("b"), root, made.grid.state.orientation.$())
    expect([target?.row, target?.col]).toEqual(["b", null])
  })

  test("under columns a glyph cell's own row id has no row element, and a cell is the tether", () => {
    const made = mount({ columns: [expandColumn<Row>(), NAME], state: { orientation: "columns" } })
    const orientation = made.grid.state.orientation.$()
    expect(root.querySelector(selectorFor("row", { rowId: "a" }))).toBeNull()
    const target = menuTargetOf(rowMenu("a"), root, orientation)
    expect(target?.kind).toBe("row")
    expect([target?.row, target?.col]).toEqual(["a", null])
    expect(target?.anchor?.dataset.rowId).toBe("a")
  })
})

describe("anchorTo writes two elements and takes both back", () => {
  test("the anchor name is unique per target", () => {
    const made = mount()
    const orientation = made.grid.state.orientation.$()
    const first = menuTargetOf(cellMenu("a", "name"), root, orientation)
    const second = menuTargetOf(cellMenu("a", "name"), root, orientation)
    const other = menuTargetOf(rowMenu("b"), root, orientation)
    expect(first?.anchorName).not.toBe(second?.anchorName)
    expect(first?.anchorName).not.toBe(other?.anchorName)
    expect(first?.anchorName.startsWith("--sg-menu-")).toBe(true)
  })

  test("the teardown removes the name from the target and the tether from the popover", () => {
    answerSupports(true)
    const made = mount()
    const target = menuTargetOf(cellMenu("a", "name"), root, made.grid.state.orientation.$())
    expect(target).not.toBeNull()
    if (target === null) return
    const popover = document.createElement("div")
    const stop = anchorTo(target, popover)
    expect(target.anchor?.style.getPropertyValue("anchor-name")).toBe(target.anchorName)
    expect(popover.style.getPropertyValue("position-anchor")).toBe(target.anchorName)
    expect(popover.style.getPropertyValue("position-area")).toBe("block-end span-inline-end")
    expect(popover.style.getPropertyValue("position-try-fallbacks")).not.toBe("")
    expect(popover.style.getPropertyValue("margin")).toBe("0px")
    stop()
    expect(target.anchor?.style.getPropertyValue("anchor-name")).toBe("")
    expect(popover.style.getPropertyValue("position-anchor")).toBe("")
    expect(popover.style.getPropertyValue("position-area")).toBe("")
  })

  test("the fixed-coordinate fallback fires when CSS.supports says no", () => {
    answerSupports(false)
    expect(supportsAnchorPositioning()).toBe(false)
    const made = mount()
    const target = menuTargetOf(cellMenu("a", "name", 137, 42), root, made.grid.state.orientation.$())
    expect(target).not.toBeNull()
    if (target === null) return
    const popover = document.createElement("div")
    const stop = anchorTo(target, popover)
    expect(popover.style.getPropertyValue("position")).toBe("fixed")
    expect(popover.style.getPropertyValue("left")).toBe("137px")
    expect(popover.style.getPropertyValue("top")).toBe("42px")
    expect(popover.style.getPropertyValue("position-anchor")).toBe("")
    expect(target.anchor?.style.getPropertyValue("anchor-name")).toBe("")
    stop()
    expect(popover.style.getPropertyValue("left")).toBe("")
    expect(popover.style.getPropertyValue("position")).toBe("")
  })

  test("a document with no CSS object degrades to the same fallback rather than throwing", () => {
    dropSupports()
    expect(supportsAnchorPositioning()).toBe(false)
    const made = mount()
    const target = menuTargetOf(rowMenu("a", 5, 9), root, made.grid.state.orientation.$())
    expect(target).not.toBeNull()
    if (target === null) return
    const popover = document.createElement("div")
    anchorTo(target, popover)
    expect(popover.style.getPropertyValue("position")).toBe("fixed")
    expect(popover.style.getPropertyValue("left")).toBe("5px")
  })

  test("a hand-built target with no element takes the fallback too", () => {
    answerSupports(true)
    const popover = document.createElement("div")
    const stop = anchorTo(
      {
        kind: "cell",
        row: "a",
        col: "name",
        at: { x: 11, y: 22 },
        anchor: null,
        anchorName: "--sg-menu-hand",
      },
      popover,
    )
    expect(popover.style.getPropertyValue("position")).toBe("fixed")
    expect(popover.style.getPropertyValue("top")).toBe("22px")
    stop()
    expect(popover.style.getPropertyValue("top")).toBe("")
  })
})
