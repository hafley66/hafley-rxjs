// Runs in chromium under `vitest.browser.config.ts`, so every property below is read back out of a
// real style engine that had to parse it first.
//
// The one file in `src/` that owns a subscription to a DOM element, so the teardown is asserted
// where the element lives rather than left to the renderer that happens to call it.
import { describe, expect, it } from "vitest"
// The one file here that reads a laid-out box rather than a written property, so it is the one that
// needs the stylesheet. Every other assertion below reads an inline property off a detached root.
import "./theme.css"
import type { ColumnDef, GridState } from "./0_types.js"
import { rowHeightVar, selectorFor } from "./3_paths.js"
import { checkboxColumn, detailColumn, dragColumn, radioColumn } from "./5_columns.js"
import { grid, ROW_HEIGHT } from "./8_grid.js"
import { render } from "./10_render.js"
import {
  SG_INLINE_TRACKS,
  SG_OFFSET_Y,
  SG_ROW_H,
  SG_TOTAL_H,
  writeGridVars,
} from "./9_css.js"

type Row = { id: string; name: string }

const ROWS: readonly Row[] = [
  { id: "a", name: "alice" },
  { id: "b", name: "bob" },
]

const gridOf = (columns: readonly ColumnDef<Row>[]) =>
  grid<Row>({ id: "t", rows: ROWS, columns, rowId: (row) => row.id })

const mount = (columns: readonly ColumnDef<Row>[]) => {
  const g = gridOf(columns)
  const root = document.createElement("div")
  const release = writeGridVars(g, root)
  return { g, root, release }
}

const tracks = (root: HTMLElement): string =>
  root.style.getPropertyValue(SG_INLINE_TRACKS).trim()

// The `trackList` grammar itself lives in `4_slice.test.ts`. What only this file can assert is what
// `tracksOf` adds on top of it: which entries become tracks, in what order, and what a committed
// resize does to a flex column.
describe("what becomes a track", () => {
  it("orders tracks start, center, end, which is the order the runs are laid out in", () => {
    const { g, root, release } = mount([
      { id: "one", width: 10 },
      { id: "two", width: 20 },
      { id: "three", width: 30 },
    ])
    g.dispatch({
      phase: "change",
      type: "colPinning",
      colPinning: { two: "end", three: "start" },
    })
    expect(tracks(root)).toBe("30px 10px 20px")
    release()
  })

  it("gives a header group node no track of its own", () => {
    const { root, release } = mount([
      { id: "one", width: 10, group: "band" },
      { id: "two", width: 20, group: "band" },
    ])
    expect(tracks(root)).toBe("10px 20px")
    release()
  })

  it("freezes a resized column at the width the drag committed", () => {
    const { g, root, release } = mount([{ id: "name", flex: 1, minWidth: 80, maxWidth: 300 }])
    expect(tracks(root)).toBe("minmax(80px, 300px)")
    g.dispatch({ phase: "change", type: "colWidth", colWidth: { name: 240 } })
    // One fixed track. A `minmax()` around it would leave the browser free to answer 80 or 300,
    // which is the schema's sizing answering a question the drag already settled.
    expect(tracks(root)).toBe("240px")
    release()
  })
})

describe("the write pass", () => {
  it("writes the virtualization properties and the track list", () => {
    const { root, release } = mount([{ id: "name", width: 120 }])
    expect(root.style.getPropertyValue(SG_ROW_H)).toBe("36px")
    expect(root.style.getPropertyValue(SG_TOTAL_H)).toBe("72px")
    expect(root.style.getPropertyValue(SG_OFFSET_Y)).toBe("0px")
    expect(tracks(root)).toBe("120px")
    release()
  })

  it("sets the track list once when it moved and not at all on a pass it did not", () => {
    const { g, root, release } = mount([
      { id: "one", width: 10 },
      { id: "two", flex: 1 },
      { id: "three", minWidth: 40, maxWidth: 90 },
    ])
    const counts = new Map<string, number>()
    const real = root.style.setProperty.bind(root.style)
    root.style.setProperty = (name: string, value: string | null, priority?: string) => {
      counts.set(name, (counts.get(name) ?? 0) + 1)
      real(name, value, priority)
    }
    g.dispatch({ phase: "change", type: "colWidth", colWidth: { two: 240 } })
    expect(counts.get(SG_INLINE_TRACKS)).toBe(1)
    // A pass that rebuilt the frame and left the inline axis alone. Every scroll frame is this
    // shape, and the track list is the property whose rewrite reflows every rendered row.
    g.dispatch({ phase: "change", type: "rowHeight", rowHeight: { a: 64 } })
    expect(counts.get(SG_INLINE_TRACKS)).toBe(1)
    expect(counts.get(rowHeightVar("a"))).toBe(1)
    expect(counts.get(SG_ROW_H)).toBe(undefined)
    release()
  })

  it("carries no per-column property beside the track list", () => {
    const { root, release } = mount([{ id: "name", width: 120, pin: "start" }])
    expect(root.getAttribute("style")).not.toContain("--sg-h-w-")
    expect(root.getAttribute("style")).not.toContain("--sg-h-x-")
    release()
  })

  it("removes a property that disappeared between frames", () => {
    const { g, root, release } = mount([{ id: "name", width: 120 }])
    g.dispatch({ phase: "change", type: "rowHeight", rowHeight: { a: 64 } })
    expect(root.style.getPropertyValue(rowHeightVar("a"))).toBe("64px")
    g.dispatch({ phase: "change", type: "rowHeight", rowHeight: {} })
    expect(root.style.getPropertyValue(rowHeightVar("a"))).toBe("")
    release()
  })

  it("keeps a property that survived the frame", () => {
    const { g, root, release } = mount([{ id: "name", width: 120 }])
    g.dispatch({ phase: "change", type: "rowHeight", rowHeight: { a: 64, b: 20 } })
    g.dispatch({ phase: "change", type: "rowHeight", rowHeight: { a: 64 } })
    expect(root.style.getPropertyValue(rowHeightVar("a"))).toBe("64px")
    expect(root.style.getPropertyValue(rowHeightVar("b"))).toBe("")
    release()
  })
})

