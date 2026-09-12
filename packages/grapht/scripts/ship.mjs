// One press: build the site, fold the proof app in, measure, rebuild with the real stats, and print
// what a reviewer should open. There is no docs:render stage for grapht; the pages/ sources are
// authored markdown, so `pnpm site:build` is the whole document build.
import { execFileSync } from "node:child_process"
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import os from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { gzipSync } from "node:zlib"

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const OUT = join(PKG, "site", "dist")
const PROOF_PKG = join(PKG, "adapters", "2_render_cytoscape")
const PROOF_DIR = join(PROOF_PKG, "proof")
const ARCH_SVG = join(PROOF_DIR, "arch.svg")
const steps = []

const run = (label, command, args, cwd = PKG) => {
  const started = Date.now()
  try {
    execFileSync(command, args, { cwd, stdio: "inherit" })
    steps.push({ label, ok: true, ms: Date.now() - started })
    return Date.now() - started
  } catch {
    steps.push({ label, ok: false, ms: Date.now() - started })
    throw new Error(`ship: ${label} failed`)
  }
}

const bytes = (path) => (existsSync(path) ? statSync(path).size : 0)
const kb = (value) => `${(value / 1024).toFixed(1)} kB`

// One source for the public path: `site/content.ts`, which VitePress reads for its own `base`. A
// ship that guessed it would put the proof under a prefix the site does not link to.
const configSource = readFileSync(join(PKG, "site", "content.ts"), "utf8")
const baseMatch = /export const BASE = "([^"]+)"/.exec(configSource)
if (baseMatch === null) throw new Error("ship: site/content.ts no longer exports a BASE string literal")
const BASE = baseMatch[1]
if (!BASE.startsWith("/") || !BASE.endsWith("/")) throw new Error(`ship: BASE must start and end with "/", found ${BASE}`)

const contentSource = readFileSync(join(PKG, "site", "content.ts"), "utf8")
const SLUGS = [...contentSource.matchAll(/slug:\s*"([^"]+)"/g)].map((match) => match[1] ?? "")
if (SLUGS.length === 0) throw new Error("ship: site/content.ts declares no page slugs")

// The proof app fetches `./arch.svg` at runtime, which vite does not emit. It is a gitignored d2
// output, so regenerate it when absent and copy it into the built tree after the proof build.
function ensureArchSvg() {
  if (existsSync(ARCH_SVG)) return
  run("arch.svg", "pnpm", ["run", "proof:svg"], PROOF_PKG)
}

// The build emits `index.html` and `assets/`. GitHub Pages has no rewrite rule, so a deep link only
// resolves when a real file sits at it; one copy of the shell per slug does that.
function deepLinkShells() {
  const shell = readFileSync(join(OUT, "index.html"), "utf8")
  for (const slug of SLUGS) {
    if (existsSync(join(OUT, slug, "index.html"))) continue
    mkdirSync(join(OUT, slug), { recursive: true })
    writeFileSync(join(OUT, slug, "index.html"), shell)
  }
  writeFileSync(join(OUT, "404.html"), shell)
  steps.push({ label: "deep links", ok: true, ms: 0 })
}

const walk = (dir) =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))

const measureBundle = (dir) => {
  if (!existsSync(dir)) return { fileCount: 0, totalBytes: 0, totalGzipBytes: 0 }
  const files = walk(dir)
  const totalBytes = files.reduce((sum, file) => sum + bytes(file), 0)
  const totalGzipBytes = files.reduce((sum, file) => sum + gzipSync(readFileSync(file)).length, 0)
  return { fileCount: files.length, totalBytes, totalGzipBytes }
}

const lineCount = (file) => readFileSync(file, "utf8").split("\n").length - 1

function sourceStats() {
  const files = []
  for (const dir of [join(PKG, "src"), join(PKG, "tests")]) {
    if (!existsSync(dir)) continue
    for (const file of walk(dir)) {
      if (!file.endsWith(".ts")) continue
      const isTest = file.includes(".test.") || file.includes("/tests/")
      files.push({ file: file.slice(PKG.length + 1), lines: lineCount(file), kind: isTest ? "test" : "source" })
    }
  }
  const source = files.filter((it) => it.kind === "source")
  const test = files.filter((it) => it.kind === "test")
  return {
    method:
      "readFileSync over packages/grapht/src and packages/grapht/tests, lines counted as \\n occurrences; a name containing .test. or under tests/ is a test file",
    files,
    sourceFiles: source.length,
    sourceLines: source.reduce((sum, it) => sum + it.lines, 0),
    testFiles: test.length,
    testLines: test.reduce((sum, it) => sum + it.lines, 0),
  }
}

function commitStats() {
  const git = (args) => execFileSync("git", args, { cwd: PKG, encoding: "utf8" }).trim()
  const hash = git(["rev-parse", "HEAD"])
  const porcelain = git(["status", "--porcelain"])
  // Exclude the outputs this ship regenerates so a clean tree stays clean after a run.
  const dirty = porcelain
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.includes("packages/grapht/site/stats.json") && !line.includes("packages/grapht/site/dist"))
  return {
    method: "git rev-parse HEAD / --short HEAD, git log -1 --format=%s %aI, git status --porcelain excluding this step's own outputs, git rev-parse --abbrev-ref HEAD",
    hash,
    short: hash.slice(0, 7),
    subject: git(["log", "-1", "--format=%s"]),
    authorDate: git(["log", "-1", "--format=%aI"]),
    branch: git(["rev-parse", "--abbrev-ref", "HEAD"]),
    clean: dirty.length === 0,
    dirtyCount: dirty.length,
    dirtyEntries: dirty,
    repository: "hafley66/hafley-rxjs",
    url: `https://github.com/hafley66/hafley-rxjs/commit/${hash}`,
    reason: null,
  }
}

