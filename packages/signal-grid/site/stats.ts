// The receipts page and the footer strip, both fed by `stats.json`, which `scripts/stats.mjs`
// measures at build time and vite inlines, so nothing on this page is fetched and nothing is typed.
import raw from "./stats.json"

// --- Shape ------------------------------------------------------------------

export interface Bundle {
  readonly fileCount: number | null
  readonly totalBytes: number | null
  readonly totalGzipBytes: number | null
  readonly reason: string | null
}

/** One `.size-limit.json` entry, as size-limit's own `--json` output reports it. */
export interface SizeLimitEntry {
  readonly name: string
  readonly sizeBytes: number | null
  readonly limitBytes: number | null
  readonly headroomBytes: number | null
  readonly passed: boolean
  readonly loadingMs: number | null
  readonly runningMs: number | null
}

export interface Treemap {
  readonly method: string
  readonly envFlag: string
  readonly command: string
  readonly file: string
  readonly bytes: number | null
  readonly reason: string | null
}

export interface Commit {
  readonly method: string
  readonly hash: string | null
  readonly short: string | null
  readonly subject: string | null
  readonly authorDate: string | null
  readonly branch: string | null
  readonly clean: boolean | null
  readonly dirtyCount: number | null
  readonly dirtyEntries: readonly string[] | null
  readonly repository: string
  readonly url: string | null
  readonly reason: string | null
}

export interface Machine {
  readonly method: string
  readonly node: string
  readonly platform: string
  readonly arch: string
  readonly cpuModel: string | null
  readonly cores: number
  readonly totalMemoryBytes: number
  readonly builtAt: string
}

export interface SourceFile {
  readonly file: string
  readonly lines: number
  readonly kind: string
}

export interface Suite {
  readonly label: string
  readonly command: string
  readonly tests: number | null
  readonly files: number | null
  readonly passed: number | null
  readonly failed: number | null
  readonly durationMs: number | null
  readonly success?: boolean
  readonly reason: string | null
}

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

