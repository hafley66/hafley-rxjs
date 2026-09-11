// Chromium under `vitest.browser.config.ts`. The defect this feature closes was a layout one: a
// band took a track's worth of cells in every row while the track list counted leaves, and the
// third cell wrapped. Every count in `18_bands.test.ts` was blind to that, so the assertions here
// read laid-out boxes out of a real engine rather than the numbers behind them.
import { afterEach, beforeEach, describe, expect, test } from "vitest"
import "./theme.css"
import { grid, headerGroup, render, SG_INLINE_TRACKS } from "./index.js"
import type { ColumnDef, Grid, GridState, RenderHandle } from "./index.js"

interface Row {
  readonly id: string
  readonly name: string
  readonly size: number
  readonly note: string
}

const ROWS: readonly Row[] = [
  { id: "a", name: "Alpha", size: 1, note: "one" },
  { id: "b", name: "Beta", size: 2, note: "two" },
]

const TWO_LEVEL: readonly ColumnDef<Row>[] = [
  headerGroup<Row>({ id: "info", header: "Info" }),
  { id: "name", header: "Name", width: 120, group: "info" },
  { id: "size", header: "Size", width: 100, group: "info" },
  { id: "note", header: "Note", width: 140 },
]

const THREE_LEVEL: readonly ColumnDef<Row>[] = [
  headerGroup<Row>({ id: "top", header: "Top" }),
  headerGroup<Row>({ id: "mid", header: "Mid", group: "top" }),
  { id: "name", header: "Name", width: 120, group: "mid" },
  { id: "size", header: "Size", width: 100, group: "mid" },
  { id: "note", header: "Note", width: 140, group: "top" },
]

let root: HTMLElement
let live: RenderHandle[] = []

class StubObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeEach(() => {
  live = []
  root = document.createElement("div")
  root.style.inlineSize = "800px"
  root.style.blockSize = "400px"
  document.body.append(root)
  ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = StubObserver
})

afterEach(() => {
  for (const handle of live) handle.stop()
  root.remove()
})

function mount(
  columns: readonly ColumnDef<Row>[],
  state: Partial<GridState> = {},
): Grid<Row> {
  const made = grid<Row>({
    id: "sg-band",
    rows: ROWS,
    columns,
    rowId: (it) => it.id,
    state: { virtualize: { vertical: false, horizontal: false }, ...state },
    viewport: { top: 0, left: 0, width: 800, height: 400 },
  })
  live.push(render(made, root))
  return made
}

const bandBox = (key: string): DOMRect => {
  const el = root.querySelector<HTMLElement>(`.sg-head-band[data-band="${key}"]`)
  if (el === null) throw new Error(`no band cell for "${key}"`)
  return el.getBoundingClientRect()
}

const leafBox = (colId: string): DOMRect => {
  const el = root.querySelector<HTMLElement>(`.sg-head-cell[data-col-id="${colId}"]`)
  if (el === null) throw new Error(`no leaf header for "${colId}"`)
  return el.getBoundingClientRect()
}

const trackCount = (): number =>
  root.style.getPropertyValue(SG_INLINE_TRACKS).trim().split(/\s+/).filter(Boolean).length

describe("a band renders no data cell", () => {
  test("a rendered row holds one cell per leaf and none for the band", () => {
    mount(TWO_LEVEL)
    for (const row of root.querySelectorAll<HTMLElement>(".sg-row")) {
      const ids = [...row.querySelectorAll<HTMLElement>(".sg-cell")].map((it) =>
        it.getAttribute("data-col-id"),
      )
      expect(ids).toEqual(["name", "size", "note"])
    }
  })

  test("every cell of a row sits on one line, which is what the wrap gave away", () => {
    mount(TWO_LEVEL)
    const row = root.querySelector<HTMLElement>(".sg-row")
    if (row === null) throw new Error("no row rendered")
    const tops = [...row.querySelectorAll<HTMLElement>(".sg-cell")].map(
      (it) => it.getBoundingClientRect().top,
    )
    expect(new Set(tops).size).toBe(1)
  })

  test("the track count equals the leaf count under both depths", () => {
    mount(TWO_LEVEL)
    expect(trackCount()).toBe(3)
    for (const handle of live) handle.stop()
    live = []
    root.replaceChildren()
    mount(THREE_LEVEL)
    expect(trackCount()).toBe(3)
  })
})

describe("a band's box is its leaves' boxes", () => {
  test("the band spans its leaves exactly, leading edge to trailing edge", () => {
    mount(TWO_LEVEL)
    const band = bandBox("info")
    expect(band.left).toBeCloseTo(leafBox("name").left, 1)
    expect(band.right).toBeCloseTo(leafBox("size").right, 1)
    expect(band.right).toBeLessThan(leafBox("note").left + 1)
  })

  test("three levels nest, and the middle band covers a strict subset of the outer one", () => {
    mount(THREE_LEVEL)
    const top = bandBox("top")
    const mid = bandBox("mid")
    expect(top.left).toBeCloseTo(leafBox("name").left, 1)
    expect(top.right).toBeCloseTo(leafBox("note").right, 1)
    expect(mid.left).toBeCloseTo(leafBox("name").left, 1)
    expect(mid.right).toBeCloseTo(leafBox("size").right, 1)
    expect(mid.right).toBeLessThan(top.right)
  })

  test("the band rows stack, one per level, above the leaf row", () => {
    mount(THREE_LEVEL)
    const rows = [...root.querySelectorAll<HTMLElement>(".sg-head-row")]
    expect(rows.length).toBe(3)
    const tops = rows.map((it) => it.getBoundingClientRect().top)
    expect(tops[0]).toBeLessThan(tops[1] ?? 0)
    expect(tops[1]).toBeLessThan(tops[2] ?? 0)
    expect(bandBox("top").bottom).toBeCloseTo(bandBox("mid").top, 1)
    expect(bandBox("mid").bottom).toBeCloseTo(leafBox("name").top, 1)
  })

  test("a leaf outside every band keeps its header on the bottom row", () => {
    mount(TWO_LEVEL)
    expect(leafBox("note").top).toBeCloseTo(leafBox("name").top, 1)
  })
})

describe("a resize moves the band with the leaf", () => {
  test("widening a leaf moves its band's trailing edge by the same delta", () => {
    const made = mount(TWO_LEVEL)
    const before = bandBox("info").right
    made.state.colWidth.size.$(220)
    const after = bandBox("info").right
    expect(after - before).toBeCloseTo(120, 1)
    expect(after).toBeCloseTo(leafBox("size").right, 1)
  })

  test("widening a leaf outside the band leaves the band's box alone", () => {
    const made = mount(TWO_LEVEL)
    const before = bandBox("info")
    made.state.colWidth.note.$(260)
    const after = bandBox("info")
    expect(after.left).toBeCloseTo(before.left, 1)
    expect(after.right).toBeCloseTo(before.right, 1)
  })
})