const pkg = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8"))

ensureArchSvg()

// Pass 1 carries the committed placeholder stats; the shipped numbers are only knowable after a
// build, so the site is measured once, the real stats written, and the site rebuilt.
const siteMs = run("site (pass 1)", "pnpm", ["site:build"])

const commit = commitStats()
const machine = {
  method: "os.type() / os.release(), process.version, node:os cpus() and totalmem(), Date at run time",
  node: process.version,
  platform: `${os.type()} ${os.release()}`,
  arch: os.arch(),
  cpuModel: os.cpus()[0]?.model ?? null,
  cores: os.cpus().length,
  totalMemoryBytes: os.totalmem(),
  builtAt: new Date().toISOString(),
}

const siteBundle = measureBundle(OUT)
const libraryBundle = measureBundle(join(PKG, "dist"))
const demoBundle = measureBundle(join(OUT, "proof"))
const source = sourceStats()
const statsMs = Date.now()

const stats = {
  schema: 1,
  generatedBy: "grapht/site",
  commit,
  machine,
  package: { name: pkg.name, version: pkg.version },
  bundle: {
    method: "statSync().size summed for raw bytes and zlib.gzipSync(readFileSync(file)).length summed for gzip, over every file in the directory",
    library: { ...libraryBundle, reason: null },
    siteMethod: "the same statSync and gzipSync pass over site/dist, measured on the pass-1 build",
    site: { ...siteBundle, reason: null },
    demo: { ...demoBundle, reason: null },
    videos: { fileCount: 0, totalBytes: 0, totalGzipBytes: 0, reason: "no recordings; the proof is a live app, not a filmed suite" },
    treemap: {
      method: "none",
      envFlag: "",
      command: "",
      file: "",
      bytes: null,
      reason: "no treemap generated for grapht",
    },
  },
  sizeLimit: {
    method: null,
    config: ".size-limit.json",
    entries: null,
    passed: null,
    durationMs: null,
    reason: "no size-limit gate for grapht",
  },
  source,
  tests: {
    method: "not run by ship; `pnpm test` covers the library",
    unit: { label: "unit", command: "pnpm test", tests: null, files: 0, passed: null, failed: null, durationMs: null, reason: "not measured by ship" },
    browser: { label: "browser", command: "", tests: null, files: 0, passed: null, failed: null, durationMs: null, reason: "no browser suite for grapht" },
  },
  timing: {
    method: "Date.now() around each execFileSync call in scripts/ship.mjs",
    typecheckMs: null,
    typecheckReason: "not measured by ship",
    libraryBuildMs: null,
    libraryBuildReason: "not measured by ship",
    unitTestsMs: null,
    browserTestsMs: null,
    siteBuildMs: siteMs,
    demoBuildMs: null,
    statsMs,
  },
  demoMemory: {
    method: null,
    command: "",
    samples: null,
    leakBytes: null,
    examples: null,
    retaining: null,
    durationMs: null,
    reason: "no browser heap pass for grapht",
  },
}

writeFileSync(join(PKG, "site", "stats.json"), `${JSON.stringify(stats, null, 2)}\n`)
steps.push({ label: "measure + stats", ok: true, ms: 0 })

// Pass 2 ships the real stats. The proof is built after it, because a pass-2 build empties dist.
run("site (pass 2)", "pnpm", ["site:build"])
deepLinkShells()

run("proof build", "npx", [
  "vite",
  "build",
  "-c",
  join(PROOF_PKG, "proof", "vite.config.ts"),
  "--base",
  `${BASE}proof/`,
  "--outDir",
  join(OUT, "proof"),
  "--emptyOutDir",
])
cpSync(ARCH_SVG, join(OUT, "proof", "arch.svg"))

const entries = walk(OUT)
const total = entries.reduce((sum, file) => sum + bytes(file), 0)
const largest = [...entries]
  .map((file) => ({ file, size: bytes(file) }))
  .sort((a, b) => b.size - a.size)
  .slice(0, 3)
  .map((it) => `${kb(it.size)} ${it.file.slice(OUT.length + 1)}`)

// The artifact invariant: the page shells and the proof app, with the proof's runtime SVG beside it.
for (const required of ["index.html", "proof/index.html", "proof/arch.svg"]) {
  if (!existsSync(join(OUT, required))) throw new Error(`ship: site/dist/${required} missing after build`)
}
const indexHtml = readFileSync(join(OUT, "index.html"), "utf8")
if (!indexHtml.includes("/hafley-rxjs/grapht/assets/")) {
  throw new Error("ship: site/dist/index.html does not reference the project base; check site/content.ts BASE")
}

console.log("")
for (const step of steps) console.log(`  ${step.ok ? "ok  " : "FAIL"} ${step.label.padEnd(18)} ${step.ms} ms`)
console.log("")
console.log(`  site/dist  ${kb(total)} across ${entries.length} entries`)
console.log(`  base       ${BASE}`)
console.log(`  pages      ${SLUGS.map((slug) => `${BASE}${slug}`).join("\n             ")}`)
console.log(`  proof      ${BASE}proof/index.html`)
console.log(`  largest    ${largest.join(", ")}`)
console.log("")
console.log("  open       the published site at https://hafley66.github.io/hafley-rxjs/grapht/")
console.log("  open       the proof in a frame at the `proof` page, or standalone:")
console.log(`  open       npx vite preview -c site/vite.config.ts (serves ${BASE})`)
