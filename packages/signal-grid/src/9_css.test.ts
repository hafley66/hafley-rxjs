// Runs in chromium under `vitest.browser.config.ts`, so every property below is read back out of a
// real style engine that had to parse it first.
//
// The one file in `src/` that owns a subscription to a DOM element, so the teardown is asserted
// where the element lives rather than left to the renderer that happens to call it.
import { describe, expect, it } from "vitest"
import type { ColumnDef } from "./0_types.js"
import { rowHeightVar } from "./3_paths.js"
import { grid } from "./8_grid.js"
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
    const { g, root, release } = mount([{ id: "name", flex: 1, minWidth: 80 }])
    g.dispatch({ phase: "change", type: "colWidth", colWidth: { name: 240 } })
    expect(tracks(root)).toBe("minmax(80px, 240px)")
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

  it("sets the track list exactly once per pass, whatever the column count", () => {
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
    // SG_ROW_H is written once per pass by construction, so an equal count is one write per pass.
    expect(counts.get(SG_INLINE_TRACKS)).toBe(counts.get(SG_ROW_H))
    expect(counts.get(SG_INLINE_TRACKS) ?? 0).toBeGreaterThan(0)
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
