import { describe, expect, it } from "vitest"
import type { Side } from "./0_types.js"
import {
  measuredSizer,
  NO_SPACERS,
  paginate,
  partition,
  renderPlan,
  sliceKeys,
  spacersOf,
  trackList,
  uniformSizer,
  windowOf,
} from "./4_slice.js"

const keys = (n: number, from = 0): string[] =>
  Array.from({ length: n }, (_, i) => `k${String(i + from).padStart(2, "0")}`)

const sideOf =
  (map: Record<string, Side>) =>
  (key: string): Side | undefined =>
    map[key]

describe("partition", () => {
  it("puts keys with no side in center", () => {
    const flat = ["a", "b", "c"]
    expect(partition(flat, () => undefined)).toEqual({ start: [], center: flat, end: [] })
  })

  it("treats an explicit center side as center", () => {
    const flat = ["a", "b"]
    expect(partition(flat, () => "center" as Side)).toEqual({ start: [], center: flat, end: [] })
  })

  it("preserves input order within each of the three runs", () => {
    const flat = ["a", "b", "c", "d", "e", "f"]
    const at = sideOf({ c: "start", a: "start", f: "end", b: "end" })
    expect(partition(flat, at)).toEqual({ start: ["a", "c"], center: ["d", "e"], end: ["b", "f"] })
  })

  it("removes a pinned key from center exactly once", () => {
    const flat = keys(10)
    const at = sideOf({ k00: "start", k05: "start", k09: "end" })
    const out = partition(flat, at)
    expect(out.center).not.toContain("k00")
    expect(out.center).not.toContain("k05")
    expect(out.center).not.toContain("k09")
    expect(out.start.length + out.center.length + out.end.length).toBe(flat.length)
    expect([...out.start, ...out.center, ...out.end].sort()).toEqual([...flat].sort())
  })
})

describe("paginate", () => {
  const center = keys(7)

  it("returns the same reference when disabled", () => {
    expect(paginate(center, { index: 3, size: 2 }, false)).toBe(center)
  })

  it("slices the requested page", () => {
    expect(paginate(center, { index: 0, size: 3 }, true)).toEqual(["k00", "k01", "k02"])
    expect(paginate(center, { index: 1, size: 3 }, true)).toEqual(["k03", "k04", "k05"])
    expect(paginate(center, { index: 2, size: 3 }, true)).toEqual(["k06"])
  })

  it("yields an empty center for a page index past the end", () => {
    expect(paginate(center, { index: 9, size: 3 }, true)).toEqual([])
    expect(() => paginate(center, { index: 1e9, size: 3 }, true)).not.toThrow()
  })

  it("clamps a negative page index to the first page", () => {
    expect(paginate(center, { index: -4, size: 3 }, true)).toEqual(["k00", "k01", "k02"])
  })

  it("yields an empty center for a non-positive page size", () => {
    expect(paginate(center, { index: 0, size: 0 }, true)).toEqual([])
    expect(paginate(center, { index: 0, size: -5 }, true)).toEqual([])
  })
})

describe("uniformSizer", () => {
  const s = uniformSizer(10, 32)

  it("reports count and total", () => {
    expect(s.count).toBe(10)
    expect(s.total).toBe(320)
  })

  it("answers offsetOf and sizeOf", () => {
    expect(s.offsetOf(0)).toBe(0)
    expect(s.offsetOf(3)).toBe(96)
    expect(s.offsetOf(10)).toBe(320)
    expect(s.sizeOf(4)).toBe(32)
  })

  it("maps a pixel to the row containing it", () => {
    expect(s.indexAt(0)).toBe(0)
    expect(s.indexAt(31)).toBe(0)
    expect(s.indexAt(32)).toBe(1)
    expect(s.indexAt(33)).toBe(1)
  })

  it("clamps indexAt below zero, past the end, and on an empty list", () => {
    expect(s.indexAt(-100)).toBe(0)
    expect(s.indexAt(99999)).toBe(9)
    expect(uniformSizer(0, 32).indexAt(50)).toBe(0)
    expect(uniformSizer(0, 32).total).toBe(0)
  })

  it("answers the head of the list when rows have no height", () => {
    expect(uniformSizer(5, 0).indexAt(200)).toBe(0)
  })
})

