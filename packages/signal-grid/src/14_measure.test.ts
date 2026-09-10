// Chromium under `vitest.browser.config.ts` supplies the elements and both observers for real.
// Both observers are still stubbed over, because what this file asserts is how many the store
// constructs and which targets each holds, and a real observer publishes neither tally and
// delivers its entries a frame later. The stubs record their instances and their targets and fire
// on the call, which is how "one observer for the whole store" and "the release detaches from
// both" become assertions rather than claims.
import { beforeEach, describe, expect, test } from "vitest"
import {
  anchorAdjustment,
  createMeasureStore,
  DEFAULT_BUFFER_PX,
  snapshotOf,
} from "./14_measure.js"
import { measuredSizer, uniformSizer } from "./4_slice.js"

type StubRect = { readonly width: number; readonly height: number }
type StubResizeEntry = { readonly target: Element; readonly contentRect: StubRect }
type StubIntersectionEntry = {
  readonly target: Element
  readonly isIntersecting: boolean
  readonly boundingClientRect?: StubRect
}

class ResizeObserverStub {
  static live: ResizeObserverStub[] = []
  readonly targets = new Set<Element>()
  constructor(private readonly notify: (entries: readonly StubResizeEntry[]) => void) {
    ResizeObserverStub.live.push(this)
  }
  observe(target: Element): void {
    this.targets.add(target)
  }
  unobserve(target: Element): void {
    this.targets.delete(target)
  }
  disconnect(): void {
    this.targets.clear()
  }
  emit(entries: readonly StubResizeEntry[]): void {
    this.notify(entries)
  }
}

class IntersectionObserverStub {
  static live: IntersectionObserverStub[] = []
  readonly targets = new Set<Element>()
  constructor(
    private readonly notify: (entries: readonly StubIntersectionEntry[]) => void,
    readonly options: IntersectionObserverInit | undefined,
  ) {
    IntersectionObserverStub.live.push(this)
  }
  observe(target: Element): void {
    this.targets.add(target)
  }
  unobserve(target: Element): void {
    this.targets.delete(target)
  }
  disconnect(): void {
    this.targets.clear()
  }
  emit(entries: readonly StubIntersectionEntry[]): void {
    this.notify(entries)
  }
}

globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
globalThis.IntersectionObserver = IntersectionObserverStub as unknown as typeof IntersectionObserver

const lastResize = (): ResizeObserverStub => {
  const found = ResizeObserverStub.live[ResizeObserverStub.live.length - 1]
  if (found === undefined) throw new Error("no ResizeObserver was constructed")
  return found
}

const lastIntersection = (): IntersectionObserverStub => {
  const found = IntersectionObserverStub.live[IntersectionObserverStub.live.length - 1]
  if (found === undefined) throw new Error("no IntersectionObserver was constructed")
  return found
}

const boxOf = (): HTMLElement => document.createElement("div")

const sized = (target: Element, width: number, height: number): StubResizeEntry => ({
  target,
  contentRect: { width, height },
})

beforeEach(() => {
  ResizeObserverStub.live = []
  IntersectionObserverStub.live = []
})

describe("one observer of each kind", () => {
  test("thirty rows hold one ResizeObserver and one IntersectionObserver", () => {
    const store = createMeasureStore({ initial: 36, direction: "vertical", onChange: () => {} })
    for (let index = 0; index < 30; index++) store.observe(`r${index}`, boxOf())
    expect(ResizeObserverStub.live.length).toBe(1)
    expect(IntersectionObserverStub.live.length).toBe(1)
    expect(lastResize().targets.size).toBe(30)
    expect(lastIntersection().targets.size).toBe(30)
    store.close()
  })
})

