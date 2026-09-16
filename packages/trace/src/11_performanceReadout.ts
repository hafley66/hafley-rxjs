// The frame meter a demo surface mounts: what the realm can measure, printed as it measures it.
// Sampling is cold — nothing starts until the caller subscribes to `painted$` — and every reading
// the realm cannot produce stays "unavailable" instead of throwing, because the same module is
// imported by node harnesses that have no frames at all.
import { auditTime, defer, tap } from "rxjs"
import { metrics$, metricsRealm } from "./8_metrics.js"

const FRAME_TEXT_MS = 250

const ROWS: ReadonlyArray<readonly [key: string, label: string]> = [
  ["fps", "FPS"],
  ["mean", "mean frame"],
  ["worst", "worst frame"],
  ["slow", "frames >32 ms"],
  ["used", "heap used ~"],
  ["allocated", "heap allocated ~"],
  ["limit", "heap limit"],
  ["pressure", "heap / limit ~"],
  ["change", "heap net / s ~"],
  ["peak", "heap peak ~"],
  ["nodes", "DOM elements"],
]

const HEAP_KEYS = ["used", "allocated", "limit", "pressure", "peak", "change"] as const

/**
 * Mount once per demo; merge `painted$` into its existing runtime boundary. The realm decides what
 * the rows can say: a realm without animation frames never fills the frame rows, one without
 * `performance.memory` never fills the heap rows, and the note under them says which and why.
 */
export function performanceReadout(target: HTMLElement) {
  const doc = target.ownerDocument
  const realm = metricsRealm(doc.defaultView ?? undefined)
  const el = doc.createElement("section")
  el.dataset.performanceReadout = ""
  el.setAttribute("aria-label", "Performance")
  el.style.cssText =
    "font:12px/1.5 ui-monospace,monospace;color:#dbeafe;background:#101827;padding:10px;border:1px solid #334155;border-radius:4px;min-width:210px"
  const title = doc.createElement("strong")
  title.textContent = "Performance"
  el.appendChild(title)
  const fields = new Map<string, HTMLElement>()
  for (const [key, label] of ROWS) {
    const row = doc.createElement("div")
    row.style.cssText = "display:flex;justify-content:space-between;gap:16px"
    const name = doc.createElement("span")
    name.textContent = label
    const value = doc.createElement("span")
    value.dataset.metric = key
    value.textContent = realm.frames ? "sampling" : "unavailable"
    fields.set(key, value)
    row.append(name, value)
    el.appendChild(row)
  }
  const note = doc.createElement("small")
  note.textContent = [
    "Heap: page-wide estimate; excludes GPU/native memory.",
    realm.heap ? undefined : "This realm has no performance.memory, so the heap stays unavailable.",
    realm.frames ? undefined : "This realm has no animation frames, so the frame rows stay unavailable.",
  ]
    .filter(Boolean)
    .join(" ")
  note.style.cssText = "display:block;max-width:240px;color:#94a3b8;margin-top:6px"
  el.appendChild(note)
  const mib = (bytes: number) => `${(bytes / 1024 ** 2).toFixed(1)} MiB`
  const painted$ = defer(() => {
    let at = -Infinity
    let previous: number | undefined
    let peak = 0
    return metrics$(target).pipe(
      auditTime(FRAME_TEXT_MS),
      tap(stats => {
        const values: Record<string, string> = {
          fps: stats.fps.toFixed(0),
          mean: `${(stats.fps ? 1000 / stats.fps : 0).toFixed(1)} ms`,
          worst: `${stats.worst.toFixed(1)} ms`,
          slow: String(stats.slow),
        }
        const now = stats.memoryAt
        if (now - at >= 1000) {
          values.nodes = String(stats.memory.domElements)
          const heap = stats.memory.heap
          if (heap) {
            peak = Math.max(peak, heap.usedJSHeapSize)
            Object.assign(values, {
              used: mib(heap.usedJSHeapSize),
              allocated: mib(heap.totalJSHeapSize),
              limit: mib(heap.jsHeapSizeLimit),
              pressure: `${((100 * heap.usedJSHeapSize) / heap.jsHeapSizeLimit).toFixed(1)}%`,
              peak: mib(peak),
              change:
                previous === undefined
                  ? "sampling"
                  : `${mib(((heap.usedJSHeapSize - previous) * 1000) / (now - at))}/s`,
            })
            previous = heap.usedJSHeapSize
          } else {
            for (const key of HEAP_KEYS) values[key] = "unavailable"
            previous = undefined
          }
          at = now
        }
        for (const [key, value] of Object.entries(values)) {
          const field = fields.get(key)
          if (field) field.textContent = value
        }
      }),
    )
  })
  return { el, painted$ }
}