describe("the teardown", () => {
  it("stops writing once released", () => {
    const { g, root, release } = mount([{ id: "name", width: 120 }])
    release()
    g.dispatch({ phase: "change", type: "colWidth", colWidth: { name: 999 } })
    expect(tracks(root)).toBe("120px")
  })

  it("is idempotent", () => {
    const { release } = mount([{ id: "name", width: 120 }])
    release()
    expect(release).not.toThrow()
  })
})

// --- The window, laid out ---------------------------------------------------

const WIDE_COLS: readonly ColumnDef<Row>[] = Array.from({ length: 200 }, (_value, index) => ({
  id: `c${String(index).padStart(3, "0")}`,
  width: 100,
}))

const WIDE_ROWS: readonly Row[] = Array.from({ length: 40 }, (_value, index) => ({
  id: `r${index}`,
  name: `row ${index}`,
}))

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })

/** Mounts into the document, because a track only has a width once an engine has laid it out. */
const mountWide = async (horizontal: boolean, scrollLeft: number) => {
  const host = document.createElement("div")
  host.style.inlineSize = "800px"
  host.style.blockSize = "400px"
  document.body.append(host)
  const g = grid<Row>({
    id: "wide",
    rows: WIDE_ROWS,
    columns: WIDE_COLS,
    rowId: (it) => it.id,
    state: { virtualize: { vertical: true, horizontal } },
  })
  const handle = render(g, host)
  const scroll = host.querySelector(".sg-scroll") as HTMLElement
  // The viewport arrives from a ResizeObserver, and a zero width empties the window.
  for (let tick = 0; tick < 20 && g.viewport.$().width === 0; tick++) await nextFrame()
  scroll.scrollLeft = scrollLeft
  scroll.dispatchEvent(new Event("scroll"))
  await nextFrame()
  await nextFrame()
  return {
    g,
    scroll,
    host,
    /** The cell's left edge in the scroller's own content space, which is what a column offset is. */
    xOf: (colId: string): number | null => {
      const cell = host.querySelector(`.sg-row ${selectorFor("cell", { colId })}`)
      if (cell === null) return null
      return (
        cell.getBoundingClientRect().left - scroll.getBoundingClientRect().left + scroll.scrollLeft
      )
    },
    cellsPerRow: host.querySelector(".sg-row")?.querySelectorAll(".sg-cell").length ?? 0,
    release: () => {
      handle.stop()
      host.remove()
    },
  }
}

// The compact row is the tightest case a glyph has to fit: 28px with a 1px border, so 27px of
// content. A glyph box that grew the row would move every offset the plan computed.
//
// The pair asserted here is a target and a mark, and they are deliberately different numbers. One
// token drove both until this block was rewritten, which is what put a 15px triangle in that 27px.
const HIT_BOX = 24
const MARK = 16

const DENSITIES: readonly GridState["density"][] = ["compact", "standard", "comfortable"]

