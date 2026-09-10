// From a flat key list to the rendered window. Pinning splits the list into three runs, pagination
// applies to the middle run only, virtualization windows whatever pagination left. Each step is a
// pure function over arrays, so list data, tree data, and a print target share one path.
//
// Nothing here measures the DOM. A `Sizer` is the only place row geometry enters, and the caller
// supplies it, so the same kernel serves uniform rows and measured rows without a branch.
import type { IndexRange, Partitioned, Side } from "./0_types.js"

const DEFAULT_COL_WIDTH = 100

const clamp = (value: number, low: number, high: number): number =>
  value < low ? low : value > high ? high : value

// --- Step 1: pinning --------------------------------------------------------

/**
 * Splits `flat` into the three sticky runs. A key with no side is center.
 * One pass with one bucket per key, so a pinned key leaves center exactly once and the three runs
 * concatenate back to a permutation of the input.
 * @feature row.pin
 * @feature col.pin
 */
export function partition<K extends string>(
  flat: readonly K[],
  side: (key: K) => Side | undefined,
): Partitioned<K> {
  const start: K[] = []
  const center: K[] = []
  const end: K[] = []
  for (const key of flat) {
    const at = side(key)
    if (at === "start") start.push(key)
    else if (at === "end") end.push(key)
    else center.push(key)
  }
  return { start, center, end }
}

// --- Step 2: pagination, center only ----------------------------------------

/**
 * The page slice of the center run. Pinned keys never reach here, which is what keeps them on
 * every page.
 * @feature page.paginate
 */
export function paginate<K extends string>(
  center: readonly K[],
  page: { index: number; size: number },
  enabled: boolean,
): readonly K[] {
  // Identity by reference so a consumer can compare with === and skip downstream work.
  if (!enabled) return center
  const size = Math.trunc(page.size)
  if (size <= 0) return []
  const index = Math.max(0, Math.trunc(page.index))
  const from = index * size
  // A stale page index is a scroll state, not an error: slice past the end is already empty.
  return center.slice(from, from + size)
}

// --- Step 3: sizing ---------------------------------------------------------

/** Row geometry over an index range. The only source of pixels in the kernel. */
export interface Sizer {
  readonly count: number
  readonly total: number
  /** Pixels from the start of the list. `index === count` answers `total`, for a trailing spacer. */
  offsetOf(index: number): number
  sizeOf(index: number): number
  /** First index whose `[offset, offset + size)` contains `px`. Clamped, never throws. */
  indexAt(px: number): number
}

/** Every method O(1), no allocation past the returned object. The common case, so it stays cheap. */
export function uniformSizer(count: number, size: number): Sizer {
  const rowCount = Math.max(0, Math.trunc(count))
  const px = Math.max(0, size)
  return {
    count: rowCount,
    total: rowCount * px,
    // O(1)
    offsetOf: (it) => clamp(Math.trunc(it), 0, rowCount) * px,
    // O(1)
    sizeOf: (it) => (it >= 0 && it < rowCount ? px : 0),
    // O(1). A zero row height has no invertible position, so it answers the head of the list.
    indexAt: (it) => (rowCount === 0 || px <= 0 ? 0 : clamp(Math.floor(it / px), 0, rowCount - 1)),
  }
}

/**
 * Variable row heights. Measurements arrive from an observer a batch at a time, so the cost lands
 * once at construction rather than on every read during a scroll.
 * @feature row.height
 */
export function measuredSizer(
  count: number,
  estimate: number,
  measured: ReadonlyMap<number, number>,
): Sizer {
  const rowCount = Math.max(0, Math.trunc(count))
  const fallback = Math.max(0, estimate)
  // O(rowCount) once. prefix[index] is the offset of row i, prefix[rowCount] is the total.
  const prefix: number[] = new Array<number>(rowCount + 1)
  prefix[0] = 0
  for (let index = 0; index < rowCount; index++) {
    const found = measured.get(index)
    prefix[index + 1] = (prefix[index] ?? 0) + (found === undefined ? fallback : Math.max(0, found))
  }
  const at = (it: number): number => prefix[it] ?? 0
  const total = at(rowCount)
  return {
    count: rowCount,
    total,
    // O(1)
    offsetOf: (it) => at(clamp(Math.trunc(it), 0, rowCount)),
    // O(1)
    sizeOf: (it) => {
      const index = Math.trunc(it)
      return index >= 0 && index < rowCount ? at(index + 1) - at(index) : 0
    },
    // O(log rowCount) binary search for the smallest index whose end is past px. Smallest rather than
    // largest so a run of zero height rows is stepped over: an empty interval contains no pixel.
    indexAt: (it) => {
      if (rowCount === 0) return 0
      if (it < 0) return 0
      if (it >= total) return rowCount - 1
      let low = 0
      let high = rowCount - 1
      while (low < high) {
        const middle = (low + high) >> 1
        if (at(middle + 1) > it) high = middle
        else low = middle + 1
      }
      return low
    },
  }
}

// --- Step 4: virtualization -------------------------------------------------

/**
 * The rendered index range for a viewport. Half-open `[start, end)`, clamped to `[0, count]`.
 * Overscan lives at this edge and nowhere deeper: it is a repaint budget, not part of the model.
 * @feature view.virtualize.row
 */