describe("measuredSizer", () => {
  it("matches a uniform sizer when nothing is measured", () => {
    const m = measuredSizer(6, 25, new Map())
    const u = uniformSizer(6, 25)
    expect(m.total).toBe(u.total)
    for (let i = 0; i <= 6; i++) expect(m.offsetOf(i)).toBe(u.offsetOf(i))
    for (let px = 0; px < 150; px += 7) expect(m.indexAt(px)).toBe(u.indexAt(px))
  })

  it("uses the measurement where there is one and the estimate elsewhere", () => {
    const m = measuredSizer(4, 20, new Map([[1, 100]]))
    expect(m.sizeOf(0)).toBe(20)
    expect(m.sizeOf(1)).toBe(100)
    expect(m.offsetOf(2)).toBe(120)
    expect(m.total).toBe(160)
    expect(m.offsetOf(4)).toBe(160)
  })

  it("binary searches to the row containing a pixel, on both sides of a boundary", () => {
    const m = measuredSizer(4, 20, new Map([[1, 100]]))
    expect(m.indexAt(0)).toBe(0)
    expect(m.indexAt(19)).toBe(0)
    expect(m.indexAt(20)).toBe(1)
    expect(m.indexAt(119)).toBe(1)
    expect(m.indexAt(120)).toBe(2)
    expect(m.indexAt(140)).toBe(3)
  })

  it("clamps indexAt below zero, past the end, and on an empty list", () => {
    const m = measuredSizer(4, 20, new Map([[1, 100]]))
    expect(m.indexAt(-1)).toBe(0)
    expect(m.indexAt(160)).toBe(3)
    expect(m.indexAt(9999)).toBe(3)
    const empty = measuredSizer(0, 20, new Map())
    expect(empty.indexAt(40)).toBe(0)
    expect(empty.total).toBe(0)
    expect(empty.offsetOf(0)).toBe(0)
  })

  it("steps over a run of zero height rows, since an empty interval contains no pixel", () => {
    const m = measuredSizer(4, 10, new Map([[1, 0], [2, 0]]))
    expect(m.total).toBe(20)
    expect(m.indexAt(9)).toBe(0)
    expect(m.indexAt(10)).toBe(3)
    expect(m.indexAt(19)).toBe(3)
  })
})

describe("windowOf", () => {
  const s = uniformSizer(20, 32)

  it("covers the viewport and expands by overscan on each side", () => {
    expect(windowOf(s, { start: 320, extent: 100 }, 0)).toEqual({ start: 10, end: 14 })
    expect(windowOf(s, { start: 320, extent: 100 }, 2)).toEqual({ start: 8, end: 16 })
  })

  it("excludes a row that begins exactly at the viewport bottom", () => {
    expect(windowOf(s, { start: 0, extent: 64 }, 0)).toEqual({ start: 0, end: 2 })
    expect(windowOf(s, { start: 0, extent: 65 }, 0)).toEqual({ start: 0, end: 3 })
  })

  it("yields an empty span at the right index for a zero extent", () => {
    expect(windowOf(s, { start: 200, extent: 0 }, 4)).toEqual({ start: 6, end: 6 })
    expect(windowOf(s, { start: 200, extent: -10 }, 4)).toEqual({ start: 6, end: 6 })
  })

  it("clamps to zero and to count", () => {
    expect(windowOf(s, { start: 0, extent: 100 }, 10)).toEqual({ start: 0, end: 14 })
    expect(windowOf(s, { start: 600, extent: 400 }, 10)).toEqual({ start: 8, end: 20 })
  })

  it("yields an empty span for an empty list", () => {
    expect(windowOf(uniformSizer(0, 32), { start: 0, extent: 500 }, 4)).toEqual({ start: 0, end: 0 })
  })
})

