// The renderer asserted against the boxes it actually produced. Every claim here is read back out
// of chromium's layout or computed style, never out of the grid's own signals: a plan that says a
// row is 80px tall and a row that paints 36 is exactly the failure this file exists to catch.
import { describe, expect, test } from "@hafley66/vitest-playwright"
import { beforeEach, inject } from "vitest"
import { selectorFor } from "../src/3_paths.js"

// vitest 4 re-exports `ProvidedContext` from an internal chunk, so the plugin's `declare module`
// block declares a second, empty interface and `inject` types every key as `never`.
const base = (inject as (key: string) => string | undefined)("vitest-playwright:baseURL")

const ROW = selectorFor("row")
const CENTER = `.sg-center ${ROW}`
const PINNED_START = `.sg-pinned-start ${ROW}`
/** The standard-density row height the fixture runs at. Every unmeasured row answers this. */
const ROW_H = 36

const A = "src/a.ts"
const NESTED = "src/a/nested"
const B = "src/b.ts"
const C = "src/c.ts"
const KIDS = [
  "src/a/one.ts",
  "src/a/two.ts",
  "src/a/three.ts",
  "src/a/four.ts",
  "src/a/five.ts",
  NESTED,
] as const
const GRANDKIDS = ["src/a/nested/x.ts", "src/a/nested/y.ts", "src/a/nested/z.ts"] as const
const OPEN_ALL = { [A]: true, [NESTED]: true }

type Patch = Record<string, unknown>
interface PlanShape {
  start: string[]
  center: string[]
  end: string[]
  centerTotal: number
  offsetTop: number
}
type Fixture = { __patch: (patch: Patch) => void; __plan: () => PlanShape }

const patch = (next: Patch): Promise<void> =>
  $page.evaluate((p) => {
    const fixture = window as unknown as Fixture
    fixture.__patch(p)
  }, next)

const plan = (): Promise<PlanShape> =>
  $page.evaluate(() => (window as unknown as Fixture).__plan())

const idsIn = (selector: string): Promise<string[]> =>
  $page.evaluate(
    (sel) =>
      Array.from(document.querySelectorAll(sel)).map((el) => el.getAttribute("data-row-id") ?? ""),
    selector,
  )

/** Rounded because a fractional device pixel is chromium's business, not the kernel's. */
const heightsIn = (selector: string): Promise<Record<string, number>> =>
  $page.evaluate((sel) => {
    const out: Record<string, number> = {}
    for (const el of Array.from(document.querySelectorAll(sel))) {
      const key = el.getAttribute("data-row-id")
      if (key !== null) out[key] = Math.round(el.getBoundingClientRect().height * 100) / 100
    }
    return out
  }, selector)

const widthsIn = (selector: string): Promise<number[]> =>
  $page.evaluate(
    (sel) =>
      Array.from(document.querySelectorAll(sel)).map(
        (el) => Math.round(el.getBoundingClientRect().width * 100) / 100,
      ),
    selector,
  )

const boxHeight = (selector: string): Promise<number> =>
  $page.evaluate((sel) => {
    const el = document.querySelector(sel)
    return el === null ? -1 : Math.round(el.getBoundingClientRect().height * 100) / 100
  }, selector)

const cssVar = (selector: string, name: string): Promise<string> =>
  $page.evaluate((arg) => {
    const el = document.querySelector(arg.sel)
    return el === null ? "" : getComputedStyle(el).getPropertyValue(arg.prop).trim()
  }, { sel: selector, prop: name })

const depthsIn = (selector: string): Promise<Record<string, string>> =>
  $page.evaluate((sel) => {
    const out: Record<string, string> = {}
    for (const el of Array.from(document.querySelectorAll(sel))) {
      const key = el.getAttribute("data-row-id")
      if (key !== null) out[key] = getComputedStyle(el).getPropertyValue("--sg-depth").trim()
    }
    return out
  }, selector)

const topOf = (selector: string): Promise<number> =>
  $page.evaluate((sel) => {
    const el = document.querySelector(sel)
    return el === null ? Number.NaN : Math.round(el.getBoundingClientRect().top * 100) / 100
  }, selector)

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0)

