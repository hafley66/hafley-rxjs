// Browser frame delivery and memory estimates. Cold streams share the caller's lifetime.
import { defer, EMPTY, map, Observable } from "rxjs"

/** Frames kept in the rolling average. 90 at 60 Hz is a second and a half, long enough that one
 * stutter shows and short enough that the number follows the hand. */
const FRAME_WINDOW = 90
/** Two 60 Hz budgets. A gap past this is a frame the browser was asked for and did not draw. */
const SLOW_FRAME_MS = 32

export interface FrameStats {
  readonly fps: number
  /** The longest gap still in the window, in milliseconds. */
  readonly worst: number
  /** Gaps past `SLOW_FRAME_MS` since the meter started. */
  readonly slow: number
}

/** One memory reading: the heap when the realm has one, and the host's element count. */
export interface MemorySample {
  readonly heap: HeapEstimate | undefined
  readonly domElements: number | undefined
}

/** What `metrics$` carries: the frame window, plus the last memory reading and when it was taken. */
export interface Metrics extends FrameStats {
  readonly memory: MemorySample
  readonly memoryAt: number
}

/** The realm's own globals, named rather than assumed: node has a clock and no animation frames, a
 * browser has both, and neither is available as a module-level default. Read through this alias, so
 * a test that stubs a global is still seen. */
type RealmLike = {
  requestAnimationFrame?: unknown
  cancelAnimationFrame?: unknown
  performance?: Performance
}

const realm = globalThis as RealmLike

/** What the realm this module was loaded in can actually measure. */
export interface MetricsRealm {
  /** Animation-frame callbacks, which is the only source of the frame statistics. */
  readonly frames: boolean
  /** Chromium's `performance.memory`, the only source of the heap estimate. */
  readonly heap: boolean
}

/**
 * Reads the realm rather than a build-time assumption, so a caller can ask whether a meter is worth
 * mounting: in node both are false, in Firefox and Safari `heap` is false, in Chromium both are true.
 */
export function metricsRealm(source: RealmLike = realm): MetricsRealm {
  return {
    frames: typeof source.requestAnimationFrame === "function" && typeof source.cancelAnimationFrame === "function",
    heap: source.performance !== undefined && heapEstimate(source.performance) !== undefined,
  }
}

/** Milliseconds between animation-frame callbacks; this does not count display-presented frames. The teardown cancels the pending frame, so a demo scrolled out of
 * view stops asking for them. A realm with no animation frames gets an empty stream instead of a
 * ReferenceError, which is what makes importing this module in node safe. */
const frameGaps = (): Observable<number> => {
  if (metricsRealm(realm).frames === false) return EMPTY
  const request = realm.requestAnimationFrame as (callback: FrameRequestCallback) => number
  const cancel = realm.cancelAnimationFrame as (handle: number) => void
  return new Observable<number>(observer => {
    let previous = realm.performance?.now() ?? Date.now()
    let id = request(function step(now: number): void {
      // A callback queued within the current frame can carry a timestamp before subscription.
      if (now > previous) observer.next(now - previous)
      previous = now
      if (!observer.closed) id = request(step)
    })
    return () => cancel(id)
  })
}

/** One ring per subscription rather than a growing array, so reading the meter costs one write and
 * one 90-step sum per frame instead of an allocation. */
export const frameStats = (): Observable<FrameStats> =>
  defer(() => {
    const gaps = new Float64Array(FRAME_WINDOW)
    let at = 0
    let filled = 0
    let slow = 0
    return frameGaps().pipe(
      map((gap): FrameStats => {
        gaps[at] = gap
        at = (at + 1) % FRAME_WINDOW
        if (filled < FRAME_WINDOW) filled += 1
        if (gap > SLOW_FRAME_MS) slow += 1
        let total = 0
        let worst = 0
        for (let i = 0; i < filled; i++) {
          const it = gaps[i] ?? 0
          total += it
          if (it > worst) worst = it
        }
        return { fps: total === 0 ? 0 : (1000 * filled) / total, worst, slow }
      }),
    )
  })

/** Chromium's page-wide JS heap estimate. It excludes GPU/native memory and is not OS pressure.
 * Source: https://developer.mozilla.org/en-US/docs/Web/API/Performance/memory */
export type HeapEstimate = { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number }

export function heapEstimate(source: Performance): HeapEstimate | undefined {
  const memory = (source as Performance & { memory?: HeapEstimate }).memory
  if (
    !memory ||
    ![memory.usedJSHeapSize, memory.totalJSHeapSize, memory.jsHeapSizeLimit].every(Number.isFinite) ||
    memory.usedJSHeapSize < 0 ||
    memory.totalJSHeapSize < 0 ||
    memory.jsHeapSizeLimit <= 0
  )
    return undefined
  return {
    usedJSHeapSize: memory.usedJSHeapSize,
    totalJSHeapSize: memory.totalJSHeapSize,
    jsHeapSizeLimit: memory.jsHeapSizeLimit,
  }
}

/** DOM element count is scoped to the supplied host. Native and GPU bytes require an external collector.
 * A realm with no performance clock has no heap reading, which is `undefined` rather than an error. */
export function memorySample(target?: Element, source: Performance | undefined = realm.performance): MemorySample {
  return {
    heap: source === undefined ? undefined : heapEstimate(source),
    domElements: target?.getElementsByTagName("*").length,
  }
}

/**
 * Frame samples every animation frame; heap and DOM scans at most once per second. In a realm with no
 * animation frames the stream completes without a sample — a node caller subscribes to nothing rather
 * than throwing, and a surface can ask `metricsRealm()` before mounting a meter at all.
 */
export function metrics$(target?: Element): Observable<Metrics> {
  return defer(() => {
    let at = -Infinity
    let memory: MemorySample
    return frameStats().pipe(
      map(frame => {
        const now = realm.performance?.now() ?? Date.now()
        if (now - at >= 1000) {
          memory = memorySample(target)
          at = now
        }
        return { ...frame, memory, memoryAt: at }
      }),
    )
  })
}