describe("sliceKeys", () => {
  it("slices the half-open span", () => {
    expect(sliceKeys(keys(5), { start: 1, end: 3 })).toEqual(["k01", "k02"])
  })

  it("returns the same reference when the span covers everything", () => {
    const all = keys(5)
    expect(sliceKeys(all, { start: 0, end: 5 })).toBe(all)
    expect(sliceKeys(all, { start: 0, end: 99 })).toBe(all)
  })

  it("yields nothing for an empty span", () => {
    expect(sliceKeys(keys(5), { start: 2, end: 2 })).toEqual([])
  })
})

describe("renderPlan", () => {
  const flat = keys(20)
  const pinned = sideOf({ k00: "start", k01: "start", k19: "end" })

  it("steps through 20 keys, 2 pinned start, 1 pinned end, page size 5, 32px rows", () => {
    const plan = renderPlan({
      flat,
      side: pinned,
      page: { index: 0, size: 5 },
      paginate: true,
      virtualize: true,
      sizer: (keys) => uniformSizer(keys.length, 32),
      viewport: { start: 40, extent: 100 },
      overscan: 1,
    })
    expect(plan).toMatchObject({
      start: ["k00", "k01"],
      center: ["k02", "k03", "k04", "k05", "k06"],
      end: ["k19"],
      span: { start: 0, end: 5 },
      centerTotal: 160,
      offsetTop: 0,
      pageCount: 4,
    })
  })

  it("reports offsetTop and centerTotal over the whole center when pagination is off", () => {
    const plan = renderPlan({
      flat,
      side: pinned,
      page: { index: 0, size: 5 },
      paginate: false,
      virtualize: true,
      sizer: (keys) => uniformSizer(keys.length, 32),
      viewport: { start: 200, extent: 100 },
      overscan: 1,
    })
    expect(plan.span).toEqual({ start: 5, end: 11 })
    expect(plan.center).toEqual(["k07", "k08", "k09", "k10", "k11", "k12"])
    expect(plan.centerTotal).toBe(544)
    expect(plan.offsetTop).toBe(160)
    expect(plan.pageCount).toBe(4)
  })

  it("never paginates or virtualizes a pinned key away", () => {
    for (const index of [0, 1, 2, 3, 50]) {
      for (const virtualize of [true, false]) {
        const plan = renderPlan({
          flat,
          side: pinned,
          page: { index, size: 5 },
          paginate: true,
          virtualize,
          sizer: (keys) => uniformSizer(keys.length, 32),
          viewport: { start: 4000, extent: 1 },
          overscan: 0,
        })
        expect(plan.start).toEqual(["k00", "k01"])
        expect(plan.end).toEqual(["k19"])
      }
    }
  })

  it("makes the window step the identity when virtualize is off, changing nothing else", () => {
    const input = {
      flat,
      side: pinned,
      page: { index: 1, size: 5 },
      paginate: true,
      sizer: (keys) => uniformSizer(keys.length, 32),
      viewport: { start: 40, extent: 33 },
      overscan: 1,
    }
    const on = renderPlan({ ...input, virtualize: true })
    const off = renderPlan({ ...input, virtualize: false })
    expect(on.span).toEqual({ start: 0, end: 4 })
    expect(off.span).toEqual({ start: 0, end: 5 })
    expect(off.center).toEqual(["k07", "k08", "k09", "k10", "k11"])
    expect(off.start).toEqual(on.start)
    expect(off.end).toEqual(on.end)
    expect(off.centerTotal).toBe(on.centerTotal)
    expect(off.offsetTop).toBe(0)
    expect(off.pageCount).toBe(on.pageCount)
  })

  it("yields an empty center for a page index past the end rather than throwing", () => {
    const run = () =>
      renderPlan({
        flat,
        side: pinned,
        page: { index: 40, size: 5 },
        paginate: true,
        virtualize: true,
        sizer: (keys) => uniformSizer(keys.length, 32),
        viewport: { start: 40, extent: 100 },
      })
    expect(run).not.toThrow()
    const plan = run()
    expect(plan.center).toEqual([])
    expect(plan.span).toEqual({ start: 0, end: 0 })
    expect(plan.centerTotal).toBe(0)
    expect(plan.offsetTop).toBe(0)
    expect(plan.start).toEqual(["k00", "k01"])
    expect(plan.end).toEqual(["k19"])
  })

  it("defaults overscan to 4", () => {
    const input = {
      flat,
      side: () => undefined,
      page: { index: 0, size: 5 },
      paginate: false,
      virtualize: true,
      sizer: (keys) => uniformSizer(keys.length, 32),
      viewport: { start: 320, extent: 32 },
    }
    expect(renderPlan(input).span).toEqual(renderPlan({ ...input, overscan: 4 }).span)
    expect(renderPlan(input).span).toEqual({ start: 6, end: 15 })
  })

  it("handles an empty relation", () => {
    const plan = renderPlan({
      flat: [] as string[],
      side: () => undefined,
      page: { index: 0, size: 5 },
      paginate: true,
      virtualize: true,
      sizer: (keys) => uniformSizer(keys.length, 32),
      viewport: { start: 0, extent: 400 },
    })
    expect(plan).toMatchObject({
      start: [],
      center: [],
      end: [],
      span: { start: 0, end: 0 },
      centerTotal: 0,
      offsetTop: 0,
      pageCount: 0,
    })
  })
})

