// @comment-ok: every group states the command its numbers came from, because a figure with no named source is the drift this whole file exists to stop
// Every number a site prints about itself that is not about what the package does. Each field names
// the command it came from in a sibling `method`, and a missing source yields `null` plus a `reason`.
//
// A package adds its own groups beside these: a memory probe that knows what to construct, a
// feature ledger, a benchmark table. Those know the library; nothing here does.
import { execFileSync, spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs"
import { cpus, totalmem } from "node:os"
import { join, relative } from "node:path"
import { gzipSync } from "node:zlib"

export const BUNDLE_METHOD =
  "statSync().size summed for raw bytes and zlib.gzipSync(readFileSync(file)).length summed for gzip, over every file in the directory; totals and a file count only, because a per-file listing of a build output answers nothing"

export const SITE_METHOD =
  "the same statSync and gzipSync pass, run after the site build and before the rebuild that ships this file; the shipped assets differ from these figures by the bytes this table adds to stats.json"

export const SIZE_LIMIT_METHOD =
  "npx size-limit --json, read as json rather than parsed out of its human output; @size-limit/preset-small-lib bundles each entry with esbuild and gzips it, @size-limit/time replays it on a throttled connection and in headless chrome"

const emptyBundle = () => ({ fileCount: null, totalBytes: null, totalGzipBytes: null })

/** Line count is `\n` occurrences plus one when the file does not end in a newline. */
function lineCount(text) {
  if (text === "") return 0
  let count = 0
  for (let index = 0; index < text.length; index++) {
    if (text[index] === "\n") count++
  }
  return text.endsWith("\n") ? count : count + 1
}

// Options: pkg (absolute package root), repo ("owner/name"), generated (repo-relative paths this
// step writes, excluded from the dirty-tree read), treemapFlag (the env var name, or null).
export function createMeasure(options) {
  const PKG = options.pkg
  const REPO = options.repo
  const GENERATED = options.generated ?? []

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

  /** Raw and gzip bytes of one file. gzip runs over the same buffer `statSync` sized. */
  const weigh = (path) => {
    const raw = readFileSync(path)
    return { bytes: statSync(path).size, gzipBytes: gzipSync(raw).length }
  }

  /** Totals and a file count over a directory tree, or `null` when it holds nothing. */
  const weighDir = (dir) => {
    if (!existsSync(dir)) return null
    const entries = readdirSync(dir, { recursive: true })
      .map((it) => join(dir, String(it)))
      .filter((it) => statSync(it).isFile())
    if (entries.length === 0) return null
    const weighed = entries.map(weigh)
    return {
      fileCount: weighed.length,
      totalBytes: weighed.reduce((sum, it) => sum + it.bytes, 0),
      totalGzipBytes: weighed.reduce((sum, it) => sum + it.gzipBytes, 0),
    }
  }

  function commitGroup() {
    const long = capture("git", ["rev-parse", "HEAD"])
    // The build writes these, so measuring before writing them still reports the tree dirty on a
    // clean checkout. Excluding them is the only way the answer is about the source.
    const porcelain = capture("git", ["status", "--porcelain"])
    const dirty =
      porcelain === null
        ? null
        : porcelain
            .split("\n")
            .filter((it) => it.trim() !== "")
            .filter((it) => !GENERATED.some((name) => it.endsWith(name)))
    return {
      method:
        "git rev-parse HEAD / --short HEAD, git log -1 --format=%s %aI, git status --porcelain excluding this step's own outputs, git rev-parse --abbrev-ref HEAD",
      hash: long,
      short: capture("git", ["rev-parse", "--short", "HEAD"]),
      subject: capture("git", ["log", "-1", "--format=%s"]),
      authorDate: capture("git", ["log", "-1", "--format=%aI"]),
      branch: capture("git", ["rev-parse", "--abbrev-ref", "HEAD"]),
      clean: dirty === null ? null : dirty.length === 0,
      dirtyCount: dirty === null ? null : dirty.length,
      dirtyEntries: dirty === null ? null : dirty.slice(0, 20),
      repository: REPO,
      url: long === null ? null : `https://github.com/${REPO}/commit/${long}`,
      reason: long === null ? `git rev-parse HEAD exited non-zero; no repository at ${relative(PKG, PKG) || PKG}` : null,
    }
  }

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
      method:
        "readFileSync over src/*.{ts,css}, lines counted as \\n occurrences; a name containing .test. is a test file",
      files,
      sourceFiles: of("source").length,
      sourceLines: of("source").reduce((sum, it) => sum + it.lines, 0),
      testFiles: of("test").length,
      testLines: of("test").reduce((sum, it) => sum + it.lines, 0),
    }
  }

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

  // Options: browserConfig (the vitest config path), browserMatch (the filename fragment whose
  // absence means there is no browser suite to run).
  function testsGroup(suites = {}) {
    const unit = runSuite("unit", [])
    const config = suites.browserConfig ?? "vitest.browser.config.ts"
    const match = suites.browserMatch ?? ".browser.test."
    const command = `vitest run --config ${config}`
    const present = existsSync(join(PKG, "src")) && readdirSync(join(PKG, "src")).some((it) => it.includes(match))
    const browser = !present
      ? {
          label: "browser",
          command,
          tests: null,
          files: 0,
          passed: null,
          failed: null,
          durationMs: null,
          reason: `${config} includes files matching ${match} and no file in src/ matches, so no browser suite was run`,
        }
      : suiteShape("browser", command, runSuite("browser", ["--config", config, "--passWithNoTests"]))
    return {
      method:
        "vitest run --reporter=json --outputFile=..., counts read from numTotalTests / numTotalTestSuites / numPassedTests / numFailedTests",
      unit: suiteShape("unit", "vitest run", unit),
      browser,
    }
  }

  /** Runs the example check, which samples `JSHeapUsedSize` over CDP around every mount, and reads
   * the file it writes. The gate lives in that script; this reads its numbers. */
  function demoMemoryGroup(script) {
    const file = join(PKG, "out", "examples-memory.json")
    const run = timed(process.execPath, [join(PKG, script), `--memory-json=${relative(PKG, file)}`])
    if (!existsSync(file)) {
      return {
        method: null,
        command: `node ${script}`,
        samples: null,
        leakBytes: null,
        examples: null,
        retaining: null,
        durationMs: run.ms,
        reason: `node ${script} wrote no out/examples-memory.json; the browser pass did not finish`,
      }
    }
    const parsed = JSON.parse(readFileSync(file, "utf8"))
    const examples = parsed.examples.filter((it) => it.reason === null || it.reason === undefined)
    const retaining = examples.filter((it) => it.leaks === true).map((it) => it.id)
    return {
      method: parsed.method,
      command: `node ${script}`,
      samples: parsed.samples,
      leakBytes: parsed.leakBytes,
      measuredAt: parsed.measuredAt,
      examples,
      retaining,
      durationMs: run.ms,
      reason:
        retaining.length === 0 ? null : `${retaining.length} example(s) hold heap after teardown: ${retaining.join(", ")}`,
    }
  }

  /** stdout of a command expected to exit non-zero when a gate fails, so the payload survives. */
  function captureEvenOnFailure(command, args) {
    const run = spawnSync(command, args, { cwd: PKG, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
    return { stdout: run.stdout ?? "", status: run.status, error: run.error }
  }

  function sizeLimitGroup() {
    const config = join(PKG, ".size-limit.json")
    const blank = { method: null, config: ".size-limit.json", entries: null, passed: null, durationMs: null }
    if (!existsSync(config)) {
      return { ...blank, reason: ".size-limit.json is absent, so there are no budgets to run" }
    }
    const started = Date.now()
    const run = captureEvenOnFailure("npx", ["size-limit", "--json"])
    const durationMs = Date.now() - started
    // The spinner writes to stderr but the runner is free to prefix stdout, so the payload starts at
    // the first bracket rather than at byte zero.
    const opened = run.stdout.indexOf("[")
    if (opened === -1) {
      return { ...blank, durationMs, reason: `npx size-limit --json printed no json array (exit ${run.status ?? "none"})` }
    }
    let parsed = null
    try {
      parsed = JSON.parse(run.stdout.slice(opened))
    } catch (error) {
      return { ...blank, durationMs, reason: `npx size-limit --json printed unparseable json: ${String(error).split("\n")[0]}` }
    }
    const entries = parsed.map((it) => ({
      name: it.name,
      sizeBytes: it.size ?? null,
      limitBytes: it.sizeLimit ?? null,
      headroomBytes: it.size === undefined || it.sizeLimit === undefined ? null : it.sizeLimit - it.size,
      passed: it.passed === true,
      loadingMs: it.loading === undefined ? null : Math.round(it.loading * 1000),
      runningMs: it.running === undefined ? null : Math.round(it.running * 1000),
    }))
    const failed = entries.filter((it) => !it.passed)
    return {
      method: SIZE_LIMIT_METHOD,
      config: ".size-limit.json",
      entries,
      passed: failed.length === 0,
      durationMs,
      reason: failed.length === 0 ? null : `${failed.length} entr(y|ies) over budget: ${failed.map((it) => it.name).join(", ")}`,
    }
  }

  const treemapGroup = (treemap) => {
    const file = join(PKG, "out", "treemap.html")
    const present = existsSync(file)
    return {
      method: treemap.method,
      envFlag: treemap.envFlag,
      command: treemap.command,
      file: "out/treemap.html",
      bytes: present ? statSync(file).size : null,
      reason: present ? null : `out/treemap.html is absent; the last build ran without ${treemap.envFlag}`,
    }
  }

  function libraryBundle() {
    const weighed = weighDir(join(PKG, "dist"))
    if (weighed === null) {
      return { ...emptyBundle(), reason: "dist/ holds no files; the library build did not run or produced nothing" }
    }
    return { ...weighed, reason: null }
  }

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
            fileCount: assets.fileCount + html.length,
            totalBytes: assets.totalBytes + html.reduce((sum, it) => sum + it.bytes, 0),
            totalGzipBytes: assets.totalGzipBytes + html.reduce((sum, it) => sum + it.gzipBytes, 0),
            reason: null,
          }
    return {
      site,
      demo:
        demo === null
          ? { ...emptyBundle(), reason: "site/dist/demo/assets does not exist; the demo has not been built in this run" }
          : { ...demo, reason: null },
      videos:
        videos === null
          ? { ...emptyBundle(), reason: "site/dist/videos holds no recordings" }
          : { ...videos, reason: null },
    }
  }

  const packageVersion = () => {
    const manifest = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8"))
    return { name: manifest.name, version: manifest.version }
  }

  return {
    capture,
    timed,
    weigh,
    weighDir,
    commitGroup,
    machineGroup,
    sourceGroup,
    testsGroup,
    demoMemoryGroup,
    sizeLimitGroup,
    treemapGroup,
    libraryBundle,
    siteBundles,
    packageVersion,
  }
}