describe("the glyph boxes inside a row", () => {
  const mountGlyphs = (
    density: GridState["density"] = "compact",
    sort: GridState["sort"] = [],
  ) => {
    const host = document.createElement("div")
    host.style.inlineSize = "600px"
    host.style.blockSize = "300px"
    document.body.append(host)
    const g = grid<Row & { kids?: readonly Row[] }>({
      id: "glyphs",
      rows: [{ id: "a", name: "alice", kids: [{ id: "a/1", name: "one" }] }, { id: "b", name: "bob" }],
      columns: [checkboxColumn(), radioColumn({ id: "pick" }), dragColumn(), detailColumn(), { id: "name", flex: 1 }],
      rowId: (it) => it.id,
      subRows: (it) => it.kids,
      state: { density, sort, virtualize: { vertical: false, horizontal: false } },
    })
    const handle = render(g, host)
    return { host, release: () => { handle.stop(); host.remove() } }
  }

  const heightsOf = (host: HTMLElement, selector: string): readonly number[] =>
    [...host.querySelectorAll(selector)].map((it) => it.getBoundingClientRect().height)

  it("leaves the row at the height its density declared", () => {
    const view = mountGlyphs()
    expect(heightsOf(view.host, ".sg-row")).toEqual([ROW_HEIGHT.compact, ROW_HEIGHT.compact])
    view.release()
  })

  for (const density of DENSITIES) {
    it(`draws the expander's box and its mark at different sizes under ${density}`, () => {
      const view = mountGlyphs(density)
      const glyph = view.host.querySelector(".sg-expander")
      expect(glyph).not.toBe(null)
      if (glyph === null) return
      const style = getComputedStyle(glyph)
      expect(style.fontSize).toBe(`${MARK}px`)
      // `line-height: 1` keeps the mark's line box off the row: normal would ask for about 19px.
      expect(style.lineHeight).toBe(`${MARK}px`)
      // The box is the target and does not follow the mark, which is the whole split.
      expect(style.inlineSize).toBe(`${HIT_BOX}px`)
      expect(style.blockSize).toBe(`${HIT_BOX}px`)
      expect(glyph.getBoundingClientRect().height).toBe(HIT_BOX)
      expect(glyph.getBoundingClientRect().height).toBeGreaterThan(MARK)
      // A target below 24px is one the pointer misses, whatever the row around it is.
      expect(HIT_BOX).toBeGreaterThanOrEqual(24)
      expect(heightsOf(view.host, ".sg-row").every((it) => it === ROW_HEIGHT[density])).toBe(true)
      view.release()
    })
  }

  it("draws every other mark at the same size, inside a box the pointer can still hit", () => {
    const view = mountGlyphs()
    const marks = [".sg-check", ".sg-check-radio", ".sg-drag", ".sg-detail-toggle"]
    for (const selector of marks) {
      const glyph = view.host.querySelector(selector)
      expect(glyph, selector).not.toBe(null)
      if (glyph === null) continue
      const style = getComputedStyle(glyph)
      expect(style.fontSize, selector).toBe(`${MARK}px`)
      expect(style.lineHeight, selector).toBe(`${MARK}px`)
      // These three fill their cell, so the box is the row's height and never the mark's.
      const box = glyph.getBoundingClientRect()
      expect(box.height, selector).toBeGreaterThanOrEqual(MARK)
      expect(box.width, selector).toBeGreaterThanOrEqual(HIT_BOX)
    }
    expect(heightsOf(view.host, ".sg-expander").every((it) => it <= ROW_HEIGHT.compact)).toBe(true)
    view.release()
  })

  // Sorted, because the `::after` rule is gated on `data-sort` and an unsorted header answers with
  // the inherited text size. The previous assertion read 16px off exactly that fallback.
  it("keeps the sort mark smaller still, because it annotates a label rather than being a target", () => {
    const view = mountGlyphs("compact", [{ field: "name", sort: "asc" }])
    const head = view.host.querySelector(selectorFor("header", { colId: "name" }))
    expect(head?.getAttribute("data-sort")).toBe("asc")
    const size = head === null ? "" : getComputedStyle(head, "::after").fontSize
    expect(size).toBe("11px")
    expect(Number.parseFloat(size)).toBeLessThan(MARK)
    view.release()
  })
})

describe("a windowed column run laid out by a real engine", () => {
  it("puts a rendered cell at the x its column's offset implies", async () => {
    const view = await mountWide(true, 4000)
    // 200 columns at 100px, so column 40 begins at 4000 and column 45 at 4500, windowed or not.
    expect(view.xOf("c040")).toBe(4000)
    expect(view.xOf("c045")).toBe(4500)
    view.release()
  })

  it("gives the scroller the width of every column, not of the rendered ones", async () => {
    const view = await mountWide(true, 4000)
    expect(view.scroll.scrollWidth).toBe(200 * 100)
    expect(view.cellsPerRow).toBeLessThan(200)
    view.release()
  })

  it("agrees with the unwindowed run about where a column sits", async () => {
    const windowed = await mountWide(true, 4000)
    const whole = await mountWide(false, 4000)
    expect(windowed.xOf("c040")).toBe(whole.xOf("c040"))
    expect(windowed.scroll.scrollWidth).toBe(whole.scroll.scrollWidth)
    expect(whole.cellsPerRow).toBe(200)
    windowed.release()
    whole.release()
  })

  it("renders no cell for a column the window left out", async () => {
    const view = await mountWide(true, 4000)
    expect(view.xOf("c000")).toBe(null)
    expect(view.xOf("c199")).toBe(null)
    view.release()
  })

  it("holds the head cell over the body cell of the same column", async () => {
    const view = await mountWide(true, 4000)
    const head = view.host.querySelector(`.sg-head ${selectorFor("header", { colId: "c040" })}`)
    const body = view.host.querySelector(`.sg-row ${selectorFor("cell", { colId: "c040" })}`)
    expect(head).not.toBe(null)
    expect(body).not.toBe(null)
    // The two bands each carry their own spacer seat, so a disagreement here is the header sitting
    // one track off the cells under it, which is the whole failure the spacer track exists to avoid.
    expect(head?.getBoundingClientRect().left).toBe(body?.getBoundingClientRect().left)
    view.release()
  })
})
