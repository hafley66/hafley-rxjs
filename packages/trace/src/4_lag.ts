// Scheduling delay, measured the same way on both sides: ask for a tick, record how late it was.
// `raf` is the paint budget, `timeout` is the macrotask queue, `eventloop` is node's own histogram.
// A browser has no event loop histogram and node has no frames, so `lag$()` picks what it can run.
import { Observable } from "rxjs"
import type { Lag, LagKind } from "./0_types.js"
import { runtimeOf } from "./1_ident.js"

const quantile = (sorted: readonly number[], q: number): number =>
  sorted.length === 0 ? 0 : (sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0)

interface Totals {
  script: number
  styleLayout: number
  blocking: number
  frames: number
}

// Long Animation Frames split a frame into the script that ran and the style and layout that
// followed, which is the half a package's own stage timers cannot reach.
function loaf(into: Totals): () => void {
  const Observer = (globalThis as { PerformanceObserver?: typeof PerformanceObserver }).PerformanceObserver
  if (Observer === undefined || !Observer.supportedEntryTypes.includes("long-animation-frame")) return () => {}
  const observer = new Observer((list) => {
    for (const entry of list.getEntries() as readonly (PerformanceEntry & {
      renderStart?: number
      styleAndLayoutStart?: number
      blockingDuration?: number
    })[]) {
      const start = entry.startTime
      const styleStart = entry.styleAndLayoutStart ?? 0
      into.frames += 1
      into.blocking += entry.blockingDuration ?? 0
      into.styleLayout += styleStart === 0 ? 0 : start + entry.duration - styleStart
      into.script += styleStart === 0 ? entry.duration : styleStart - start
    }
  })
  observer.observe({ type: "long-animation-frame", buffered: false } as PerformanceObserverInit)
  return () => observer.disconnect()
}

const heapOf = (): number | undefined => {
  const memory = (globalThis.performance as { memory?: { usedJSHeapSize?: number } } | undefined)?.memory
  if (memory?.usedJSHeapSize !== undefined) return memory.usedJSHeapSize
  const usage = (globalThis as { process?: { memoryUsage?: () => { heapUsed: number } } }).process?.memoryUsage
  return usage === undefined ? undefined : usage().heapUsed
}

/** What this runtime can measure. `raf` needs a document, `eventloop` needs node. */
export function lagKinds(): readonly LagKind[] {
  const runtime = runtimeOf()
  if (runtime === "browser") return ["raf", "timeout"]
  if (runtime === "worker") return ["timeout"]
  return ["timeout", "eventloop"]
}

/**
 * One `Lag` per window. Cold: nothing is scheduled until a subscriber arrives, and the teardown
 * cancels the tick, so a page that stops reading stops paying.
 */
export function lag$(kind: LagKind = lagKinds()[0] ?? "timeout", windowMs = 1000, everyMs = 16): Observable<Lag> {
  return new Observable<Lag>((subscriber) => {
    const gaps: number[] = []
    const totals: Totals = { script: 0, styleLayout: 0, blocking: 0, frames: 0 }
    const stopLoaf = kind === "raf" ? loaf(totals) : () => {}
    const now = (): number => globalThis.performance?.now() ?? Date.now()
    let previous = now()
    let since = now()
    let live = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let frame: number | undefined

    const flush = (at: number): void => {
      const sorted = [...gaps].sort((a, b) => a - b)
      subscriber.next({
        kind,
        expectedMs: everyMs,
        samples: sorted.length,
        elapsedMs: at - since,
        fps: kind === "raf" && at > since ? 1000 * sorted.length / (at - since) : undefined,
        p50: quantile(sorted, 0.5),
        p95: quantile(sorted, 0.95),
        worst: sorted[sorted.length - 1] ?? 0,
        scriptMs: totals.frames === 0 ? undefined : totals.script / totals.frames,
        styleLayoutMs: totals.frames === 0 ? undefined : totals.styleLayout / totals.frames,
        blockingMs: totals.frames === 0 ? undefined : totals.blocking / totals.frames,
        heapBytes: heapOf(),
      })
      gaps.length = 0
      totals.script = 0
      totals.styleLayout = 0
      totals.blocking = 0
      totals.frames = 0
      since = at
    }

    const tick = (): void => {
      if (!live) return
      const at = now()
      gaps.push(at - previous)
      previous = at
      if (at - since >= windowMs) flush(at)
      schedule()
    }
    const schedule = (): void => {
      if (kind === "raf") frame = requestAnimationFrame(tick)
      else timer = setTimeout(tick, everyMs)
    }
    schedule()
    return () => {
      live = false
      stopLoaf()
      if (timer !== undefined) clearTimeout(timer)
      if (frame !== undefined && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame)
    }
  })
}
