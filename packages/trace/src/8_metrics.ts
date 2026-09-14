// Browser frame delivery and memory estimates. Cold streams share the caller's lifetime.
import { defer, map, Observable } from "rxjs"

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

/** Milliseconds between animation-frame callbacks; this does not count display-presented frames. The teardown cancels the pending frame, so a demo scrolled out of
 * view stops asking for them. */
const frameGaps = (): Observable<number> =>
  new Observable<number>((observer) => {
    let previous = performance.now()
    let id = requestAnimationFrame(function step(now: number): void {
      // A callback queued within the current frame can carry a timestamp before subscription.
      if (now > previous) observer.next(now - previous)
      previous = now
      if (!observer.closed) id = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(id)
  })

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
  if (!memory || ![memory.usedJSHeapSize, memory.totalJSHeapSize, memory.jsHeapSizeLimit].every(Number.isFinite) || memory.usedJSHeapSize < 0 || memory.totalJSHeapSize < 0 || memory.jsHeapSizeLimit <= 0) return undefined
  return { usedJSHeapSize: memory.usedJSHeapSize, totalJSHeapSize: memory.totalJSHeapSize, jsHeapSizeLimit: memory.jsHeapSizeLimit }
}

/** DOM element count is scoped to the supplied host. Native and GPU bytes require an external collector. */
export function memorySample(target?: Element, source: Performance = performance) {
  return { heap: heapEstimate(source), domElements: target?.getElementsByTagName("*").length }
}

/** Frame samples every animation frame; heap and DOM scans at most once per second. */
export function metrics$(target?: Element) {
  return defer(() => {
    let at = -Infinity
    let memory: ReturnType<typeof memorySample>
    return frameStats().pipe(map(frame => {
      const now = performance.now()
      if (now - at >= 1000) { memory = memorySample(target); at = now }
      return { ...frame, memory, memoryAt: at }
    }))
  })
}
