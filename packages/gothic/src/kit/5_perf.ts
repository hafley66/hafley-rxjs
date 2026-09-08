// perf marks: name -> {n, total, max, last} in ms; off unless ?perf=1, then a table logs every 2s
// the bench harness (pnpm bench) times the same functions without this gate
export type PerfSample = { name: string; n: number; total: number; max: number; last: number }

const buckets = new Map<string, PerfSample>()

export const PERF: boolean = (() => {
  try {
    return typeof location !== "undefined" && /[?&#]perf=1\b/.test(`${location.search}${location.hash}`)
  } catch {
    return false
  }
})()

export function record(name: string, ms: number): void {
  let s = buckets.get(name)
  if (!s) buckets.set(name, (s = { name, n: 0, total: 0, max: 0, last: 0 }))
  s.n++
  s.total += ms
  if (ms > s.max) s.max = ms
  s.last = ms
}

const noop = () => {}

// mark("x") -> close(): times one span; a shared noop while perf is off
export function mark(name: string): () => void {
  if (!PERF) return noop
  const t0 = performance.now()
  return () => record(name, performance.now() - t0)
}

export function timed<T>(name: string, fn: () => T): T {
  if (!PERF) return fn()
  const t0 = performance.now()
  try {
    return fn()
  } finally {
    record(name, performance.now() - t0)
  }
}

export function samples(): PerfSample[] {
  return [...buckets.values()].sort((a, b) => b.total - a.total)
}

const gauges = new Map<string, number>()

// a live count (strokes, paths), not a duration; printed beside the ms table
export function setGauge(name: string, value: number): void {
  gauges.set(name, value)
}

export function reset(): void {
  buckets.clear()
}

export function logTable(): void {
  const rows = samples().map(s => ({
    name: s.name,
    calls: s.n,
    "total ms": Math.round(s.total * 10) / 10,
    "avg ms": Math.round((s.total / s.n) * 1000) / 1000,
    "max ms": Math.round(s.max * 1000) / 1000,
  }))
  if (rows.length) console.table(rows)
  const g = [...gauges.entries()]
  if (g.length) console.table(g.map(([name, value]) => ({ name, value })))
}

if (PERF) {
  setInterval(logTable, 2000)
  ;(globalThis as { __gothicPerf?: unknown }).__gothicPerf = { samples, reset, logTable }
}