describe.skipIf(base === undefined)("signal-grid render", () => {
  beforeEach(async () => {
    // A fresh load rather than a reset hook: the grid and its subscriptions are module level, so
    // reloading is the only way to be sure the previous test's state is gone.
    await $page.goto(base as string)
    await expect($page.locator("html")).toHaveAttribute("data-fixture", "ready")
    await expect($page.locator(CENTER)).toHaveCount(3)
  })

  test("puts one row element in the center run per key the plan named", async () => {
    await patch({ expanded: OPEN_ALL })

    const shape = await plan()
    expect(shape.center).toHaveLength(12)
    await expect($page.locator(CENTER)).toHaveCount(shape.center.length)
    expect(await idsIn(CENTER)).toEqual(shape.center)
    expect(shape.start).toEqual([])
    expect(shape.end).toEqual([])
  })

  test("resizes one row of a pinned, second-page run and leaves its neighbours alone", async () => {
    // The two index spaces disagree here and nowhere else: one row is lifted out of the center by
    // pinning, and the page index moves the run four further along. A sizer keyed by flat-list
    // position lands the override on a row four places away, or on no rendered row at all.
    await patch({
      expanded: OPEN_ALL,
      rowPinning: { [C]: "start" },
      page: { mode: "pages", index: 1, size: 4, total: null },
      rowHeight: { [NESTED]: 80 },
    })

    const shape = await plan()
    expect(shape.start).toEqual([C])
    expect(shape.center).toEqual(["src/a/four.ts", "src/a/five.ts", NESTED, "src/a/nested/x.ts"])

    expect(await idsIn(PINNED_START)).toEqual([C])
    expect(await heightsIn(CENTER)).toEqual({
      "src/a/four.ts": ROW_H,
      "src/a/five.ts": ROW_H,
      [NESTED]: 80,
      "src/a/nested/x.ts": ROW_H,
    })

    // The spacer has to agree with what the rows painted, which is the half the sizer owns.
    const painted = sum(Object.values(await heightsIn(CENTER)))
    expect(painted).toBe(3 * ROW_H + 80)
    expect(await cssVar(".sg", "--sg-total-h")).toBe(`${painted}px`)
    expect(shape.centerTotal).toBe(painted)
  })

  test("moves a pinned row into the start run and holds it there while the center scrolls", async () => {
    await patch({ expanded: OPEN_ALL, rowPinning: { [B]: "start" } })

    expect(await idsIn(PINNED_START)).toEqual([B])
    expect(await idsIn(CENTER)).not.toContain(B)
    await expect($page.locator(`${PINNED_START}[data-row-id="${B}"]`)).toBeVisible()

    const pinnedBefore = await topOf(`${PINNED_START}[data-row-id="${B}"]`)
    const centerBefore = await topOf(`${CENTER}[data-row-id="${A}"]`)

    // Read back what the box accepted rather than assuming it: the spacer is only as tall as the
    // page run, so asking for more than the overflow leaves the assertion measuring a clamp.
    const scrolled = await $page.evaluate((top) => {
      const box = document.querySelector(".sg-scroll")
      if (box === null) return 0
      box.scrollTop = top
      return box.scrollTop
    }, 120)

    const pinnedAfter = await topOf(`${PINNED_START}[data-row-id="${B}"]`)
    const centerAfter = await topOf(`${CENTER}[data-row-id="${A}"]`)

    // Sticky, so the run parks at its own inset from the scroll box instead of travelling with the
    // center. The single pixel between where it rests and where it started is the header's bottom
    // border, which `--sg-row-h` does not count.
    expect(pinnedAfter).toBe(await topOf(".sg-scroll") + ROW_H)
    expect(pinnedBefore - pinnedAfter).toBeLessThanOrEqual(1)
    expect(scrolled).toBe(120)
    expect(Math.abs(centerBefore - centerAfter - scrolled)).toBeLessThan(1)
    await expect($page.locator(`${PINNED_START}[data-row-id="${B}"]`)).toBeVisible()
  })

  test("sizes the scroll spacer to the sum of the page run's heights", async () => {
    await patch({
      expanded: OPEN_ALL,
      page: { mode: "pages", index: 0, size: 5, total: null },
      rowHeight: { "src/a/two.ts": 60 },
    })

    const shape = await plan()
    expect(shape.center).toHaveLength(5)

    const painted = sum(Object.values(await heightsIn(CENTER)))
    expect(painted).toBe(4 * ROW_H + 60)
    expect(await cssVar(".sg", "--sg-total-h")).toBe(`${painted}px`)
    expect(await boxHeight(".sg-canvas")).toBe(painted)
  })

  test("adds exactly a node's children on expand, one depth deeper", async () => {
    expect(await idsIn(CENTER)).toEqual([A, B, C])

    await patch({ expanded: { [A]: true } })
    expect(await idsIn(CENTER)).toEqual([A, ...KIDS, B, C])

    const depths = await depthsIn(CENTER)
    expect(depths[A]).toBe("0")
    for (const kid of KIDS) expect(depths[kid]).toBe("1")

    await patch({ expanded: OPEN_ALL })
    expect(await idsIn(CENTER)).toEqual([A, ...KIDS.slice(0, 5), NESTED, ...GRANDKIDS, B, C])

    const deeper = await depthsIn(CENTER)
    for (const grandkid of GRANDKIDS) expect(deeper[grandkid]).toBe("2")
  })

  test("drops a hidden column's cells from every row and its header with them", async () => {
    await expect($page.locator(selectorFor("cell", { colId: "size" }))).toHaveCount(3)
    await expect($page.locator(selectorFor("header", { colId: "size" }))).toHaveCount(1)

    await patch({ colHidden: { size: true, mtime: true } })

    await expect($page.locator(selectorFor("cell", { colId: "size" }))).toHaveCount(0)
    await expect($page.locator(selectorFor("header", { colId: "size" }))).toHaveCount(0)
    await expect($page.locator(selectorFor("cell"))).toHaveCount(3)

    // Unhiding is the same write, so the third column proves nothing was removed permanently.
    await patch({ colHidden: {} })
    await expect($page.locator(selectorFor("cell"))).toHaveCount(9)
    await expect($page.locator(selectorFor("cell", { colId: "mtime" }))).toHaveCount(3)
  })

  test("resizes every cell of one column from a colWidth write", async () => {
    const nameCells = selectorFor("cell", { colId: "name" })
    const sizeCells = selectorFor("cell", { colId: "size" })
    expect(await widthsIn(nameCells)).toEqual([200, 200, 200])

    await patch({ colWidth: { name: 260 } })

    expect(await widthsIn(nameCells)).toEqual([260, 260, 260])
    expect(await widthsIn(sizeCells)).toEqual([100, 100, 100])
    expect(await widthsIn(`.sg-head-cell[data-col-id="name"]`)).toEqual([260])
  })
})
