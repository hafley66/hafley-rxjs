// @comment-ok: the probe runs in a child process because a synchronous script cannot import an ES module, and that constraint is invisible from the code
// The numbers that are about grids: what a 100k-row grid retains, how many epics the default set
// holds, what the parity ledger tracks, and what the benchmark tables say. Everything else is
// measured by `@hafley66/docs-kit`, whose groups this assembles around these four.
import { execFileSync } from "node:child_process"
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { BUNDLE_METHOD, SITE_METHOD, createMeasure, reportStats } from "@hafley66/docs-kit/scripts/stats"

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const OUT = join(PKG, "site", "stats.json")
const REPO = "hafley66/hafley-rxjs"

const argv = process.argv.slice(2)
const bundlesOnly = argv.includes("--bundles")
const numberArg = (name) => {
  const found = argv.find((it) => it.startsWith(`--${name}=`))
  if (found === undefined) return null
  const value = Number(found.slice(name.length + 3))
  return Number.isFinite(value) ? value : null
}

const measure = createMeasure({
  pkg: PKG,
  repo: REPO,
  // The build writes these three, so measuring before writing them would report a clean checkout
  // dirty. Excluding them is the only way the answer is about the source.
  generated: [
    "packages/signal-grid/site/stats.json",
    "packages/signal-grid/site/parity.json",
    "packages/signal-grid/docs/1_parity.md",
    "packages/signal-grid/docs/reference-api.md",
  ],
})

const TREEMAP = {
  method:
    "rollup-plugin-visualizer, wired into vite.config.ts behind SIGNAL_GRID_TREEMAP=1 because it takes the bundle step from 24 ms to 84 ms; this script does not set the flag",
  envFlag: "SIGNAL_GRID_TREEMAP=1",
  command: "SIGNAL_GRID_TREEMAP=1 npx vite build",
}

// --- memory -----------------------------------------------------------------

const PROBE = `
import { grid } from ${JSON.stringify(pathToFileURL(join(PKG, "dist", "index.js")).href)}

const ROWS = 100000
const rows = []
for (let index = 0; index < ROWS; index++) {
  rows.push({ id: "r" + index, name: "row " + index, size: index % 997, kind: "k" + (index % 7) })
}
const columns = [
  { id: "name", header: "Name", type: "string", width: 240 },
  { id: "size", header: "Size", type: "number", width: 120 },
  { id: "kind", header: "Kind", type: "string", width: 120 },
]

globalThis.gc()
const before = process.memoryUsage().heapUsed
const built = grid({
  id: "stats-probe",
  rows,
  columns,
  rowId: (it) => it.id,
  viewport: { top: 0, left: 0, width: 1280, height: 800 },
})
const plan = built.view.plan.$()
const flat = built.view.flat.$()
globalThis.gc()
const after = process.memoryUsage().heapUsed
const usage = process.memoryUsage()
process.stdout.write(JSON.stringify({
  rows: ROWS,
  windowed: plan.center.length,
  flat: flat.length,
  heapBeforeBytes: before,
  heapAfterBytes: after,
  retainedBytes: after - before,
  rssBytes: usage.rss,
}))
built.close()
`

