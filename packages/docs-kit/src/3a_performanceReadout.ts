// The signal-grid frame meter, shared by demo surfaces. Sampling ends with the caller's stream.
import { auditTime, defer, tap } from "rxjs"

import { metrics$ } from "@hafley66/trace"
export { frameStats, heapEstimate, type FrameStats, type HeapEstimate } from "@hafley66/trace"

const FRAME_TEXT_MS = 250

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
    return metrics$(target).pipe(auditTime(FRAME_TEXT_MS), tap(stats => {
      const values: Record<string, string> = { fps: stats.fps.toFixed(0), mean: `${(stats.fps ? 1000 / stats.fps : 0).toFixed(1)} ms`, worst: `${stats.worst.toFixed(1)} ms`, slow: String(stats.slow) }
      const now = stats.memoryAt
      if (now - at >= 1000) {
        values.nodes = String(stats.memory.domElements)
        const heap = stats.memory.heap
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
