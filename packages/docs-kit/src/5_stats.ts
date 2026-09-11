// The receipts page and the footer strip, both fed by a `stats.json` a site's own measure step
// writes and vite inlines, so nothing on the page is fetched and nothing is typed by hand.

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

/** One example's heap, sampled around its own mount and teardown. Every figure is a median. */
export interface DemoHeap {
  readonly id: string
  readonly repeats: number
  readonly baselineHeapBytes: number
  readonly peakHeapBytes: number
  readonly peakSpreadBytes: number
  readonly retainedHeapBytes: number
  readonly retainedSpreadBytes: number
  readonly nodesAfterTeardown: number
  readonly painted: number
  readonly leaks: boolean
  readonly reason: string | null
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

/** Every group `@hafley66/docs-kit` measures for any package. A site adds its own beside these. */
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
  readonly demoMemory: {
    readonly method: string | null
    readonly command: string
    readonly samples: number | null
    readonly leakBytes: number | null
    readonly measuredAt?: string
    readonly examples: readonly DemoHeap[] | null
    readonly retaining: readonly string[] | null
    readonly durationMs: number | null
    readonly reason: string | null
  }
}

// --- Formatting -------------------------------------------------------------

export const NUMBER = new Intl.NumberFormat("en-US")

export const formatBytes = (value: number): string => {
  if (value < 1024) return `${NUMBER.format(value)} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} kB`
  return `${(value / (1024 * 1024)).toFixed(2)} MB`
}

export const formatMs = (value: number | null): string =>
  value === null ? "not measured" : `${NUMBER.format(value)} ms`

const formatDate = (iso: string | null): string => {
  if (iso === null) return "unknown"
  const when = new Date(iso)
  if (Number.isNaN(when.getTime())) return iso
  return `${when.toISOString().replace("T", " ").slice(0, 19)} UTC`
}

const shortDate = (iso: string): string => {
  const when = new Date(iso)
  return Number.isNaN(when.getTime()) ? iso : when.toISOString().slice(0, 10)
}

// --- DOM --------------------------------------------------------------------

export const el = (tag: string, className: string, text?: string): HTMLElement => {
  const node = document.createElement(tag)
  if (className !== "") node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

export type Cell = string | number | null | HTMLElement

const cellNode = (value: Cell): HTMLElement => {
  if (value === null) return el("td", "stats-null", "null")
  if (value instanceof HTMLElement) {
    const wrap = document.createElement("td")
    wrap.append(value)
    return wrap
  }
  return el("td", typeof value === "number" ? "stats-num" : "", String(value))
}

export interface TableSpec {
  readonly columns: readonly string[]
  readonly rows: readonly (readonly Cell[])[]
  /** Columns whose cells are right-aligned numbers, by index. */
  readonly numeric?: readonly number[]
}

export function table(spec: TableSpec): HTMLElement {
  const wrap = el("div", "stats-table")
  const node = document.createElement("table")
  const head = document.createElement("thead")
  const headRow = document.createElement("tr")
  spec.columns.forEach((column, index) => {
    headRow.append(el("th", spec.numeric?.includes(index) === true ? "stats-num" : "", column))
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

export const method = (text: string | null): HTMLElement =>
  el("p", "stats-method", text === null ? "no source" : `measured by: ${text}`)

export const missing = (reason: string | null): HTMLElement =>
  el("p", "stats-missing", reason === null ? "not measured" : `not measured. ${reason}`)

export function link(href: string, text: string, className: string): HTMLAnchorElement {
  const anchor = document.createElement("a")
  anchor.href = href
  anchor.className = className
  anchor.target = "_blank"
  anchor.rel = "noreferrer"
  anchor.textContent = text
  return anchor
}

// --- Sections ---------------------------------------------------------------

export interface Section {
  readonly id: string
  readonly title: string
  readonly nodes: readonly HTMLElement[]
}

export type SectionBuilder = (stats: Stats) => Section

function commitSection(stats: Stats): Section {
  const commit = stats.commit
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
        [
          "working tree",
          commit.clean === null ? null : commit.clean ? "clean" : `dirty, ${commit.dirtyCount ?? 0} path(s)`,
        ],
        ["repository", commit.repository],
      ],
    }),
    method(commit.method),
  )
  return { id: "commit", title: "Commit", nodes }
}

