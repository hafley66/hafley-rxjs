// One case list per bench file, consumed twice: `register` hands it to vitest's `bench`, and
// `measure` runs the same closures through a median/p95 loop for `4_report.ts`.
import { bench, describe } from "vitest"

export interface Case {
  readonly group: string
  readonly name: string
  readonly run: () => void
  readonly iterations: number
  readonly warmup: number
  /** Calls per timed sample. Raise it when one call is under a microsecond. */
  readonly inner?: number
  /** Printed in the report next to the number, so a reader knows what the number covers. */
  readonly means: string
}

const underVitest = (): boolean => process.env.VITEST !== undefined

// vitest 4.1.10 drops `benchmark.includeSamples` on the way to the worker, so `results.json` has no
// samples and p95 cannot be recovered from it. `measure` below is the only p95 source.
export function register(cases: readonly Case[]): void {
  if (!underVitest()) return
  const groups = new Map<string, Case[]>()
  for (const item of cases) {
    const bucket = groups.get(item.group)
    if (bucket === undefined) groups.set(item.group, [item])
    else bucket.push(item)
  }
  for (const [group, bucket] of groups) {
    describe(group, () => {
      for (const item of bucket) {
        bench(item.name, item.run, {
          time: 0,
          iterations: item.iterations,
          warmupIterations: item.warmup,
        })
      }
    })
  }
}

export interface Stats {
  readonly group: string
  readonly name: string
  readonly means: string
  readonly samples: number
  readonly inner: number
  readonly median: number
  readonly p95: number
  readonly mean: number
  readonly min: number
  readonly hz: number
}

const at = (sorted: readonly number[], q: number): number => {
  if (sorted.length === 0) return Number.NaN
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))
  return sorted[rank] as number
}

/** Warmup runs are timed and thrown away, so the JIT tier-up is not in any reported sample. */
export function measure(item: Case): Stats {
  const inner = item.inner ?? 1
  for (let i = 0; i < item.warmup; i++) for (let k = 0; k < inner; k++) item.run()
  const samples: number[] = new Array<number>(item.iterations)
  for (let i = 0; i < item.iterations; i++) {
    const from = performance.now()
    for (let k = 0; k < inner; k++) item.run()
    samples[i] = (performance.now() - from) / inner
  }
  const sorted = [...samples].sort((a, b) => a - b)
  let total = 0
  for (const value of samples) total += value
  const mean = total / samples.length
  const median = at(sorted, 0.5)
  return {
    group: item.group,
    name: item.name,
    means: item.means,
    samples: samples.length,
    inner,
    median,
    p95: at(sorted, 0.95),
    mean,
    min: sorted[0] as number,
    hz: mean > 0 ? 1000 / mean : Number.POSITIVE_INFINITY,
  }
}

const fixed = (value: number): string => {
  if (!Number.isFinite(value)) return "n/a"
  if (value >= 100) return value.toFixed(1)
  if (value >= 1) return value.toFixed(3)
  if (value >= 0.001) return value.toFixed(5)
  return value.toExponential(2)
}

const rate = (value: number): string => {
  if (!Number.isFinite(value)) return "n/a"
  if (value < 10) return value.toFixed(2)
  return Math.round(value).toLocaleString("en-US")
}

export function markdown(rows: readonly Stats[]): string {
  const head = "| benchmark | ops/s | median ms | p95 ms | min ms | n | what the number means |"
  const rule = "| --- | ---: | ---: | ---: | ---: | ---: | --- |"
  const body = rows.map(
    (row) =>
      `| ${row.name} | ${rate(row.hz)} | ${fixed(row.median)} | ${fixed(row.p95)} | ${fixed(row.min)} | ${row.samples}${row.inner > 1 ? "x" + row.inner : ""} | ${row.means} |`,
  )
  return [head, rule, ...body].join("\n")
}

