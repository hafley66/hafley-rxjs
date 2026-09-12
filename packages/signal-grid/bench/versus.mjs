// The head-to-head. Three engines over the same rows, the same cells, the same warmup, the same
// frame count and velocity, in one chromium with one set of flags and one CDP metric read.
//
// @comment-ok: this is the contract that makes the table comparable, and a reader has to be able
// to check it here rather than take the numbers on faith.
// - Every engine page exports `window.__bench(warm, frames)` from `bench/scroll/1_run.ts`, so the
//   measurement code below never branches on which engine it is driving.
// - Every engine page exports `window.__firstRow`, milliseconds from navigation start.
// - `src=array` for every cell, so no engine is measured against a lazier relation than another.
//
//   node bench/versus.mjs              build, run, write versus.json and versus.svg
//   node bench/versus.mjs --no-build   reuse bench/scroll/dist
//   node bench/versus.mjs --no-ceiling skip the row-count ceiling probe
//
// Always through the queue: `node ../../scripts/browser-queue.mjs node bench/versus.mjs`.
import { spawnSync } from "node:child_process"
import { existsSync, writeFileSync } from "node:fs"
import { cpus, totalmem } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"
import { METRICS, metricsOf, serveDist } from "./_serve.mjs"

const PACKAGE = fileURLToPath(new URL(".", import.meta.url)).replace(/bench\/$/, "")
const DIST = join(PACKAGE, "bench/scroll/dist")

const argv = process.argv.slice(2)
const WARM = 40
const FRAMES = 120
const ROW_PX = 36

const ENGINES = [
  { id: "signal-grid", page: "index.html", row: ".sg-row", scroll: ".sg-scroll" },
  { id: "signal-grid + reactSlot", page: "react.html", row: ".sg-row", scroll: ".sg-scroll" },
  { id: "MUI X 9.13.0", page: "mui.html", row: ".MuiDataGrid-row", scroll: ".MuiDataGrid-virtualScroller" },
]

const BASE = { rows: 100000, width: 1600, height: 900, cell: "heavy", extent: "uniform", overscan: 4, cv: 0, resize: 0, src: "array" }
const at = (patch) => ({ ...BASE, ...patch })
const keyOf = (c) =>
  `rows=${c.rows}&width=${c.width}&height=${c.height}&overscan=${c.overscan}` +
  `&cell=${c.cell}&extent=${c.extent}&cv=${c.cv}&resize=${c.resize}&src=${c.src}`

// Three axes crossed against the baseline: relation size, cell weight, viewport box. Plus a buffer
// cell, and a 101-row cell that gives every engine the scroll depth MUI X's MIT page cap allows.
const CELLS = [
  ["101 rows, heavy, 1600x900", at({ rows: 101 })],
  ["1k rows, heavy, 1600x900", at({ rows: 1000 })],
  ["100k rows, heavy, 1600x900", at({})],
  ["100k rows, plain, 1600x900", at({ cell: "plain" })],
  ["100k rows, heavy, 720x480", at({ width: 720, height: 480 })],
  ["100k rows, plain, 720x480", at({ width: 720, height: 480, cell: "plain" })],
  ["100k rows, heavy, 2560x1440", at({ width: 2560, height: 1440 })],
  ["100k rows, plain, 2560x1440", at({ width: 2560, height: 1440, cell: "plain" })],
  ["100k rows, heavy, overscan 32", at({ overscan: 32 })],
]

const CEILING = [100000, 250000, 500000, 1000000]

if (!argv.includes("--no-build")) {
  const built = spawnSync("npx", ["vite", "build", "-c", "bench/scroll/vite.config.ts"], { cwd: PACKAGE, stdio: "inherit" })
  if (built.status !== 0) process.exit(built.status ?? 1)
}
if (!existsSync(join(DIST, "mui.html"))) {
  console.error(`bench/versus: no build at ${DIST}`)
  process.exit(1)
}

const server = await serveDist(DIST)
const browser = await chromium.launch({ headless: true, args: ["--enable-precise-memory-info"] })

async function measure(engine, cfg) {
  const key = keyOf(cfg)
  const page = await browser.newPage({ viewport: { width: cfg.width + 48, height: cfg.height + 80 } })
  try {
    await page.goto(`${server.origin}/${engine.page}?${key}`, { waitUntil: "load" })
    await page.waitForSelector(engine.row, { timeout: 60000 })
    const firstRowMs = await page.evaluate(() => window.__firstRow)
    const depth = await page.evaluate((sel) => {
      const node = document.querySelector(sel)
      return node === null ? 0 : node.scrollHeight
    }, engine.scroll)
    const cdp = await page.context().newCDPSession(page)
    await cdp.send("Performance.enable")
    await cdp.send("HeapProfiler.enable")
    await page.evaluate((warm) => window.__bench(0, warm), WARM)
    const before = await metricsOf(cdp)
    const run = await page.evaluate((frames) => window.__bench(0, frames), FRAMES)
    const after = await metricsOf(cdp)
    const delta = {}
    for (const name of METRICS) delta[name] = (after[name] ?? 0) - (before[name] ?? 0)
    const per = (name) => (delta[name] * 1000) / Math.max(1, run.frames)
    return {
      ok: true,
      ...run,
      firstRowMs,
      scrollPx: depth,
      scrollRows: Math.round(depth / ROW_PX),
      heapMb: after.JSHeapUsedSize / 1024 ** 2,
      heapDeltaKb: delta.JSHeapUsedSize / 1024,
      domNodes: after.Nodes,
      layoutMs: per("LayoutDuration"),
      styleMs: per("RecalcStyleDuration"),
      scriptMs: per("ScriptDuration"),
      taskMs: per("TaskDuration"),
      delta,
    }
  } catch (error) {
    return { ok: false, error: String(error).split("\n")[0] }
  } finally {
    await page.close().catch(() => {})
  }
}