describe("trackList", () => {
  it("returns none for an empty run, which is the initial value of the property", () => {
    expect(trackList([])).toBe("none")
  })

  it("gives a declared width a px track and no fr", () => {
    const track = trackList([{ id: "a", width: 120 }])
    expect(track).toBe("120px")
    expect(track).not.toContain("fr")
  })

  it("defaults a column with neither width nor flex to the default width in px", () => {
    expect(trackList([{ id: "a" }])).toBe("100px")
  })

  it("turns flex into fr", () => {
    expect(trackList([{ id: "a", flex: 2 }])).toBe("2fr")
  })

  it("treats a non-positive flex as fixed", () => {
    expect(trackList([{ id: "a", flex: 0, width: 70 }])).toBe("70px")
  })

  it("wraps a min around the flexible max", () => {
    expect(trackList([{ id: "a", flex: 1, minWidth: 80 }])).toBe("minmax(80px, 1fr)")
  })

  it("wraps a min and a max in minmax", () => {
    expect(trackList([{ id: "a", minWidth: 80, maxWidth: 240 }])).toBe("minmax(80px, 240px)")
  })

  it("fills the low slot with zero when only a max was declared", () => {
    expect(trackList([{ id: "a", width: 300, maxWidth: 240 }])).toBe("minmax(0px, 240px)")
  })

  it("caps a flex column at its max, since minmax cannot hold a flexible max and a cap", () => {
    expect(trackList([{ id: "a", flex: 2, minWidth: 80, maxWidth: 240 }])).toBe(
      "minmax(80px, 240px)",
    )
  })

  it("keeps the declared min against a declared width", () => {
    expect(trackList([{ id: "a", width: 10, minWidth: 80 }])).toBe("minmax(80px, 10px)")
  })

  it("joins a whole run in order with one space", () => {
    expect(
      trackList([
        { id: "a", width: 120 },
        { id: "b", flex: 1, minWidth: 80 },
        { id: "c", flex: 2 },
        { id: "d", minWidth: 80, maxWidth: 240 },
      ]),
    ).toBe("120px minmax(80px, 1fr) 2fr minmax(80px, 240px)")
  })

  it("rounds a fractional width to two places and floors a negative one at zero", () => {
    expect(trackList([{ id: "a", width: 120.4567 }])).toBe("120.46px")
    expect(trackList([{ id: "a", width: -10 }])).toBe("0px")
  })
})