export interface Stats {
  readonly schema: number
  readonly generatedBy: string
  readonly commit: Commit
  readonly machine: Machine
  readonly package: { readonly name: string; readonly version: string }
  readonly bundle: {
    readonly method: string
    readonly library: Bundle
    readonly siteMethod: string
    readonly site: Bundle
    readonly demo: Bundle
    readonly videos: Bundle
    readonly treemap: Treemap
  }
  readonly sizeLimit: {
    readonly method: string | null
    readonly config: string
    readonly entries: readonly SizeLimitEntry[] | null
    readonly passed: boolean | null
    readonly durationMs: number | null
    readonly reason: string | null
  }
  readonly source: {
    readonly method: string
    readonly files: readonly SourceFile[]
    readonly sourceFiles: number
    readonly sourceLines: number
    readonly testFiles: number
    readonly testLines: number
  }
  readonly tests: { readonly method: string; readonly unit: Suite; readonly browser: Suite }
  readonly timing: {
    readonly method: string
    readonly typecheckMs: number | null
    readonly typecheckReason: string | null
    readonly libraryBuildMs: number | null
    readonly libraryBuildReason: string | null
    readonly unitTestsMs: number | null
    readonly browserTestsMs: number | null
    readonly siteBuildMs: number | null
    readonly demoBuildMs: number | null
    readonly statsMs: number
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

// --- Formatting -------------------------------------------------------------

const NUMBER = new Intl.NumberFormat("en-US")

export const formatBytes = (value: number): string => {
  if (value < 1024) return `${NUMBER.format(value)} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} kB`
  return `${(value / (1024 * 1024)).toFixed(2)} MB`
}

const formatMs = (value: number | null): string => (value === null ? "not measured" : `${NUMBER.format(value)} ms`)

const formatDate = (iso: string | null): string => {
  if (iso === null) return "unknown"
  const when = new Date(iso)
  if (Number.isNaN(when.getTime())) return iso
  return when.toISOString().replace("T", " ").slice(0, 19) + " UTC"
}

const shortDate = (iso: string): string => {
  const when = new Date(iso)
  return Number.isNaN(when.getTime()) ? iso : when.toISOString().slice(0, 10)
}

// --- DOM --------------------------------------------------------------------

const el = (tag: string, className: string, text?: string): HTMLElement => {
  const node = document.createElement(tag)
  if (className !== "") node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

type Cell = string | number | null | HTMLElement

const cellNode = (value: Cell): HTMLElement => {
  if (value === null) return el("td", "stats-null", "null")
  if (value instanceof HTMLElement) {
    const wrap = document.createElement("td")
    wrap.append(value)
    return wrap
  }
  return el("td", typeof value === "number" ? "stats-num" : "", String(value))
}

interface TableSpec {
  readonly columns: readonly string[]
  readonly rows: readonly (readonly Cell[])[]
  /** Columns whose cells are right-aligned numbers, by index. */
  readonly numeric?: readonly number[]
}

function table(spec: TableSpec): HTMLElement {
  const wrap = el("div", "stats-table")
  const node = document.createElement("table")
  const head = document.createElement("thead")
  const headRow = document.createElement("tr")
  spec.columns.forEach((column, index) => {
    const cell = el("th", spec.numeric?.includes(index) === true ? "stats-num" : "", column)
    headRow.append(cell)
  })
  head.append(headRow)
  const body = document.createElement("tbody")
  for (const row of spec.rows) {
    const line = document.createElement("tr")
    row.forEach((value, index) => {
      const cell = cellNode(value)
      if (spec.numeric?.includes(index) === true) cell.classList.add("stats-num")
      line.append(cell)
    })
    body.append(line)
  }
  node.append(head, body)
  wrap.append(node)
  return wrap
}

const method = (text: string | null): HTMLElement =>
  el("p", "stats-method", text === null ? "no source" : `measured by: ${text}`)

const missing = (reason: string | null): HTMLElement =>
  el("p", "stats-missing", reason === null ? "not measured" : `not measured. ${reason}`)

function link(href: string, text: string, className: string): HTMLAnchorElement {
  const anchor = document.createElement("a")
  anchor.href = href
  anchor.className = className
  anchor.target = "_blank"
  anchor.rel = "noreferrer"
  anchor.textContent = text
  return anchor
}

// --- Sections ---------------------------------------------------------------

interface Section {
  readonly id: string
  readonly title: string
  readonly nodes: readonly HTMLElement[]
}

function commitSection(): Section {
  const commit = STATS.commit
  const nodes: HTMLElement[] = []
  if (commit.clean === false) {
    const warning = el("div", "stats-warning")
    warning.append(
      el("strong", "", "This page was built from an unclean working tree."),
      el(
        "p",
        "",
        `${commit.dirtyCount ?? 0} path(s) differed from ${commit.short ?? "HEAD"} when these numbers were taken, so the build is not reproducible from the commit alone.`,
      ),
    )
    if (commit.dirtyEntries !== null && commit.dirtyEntries.length > 0) {
      const list = el("ul", "stats-dirty")
      for (const entry of commit.dirtyEntries) list.append(el("li", "", entry))
      warning.append(list)
    }
    nodes.push(warning)
  }
  const hash =
    commit.url === null || commit.hash === null
      ? (commit.hash ?? "unknown")
      : link(commit.url, commit.hash, "stats-hash")
  nodes.push(
    table({
      columns: ["field", "value"],
      rows: [
        ["commit", hash],
        ["short", commit.short],
        ["subject", commit.subject],
        ["author date", formatDate(commit.authorDate)],
        ["branch", commit.branch],
        ["working tree", commit.clean === null ? null : commit.clean ? "clean" : `dirty, ${commit.dirtyCount ?? 0} path(s)`],
        ["repository", commit.repository],
      ],
    }),
    method(commit.method),
  )
  return { id: "commit", title: "Commit", nodes }
}

function machineSection(): Section {
  const machine = STATS.machine
  return {
    id: "machine",
    title: "Machine",
    nodes: [
      table({
        columns: ["field", "value"],
        rows: [
          ["built at", formatDate(machine.builtAt)],
          ["node", machine.node],
          ["platform", `${machine.platform} ${machine.arch}`],
          ["cpu", machine.cpuModel],
          ["cores", machine.cores],
          ["total memory", formatBytes(machine.totalMemoryBytes)],
          ["package", `${STATS.package.name} ${STATS.package.version}`],
        ],
        numeric: [],
      }),
      method(machine.method),
    ],
  }
}

const bundleRow = (label: string, bundle: Bundle): Cell[] =>
  bundle.totalBytes === null || bundle.totalGzipBytes === null
    ? [label, null, null, null]
    : [label, bundle.fileCount, formatBytes(bundle.totalBytes), formatBytes(bundle.totalGzipBytes)]

function sizeLimitTable(): HTMLElement {
  const sizeLimit = STATS.sizeLimit
  if (sizeLimit.entries === null) return missing(sizeLimit.reason)
  const rows: Cell[][] = sizeLimit.entries.map((it) => [
    it.name,
    it.sizeBytes === null ? null : formatBytes(it.sizeBytes),
    it.limitBytes === null ? null : formatBytes(it.limitBytes),
    it.headroomBytes === null ? null : formatBytes(it.headroomBytes),
    it.loadingMs === null ? null : formatMs(it.loadingMs),
    it.runningMs === null ? null : formatMs(it.runningMs),
    it.passed ? "pass" : "over budget",
  ])
  return table({
    columns: ["entry", "gzip", "budget", "headroom", "slow 3G load", "run on a Snapdragon 410", "gate"],
    rows,
    numeric: [1, 2, 3, 4, 5],
  })
}

function bundleSection(): Section {
  const bundle = STATS.bundle
  const sizeLimit = STATS.sizeLimit
  const nodes: HTMLElement[] = [
    el("h3", "", "Budgets, per entry point"),
    sizeLimitTable(),
    el(
      "p",
      "stats-measured",
      `The gate is \`npx size-limit\`, run from ${sizeLimit.config}. It exits non-zero when an entry passes its budget, so a regression fails the build instead of appearing in a table.`,
    ),
    method(sizeLimit.method),
    el("h3", "", "Build outputs, totals"),
    table({
      columns: ["output", "files", "raw", "gzip"],
      rows: [
        bundleRow("library, dist/", bundle.library),
        bundleRow("site, site/dist/", bundle.site),
        bundleRow("demo, site/dist/demo/", bundle.demo),
        bundleRow("recordings, site/dist/videos/", bundle.videos),
      ],
      numeric: [1, 2, 3],
    }),
    method(bundle.method),
    method(bundle.siteMethod),
    el("h3", "", "What is inside the bundle"),
    bundle.treemap.bytes === null
      ? missing(bundle.treemap.reason)
      : table({
          columns: ["field", "value"],
          rows: [
            ["command", bundle.treemap.command],
            ["file", bundle.treemap.file],
            ["size", formatBytes(bundle.treemap.bytes)],
          ],
        }),
    method(bundle.treemap.method),
  ]
  for (const bundleEntry of [bundle.library, bundle.site, bundle.demo, bundle.videos]) {
    if (bundleEntry.reason !== null) nodes.push(el("p", "stats-missing", bundleEntry.reason))
  }
  return { id: "bundle", title: "Bundle", nodes }
}

function sourceSection(): Section {
  const source = STATS.source
  const summary = table({
    columns: ["kind", "files", "lines"],
    rows: [
      ["source", source.sourceFiles, NUMBER.format(source.sourceLines)],
      ["test", source.testFiles, NUMBER.format(source.testLines)],
      ["total", source.sourceFiles + source.testFiles, NUMBER.format(source.sourceLines + source.testLines)],
    ],
    numeric: [1, 2],
  })
  const perFile = table({
    columns: ["file", "kind", "lines"],
    rows: source.files.map((it) => [it.file, it.kind, it.lines]),
    numeric: [2],
  })
  return { id: "source", title: "Source", nodes: [summary, perFile, method(source.method)] }
}

function suiteRow(suite: Suite): Cell[] {
  return [
    suite.label,
    suite.command,
    suite.files,
    suite.tests,
    suite.passed,
    suite.failed,
    suite.durationMs === null ? null : formatMs(suite.durationMs),
  ]
}

function testsSection(): Section {
  const tests = STATS.tests
  const nodes: HTMLElement[] = [
    table({
      columns: ["suite", "command", "files", "tests", "passed", "failed", "duration"],
      rows: [suiteRow(tests.unit), suiteRow(tests.browser)],
      numeric: [2, 3, 4, 5, 6],
    }),
  ]
  for (const suite of [tests.unit, tests.browser]) {
    if (suite.reason !== null) nodes.push(el("p", "stats-missing", `${suite.label}: ${suite.reason}`))
  }
  nodes.push(method(tests.method))
  return { id: "tests", title: "Tests", nodes }
}

function timingSection(): Section {
  const timing = STATS.timing
  const rows: Cell[][] = [
    ["tsc --noEmit", timing.typecheckMs === null ? null : formatMs(timing.typecheckMs)],
    ["vite build, library", timing.libraryBuildMs === null ? null : formatMs(timing.libraryBuildMs)],
    ["vite build, site", timing.siteBuildMs === null ? null : formatMs(timing.siteBuildMs)],
    ["vite build, demo", timing.demoBuildMs === null ? null : formatMs(timing.demoBuildMs)],
    ["vitest run, unit", timing.unitTestsMs === null ? null : formatMs(timing.unitTestsMs)],
    ["vitest run, browser", timing.browserTestsMs === null ? null : formatMs(timing.browserTestsMs)],
    ["stats.mjs itself", formatMs(timing.statsMs)],
  ]
  const nodes: HTMLElement[] = [table({ columns: ["step", "wall time"], rows, numeric: [1] })]
  if (timing.typecheckReason !== null) nodes.push(el("p", "stats-missing", timing.typecheckReason))
  if (timing.libraryBuildReason !== null) nodes.push(el("p", "stats-missing", timing.libraryBuildReason))
  nodes.push(method(timing.method))
  return { id: "timing", title: "Timing", nodes }
}

function memorySection(): Section {
  const memory = STATS.memory
  if (memory.measured === null || memory.retainedBytes === undefined) {
    return { id: "memory", title: "Memory", nodes: [missing(memory.reason)] }
  }
  const nodes: HTMLElement[] = [
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
  ]
  return { id: "memory", title: "Memory", nodes }
}

function benchSection(): Section {
  const bench = STATS.bench
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
    nodes.push(
      el("h3", "", `Medians, ${bench.medians.length} cases`),
      table({
        columns: ["section", "case", "ops/s", "median ms", "p95 ms", "min ms", "samples"],
        rows: bench.medians.map((it) => [
          it.section,
          it.benchmark,
          it.opsPerSecond === null ? null : NUMBER.format(it.opsPerSecond),
          it.medianMs,
          it.p95Ms,
          it.minMs,
          it.samples,
        ]),
        numeric: [2, 3, 4, 5, 6],
      }),
    )
  }
  nodes.push(method(bench.method))
  return { id: "bench", title: "Benchmarks", nodes }
}

// --- Page -------------------------------------------------------------------

const SECTIONS: Readonly<Record<string, () => Section>> = {
  commit: commitSection,
  machine: machineSection,
  bundle: bundleSection,
  source: sourceSection,
  tests: testsSection,
  timing: timingSection,
  memory: memorySection,
  bench: benchSection,
}

/** Renders one section of the receipts page into `host`; `site/stats.md` writes the heading above it. */
export function renderStatsSection(id: string, host: HTMLElement): void {
  const build = SECTIONS[id]
  if (build === undefined) {
    host.append(el("p", "stats-missing", `site/stats.md asks for a section "${id}" that site/stats.ts does not define`))
    return
  }
  const section = build()
  for (const node of section.nodes) {
    if (node.tagName === "H3") {
      node.id = `${section.id}-${(node.textContent ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`
    }
    host.append(node)
  }
}

// --- Footer strip -----------------------------------------------------------

/** The strip every page carries: the commit it was built from, when, and whether the tree was clean. */
export function statsFooter(hrefFor: (slug: string) => string): HTMLElement {
  const commit = STATS.commit
  const footer = el("footer", "receipts")
  const hash =
    commit.url === null || commit.short === null
      ? el("span", "receipts-hash", commit.short ?? "no commit")
      : link(commit.url, commit.short, "receipts-hash")
  if (hash instanceof HTMLAnchorElement && commit.subject !== null) hash.title = commit.subject
  footer.append(
    el("span", "receipts-label", "built from"),
    hash,
    el("span", "receipts-sep", "·"),
    el("span", "receipts-date", shortDate(STATS.machine.builtAt)),
    el("span", "receipts-sep", "·"),
    commit.clean === true
      ? el("span", "receipts-clean", "clean tree")
      : el("span", "receipts-dirty", commit.clean === null ? "tree state unknown" : `dirty tree, ${commit.dirtyCount ?? 0} path(s)`),
    el("span", "receipts-sep", "·"),
  )
  const more = document.createElement("a")
  more.href = hrefFor("stats")
  more.className = "receipts-more"
  more.textContent = "all receipts"
  footer.append(more)
  return footer
}