/** How many rows the `rows` prop can carry before the page stops reaching a first row. Separate
 * from how many the engine will then scroll through, which the `scroll rows` column reports. */
async function ceiling(engine) {
  const reached = []
  for (const rows of CEILING) {
    const cfg = at({ rows, cell: "plain" })
    const page = await browser.newPage({ viewport: { width: 1648, height: 980 } })
    const started = Date.now()
    try {
      await page.goto(`${server.origin}/${engine.page}?${keyOf(cfg)}`, { waitUntil: "load", timeout: 120000 })
      await page.waitForSelector(engine.row, { timeout: 120000 })
      const cdp = await page.context().newCDPSession(page)
      await cdp.send("Performance.enable")
      await cdp.send("HeapProfiler.enable")
      const metrics = await metricsOf(cdp)
      reached.push({ rows, ok: true, ms: Date.now() - started, heapMb: metrics.JSHeapUsedSize / 1024 ** 2 })
    } catch (error) {
      reached.push({ rows, ok: false, ms: Date.now() - started, error: String(error).split("\n")[0] })
      await page.close().catch(() => {})
      break
    }
    await page.close().catch(() => {})
  }
  return reached
}

const runs = []
for (const [label, cfg] of CELLS) {
  process.stderr.write(`${label}\n`)
  for (const engine of ENGINES) {
    process.stderr.write(`  ${engine.id}\n`)
    runs.push({ label, engine: engine.id, query: keyOf(cfg), ...(await measure(engine, cfg)) })
  }
}

const ceilings = []
if (!argv.includes("--no-ceiling")) {
  for (const engine of ENGINES) {
    process.stderr.write(`ceiling: ${engine.id}\n`)
    ceilings.push({ engine: engine.id, tried: await ceiling(engine) })
  }
}

await browser.close()
server.close()

const machine = [
  `- node ${process.version}, ${process.platform} ${process.arch}`,
  `- ${cpus().length} x ${cpus()[0]?.model ?? "unknown cpu"}`,
  `- ${(totalmem() / 1024 ** 3).toFixed(0)} GiB RAM`,
  `- one chromium, headless, \`--enable-precise-memory-info\`, through \`scripts/browser-queue.mjs\``,
  `- ${WARM} warm-up frames as their own burst, then ${FRAMES} measured at 240 px per frame`,
  `- run ${new Date().toISOString().slice(0, 10)}`,
]

const n1 = (v) => (typeof v === "number" ? v.toFixed(1) : "-")
const n2 = (v) => (typeof v === "number" ? v.toFixed(2) : "-")

const HEAD = [
  "case", "engine", "p50 ms", "p95 ms", "worst ms", "slow", "rows held", "scroll rows",
  "nodes", "settled nodes", "layout ms/f", "style ms/f", "script ms/f", "heap MB", "first row ms",
]

const line = (r) =>
  r.ok
    ? [r.label, r.engine, n1(r.p50), n1(r.p95), n1(r.worst), String(r.slow), String(r.held), String(r.scrollRows), String(r.nodes), String(r.domNodes), n2(r.layoutMs), n2(r.styleMs), n2(r.scriptMs), n1(r.heapMb), n1(r.firstRowMs)]
    : [r.label, r.engine, ...Array.from({ length: HEAD.length - 2 }, () => "failed")]

const table = [
  `| ${HEAD.join(" | ")} |`,
  `| ${HEAD.map(() => "---").join(" | ")} |`,
  ...runs.map((r) => `| ${line(r).join(" | ")} |`),
].join("\n")

const ceilingTable = [
  "| engine | rows | reached | mount ms | heap MB |",
  "| --- | --- | --- | --- | --- |",
  ...ceilings.flatMap((c) => c.tried.map((t) => `| ${c.engine} | ${t.rows.toLocaleString()} | ${t.ok ? "yes" : "no"} | ${t.ms} | ${n1(t.heapMb)} |`)),
].join("\n")

const markdown = [
  "## Head to head: signal-grid against MUI X Data Grid 9.13.0",
  "",
  ...machine,
  "",
  table,
  "",
  "`nodes` is counted on the last measured frame; `settled nodes` is the CDP node count taken after",
  "the burst, so the gap between them is content that committed outside the scroll frame.",
  "",
  "### Row-count ceiling, plain cells",
  "",
  ceilingTable,
  "",
].join("\n")

const report = { warm: WARM, frames: FRAMES, base: BASE, engines: ENGINES.map((e) => e.id), machine, runs, ceilings }
writeFileSync(join(PACKAGE, "bench/versus.json"), JSON.stringify(report, null, 2) + "\n")
const { versusChart } = await import("./chart.mjs")
writeFileSync(join(PACKAGE, "bench/versus.svg"), versusChart(report))
process.stdout.write(markdown + "\n")