describe("measurement", () => {
  test("vertical reads contentRect.height", () => {
    const store = createMeasureStore({ initial: 36, direction: "vertical", onChange: () => {} })
    const row = boxOf()
    store.observe("r0", row)
    lastResize().emit([sized(row, 400, 72)])
    expect(store.extents.get("r0")).toBe(72)
    store.close()
  })

  test("horizontal reads contentRect.width, so the store transposes with everything else", () => {
    const store = createMeasureStore({ initial: 100, direction: "horizontal", onChange: () => {} })
    const col = boxOf()
    store.observe("c0", col)
    lastResize().emit([sized(col, 400, 72)])
    expect(store.extents.get("c0")).toBe(400)
    store.close()
  })

  test("several elements resizing in one callback produce exactly one onChange", () => {
    const calls: (readonly string[])[] = []
    const store = createMeasureStore({
      initial: 36,
      direction: "vertical",
      onChange: (keys) => calls.push(keys),
    })
    const first = boxOf()
    const second = boxOf()
    store.observe("r0", first)
    store.observe("r1", second)
    lastResize().emit([sized(first, 400, 50), sized(second, 400, 60)])
    expect(calls.length).toBe(1)
    expect(calls[0]).toEqual(["r0", "r1"])
    store.close()
  })

  test("a measurement equal to the stored one invalidates nothing", () => {
    let calls = 0
    const store = createMeasureStore({
      initial: 36,
      direction: "vertical",
      onChange: () => {
        calls++
      },
    })
    const row = boxOf()
    store.observe("r0", row)
    lastResize().emit([sized(row, 400, 50)])
    lastResize().emit([sized(row, 400, 50)])
    expect(calls).toBe(1)
    lastResize().emit([sized(row, 400, 51)])
    expect(calls).toBe(2)
    store.close()
  })
})

describe("estimate", () => {
  test("falls back to initial before anything is measured", () => {
    const store = createMeasureStore({ initial: 36, direction: "vertical", onChange: () => {} })
    expect(store.estimate()).toBe(36)
    store.close()
  })

  test("is the mean of what has been measured", () => {
    const store = createMeasureStore({ initial: 36, direction: "vertical", onChange: () => {} })
    const first = boxOf()
    const second = boxOf()
    store.observe("r0", first)
    store.observe("r1", second)
    lastResize().emit([sized(first, 400, 20), sized(second, 400, 40)])
    expect(store.estimate()).toBe(30)
    lastResize().emit([sized(first, 400, 80)])
    expect(store.estimate()).toBe(60)
    store.close()
  })
})

describe("snapshots", () => {
  test("a snapshot is frozen, so a signal holding one sees the next batch as a new value", () => {
    const store = createMeasureStore({ initial: 36, direction: "vertical", onChange: () => {} })
    const row = boxOf()
    store.observe("r0", row)
    lastResize().emit([sized(row, 400, 50)])
    const first = snapshotOf(store)
    lastResize().emit([sized(row, 400, 70)])
    const second = snapshotOf(store)
    expect(first.extents.get("r0")).toBe(50)
    expect(first.estimate).toBe(50)
    expect(second.extents.get("r0")).toBe(70)
    expect(second.extents).not.toBe(first.extents)
    store.close()
  })
})

describe("release and close", () => {
  test("releasing detaches from both observers and keeps the measurement", () => {
    const store = createMeasureStore({ initial: 36, direction: "vertical", onChange: () => {} })
    const row = boxOf()
    const release = store.observe("r0", row)
    lastResize().emit([sized(row, 400, 90)])
    release()
    expect(lastResize().targets.has(row)).toBe(false)
    expect(lastIntersection().targets.has(row)).toBe(false)
    expect(store.extents.get("r0")).toBe(90)
    expect(store.estimate()).toBe(90)
    store.close()
  })

  test("close disconnects both and clears", () => {
    const store = createMeasureStore({ initial: 36, direction: "vertical", onChange: () => {} })
    const row = boxOf()
    store.observe("r0", row)
    lastResize().emit([sized(row, 400, 90)])
    store.close()
    expect(lastResize().targets.size).toBe(0)
    expect(lastIntersection().targets.size).toBe(0)
    expect(store.extents.size).toBe(0)
    expect(store.estimate()).toBe(36)
  })
})

