// Chromium only: the resize target is a hit test against painted boxes, and auto-fit reads the
// max-content width of rendered cells, so both need real layout and the shipped stylesheet.
import { afterEach, beforeEach, describe, expect, test } from "vitest"
import "./theme.css"
import type { ColumnDef, GridAction, GridState, Slots } from "./0_types.js"
import { selectorFor } from "./3_paths.js"
import { grid, type Grid } from "./8_grid.js"
import { render, type RenderHandle } from "./10_render.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly size: number
}

const ROWS: readonly Row[] = [
  { id: "a", name: "Alpha", size: 1 },
  { id: "b", name: "A considerably longer name than the column holds", size: 2 },
  { id: "c", name: "Mid length name", size: 3 },
]

const NAME: ColumnDef<Row> = { id: "name", header: "Name", width: 80, resizable: true, movable: true }
const SIZE: ColumnDef<Row> = { id: "size", header: "Size", width: 80, resizable: true, movable: true }

let host: HTMLElement
let live: { readonly handle: RenderHandle; readonly grid: Grid<Row> } | undefined
let seen: GridAction<Row>[] = []

beforeEach(() => {
  host = document.createElement("div")
  document.body.append(host)
  seen = []
})

afterEach(() => {
  live?.handle.stop()
  live?.grid.close()
  live = undefined
  host.remove()
})

const mount = (options: {
  readonly columns?: readonly ColumnDef<Row>[]
  readonly state?: Partial<GridState>
  readonly slots?: Slots<Row>
} = {}): Grid<Row> => {
  const made = grid<Row>({
    id: "sg-resize",
    rows: ROWS,
    columns: options.columns ?? [NAME, SIZE],
    rowId: (row) => row.id,
    state: { virtualize: { vertical: false, horizontal: false }, ...options.state },
    viewport: { top: 0, left: 0, width: 900, height: 400 },
    slots: options.slots,
  })
  // The test is the boundary, so it holds the one subscription that records what was dispatched.
  made.actions$.subscribe((it) => seen.push(it))
  live = { handle: render(made, host), grid: made }
  return made
}

const headOf = (colId: string): HTMLElement => {
  const el = host.querySelector(selectorFor("header", { colId }))
  if (!(el instanceof HTMLElement)) throw new Error(`no header for ${colId}`)
  return el
}

const at = (x: number, y: number): Element => {
  const el = document.elementFromPoint(x, y)
  if (el === null) throw new Error(`nothing at ${x},${y}`)
  return el
}

const pointer = (type: string, x: number, y: number, detail = 1): PointerEvent =>
  new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, detail, pointerId: 1 })

const mouse = (type: string, x: number, y: number, detail: number): MouseEvent =>
  new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, detail })

// The order a browser raises for two presses in place, each press dispatched to whatever the point
// hits at that moment, so a header rebuilt between presses is hit the way a real pointer hits it.
const doubleClickAt = (x: number, y: number): void => {
  for (const detail of [1, 2]) {
    at(x, y).dispatchEvent(pointer("pointerdown", x, y, detail))
    at(x, y).dispatchEvent(mouse("mousedown", x, y, detail))
    at(x, y).dispatchEvent(pointer("pointerup", x, y, detail))
    at(x, y).dispatchEvent(mouse("mouseup", x, y, detail))
    at(x, y).dispatchEvent(mouse("click", x, y, detail))
  }
  at(x, y).dispatchEvent(mouse("dblclick", x, y, 2))
}

/** The column's end edge, at the header's vertical middle. */
const boundaryOf = (colId: string): { readonly x: number; readonly y: number } => {
  const box = headOf(colId).getBoundingClientRect()
  return { x: box.right, y: box.top + box.height / 2 }
}

const downs = (): readonly { readonly col: string; readonly part: string }[] =>
  seen.flatMap((it) =>
    it.phase === "intent" && it.type === "header.pointerdown" ? [{ col: it.col, part: it.part }] : [],
  )