const kb = (value) => (value === null || value === undefined ? "n/a" : `${(value / 1024).toFixed(1)} kB`)

/** The lines every package prints after writing its stats, plus whatever `extra` adds. */
export function reportStats(stats, out, pkg, { bundlesOnly = false, extra = [], nulls = [] } = {}) {
  console.log("")
  console.log(`  stats      ${relative(pkg, out)}${bundlesOnly ? " (bundles refreshed)" : ""}`)
  console.log(`  commit     ${stats.commit.short ?? "unknown"} ${stats.commit.clean === true ? "clean" : "DIRTY"}`)
  console.log(`  library    ${kb(stats.bundle.library.totalBytes)} raw, ${kb(stats.bundle.library.totalGzipBytes)} gzip`)
  for (const entry of stats.sizeLimit.entries ?? []) {
    console.log(`  size-limit ${entry.passed ? "pass" : "OVER"} ${kb(entry.sizeBytes)} of ${kb(entry.limitBytes)}  ${entry.name}`)
  }
  console.log(`  site       ${kb(stats.bundle.site.totalBytes)} raw, ${kb(stats.bundle.site.totalGzipBytes)} gzip`)
  console.log(`  demo       ${kb(stats.bundle.demo.totalBytes)} raw, ${kb(stats.bundle.demo.totalGzipBytes)} gzip`)
  console.log(`  tests      ${stats.tests.unit.tests ?? "n/a"} unit in ${stats.tests.unit.durationMs ?? "n/a"} ms`)
  for (const line of extra) console.log(line)
  console.log(
    `  demos      ${stats.demoMemory.examples === null ? "n/a" : `${stats.demoMemory.examples.length} sampled, ${stats.demoMemory.retaining.length} retaining over ${kb(stats.demoMemory.leakBytes)}`}`,
  )
  const found = [
    stats.commit.reason === null ? null : `commit: ${stats.commit.reason}`,
    stats.bundle.library.reason === null ? null : `bundle.library: ${stats.bundle.library.reason}`,
    stats.bundle.site.reason === null ? null : `bundle.site: ${stats.bundle.site.reason}`,
    stats.bundle.demo.reason === null ? null : `bundle.demo: ${stats.bundle.demo.reason}`,
    stats.bundle.videos.reason === null ? null : `bundle.videos: ${stats.bundle.videos.reason}`,
    stats.bundle.treemap.reason === null ? null : `bundle.treemap: ${stats.bundle.treemap.reason}`,
    stats.sizeLimit.reason === null ? null : `sizeLimit: ${stats.sizeLimit.reason}`,
    stats.tests.browser.reason === null ? null : `tests.browser: ${stats.tests.browser.reason}`,
    stats.demoMemory.reason === null ? null : `demoMemory: ${stats.demoMemory.reason}`,
    ...nulls,
  ].filter((it) => it !== null && it !== undefined)
  for (const note of found) console.log(`  null       ${note}`)
  console.log("")
}