describe("the buffer zone", () => {
  test("the rootMargin is the buffer on the scrolling direction only", () => {
    const root = boxOf()
    const vertical = createMeasureStore({
      initial: 36,
      direction: "vertical",
      onChange: () => {},
      root,
    })
    expect(lastIntersection().options?.root).toBe(root)
    expect(lastIntersection().options?.rootMargin).toBe(`${DEFAULT_BUFFER_PX}px 0px`)
    vertical.close()
    const horizontal = createMeasureStore({
      initial: 100,
      direction: "horizontal",
      onChange: () => {},
      root,
      bufferPx: 320,
    })
    expect(lastIntersection().options?.rootMargin).toBe("0px 320px")
    horizontal.close()
  })

  test("a row below the root but inside the margin is approaching, ahead of visibility", () => {
    const root = boxOf()
    const store = createMeasureStore({
      initial: 36,
      direction: "vertical",
      onChange: () => {},
      root,
      bufferPx: 200,
    })
    const seen: (readonly string[])[] = []
    const sub = store.approaching$.subscribe((keys) => seen.push(keys))
    const row = boxOf()
    store.observe("r40", row)
    // The root is 600 tall and the row starts at 700: outside the box, inside the 200px margin,
    // which is the case a real IntersectionObserver reports as intersecting.
    lastIntersection().emit([
      { target: row, isIntersecting: true, boundingClientRect: { width: 400, height: 80 } },
    ])
    expect(seen).toEqual([["r40"]])
    sub.unsubscribe()
    store.close()
  })

  test("one emission per observer callback, and leaving is its own stream", () => {
    const store = createMeasureStore({
      initial: 36,
      direction: "vertical",
      onChange: () => {},
      root: boxOf(),
    })
    const near: (readonly string[])[] = []
    const away: (readonly string[])[] = []
    const subs = store.approaching$.subscribe((keys) => near.push(keys))
    subs.add(store.leaving$.subscribe((keys) => away.push(keys)))
    const first = boxOf()
    const second = boxOf()
    const third = boxOf()
    store.observe("r0", first)
    store.observe("r1", second)
    store.observe("r2", third)
    lastIntersection().emit([
      { target: first, isIntersecting: true },
      { target: second, isIntersecting: true },
      { target: third, isIntersecting: false },
    ])
    expect(near).toEqual([["r0", "r1"]])
    expect(away).toEqual([["r2"]])
    subs.unsubscribe()
    store.close()
  })

  test("a released key is silent on both streams", () => {
    const store = createMeasureStore({
      initial: 36,
      direction: "vertical",
      onChange: () => {},
      root: boxOf(),
    })
    const near: (readonly string[])[] = []
    const sub = store.approaching$.subscribe((keys) => near.push(keys))
    const row = boxOf()
    store.observe("r0", row)()
    lastIntersection().emit([{ target: row, isIntersecting: true }])
    expect(near).toEqual([])
    sub.unsubscribe()
    store.close()
  })
})

describe("scroll anchoring", () => {
  const anchor = 20

  test("a correction above the window shifts the anchor by the whole difference", () => {
    const before = uniformSizer(100, 40)
    const after = measuredSizer(100, 40, new Map([[3, 90]]))
    expect(anchorAdjustment(before, after, anchor)).toBe(50)
  })

  test("a correction below the window moves nothing", () => {
    const before = uniformSizer(100, 40)
    const after = measuredSizer(100, 40, new Map([[55, 90]]))
    expect(anchorAdjustment(before, after, anchor)).toBe(0)
  })

  test("the anchor's own height change moves its own start offset by nothing", () => {
    const before = uniformSizer(100, 40)
    const after = measuredSizer(100, 40, new Map([[anchor, 200]]))
    expect(anchorAdjustment(before, after, anchor)).toBe(0)
  })

  test("corrections above the window sum, and a shrink cancels a growth", () => {
    const before = uniformSizer(100, 40)
    const after = measuredSizer(100, 40, new Map([[1, 60], [2, 10], [7, 45]]))
    expect(anchorAdjustment(before, after, anchor)).toBe(-5)
  })
})