function machineSection(stats: Stats): Section {
  const machine = stats.machine
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
          ["package", `${stats.package.name} ${stats.package.version}`],
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

function sizeLimitTable(stats: Stats): HTMLElement {
  const sizeLimit = stats.sizeLimit
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

function bundleSection(stats: Stats): Section {
  const bundle = stats.bundle
  const sizeLimit = stats.sizeLimit
  const nodes: HTMLElement[] = [
    el("h3", "", "Budgets, per entry point"),
    sizeLimitTable(stats),
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
  for (const entry of [bundle.library, bundle.site, bundle.demo, bundle.videos]) {
    if (entry.reason !== null) nodes.push(el("p", "stats-missing", entry.reason))
  }
  return { id: "bundle", title: "Bundle", nodes }
}

function sourceSection(stats: Stats): Section {
  const source = stats.source
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

const suiteRow = (suite: Suite): Cell[] => [
  suite.label,
  suite.command,
  suite.files,
  suite.tests,
  suite.passed,
  suite.failed,
  suite.durationMs === null ? null : formatMs(suite.durationMs),
]

function testsSection(stats: Stats): Section {
  const tests = stats.tests
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

function timingSection(stats: Stats): Section {
  const timing = stats.timing
  const rows: Cell[][] = [
    ["tsc --noEmit", timing.typecheckMs === null ? null : formatMs(timing.typecheckMs)],
    ["vite build, library", timing.libraryBuildMs === null ? null : formatMs(timing.libraryBuildMs)],
    ["vite build, site", timing.siteBuildMs === null ? null : formatMs(timing.siteBuildMs)],
    ["vite build, demo", timing.demoBuildMs === null ? null : formatMs(timing.demoBuildMs)],
    ["vitest run, unit", timing.unitTestsMs === null ? null : formatMs(timing.unitTestsMs)],
    ["vitest run, browser", timing.browserTestsMs === null ? null : formatMs(timing.browserTestsMs)],
    ["the measure step itself", formatMs(timing.statsMs)],
  ]
  const nodes: HTMLElement[] = [table({ columns: ["step", "wall time"], rows, numeric: [1] })]
  if (timing.typecheckReason !== null) nodes.push(el("p", "stats-missing", timing.typecheckReason))
  if (timing.libraryBuildReason !== null) nodes.push(el("p", "stats-missing", timing.libraryBuildReason))
  nodes.push(method(timing.method))
  return { id: "timing", title: "Timing", nodes }
}

/** The per-demo heap table, so a package's own memory section can append it under its own probe. */
export function demoMemoryNodes(stats: Stats, paintedLabel: string): readonly HTMLElement[] {
  const demos = stats.demoMemory
  const nodes: HTMLElement[] = [el("h3", "", "Per demo, in a real browser")]
  if (demos.examples === null) {
    nodes.push(missing(demos.reason))
    return nodes
  }
  const ordered = [...demos.examples].sort((left, right) => right.peakHeapBytes - left.peakHeapBytes)
  nodes.push(
    table({
      columns: ["demo", "peak heap", "retained after teardown", "nodes after teardown", paintedLabel, "spread across runs"],
      rows: ordered.map((it) => [
        it.leaks ? `${it.id} (retains)` : it.id,
        formatBytes(it.peakHeapBytes),
        formatBytes(it.retainedHeapBytes),
        it.nodesAfterTeardown,
        it.painted,
        `peak ±${formatBytes(it.peakSpreadBytes)}, retained ±${formatBytes(it.retainedSpreadBytes)}`,
      ]),
      numeric: [1, 2, 3, 4],
    }),
  )
  if (demos.retaining !== null && demos.retaining.length > 0) {
    nodes.push(el("p", "stats-missing", `These demos hold heap after teardown: ${demos.retaining.join(", ")}.`))
  } else if (demos.leakBytes !== null) {
    nodes.push(
      el(
        "p",
        "stats-measured",
        `No demo held more than ${formatBytes(demos.leakBytes)} over its own baseline after teardown.`,
      ),
    )
  }
  nodes.push(method(demos.method))
  return nodes
}

/** Every section whose numbers come out of the kit's own measure step. */
export const CORE_SECTIONS: Readonly<Record<string, SectionBuilder>> = {
  commit: commitSection,
  machine: machineSection,
  bundle: bundleSection,
  source: sourceSection,
  tests: testsSection,
  timing: timingSection,
}

/** Renders one section into `host`; the page's own markdown writes the heading above it. */
export function renderSection(
  stats: Stats,
  sections: Readonly<Record<string, SectionBuilder>>,
  id: string,
  host: HTMLElement,
): void {
  const build = sections[id]
  if (build === undefined) {
    host.append(el("p", "stats-missing", `a receipts page asks for a section "${id}" that this site does not define`))
    return
  }
  const section = build(stats)
  for (const node of section.nodes) {
    if (node.tagName === "H3") {
      node.id = `${section.id}-${(node.textContent ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`
    }
    host.append(node)
  }
}

// --- Footer strip -----------------------------------------------------------

/** The strip every page carries: the commit it was built from, when, and whether the tree was clean. */
export function statsFooter(stats: Stats, hrefFor: (slug: string) => string): HTMLElement {
  const commit = stats.commit
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
    el("span", "receipts-date", shortDate(stats.machine.builtAt)),
    el("span", "receipts-sep", "·"),
    commit.clean === true
      ? el("span", "receipts-clean", "clean tree")
      : el(
          "span",
          "receipts-dirty",
          commit.clean === null ? "tree state unknown" : `dirty tree, ${commit.dirtyCount ?? 0} path(s)`,
        ),
    el("span", "receipts-sep", "·"),
  )
  const more = document.createElement("a")
  more.href = hrefFor("stats")
  more.className = "receipts-more"
  more.textContent = "all receipts"
  footer.append(more)
  return footer
}
