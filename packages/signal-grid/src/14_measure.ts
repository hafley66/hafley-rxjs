// @comment-ok: the two-observer contract (one of each for the whole grid) is the invariant this file exists to hold
// Real geometry, for the entries whose extent no config can declare. A `ResizeObserver` reports
// what an entry became; an `IntersectionObserver` with a `rootMargin` buffer reports which entries
// are about to matter, ahead of paint.
//
// The buffer is the interesting half. Measuring an entry while it is still off screen puts its
// real extent in the sizer before it paints, so the plan corrects an estimate for something nobody
// is looking at. The same edge is the infinite-paging boundary and the cue for lazy cell content.
import { Observable, Subject } from "rxjs"
import type { Sizer } from "./4_slice.js"

export type MeasureDirection = "vertical" | "horizontal"

export interface MeasureStore {
  /** Keyed for the sizer, and live. Absent means "use the estimate". */
  readonly extents: ReadonlyMap<string, number>
  /** Observe an element under `key`, with both observers. Returns the release for both. */
  readonly observe: (key: string, el: HTMLElement) => () => void
  /** Rolling mean of what has been measured, the estimate for entries never rendered. */
  readonly estimate: () => number
  /** Keys entering the buffer zone, ahead of visibility. One emission per observer callback. */
  readonly approaching$: Observable<readonly string[]>
  /** Keys leaving it, so a consumer can release work it started. */
  readonly leaving$: Observable<readonly string[]>
  readonly close: () => void
}

export interface MeasureOptions {
  /** The extent to assume before anything has been measured. */
  readonly initial: number
  /** Picks `contentRect.height` or `contentRect.width`, so the store transposes with everything. */
  readonly direction: MeasureDirection
  readonly onChange: (keys: readonly string[]) => void
  /** The scroll box. Null means the document viewport, which is what a page-scrolled grid has. */
  readonly root?: Element | null
  readonly bufferPx?: number
}

/** A frozen read of the store, for a consumer whose invalidation compares by reference. */
export interface MeasureSnapshot {
  readonly extents: ReadonlyMap<string, number>
  readonly estimate: number
}

/** Copied, because `MeasureStore.extents` is live and a reference comparison would never move. */
export const snapshotOf = (store: MeasureStore): MeasureSnapshot => ({
  extents: new Map(store.extents),
  estimate: store.estimate(),
})

/** Roughly five standard rows, so a fast scroll still measures before it paints. */
export const DEFAULT_BUFFER_PX = 200

/** Below this a measurement is device-pixel wobble, and re-planning on it would thrash. */
const EPSILON = 0.5

const marginFor = (direction: MeasureDirection, buffer: number): string => {
  const px = `${Math.max(0, Math.round(buffer))}px`
  return direction === "vertical" ? `${px} 0px` : `0px ${px}`
}

export function createMeasureStore(opts: MeasureOptions): MeasureStore {
  const initial = Math.max(0, opts.initial)
  const extents = new Map<string, number>()
  const keyOf = new Map<Element, string>()
  const elementOf = new Map<string, Element>()
  const approaching = new Subject<readonly string[]>()
  const leaving = new Subject<readonly string[]>()
  // Kept alongside the map so `estimate()` stays O(1) during a scroll rather than O(measured).
  let sum = 0

  const record = (key: string, px: number): boolean => {
    const prior = extents.get(key)
    if (prior !== undefined && Math.abs(prior - px) < EPSILON) return false
    sum += px - (prior ?? 0)
    extents.set(key, px)
    return true
  }

  const extentOf = (entry: ResizeObserverEntry): number =>
    opts.direction === "vertical" ? entry.contentRect.height : entry.contentRect.width

  // One observer for the whole store. Thirty rows on screen is thirty `observe` calls against one
  // observer, which is also why a batch of resizes arrives as one callback and one `onChange`.
  const resize =
    typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver((entries) => {
          const changed: string[] = []
          for (const entry of entries) {
            const key = keyOf.get(entry.target)
            if (key === undefined) continue
            if (record(key, extentOf(entry))) changed.push(key)
          }
          if (changed.length > 0) opts.onChange(changed)
        })

  const buffer = opts.bufferPx ?? DEFAULT_BUFFER_PX
  const intersect =
    typeof IntersectionObserver === "undefined"
      ? undefined
      : new IntersectionObserver(
          (entries) => {
            const near: string[] = []
            const away: string[] = []
            for (const entry of entries) {
              const key = keyOf.get(entry.target)
              if (key === undefined) continue
              if (entry.isIntersecting) near.push(key)
              else away.push(key)
            }
            if (near.length > 0) approaching.next(near)
            if (away.length > 0) leaving.next(away)
          },
          { root: opts.root ?? null, rootMargin: marginFor(opts.direction, buffer) },
        )

  const detach = (key: string): void => {
    const held = elementOf.get(key)
    if (held === undefined) return
    resize?.unobserve(held)
    intersect?.unobserve(held)
    elementOf.delete(key)
    keyOf.delete(held)
  }

  return {
    extents,
    observe: (key, el) => {
      // A key rebound to a new element releases the old one first, so the maps stay a bijection.
      if (elementOf.get(key) !== el) detach(key)
      elementOf.set(key, el)
      keyOf.set(el, key)
      resize?.observe(el)
      intersect?.observe(el)
      // The measurement outlives the observation: an entry scrolled out of the window has not
      // changed extent, and dropping it would re-estimate a row already known.
      return () => detach(key)
    },
    // Mean, not median: the scroll extent is count times the estimate, so the estimator that
    // minimizes total error is the arithmetic one even when a few tall entries skew the shape.
    estimate: () => (extents.size === 0 ? initial : sum / extents.size),
    approaching$: approaching.asObservable(),
    leaving$: leaving.asObservable(),
    close: () => {
      resize?.disconnect()
      intersect?.disconnect()
      keyOf.clear()
      elementOf.clear()
      extents.clear()
      sum = 0
      approaching.complete()
      leaving.complete()
    },
  }
}

/** Pixels to add to `scrollTop` so the entry at `anchorIndex` holds its place. The delta is the
 * shift of its own start offset, so a correction below it answers zero with no special case. */
export function anchorAdjustment(before: Sizer, after: Sizer, anchorIndex: number): number {
  const index = Math.max(0, Math.trunc(anchorIndex))
  return after.offsetOf(index) - before.offsetOf(index)
}
