// One animation frame loop drives both the corner meter and every panel's timing strip, and it is
// only scheduled while a demo is mounted, so a page carrying no demo schedules no frame.
import { ref, shallowRef, type Ref } from "vue"
import * as signalGrid from "../../../src/index.js"

/** Frames per second over a rolling one-second window. */
export const fps: Ref<number> = ref(0)

/** How many demos are mounted right now; the corner meter renders nothing while this is zero. */
export const mountedDemos: Ref<number> = ref(0)

export interface Timing {
  /** The category tuple past its leading package segment, joined: `["signal-grid","plan"]` reads `plan`. */
  readonly label: string
  readonly last: number
  readonly mean: number
  readonly count: number
}

type LogEmit = (category: readonly string[], message: string, fields: Record<string, unknown>) => void

interface LogSink {
  on: boolean
  emit: LogEmit
}

interface Running {
  last: number
  total: number
  count: number
}

class Collector {
  readonly timings = shallowRef<readonly Timing[]>([])
  private readonly running = new Map<string, Running>()
  private dirty = false

  record(label: string, value: number): void {
    const found = this.running.get(label)
    if (found === undefined) this.running.set(label, { last: value, total: value, count: 1 })
    else {
      found.last = value
      found.total += value
      found.count += 1
    }
    this.dirty = true
  }

  // Publishing on every record would rewrite the strip thousands of times during a 50k-row render.
  publish(): void {
    if (!this.dirty) return
    this.dirty = false
    this.timings.value = [...this.running].map(([label, it]) => ({
      label,
      last: it.last,
      mean: it.total / it.count,
      count: it.count,
    }))
  }

  reset(): void {
    this.running.clear()
    this.dirty = true
  }
}

const collectors = new Set<Collector>()
const stamps: number[] = []
let frame = 0
let restore: { emit: LogEmit; on: boolean } | null = null

// `LogEmit` carries structured fields rather than a formatted line, so the duration is read by name.
const DURATION_FIELDS = ["ms", "durationMs", "duration", "elapsedMs"] as const

const durationOf = (fields: Record<string, unknown>): number | null => {
  for (const name of DURATION_FIELDS) {
    const value = fields[name]
    if (typeof value === "number" && Number.isFinite(value)) return value
  }
  return null
}

const labelOf = (category: readonly string[]): string =>
  (category[0] === "signal-grid" ? category.slice(1) : category).join(".") || "grid"

// Spread rather than a property read: `LOG` lands in `src/` on another branch, and a static
// `signalGrid.LOG` makes the bundler warn about an export that does not exist yet.
const barrel: Readonly<Record<string, unknown>> = { ...signalGrid }

const logSink = (): LogSink | null => {
  const found = barrel.LOG
  if (typeof found !== "object" || found === null) return null
  const candidate = found as Partial<LogSink>
  return typeof candidate.emit === "function" && typeof candidate.on === "boolean"
    ? (found as LogSink)
    : null
}

const tick = (now: number): void => {
  stamps.push(now)
  while (stamps.length > 0 && now - (stamps[0] ?? now) > 1000) stamps.shift()
  fps.value = stamps.length
  for (const it of collectors) it.publish()
  frame = requestAnimationFrame(tick)
}

const startLogging = (): void => {
  const sink = logSink()
  if (sink === null || restore !== null) return
  restore = { emit: sink.emit, on: sink.on }
  sink.emit = (category, _message, fields) => {
    const value = durationOf(fields)
    if (value === null) return
    const label = labelOf(category)
    for (const it of collectors) it.record(label, value)
  }
  sink.on = true
}

const stopLogging = (): void => {
  const sink = logSink()
  if (sink === null || restore === null) return
  sink.emit = restore.emit
  sink.on = restore.on
  restore = null
}

export interface Meters {
  readonly timings: Ref<readonly Timing[]>
  readonly reset: () => void
  readonly release: () => void
}

/** Starts the frame loop and the log sink on the first demo, and ends both when the last one goes. */
export function retainMeters(): Meters {
  const collector = new Collector()
  collectors.add(collector)
  mountedDemos.value = collectors.size
  if (collectors.size === 1) {
    startLogging()
    frame = requestAnimationFrame(tick)
  }
  let released = false
  return {
    timings: collector.timings,
    reset: () => {
      collector.reset()
    },
    release: () => {
      if (released) return
      released = true
      collectors.delete(collector)
      mountedDemos.value = collectors.size
      if (collectors.size === 0) {
        cancelAnimationFrame(frame)
        frame = 0
        stamps.length = 0
        fps.value = 0
        stopLogging()
      }
    },
  }
}