function memoryGroup() {
  if (!existsSync(join(PKG, "dist", "index.js"))) {
    return {
      method: null,
      measured: null,
      reason: "dist/index.js is absent, so the probe had nothing to import; run the library build first",
    }
  }
  let raw = null
  try {
    raw = execFileSync(process.execPath, ["--expose-gc", "--input-type=module", "-e", PROBE], {
      cwd: PKG,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
  } catch (error) {
    return { method: null, measured: null, reason: `the probe child process failed: ${String(error).split("\n")[0]}` }
  }
  const parsed = JSON.parse(raw)
  return {
    method:
      "a child node --expose-gc process imports dist/index.js, allocates 100000 plain row objects, forces gc, reads process.memoryUsage().heapUsed, builds one grid and reads view.plan and view.flat, forces gc again, reads heapUsed again",
    measured:
      "bytes the grid retains on top of the caller's own row objects: heapUsed after building a 100000-row grid and reading its plan, minus heapUsed with only the rows alive, both after a forced gc",
    rows: parsed.rows,
    flatNodes: parsed.flat,
    windowedRows: parsed.windowed,
    heapBeforeBytes: parsed.heapBeforeBytes,
    heapAfterBytes: parsed.heapAfterBytes,
    retainedBytes: parsed.retainedBytes,
    retainedBytesPerRow: Number((parsed.retainedBytes / parsed.rows).toFixed(1)),
    rssBytes: parsed.rssBytes,
    reason: null,
  }
}

// --- ledger -----------------------------------------------------------------

const EPIC_PROBE = `
import { defaultEpics } from ${JSON.stringify(pathToFileURL(join(PKG, "dist", "index.js")).href)}
process.stdout.write(String(defaultEpics().length))
`

/** Called rather than regex-counted: a helper returning two epics reads as one `epic(` to a scanner. */
function epicsGroup() {
  if (!existsSync(join(PKG, "dist", "index.js"))) {
    return {
      method: null,
      count: null,
      reason: "dist/index.js is absent, so defaultEpics() could not be imported; run the library build first",
    }
  }
  let raw = null
  try {
    raw = execFileSync(process.execPath, ["--input-type=module", "-e", EPIC_PROBE], {
      cwd: PKG,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
  } catch (error) {
    return {
      method: null,
      count: null,
      reason: `importing defaultEpics from dist/index.js failed: ${String(error).split("\n")[0]}`,
    }
  }
  const count = Number(raw.trim())
  return {
    method: "a child node process imports defaultEpics from dist/index.js and reports the length of what it returns",
    count: Number.isFinite(count) ? count : null,
    reason: Number.isFinite(count) ? null : `defaultEpics().length printed ${JSON.stringify(raw)}`,
  }
}

/** `parity.mjs` exits non-zero while a module is untagged and still writes its counts, so a failing
 * gate is reported here rather than erasing the numbers. */
function featuresGroup() {
  const data = join(PKG, "site", "parity.json")
  const run = measure.timed(process.execPath, [join(PKG, "scripts", "parity.mjs")])
  if (!existsSync(data)) {
    return { method: null, tracked: null, reason: "node scripts/parity.mjs wrote no site/parity.json" }
  }
  const parsed = JSON.parse(readFileSync(data, "utf8"))
  return {
    method: "node scripts/parity.mjs, counts read back from site/parity.json",
    tracked: parsed.features,
    implemented: parsed.implemented,
    declaredOnly: parsed.declaredOnly,
    decidedOut: parsed.decidedOut,
    undecided: parsed.undecided,
    tags: parsed.tags,
    modules: parsed.modules,
    untagged: parsed.untagged,
    unread: parsed.unread.length,
    gate: parsed.ok ? "pass" : "fail",
    durationMs: run.ms,
    reason: parsed.ok ? null : `the parity gate fails: ${parsed.untagged.length} module(s) under src/ carry no feature tag`,
  }
}

// --- bench ------------------------------------------------------------------

const cell = (text) => text.trim()

/** "18,848" -> 18848, "3.83e-4" -> 0.000383, anything else -> null. */
function numberOf(text) {
  const cleaned = cell(text).replace(/,/g, "")
  if (cleaned === "" || cleaned === "-") return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

const rowCells = (line) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map(cell)

function benchGroup() {
  const file = join(PKG, "bench", "README.md")
  if (!existsSync(file)) {
    return {
      method: null,
      file: "bench/README.md",
      medians: null,
      headToHead: null,
      machine: null,
      reason: "bench/README.md does not exist",
    }
  }
  const lines = readFileSync(file, "utf8").split("\n")
  const medians = []
  const headToHead = []
  const machine = []
  let section = ""
  let inMachine = false

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? ""
    const heading = /^#{2,3}\s+(.*)$/.exec(line)
    if (heading !== null) {
      section = heading[1] ?? ""
      inMachine = section.toLowerCase() === "machine"
      continue
    }
    if (inMachine && line.startsWith("- ")) {
      machine.push(line.slice(2).trim())
      continue
    }
    if (!line.startsWith("|")) continue
    const header = rowCells(line)
    const divider = lines[index + 1] ?? ""
    if (!/^\|[\s:|-]+\|$/.test(divider.trim())) continue

    const medianAt = header.indexOf("median ms")
    const isHeadToHead = header[0] === "operation" && header.some((it) => it.includes("signal-grid median"))
    for (let cursor = index + 2; cursor < lines.length; cursor++) {
      const body = lines[cursor] ?? ""
      if (!body.startsWith("|")) break
      const cells = rowCells(body)
      if (medianAt > 0) {
        medians.push({
          section,
          benchmark: cells[0] ?? "",
          opsPerSecond: numberOf(cells[1] ?? ""),
          medianMs: numberOf(cells[2] ?? ""),
          p95Ms: numberOf(cells[3] ?? ""),
          minMs: numberOf(cells[4] ?? ""),
          samples: cells[5] ?? null,
          note: cells[6] ?? null,
        })
      } else if (isHeadToHead) {
        headToHead.push({
          operation: cells[0] ?? "",
          signalGridMedian: cells[1] ?? "",
          tanstackMedian: cells[2] ?? "",
          ratio: cells[3] ?? "",
        })
      }
    }
  }

  if (medians.length === 0 && headToHead.length === 0) {
    return {
      method: null,
      file: "bench/README.md",
      medians: null,
      headToHead: null,
      machine: machine.length === 0 ? null : machine,
      reason: "bench/README.md holds no table with a `median ms` column and no head-to-head summary table",
    }
  }
  return {
    method:
      "parsed out of bench/README.md, which bench/4_report.ts generates from `NODE_OPTIONS=--expose-gc vite-node bench/4_report.ts`; this script does not rerun the benchmarks",
    file: "bench/README.md",
    machine: machine.length === 0 ? null : machine,
    medians,
    headToHead,
    reason: null,
  }
}

// --- assembly ---------------------------------------------------------------

function fullRun() {
  const startedAt = Date.now()
  const typecheck = measure.timed("npx", ["tsc", "--noEmit"])
  const libraryBuild = measure.timed("npx", ["vite", "build"])
  const themeSource = join(PKG, "src", "theme.css")
  if (libraryBuild.ok && existsSync(themeSource)) cpSync(themeSource, join(PKG, "dist", "theme.css"))
  const tests = measure.testsGroup()
  const bundles = measure.siteBundles()

  return {
    schema: 1,
    generatedBy: "packages/signal-grid/scripts/stats.mjs",
    commit: measure.commitGroup(),
    machine: measure.machineGroup(),
    package: measure.packageVersion(),
    bundle: {
      method: BUNDLE_METHOD,
      library: measure.libraryBundle(),
      siteMethod: SITE_METHOD,
      site: bundles.site,
      demo: bundles.demo,
      videos: bundles.videos,
      treemap: measure.treemapGroup(TREEMAP),
    },
    sizeLimit: measure.sizeLimitGroup(),
    source: measure.sourceGroup(),
    epics: epicsGroup(),
    features: featuresGroup(),
    tests,
    timing: {
      method:
        "Date.now() around each execFileSync call in scripts/stats.mjs; site and demo build times are handed over by scripts/ship.mjs",
      typecheckMs: typecheck.ok ? typecheck.ms : null,
      typecheckReason: typecheck.ok ? null : "npx tsc --noEmit exited non-zero",
      libraryBuildMs: libraryBuild.ok ? libraryBuild.ms : null,
      libraryBuildReason: libraryBuild.ok ? null : "npx vite build exited non-zero",
      unitTestsMs: tests.unit.durationMs,
      browserTestsMs: tests.browser.durationMs,
      siteBuildMs: null,
      demoBuildMs: null,
      statsMs: Date.now() - startedAt,
    },
    memory: memoryGroup(),
    demoMemory: measure.demoMemoryGroup(join("scripts", "examples.mjs")),
    bench: benchGroup(),
  }
}

// The site imports stats.json, so its own bundle size is only knowable after it is built.
// `ship.mjs` builds, calls `--bundles`, and builds again, which is why `SITE_METHOD` names the pass.
function bundlesRun() {
  if (!existsSync(OUT)) {
    throw new Error("scripts/stats.mjs --bundles needs an existing site/stats.json; run it without the flag first")
  }
  const previous = JSON.parse(readFileSync(OUT, "utf8"))
  const bundles = measure.siteBundles()
  return {
    ...previous,
    bundle: { ...previous.bundle, siteMethod: SITE_METHOD, site: bundles.site, demo: bundles.demo, videos: bundles.videos },
    timing: {
      ...previous.timing,
      siteBuildMs: numberArg("site-build-ms") ?? previous.timing.siteBuildMs,
      demoBuildMs: numberArg("demo-build-ms") ?? previous.timing.demoBuildMs,
    },
  }
}

const stats = bundlesOnly ? bundlesRun() : fullRun()
writeFileSync(OUT, `${JSON.stringify(stats, null, 2)}\n`)

const kb = (value) => (value === null ? "n/a" : `${(value / 1024).toFixed(1)} kB`)
reportStats(stats, OUT, PKG, {
  bundlesOnly,
  extra: [
    `  epics      ${stats.epics.count ?? "n/a"} in defaultEpics()`,
    `  features   ${stats.features.tracked ?? "n/a"} tracked, ${stats.features.implemented ?? "n/a"} implemented, gate ${stats.features.gate ?? "n/a"}`,
    `  memory     ${stats.memory.retainedBytes === undefined ? "n/a" : kb(stats.memory.retainedBytes)} retained by a 100k-row grid`,
  ],
  nulls: [
    stats.memory.reason === null ? null : `memory: ${stats.memory.reason}`,
    stats.bench.reason === null ? null : `bench: ${stats.bench.reason}`,
    stats.epics.reason === null ? null : `epics: ${stats.epics.reason}`,
    stats.features.reason === null ? null : `features: ${stats.features.reason}`,
  ],
})