// The horizontal seat runs the same `renderPlan`, handed `left` and `width` instead of `top` and
// `height`. What these pin is that the arithmetic does not care which of the two it was handed.
describe("the column window", () => {
  const cols = keys(200)
  const pinned = sideOf({ k00: "start", k01: "start", k199: "end" })
  const plan = (left: number, width = 800, overscan = 4) =>
    renderPlan({
      flat: cols,
      side: pinned,
      page: { index: 0, size: 0 },
      paginate: false,
      virtualize: true,
      sizer: (run) => uniformSizer(run.length, 100),
      viewport: { start: left, extent: width },
      overscan,
    })

  it("holds the columns the viewport covers at a given scroll offset", () => {
    // 197 center columns at 100px. `left` 4000 puts center index 40 at the left edge, 8 fit in 800px,
    // and 4 of overscan sit on each side, so the run is [36, 52).
    const run = plan(4000)
    expect(run.span).toEqual({ start: 36, end: 52 })
    expect(run.center).toHaveLength(16)
    expect(run.center[0]).toBe("k38")
    expect(run.center[15]).toBe("k53")
  })

  it("steps the run forward by one column for each column scrolled", () => {
    const steps = [0, 100, 200, 300].map((left) => plan(left, 800, 0).span)
    expect(steps).toEqual([
      { start: 0, end: 8 },
      { start: 1, end: 9 },
      { start: 2, end: 10 },
      { start: 3, end: 11 },
    ])
  })

  it("never drops a pinned column, at any offset or window size", () => {
    for (const left of [0, 4000, 19_000, 999_999]) {
      for (const width of [0, 1, 800, 100_000]) {
        const run = plan(left, width)
        expect(run.start).toEqual(["k00", "k01"])
        expect(run.end).toEqual(["k199"])
        expect(run.center).not.toContain("k00")
        expect(run.center).not.toContain("k199")
      }
    }
  })

  it("answers the same run for a viewport that did not move", () => {
    const first = plan(4000)
    const second = plan(4000)
    expect(second.span).toEqual(first.span)
    expect(second.center).toEqual(first.center)
    expect(spacersOf(second)).toEqual(spacersOf(first))
  })

  it("keeps the whole run when the window is off, whatever the scroll offset says", () => {
    const off = renderPlan({
      flat: cols,
      side: pinned,
      page: { index: 0, size: 0 },
      paginate: false,
      virtualize: false,
      sizer: (run) => uniformSizer(run.length, 100),
      viewport: { start: 4000, extent: 800 },
    })
    expect(off.center).toHaveLength(197)
    expect(spacersOf(off)).toBe(NO_SPACERS)
  })
})

describe("spacersOf", () => {
  const plan = (left: number, virtualize = true) =>
    renderPlan({
      flat: keys(200),
      side: () => undefined,
      page: { index: 0, size: 0 },
      paginate: false,
      virtualize,
      sizer: (run) => uniformSizer(run.length, 100),
      viewport: { start: left, extent: 800 },
      overscan: 4,
    })

  it("splits the skipped pixels either side of the window, summing to the whole run", () => {
    const run = plan(4000)
    const gap = spacersOf(run)
    expect(gap).toEqual({ lead: 3600, trail: 14_800, tracked: true })
    expect(gap.lead + run.center.length * 100 + gap.trail).toBe(run.centerTotal)
  })

  it("tracks a trailing gap alone at the head of the run", () => {
    expect(spacersOf(plan(0))).toEqual({ lead: 0, trail: 18_800, tracked: true })
  })

  it("occupies no track when the window covers the whole run", () => {
    expect(spacersOf(plan(0, false))).toBe(NO_SPACERS)
  })

  it("holds the lead at the last column's offset once the window reaches the end", () => {
    const run = plan(19_200)
    const gap = spacersOf(run)
    expect(gap.trail).toBe(0)
    expect(gap.lead).toBe(run.span.start * 100)
  })
})
