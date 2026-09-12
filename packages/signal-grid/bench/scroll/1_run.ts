// One burst, shared by every engine page, so the head-to-head compares measurements rather than
// measurement code. `bench/versus.mjs` reads the `Run` shape without branching on the engine.

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
   * is what the measured frames of row churn failed to hand back. */
  readonly heapWarm: number
  readonly heapEnd: number
  readonly stages: readonly StageTotal[]
}

export const SLOW_MS = 32
export const SPEED = 240

interface HeapSource {
  readonly usedJSHeapSize?: number
}

export const heap = (): number =>
  (performance as { memory?: HeapSource }).memory?.usedJSHeapSize ?? 0

/** Milliseconds from navigation start to the first rendered row, resolved on the frame the row
 * exists. Called at module scope on each page, so a synchronous mount resolves at once. */
export const firstRowAt = (selector: string): Promise<number> =>
  new Promise<number>((resolve) => {
    const tick = (): void => {
      if (document.querySelector(selector) !== null) resolve(performance.now())
      else requestAnimationFrame(tick)
    }
    tick()
  })

export interface BurstSpec {
  readonly warm: number
  readonly frames: number
  /** Advances one frame's worth of scroll. `at` is the frame index, which the resize factor reads. */
  readonly step: (px: number, at: number) => void
  /** The element whose rendered rows and descendants are counted. */
  readonly scroll: () => HTMLElement
  /** Counts the rows the engine is holding in the document. */
  readonly held: () => number
  /** Inline custom properties the engine writes on its root, as a byte count. */
  readonly styleBytes: () => number
  /** Per-stage totals the engine can report about itself. Empty for engines that cannot. */
  readonly stages?: {
    readonly start: () => void
    readonly reset: () => void
    readonly stop: () => readonly StageTotal[]
  }
}

/** `warm` frames discarded, then `frames` measured at 240 px each, reversing at either end. Without
 * the reversal a short scroller reports the frame cost of scrolling nothing. */
export async function burst(spec: BurstSpec): Promise<Run> {
  spec.stages?.start()
  const gaps: number[] = []
  let previous = performance.now()
  let step = 0
  let heapWarm = 0
  let way = 1
  await new Promise<void>((resolve) => {
    const tick = (now: number): void => {
      gaps.push(now - previous)
      previous = now
      const box = spec.scroll()
      if (way > 0 && box.scrollTop + box.clientHeight >= box.scrollHeight - 1) way = -1
      else if (way < 0 && box.scrollTop <= 0) way = 1
      spec.step(SPEED * way, step)
      step += 1
      if (step === spec.warm) {
        spec.stages?.reset()
        heapWarm = heap()
      }
      if (step < spec.warm + spec.frames) requestAnimationFrame(tick)
      else resolve()
    }
    requestAnimationFrame(tick)
  })
  const stages = spec.stages?.stop() ?? []
  const measured = gaps.slice(spec.warm)
  const sorted = [...measured].sort((a, b) => a - b)
  return {
    frames: measured.length,
    p50: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
    p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
    worst: sorted[sorted.length - 1] ?? 0,
    slow: measured.filter((it) => it > SLOW_MS).length,
    held: spec.held(),
    nodes: spec.scroll().getElementsByTagName("*").length,
    styleBytes: spec.styleBytes(),
    heapWarm,
    heapEnd: heap(),
    stages,
  }
}

declare global {
  interface Window {
    __bench: (warm: number, frames: number) => Promise<Run>
    /** Navigation start to first row, in milliseconds. */
    __firstRow: Promise<number>
  }
}