export function windowOf(
  sizer: Sizer,
  viewport: { start: number; extent: number },
  overscan: number,
): IndexRange {
  const rowCount = sizer.count
  if (rowCount === 0) return { start: 0, end: 0 }
  const pad = Math.max(0, Math.trunc(overscan))
  const top = sizer.indexAt(viewport.start)
  // A collapsed viewport renders nothing, and padding nothing is still nothing. The index survives
  // so the next resize resumes at the same scroll anchor.
  if (viewport.extent <= 0) return { start: top, end: top }
  const bottomPx = viewport.start + viewport.extent
  const last = sizer.indexAt(bottomPx)
  // Half-open on the pixel axis too: a row that begins exactly at the viewport bottom is outside.
  const end = sizer.offsetOf(last) >= bottomPx ? last : last + 1
  return { start: clamp(top - pad, 0, rowCount), end: clamp(end + pad, 0, rowCount) }
}

export function sliceKeys<K extends string>(keys: readonly K[], span: IndexRange): readonly K[] {
  // Reference identity when the span covers everything, which is how `virtualize: false` costs
  // nothing downstream.
  if (span.start <= 0 && span.end >= keys.length) return keys
  return keys.slice(Math.max(0, span.start), Math.max(0, span.end))
}

// --- The composition --------------------------------------------------------

export interface RenderPlanInput<K extends string> {
  readonly flat: readonly K[]
  readonly side: (key: K) => Side | undefined
  readonly page: { readonly index: number; readonly size: number }
  readonly paginate: boolean
  readonly virtualize: boolean
  /**
   * Built over the paginated center, so the scroll spacer measures the page and not the relation.
   * Takes the keys rather than a count: the page run's index space is not the flat list's once a
   * pinned key has been lifted out or the page index has moved, so a count leaves the callback
   * translating between two spaces it cannot see, and a per-key override lands on the wrong row.
   */
  readonly sizer: (keys: readonly K[]) => Sizer
  readonly viewport: { readonly start: number; readonly extent: number }
  readonly overscan?: number
}

export interface RenderPlan<K extends string> {
  readonly start: readonly K[]
  /** The windowed run. What actually renders. */
  readonly center: readonly K[]
  readonly end: readonly K[]
  readonly span: IndexRange
  /** Total pixels of the paginated center, for the scroll spacer. */
  readonly centerTotal: number
  /** Pixels above `span.start`, for the translate or the leading pad. */
  readonly offsetTop: number
  readonly pageCount: number
  /** The sizer this plan was windowed with, so a later plan can cancel a scroll shift against it. */
  readonly sizer: Sizer
}

const DEFAULT_OVERSCAN = 4

/** partition -> paginate -> virtualize, in that order, once. */
export function renderPlan<K extends string>(input: RenderPlanInput<K>): RenderPlan<K> {
  const { start, center, end } = partition(input.flat, input.side)
  const paged = paginate(center, input.page, input.paginate)
  const sizer = input.sizer(paged)
  // Reported off the whole center regardless of the toggle, because a pager reads it to decide
  // whether to render at all.
  const size = Math.trunc(input.page.size)
  const pageCount = size > 0 ? Math.ceil(center.length / size) : 0
  const span = input.virtualize
    ? windowOf(sizer, input.viewport, input.overscan ?? DEFAULT_OVERSCAN)
    : { start: 0, end: paged.length }
  return {
    sizer,
    start,
    center: sliceKeys(paged, span),
    end,
    span,
    centerTotal: sizer.total,
    offsetTop: sizer.offsetOf(span.start),
    pageCount,
  }
}

/** The pixels a window left out, before `span.start` and after `span.end`. */
export interface Spacers {
  readonly lead: number
  readonly trail: number
  /** Whether the pair occupies two tracks. Read rather than restated, so no consumer disagrees
   * about how many seats the rendered run covers. */
  readonly tracked: boolean
}

export const NO_SPACERS: Spacers = { lead: 0, trail: 0, tracked: false }

/** Read off the plan's own sizer, so a spacer can never describe a run other than the one that was
 * windowed. @feature view.virtualize.col */
export function spacersOf<K extends string>(plan: RenderPlan<K>): Spacers {
  const lead = Math.max(0, plan.offsetTop)
  const trail = Math.max(0, plan.centerTotal - plan.sizer.offsetOf(plan.span.end))
  if (lead === 0 && trail === 0) return NO_SPACERS
  return { lead, trail, tracked: true }
}

// --- Column tracks ----------------------------------------------------------

/** One column's declared sizing. Nothing here is resolved: the browser owns the arithmetic. */
export interface TrackColumn {
  readonly id: string
  readonly width?: number
  readonly minWidth?: number
  readonly maxWidth?: number
  readonly flex?: number
}

const trackPx = (value: number): string => `${Math.round(Math.max(0, value) * 100) / 100}px`

/** One `grid-template-columns` value. `maxWidth` takes the upper slot even when `flex` is set,
 * because `minmax()` cannot hold both a flexible max and a cap. @feature col.size */
export function trackList(cols: readonly TrackColumn[]): string {
  // An empty template is not a valid declaration, and `none` is the initial value.
  if (cols.length === 0) return "none"
  return cols.map(trackOf).join(" ")
}

function trackOf(col: TrackColumn): string {
  const flex = col.flex
  // A non-positive flex is a fixed column that happened to spell zero, as MUI reads it.
  const base = flex !== undefined && flex > 0 ? `${flex}fr` : trackPx(col.width ?? DEFAULT_COL_WIDTH)
  if (col.minWidth === undefined && col.maxWidth === undefined) return base
  const low = col.minWidth === undefined ? "0px" : trackPx(col.minWidth)
  const high = col.maxWidth === undefined ? base : trackPx(col.maxWidth)
  return `minmax(${low}, ${high})`
}
