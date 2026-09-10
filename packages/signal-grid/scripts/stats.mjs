// Every number the site prints about itself, written to `site/stats.json`. Each field names the
// command it came from in a sibling `method`, and a missing source yields `null` plus a `reason`.
import { execFileSync } from "node:child_process"
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { cpus, totalmem } from "node:os"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { gzipSync } from "node:zlib"

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

// --- shell ------------------------------------------------------------------

/** stdout of a command, trimmed, or `null` when it exits non-zero. Never throws. */
const capture = (command, args) => {
  try {
    return execFileSync(command, args, { cwd: PKG, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()
  } catch {
    return null
  }
}

/** Runs a command for its side effect and returns the wall time in ms, or `null` when it failed. */
const timed = (command, args) => {
  const started = Date.now()
  try {
    execFileSync(command, args, { cwd: PKG, stdio: ["ignore", "ignore", "pipe"] })
    return { ms: Date.now() - started, ok: true }
  } catch {
    return { ms: Date.now() - started, ok: false }
  }
}

// --- bytes ------------------------------------------------------------------

/** Raw and gzip bytes of one file. gzip runs over the same buffer `statSync` sized. */
function weigh(path) {
  const raw = readFileSync(path)
  return { file: relative(PKG, path), bytes: statSync(path).size, gzipBytes: gzipSync(raw).length }
}

function weighDir(dir) {
  if (!existsSync(dir)) return null
  const entries = readdirSync(dir, { recursive: true })
    .map((it) => join(dir, String(it)))
    .filter((it) => statSync(it).isFile())
  if (entries.length === 0) return null
  const files = entries.map(weigh).sort((left, right) => right.bytes - left.bytes)
  return {
    files,
    totalBytes: files.reduce((sum, it) => sum + it.bytes, 0),
    totalGzipBytes: files.reduce((sum, it) => sum + it.gzipBytes, 0),
  }
}

// --- commit -----------------------------------------------------------------

function commitGroup() {
  const long = capture("git", ["rev-parse", "HEAD"])
  const short = capture("git", ["rev-parse", "--short", "HEAD"])
  const porcelain = capture("git", ["status", "--porcelain"])
  // The build writes these two, so measuring before writing them still reports the tree dirty on a
  // clean checkout. Excluding a file this script itself produces is the only way the answer can be
  // about the source rather than about the act of measuring it.
  const GENERATED = [
    "packages/signal-grid/site/stats.json",
    "packages/signal-grid/site/parity.json",
    "packages/signal-grid/docs/1_parity.md",
  ]
  const dirty =
    porcelain === null
      ? null
      : porcelain
          .split("\n")
          .filter((it) => it.trim() !== "")
          .filter((it) => !GENERATED.some((name) => it.endsWith(name)))
  return {
    method: "git rev-parse HEAD / --short HEAD, git log -1 --format=%s %aI, git status --porcelain excluding this script's own two outputs, git rev-parse --abbrev-ref HEAD",
    hash: long,
    short,
    subject: capture("git", ["log", "-1", "--format=%s"]),
    authorDate: capture("git", ["log", "-1", "--format=%aI"]),
    branch: capture("git", ["rev-parse", "--abbrev-ref", "HEAD"]),
    clean: dirty === null ? null : dirty.length === 0,
    dirtyCount: dirty === null ? null : dirty.length,
    dirtyEntries: dirty === null ? null : dirty.slice(0, 20),
    repository: REPO,
    url: long === null ? null : `https://github.com/${REPO}/commit/${long}`,
    reason: long === null ? "git rev-parse HEAD exited non-zero; no repository at packages/signal-grid" : null,
  }
}

// --- machine ----------------------------------------------------------------

function machineGroup() {
  const cores = cpus()
  return {
    method: "process.version, process.platform, process.arch, node:os cpus() and totalmem(), Date at run time",
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpuModel: cores[0]?.model ?? null,
    cores: cores.length,
    totalMemoryBytes: totalmem(),
    builtAt: new Date().toISOString(),
  }
}

// --- source -----------------------------------------------------------------

/** Line count is `\n` occurrences plus one when the file does not end in a newline. */
function lineCount(text) {
  if (text === "") return 0
  let count = 0
  for (let index = 0; index < text.length; index++) {
    if (text[index] === "\n") count++
  }
  return text.endsWith("\n") ? count : count + 1
}

function sourceGroup() {
  const dir = join(PKG, "src")
  const names = readdirSync(dir).filter((it) => it.endsWith(".ts") || it.endsWith(".css"))
  const files = names
    .map((name) => {
      const text = readFileSync(join(dir, name), "utf8")
      return { file: `src/${name}`, lines: lineCount(text), kind: name.includes(".test.") ? "test" : "source" }
    })
    .sort((left, right) => right.lines - left.lines)
  const of = (kind) => files.filter((it) => it.kind === kind)
  return {
    method: "readFileSync over src/*.{ts,css}, lines counted as \\n occurrences; a name containing .test. is a test file",
    files,
    sourceFiles: of("source").length,
    sourceLines: of("source").reduce((sum, it) => sum + it.lines, 0),
    testFiles: of("test").length,
    testLines: of("test").reduce((sum, it) => sum + it.lines, 0),
  }
}

// --- tests ------------------------------------------------------------------

const TMP = join(PKG, "out", "stats")

/** Runs one vitest config through the json reporter and reads the file back. */
function runSuite(label, args) {
  mkdirSync(TMP, { recursive: true })
  const file = join(TMP, `${label}.json`)
  const started = Date.now()
  const outcome = timed("npx", ["vitest", "run", "--reporter=json", `--outputFile=${file}`, ...args])
  if (!existsSync(file)) {
    return {
      report: null,
      ms: Date.now() - started,
      reason: `vitest run ${args.join(" ")} wrote no json report (exit ${outcome.ok ? 0 : "non-zero"})`,
    }
  }
  return { report: JSON.parse(readFileSync(file, "utf8")), ms: outcome.ms, reason: null }
}

const suiteShape = (label, command, run) =>
  run.report === null
    ? { label, command, tests: null, files: null, passed: null, failed: null, durationMs: run.ms, reason: run.reason }
    : {
        label,
        command,
        tests: run.report.numTotalTests,
        files: run.report.numTotalTestSuites,
        passed: run.report.numPassedTests,
        failed: run.report.numFailedTests,
        durationMs: run.ms,
        success: run.report.success,
        reason: null,
      }

function testsGroup() {
  const unit = runSuite("unit", [])
  const browserFiles = readdirSync(join(PKG, "src")).filter((it) => it.includes(".browser.test."))
  const browser =
    browserFiles.length === 0
      ? {
          label: "browser",
          command: "vitest run --config vitest.browser.config.ts",
          tests: null,
          files: 0,
          passed: null,
          failed: null,
          durationMs: null,
          reason:
            "vitest.browser.config.ts includes src/**/*.browser.test.{ts,tsx} and no file in src/ matches, so no browser suite was run",
        }
      : suiteShape(
          "browser",
          "vitest run --config vitest.browser.config.ts",
          runSuite("browser", ["--config", "vitest.browser.config.ts", "--passWithNoTests"]),
        )
  return {
    method: "vitest run --reporter=json --outputFile=..., counts read from numTotalTests / numTotalTestSuites / numPassedTests / numFailedTests",
    unit: suiteShape("unit", "vitest run", unit),
    browser,
  }
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
  const built = join(PKG, "dist", "index.js")
  if (!existsSync(built)) {
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
    return {
      method: null,
      measured: null,
      reason: `the probe child process failed: ${String(error).split("\n")[0]}`,
    }
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

/** Called rather than regex-counted: a helper returning two epics reads as one `epic(` to a scanner.
 * The child process is what lets this synchronous script import an ES module. */
function epicsGroup() {
  const built = join(PKG, "dist", "index.js")
  if (!existsSync(built)) {
    return { method: null, count: null, reason: "dist/index.js is absent, so defaultEpics() could not be imported; run the library build first" }
  }
  let raw = null
  try {
    raw = execFileSync(process.execPath, ["--input-type=module", "-e", EPIC_PROBE], {
      cwd: PKG,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
  } catch (error) {
    return { method: null, count: null, reason: `importing defaultEpics from dist/index.js failed: ${String(error).split("\n")[0]}` }
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
  const run = timed(process.execPath, [join(PKG, "scripts", "parity.mjs")])
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
    return { method: null, file: "bench/README.md", medians: null, headToHead: null, machine: null, reason: "bench/README.md does not exist" }
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

// --- bundle -----------------------------------------------------------------

function libraryBundle() {
  const dir = join(PKG, "dist")
  const weighed = weighDir(dir)
  if (weighed === null) {
    return { ...emptyBundle(), reason: "dist/ holds no files; the library build did not run or produced nothing" }
  }
  return { ...weighed, reason: null }
}

const emptyBundle = () => ({ files: null, totalBytes: null, totalGzipBytes: null })

function siteBundles() {
  const dist = join(PKG, "site", "dist")
  const assets = weighDir(join(dist, "assets"))
  const html = existsSync(join(dist, "index.html")) ? [weigh(join(dist, "index.html"))] : []
  const demo = weighDir(join(dist, "demo", "assets"))
  const videos = weighDir(join(dist, "videos"))
  const site =
    assets === null
      ? { ...emptyBundle(), reason: "site/dist/assets does not exist; the site has not been built in this run" }
      : {
          files: [...assets.files, ...html],
          totalBytes: assets.totalBytes + html.reduce((sum, it) => sum + it.bytes, 0),
          totalGzipBytes: assets.totalGzipBytes + html.reduce((sum, it) => sum + it.gzipBytes, 0),
          reason: null,
        }
  return {
    site,
    demo: demo === null ? { ...emptyBundle(), reason: "site/dist/demo/assets does not exist; the demo has not been built in this run" } : { ...demo, reason: null },
    videos:
      videos === null
        ? { ...emptyBundle(), reason: "site/dist/videos holds no recordings; run `pnpm test:visual && pnpm videos`" }
        : { ...videos, reason: null },
  }
}

// --- assembly ---------------------------------------------------------------

const packageVersion = () => {
  const manifest = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8"))
  return { name: manifest.name, version: manifest.version }
}

const BUNDLE_METHOD = "statSync().size for raw bytes and zlib.gzipSync(readFileSync(file)).length for gzip, over the same file"
const SITE_METHOD =
  "the same statSync and gzipSync pass, run after the site build and before the rebuild that ships this file; the shipped assets differ from these figures by the bytes this table adds to stats.json"

function fullRun() {
  const startedAt = Date.now()
  const typecheck = timed("npx", ["tsc", "--noEmit"])
  const libraryBuild = timed("npx", ["vite", "build"])
  const themeSource = join(PKG, "src", "theme.css")
  if (libraryBuild.ok && existsSync(themeSource)) cpSync(themeSource, join(PKG, "dist", "theme.css"))
  const tests = testsGroup()
  const bundles = siteBundles()

  return {
    schema: 1,
    generatedBy: "packages/signal-grid/scripts/stats.mjs",
    commit: commitGroup(),
    machine: machineGroup(),
    package: packageVersion(),
    bundle: {
      method: BUNDLE_METHOD,
      library: libraryBundle(),
      siteMethod: SITE_METHOD,
      site: bundles.site,
      demo: bundles.demo,
      videos: bundles.videos,
    },
    source: sourceGroup(),
    epics: epicsGroup(),
    features: featuresGroup(),
    tests,
    timing: {
      method: "Date.now() around each execFileSync call in scripts/stats.mjs; site and demo build times are handed over by scripts/ship.mjs",
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
    bench: benchGroup(),
  }
}

// The site imports stats.json, so its own bundle size is only knowable after it is built. `ship.mjs`
// builds, calls `--bundles`, and builds again, which is why `SITE_METHOD` names the pass it measured.
function bundlesRun() {
  if (!existsSync(OUT)) throw new Error("scripts/stats.mjs --bundles needs an existing site/stats.json; run it without the flag first")
  const previous = JSON.parse(readFileSync(OUT, "utf8"))
  const bundles = siteBundles()
  const siteBuildMs = numberArg("site-build-ms")
  const demoBuildMs = numberArg("demo-build-ms")
  return {
    ...previous,
    bundle: { ...previous.bundle, siteMethod: SITE_METHOD, site: bundles.site, demo: bundles.demo, videos: bundles.videos },
    timing: {
      ...previous.timing,
      siteBuildMs: siteBuildMs ?? previous.timing.siteBuildMs,
      demoBuildMs: demoBuildMs ?? previous.timing.demoBuildMs,
    },
  }
}

const stats = bundlesOnly ? bundlesRun() : fullRun()
writeFileSync(OUT, `${JSON.stringify(stats, null, 2)}\n`)

const kb = (value) => (value === null ? "n/a" : `${(value / 1024).toFixed(1)} kB`)
console.log("")
console.log(`  stats      ${relative(PKG, OUT)}${bundlesOnly ? " (bundles refreshed)" : ""}`)
console.log(`  commit     ${stats.commit.short ?? "unknown"} ${stats.commit.clean === true ? "clean" : "DIRTY"}`)
console.log(`  library    ${kb(stats.bundle.library.totalBytes)} raw, ${kb(stats.bundle.library.totalGzipBytes)} gzip`)
console.log(`  site       ${kb(stats.bundle.site.totalBytes)} raw, ${kb(stats.bundle.site.totalGzipBytes)} gzip`)
console.log(`  demo       ${kb(stats.bundle.demo.totalBytes)} raw, ${kb(stats.bundle.demo.totalGzipBytes)} gzip`)
console.log(`  tests      ${stats.tests.unit.tests ?? "n/a"} unit in ${stats.tests.unit.durationMs ?? "n/a"} ms`)
console.log(`  epics      ${stats.epics.count ?? "n/a"} in defaultEpics()`)
console.log(`  features   ${stats.features.tracked ?? "n/a"} tracked, ${stats.features.implemented ?? "n/a"} implemented, gate ${stats.features.gate ?? "n/a"}`)
console.log(`  memory     ${stats.memory.retainedBytes === undefined ? "n/a" : kb(stats.memory.retainedBytes)} retained by a 100k-row grid`)
const nulls = []
if (stats.commit.reason !== null) nulls.push(`commit: ${stats.commit.reason}`)
if (stats.bundle.library.reason !== null) nulls.push(`bundle.library: ${stats.bundle.library.reason}`)
if (stats.bundle.site.reason !== null) nulls.push(`bundle.site: ${stats.bundle.site.reason}`)
if (stats.bundle.demo.reason !== null) nulls.push(`bundle.demo: ${stats.bundle.demo.reason}`)
if (stats.bundle.videos.reason !== null) nulls.push(`bundle.videos: ${stats.bundle.videos.reason}`)
if (stats.tests.browser.reason !== null) nulls.push(`tests.browser: ${stats.tests.browser.reason}`)
if (stats.memory.reason !== null) nulls.push(`memory: ${stats.memory.reason}`)
if (stats.bench.reason !== null) nulls.push(`bench: ${stats.bench.reason}`)
if (stats.epics.reason !== null) nulls.push(`epics: ${stats.epics.reason}`)
if (stats.features.reason !== null) nulls.push(`features: ${stats.features.reason}`)
for (const note of nulls) console.log(`  null       ${note}`)
console.log("")
