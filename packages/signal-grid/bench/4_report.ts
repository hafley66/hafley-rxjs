// Prints the markdown that `bench/README.md` carries. Separate from `vitest bench` because vitest
// 4.1.10 discards benchmark samples before the JSON reporter, and p95 needs the samples.
import { cpus, totalmem } from "node:os"
import { axisOfEntries, flattenAxis, groupAxis, sortAxis } from "../src/1_axis.js"
import { buildComparator } from "../src/2_operators.js"
import { measuredSizer } from "../src/4_slice.js"
import type { RowId } from "../src/0_types.js"
import { markdown, measure, type Case, type Stats } from "./_cases.js"
import { ASC, COLUMNS, readField, rowsOf, treeAxis } from "./_fixtures.js"
import { flatTable } from "./_tanstack.js"
import { checksum, flatRows, treeShape, type Row } from "./0_data.js"

const kernel = (await import("./1_kernel.bench.js")).CASES
const versus = (await import("./2_vs_tanstack.bench.js")).CASES
const notComparable = (await import("./2_vs_tanstack.bench.js")).NOT_COMPARABLE
const reactive = (await import("./3_reactive.bench.js")).CASES

const machine = (): string => {
  const cpu = cpus()[0]
  return [
    `- node ${process.version}, ${process.platform} ${process.arch}`,
    `- ${cpus().length} x ${cpu?.model ?? "unknown cpu"}`,
    `- ${(totalmem() / 1024 ** 3).toFixed(0)} GiB RAM`,
    `- run ${new Date().toISOString().slice(0, 10)}`,
  ].join("\n")
}

const section = (title: string, cases: readonly Case[]): string => {
  const out: string[] = ["## " + title, ""]
  let group = ""
  let rows: Stats[] = []
  const flush = (): void => {
    if (rows.length === 0) return
    out.push("### " + group, "", markdown(rows), "")
    rows = []
  }
  for (const item of cases) {
    if (item.group !== group) {
      flush()
      group = item.group
    }
    process.stderr.write(`  ${item.name}\n`)
    rows.push(measure(item))
  }
  flush()
  return out.join("\n")
}

const bytes = (value: number): string => (value / 1024 ** 2).toFixed(1) + " MiB"

interface AllocRow {
  readonly name: string
  readonly retained: number
}

/** Retained bytes after a forced gc, so the number is what survives rather than what churned. */
const retained = (name: string, build: () => unknown): AllocRow => {
  const gc = (globalThis as { gc?: () => void }).gc
  if (gc === undefined) return { name, retained: Number.NaN }
  gc()
  gc()
  const before = process.memoryUsage().heapUsed
  const held = build()
  gc()
  const after = process.memoryUsage().heapUsed
  void held
  return { name, retained: after - before }
}

const allocation = (): string => {
  const gc = (globalThis as { gc?: () => void }).gc
  if (gc === undefined) return "Allocation table skipped: rerun with `node --expose-gc`.\n"
  const rows100k = rowsOf(100000)
  const axis100k = axisOfEntries<RowId, Row>(rows100k.map((row) => [row.id, row] as const))
  const cmp = buildComparator<Row>(ASC, COLUMNS, readField)
  const groupValue = (path: readonly unknown[], key: RowId): Row => ({
    id: key,
    name: String(path[path.length - 1] ?? ""),
    dept: "",
    tier: "",
    score: 0,
    active: false,
  })
  const heights = new Map<number, number>()
  for (let at = 0; at < 1000000; at += 7) heights.set(at, 30)
  const table = [
    retained("flatRows(100000), the source data", () => flatRows(100000)),
    retained("axisOf over 100k rows", () => axisOfEntries<RowId, Row>(rows100k.map((r) => [r.id, r] as const))),
    retained("sortAxis result, 100k", () => sortAxis(axis100k, cmp)),
    retained("groupAxis result, 100k into 8", () => groupAxis(axis100k, [(r: Row) => r.dept], groupValue)),
    retained("flattenAxis, 124,800 nodes all open", () => flattenAxis(treeAxis, () => true)),
    retained("measuredSizer prefix array, 1M", () => measuredSizer(1000000, 36, heights)),
    retained("TanStack constructTable + core model, 100k", () => {
      const made = flatTable(rows100k)
      return made.getCoreRowModel().rows
    }),
  ]
  const head = "| structure | retained after gc | bytes per unit |"
  const rule = "| --- | ---: | ---: |"
  const counts = [100000, 100000, 100000, 100000, treeShape(100000, 4, 5).nodes, 1000000, 100000]
  const body = table.map((row, at) => {
    const unit = counts[at] ?? 1
    const size = Number.isFinite(row.retained) ? bytes(row.retained) : "n/a"
    const each = Number.isFinite(row.retained) ? Math.round(row.retained / unit) + " B" : "n/a"
    return `| ${row.name} | ${size} | ${each} |`
  })
  return [head, rule, ...body].join("\n") + "\n"
}

const parts = [
  "# signal-grid benchmarks",
  "",
  "## machine",
  "",
  machine(),
  "",
  "## data",
  "",
  "| set | rows | FNV-1a |",
  "| --- | ---: | --- |",
  ...[1000, 10000, 100000].map((n) => `| flatRows(${n}) | ${n} | 0x${checksum(rowsOf(n)).toString(16)} |`),
  `| treeRows(100000, 4, 5) | ${treeShape(100000, 4, 5).nodes} nodes, 100000 leaves | structural |`,
  "",
  section("kernel operators", kernel),
  "",
  section("head to head with @tanstack/table-core 9.1.0", versus),
  "",
  "### not compared, and why",
  "",
  ...notComparable.map((line) => "- " + line),
  "",
  section("reactive derivation", reactive),
  "",
  "## allocation",
  "",
  allocation(),
]

process.stdout.write(parts.join("\n") + "\n")
