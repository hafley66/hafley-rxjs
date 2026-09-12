// The single-cell bench page. Every factor is on the query string, `0_bench.ts` mounts it, and
// `window.__bench` drives one burst. `bench/scroll.mjs` is the caller; opening the page by hand
// mounts the grid and leaves it there.
import { setGridLogEmit } from "../../src/index.js"
import { cfgOf, mountBench } from "./0_bench.js"

const found = document.getElementById("mount")
if (found === null) throw new Error("bench page has no #mount")
const mount: HTMLElement = found

const cfg = cfgOf(new URLSearchParams(location.search))
const bench = mountBench(mount, cfg)

export interface StageTotal {
  readonly stage: string
  readonly records: number
  readonly ms: number
}

export interface Run {
  readonly frames: number
  readonly p50: number
  readonly p95: number
  readonly worst: number
  readonly slow: number
  readonly held: number
  readonly nodes: number
  readonly styleBytes: number
  /** JS heap in bytes at the end of warmup and at the end of the burst. The second minus the first
   * is what 120 frames of row churn failed to hand back. */
  readonly heapWarm: number
  readonly heapEnd: number
  readonly stages: readonly StageTotal[]
}

const SLOW_MS = 32
const SPEED = 240

interface HeapSource {
  readonly usedJSHeapSize?: number
}

const heap = (): number => (performance as { memory?: HeapSource }).memory?.usedJSHeapSize ?? 0

/** One burst: `warm` frames discarded, then `frames` measured at 240 px each. Stage totals come off
 * the package's LogTape surface, so a row says where the frame went and not only how long. */
async function run(warm: number, frames: number): Promise<Run> {
  const by = new Map<string, { records: number; ms: number }>()
  setGridLogEmit((category, _message, fields) => {
    const key = category.join(".")
    const held = by.get(key) ?? { records: 0, ms: 0 }
    held.records += 1
    held.ms += typeof fields["durationMs"] === "number" ? fields["durationMs"] : 0
    by.set(key, held)
  })
  const gaps: number[] = []
  let previous = performance.now()
  let step = 0
  let heapWarm = 0
  await new Promise<void>((resolve) => {
    const tick = (now: number): void => {
      gaps.push(now - previous)
      previous = now
      bench.step(SPEED, step)
      step += 1
      if (step === warm) {
        by.clear()
        heapWarm = heap()
      }
      if (step < warm + frames) requestAnimationFrame(tick)
      else resolve()
    }
    requestAnimationFrame(tick)
  })
  setGridLogEmit(null)
  const measured = gaps.slice(warm)
  const sorted = [...measured].sort((a, b) => a - b)
  // `render` decorates the element it is handed, so the grid root is the mount and the inline
  // custom properties are on its own style attribute.
  const style = mount.getAttribute("style") ?? ""
  return {
    frames: measured.length,
    p50: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
    p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
    worst: sorted[sorted.length - 1] ?? 0,
    slow: measured.filter((it) => it > SLOW_MS).length,
    held: mount.getElementsByClassName("sg-row").length,
    nodes: bench.scroll.getElementsByTagName("*").length,
    styleBytes: style.length,
    heapWarm,
    heapEnd: heap(),
    stages: [...by].map(([stage, it]) => ({ stage, records: it.records, ms: it.ms })),
  }
}

declare global {
  interface Window {
    __bench: (warm: number, frames: number) => Promise<Run>
  }
}

window.__bench = run
