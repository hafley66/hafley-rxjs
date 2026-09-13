// The signal-grid frame meter, shared by demo surfaces. Sampling ends with the caller's stream.
import { auditTime, defer, map, Observable, tap } from "rxjs"

/** Frames kept in the rolling average. 90 at 60 Hz is a second and a half, long enough that one
 * stutter shows and short enough that the number follows the hand. */
const FRAME_WINDOW = 90
/** Two 60 Hz budgets. A gap past this is a frame the browser was asked for and did not draw. */
const SLOW_FRAME_MS = 32
/** The meter samples every frame; only the text it writes is throttled. */
const FRAME_TEXT_MS = 250

export interface FrameStats {
  readonly fps: number
  /** The longest gap still in the window, in milliseconds. */
  readonly worst: number
  /** Gaps past `SLOW_FRAME_MS` since the meter started. */
  readonly slow: number
}

/** Milliseconds between paints. The teardown cancels the pending frame, so a demo scrolled out of
 * view stops asking for them. */
const frameGaps = (): Observable<number> =>
  new Observable<number>((observer) => {
    let previous = performance.now()
    let id = requestAnimationFrame(function step(now: number): void {
      observer.next(now - previous)
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

/** Mount once per demo; merge painted$ into its existing runtime boundary. */
export function performanceReadout(target: HTMLElement) {
  const el = target.ownerDocument.createElement("section")
  el.dataset.performanceReadout = ""
  el.setAttribute("aria-label", "Performance")
  el.style.cssText = "font:12px/1.5 ui-monospace,monospace;color:#dbeafe;background:#101827;padding:10px;border:1px solid #334155;border-radius:4px;min-width:210px"
  const title = target.ownerDocument.createElement("strong")
  title.textContent = "Performance"
  el.appendChild(title)
  const fields = new Map<string, HTMLElement>()
  for (const [key, label] of [["fps", "FPS"], ["mean", "mean frame"], ["worst", "worst frame"], ["slow", "frames >32 ms"], ["used", "heap used ~"], ["allocated", "heap allocated ~"], ["limit", "heap limit"], ["pressure", "heap / limit ~"], ["change", "heap net / s ~"], ["peak", "heap peak ~"], ["nodes", "DOM elements"]]) {
    const row = target.ownerDocument.createElement("div")
    row.style.cssText = "display:flex;justify-content:space-between;gap:16px"
    const name = target.ownerDocument.createElement("span")
    name.textContent = label!
    const value = target.ownerDocument.createElement("span")
    value.dataset.metric = key!
    value.textContent = "unavailable"
    fields.set(key!, value)
    row.append(name, value)
    el.appendChild(row)
  }
  const note = target.ownerDocument.createElement("small")
  note.textContent = "Heap: page-wide estimate; excludes GPU/native memory."
  note.style.cssText = "display:block;max-width:240px;color:#94a3b8;margin-top:6px"
  el.appendChild(note)
  const mib = (bytes: number) => `${(bytes / 1024 ** 2).toFixed(1)} MiB`
  const painted$ = defer(() => {
    let at = -Infinity
    let previous: number | undefined
    let peak = 0
    return frameStats().pipe(auditTime(FRAME_TEXT_MS), tap(stats => {
      const values: Record<string, string> = { fps: stats.fps.toFixed(0), mean: `${(stats.fps ? 1000 / stats.fps : 0).toFixed(1)} ms`, worst: `${stats.worst.toFixed(1)} ms`, slow: String(stats.slow) }
      const now = performance.now()
      if (now - at >= 1000) {
        values.nodes = String(target.getElementsByTagName("*").length)
        const heap = heapEstimate(performance)
        if (heap) {
          peak = Math.max(peak, heap.usedJSHeapSize)
          Object.assign(values, { used: mib(heap.usedJSHeapSize), allocated: mib(heap.totalJSHeapSize), limit: mib(heap.jsHeapSizeLimit), pressure: `${(100 * heap.usedJSHeapSize / heap.jsHeapSizeLimit).toFixed(1)}%`, peak: mib(peak), change: previous === undefined ? "sampling" : `${mib((heap.usedJSHeapSize - previous) * 1000 / (now - at))}/s` })
          previous = heap.usedJSHeapSize
        } else {
          for (const key of ["used", "allocated", "limit", "pressure", "peak", "change"]) values[key] = "unavailable"
          previous = undefined
        }
        at = now
      }
      for (const [key, value] of Object.entries(values)) fields.get(key)!.textContent = value
    }))
  })
  return { el, painted$ }
}