/** The widest rendered content of a column, read off text ranges so it ignores the track width. */
const widestContent = (colId: string): number => {
  const boxes = [headOf(colId).querySelector(".sg-head-label"), ...host.querySelectorAll(selectorFor("cell", { colId }))]
  const pad = Number.parseFloat(getComputedStyle(headOf(colId)).paddingInlineStart) * 2
  const widths = boxes.flatMap((el) => {
    if (el === null) return []
    const range = document.createRange()
    range.selectNodeContents(el)
    return [range.getBoundingClientRect().width + pad]
  })
  return Math.ceil(Math.max(...widths))
}

const overflowing = (colId: string): readonly string[] =>
  [...host.querySelectorAll<HTMLElement>(selectorFor("cell", { colId }))]
    .filter((el) => el.scrollWidth > el.clientWidth)
    .map((el) => el.textContent ?? "")

describe("the resize target straddles the column's end edge", () => {
  const cases: readonly [string, Parameters<typeof mount>[0]][] = [
    ["standard density, text label", {}],
    [
      "compact density, slotted label",
      {
        state: { density: "compact" },
        slots: {
          header: (ctx) => {
            const el = document.createElement("button")
            el.textContent = `[${ctx.col}]`
            el.style.inlineSize = "100%"
            return el
          },
        },
      },
    ],
  ]

  test.each(cases)("a pointerdown within 4px either side of the edge resizes (%s)", (_name, options) => {
    mount(options)
    const edge = boundaryOf("name")
    for (const dx of [-4, -1, 1, 4]) {
      at(edge.x + dx, edge.y).dispatchEvent(pointer("pointerdown", edge.x + dx, edge.y))
      window.dispatchEvent(pointer("pointerup", edge.x + dx, edge.y))
    }
    expect(downs()).toEqual([
      { col: "name", part: "resize" },
      { col: "name", part: "resize" },
      { col: "name", part: "resize" },
      { col: "name", part: "resize" },
    ])
  })
})

describe("a double click on the resize handle fits the column to its content", () => {
  test("the width becomes the widest content plus padding, and no cell in it overflows", () => {
    const made = mount()
    const edge = boundaryOf("name")
    doubleClickAt(edge.x, edge.y)
    const expected = widestContent("name")
    expect({
      colWidth: made.state.colWidth.$(),
      painted: Math.round(headOf("name").getBoundingClientRect().width),
      overflowing: overflowing("name"),
    }).toEqual({
      colWidth: { name: expected },
      painted: expected,
      overflowing: [],
    })
    expect(expected).toBeGreaterThan(200)
  })

  test("maxWidth clamps the fit", () => {
    const made = mount({ columns: [{ ...NAME, maxWidth: 120 }, SIZE] })
    const edge = boundaryOf("name")
    doubleClickAt(edge.x, edge.y)
    expect(made.state.colWidth.$()).toEqual({ name: 120 })
  })

  test("minWidth clamps a fit narrower than it", () => {
    const made = mount({ columns: [NAME, { ...SIZE, width: 200, minWidth: 60 }] })
    const edge = boundaryOf("size")
    doubleClickAt(edge.x - 2, edge.y)
    expect(made.state.colWidth.$()).toEqual({ size: 60 })
  })

  test("the double click raises no sort and no move, even struck over the neighbour's label", () => {
    const made = mount()
    const edge = boundaryOf("name")
    doubleClickAt(edge.x + 3, edge.y)
    expect({
      sort: made.state.sort.$(),
      colOrder: made.view.cols.$().map((it) => it.key),
      drag: made.state.drag.$(),
      downs: downs(),
      clicks: seen.filter((it) => it.phase === "intent" && it.type === "header.click").length,
      fits: seen.flatMap((it) =>
        it.phase === "intent" && it.type === "header.dblclick" ? [{ col: it.col, part: it.part }] : [],
      ),
    }).toEqual({
      sort: [],
      colOrder: ["name", "size"],
      drag: null,
      downs: [
        { col: "name", part: "resize" },
        { col: "name", part: "resize" },
      ],
      clicks: 0,
      fits: [{ col: "name", part: "resize" }],
    })
  })
})
