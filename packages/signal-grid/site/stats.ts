// The three receipts sections that are about grids: what a 100k-row grid retains, how many epics
// the default set holds, and how the benchmarks compare. Every other section comes from the kit.
import {
  CORE_SECTIONS,
  NUMBER,
  demoMemoryNodes,
  el,
  formatBytes,
  method,
  missing,
  table,
  type Cell,
  type Section,
  type SectionBuilder,
  type Stats as CoreStats,
} from "@hafley66/docs-kit"
import raw from "./stats.json"

export interface BenchRow {
  readonly section: string
  readonly benchmark: string
  readonly opsPerSecond: number | null
  readonly medianMs: number | null
  readonly p95Ms: number | null
  readonly minMs: number | null
  readonly samples: string | null
  readonly note: string | null
}

export interface HeadToHead {
  readonly operation: string
  readonly signalGridMedian: string
  readonly tanstackMedian: string
  readonly ratio: string
}

export interface Stats extends CoreStats {
  readonly epics: { readonly method: string | null; readonly count: number | null; readonly reason: string | null }
  readonly features: {
    readonly method: string | null
    readonly tracked: number | null
    readonly implemented?: number | null
    readonly gate?: string
    readonly reason: string | null
  }
  readonly memory: {
    readonly method: string | null
    readonly measured: string | null
    readonly rows?: number
    readonly flatNodes?: number
    readonly windowedRows?: number
    readonly heapBeforeBytes?: number
    readonly heapAfterBytes?: number
    readonly retainedBytes?: number
    readonly retainedBytesPerRow?: number
    readonly rssBytes?: number
    readonly reason: string | null
  }
  readonly bench: {
    readonly method: string | null
    readonly file: string
    readonly machine: readonly string[] | null
    readonly medians: readonly BenchRow[] | null
    readonly headToHead: readonly HeadToHead[] | null
    readonly reason: string | null
  }
}

// The import is a JSON literal, so TypeScript would infer `null` for whichever optional field
// happens to be null in today's file. The declared shape above is the contract stats.mjs writes to.
export const STATS = raw as unknown as Stats

const rowsRetained = (stats: CoreStats): Section => {
  const memory = (stats as Stats).memory
  if (memory.measured === null || memory.retainedBytes === undefined) {
    return { id: "memory", title: "Memory", nodes: [missing(memory.reason), ...demoMemoryNodes(stats, "rows")] }
  }
  return {
    id: "memory",
    title: "Memory",
    nodes: [
      el("p", "stats-measured", `What this measures: ${memory.measured}`),
      table({
        columns: ["field", "value"],
        rows: [
          ["rows", NUMBER.format(memory.rows ?? 0)],
          ["flat nodes derived", NUMBER.format(memory.flatNodes ?? 0)],
          ["rows in the window", NUMBER.format(memory.windowedRows ?? 0)],
          ["heap before, rows only", formatBytes(memory.heapBeforeBytes ?? 0)],
          ["heap after, grid plus plan", formatBytes(memory.heapAfterBytes ?? 0)],
          ["retained by the grid", formatBytes(memory.retainedBytes)],
          ["retained per row", `${memory.retainedBytesPerRow ?? 0} B`],
          ["rss at the end", formatBytes(memory.rssBytes ?? 0)],
        ],
        numeric: [1],
      }),
      method(memory.method),
      ...demoMemoryNodes(stats, "rows"),
    ],
  }
}

const benchmarks = (stats: CoreStats): Section => {
  const bench = (stats as Stats).bench
  if (bench.medians === null && bench.headToHead === null) {
    return { id: "bench", title: "Benchmarks", nodes: [missing(bench.reason)] }
  }
  const nodes: HTMLElement[] = []
  if (bench.machine !== null) {
    const list = el("ul", "stats-machine")
    for (const line of bench.machine) list.append(el("li", "", line))
    nodes.push(el("h3", "", "Run conditions"), list)
  }
  if (bench.headToHead !== null && bench.headToHead.length > 0) {
    nodes.push(
      el("h3", "", "Head to head with @tanstack/table-core"),
      table({
        columns: ["operation", "signal-grid median", "table-core median", "ratio"],
        rows: bench.headToHead.map((it) => [it.operation, it.signalGridMedian, it.tanstackMedian, it.ratio]),
        numeric: [1, 2, 3],
      }),
    )
  }
  if (bench.medians !== null && bench.medians.length > 0) {
    const rows: Cell[][] = bench.medians.map((it) => [
      it.section,
      it.benchmark,
      it.opsPerSecond === null ? null : NUMBER.format(it.opsPerSecond),
      it.medianMs,
      it.p95Ms,
      it.minMs,
      it.samples,
    ])
    nodes.push(
      el("h3", "", `Medians, ${bench.medians.length} cases`),
      table({
        columns: ["section", "case", "ops/s", "median ms", "p95 ms", "min ms", "samples"],
        rows,
        numeric: [2, 3, 4, 5, 6],
      }),
    )
  }
  nodes.push(method(bench.method))
  return { id: "bench", title: "Benchmarks", nodes }
}

export const SECTIONS: Readonly<Record<string, SectionBuilder>> = {
  ...CORE_SECTIONS,
  memory: rowsRetained,
  bench: benchmarks,
}
