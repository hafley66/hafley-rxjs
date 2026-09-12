// The factorial scroll matrix. `bench/scroll/main.ts` is one page with every factor on its query
// string; this walks the cells, drives `window.__bench` in chromium, and writes `bench/scroll.json`
// plus the markdown `bench/README.md` carries.
//
//   node bench/scroll.mjs            build, run every block, write scroll.json and print markdown
//   node bench/scroll.mjs --block 2  one block
//   node bench/scroll.mjs --no-build reuse bench/scroll/dist
//
// Always through the queue: `node ../../scripts/browser-queue.mjs node bench/scroll.mjs`.
import { spawnSync } from "node:child_process"
import { createReadStream, existsSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
import { cpus, totalmem } from "node:os"
import { extname, join, normalize } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"

const PACKAGE = fileURLToPath(new URL(".", import.meta.url)).replace(/bench\/$/, "")
const DIST = join(PACKAGE, "bench/scroll/dist")

const argv = process.argv.slice(2)
const only = argv.includes("--block") ? Number(argv[argv.indexOf("--block") + 1]) : null
const WARM = 40
const FRAMES = 120

const BASE = { rows: 1000000, width: 1600, height: 900, cell: "heavy", extent: "uniform", overscan: 4, cv: 0 }

const at = (patch) => ({ ...BASE, ...patch })
const keyOf = (c) =>
  `rows=${c.rows}&width=${c.width}&height=${c.height}&overscan=${c.overscan}&cell=${c.cell}&extent=${c.extent}&cv=${c.cv}`

// Four blocks, each answering one question. A cell repeated across blocks runs once and is read
// twice, which is why every block is a list of configs rather than a list of runs.
const BLOCKS = [
  {
    n: 1,
    title: "Main effects, one factor off the baseline",
    ask: "which factor moves the frame at all",
    cells: [
      ["baseline", at({})],
      ["rows 1k", at({ rows: 1000 })],
      ["rows 20k", at({ rows: 20000 })],
      ["viewport 720x480", at({ width: 720, height: 480 })],
      ["viewport 2560x1440", at({ width: 2560, height: 1440 })],
      ["cell plain", at({ cell: "plain" })],
      ["overscan 0", at({ overscan: 0 })],
      ["overscan 96", at({ overscan: 96 })],
      ["content-visibility on", at({ cv: 1 })],
    ],
  },
  {
    n: 2,
    title: "Buffer size against content-visibility",
    ask: "does an oversized buffer plus content-visibility beat a small buffer",
    cells: [0, 4, 24, 96].flatMap((overscan) =>
      [0, 1].map((cv) => [`overscan ${overscan}, cv ${cv === 1 ? "on" : "off"}`, at({ overscan, cv })]),
    ),
  },
  {
    n: 3,
    title: "Viewport size against cell complexity",
    ask: "does a bigger screen cost rows or cost nodes",
    cells: [
      [720, 480],
      [1600, 900],
      [2560, 1440],
    ].flatMap(([width, height]) =>
      ["plain", "heavy"].map((cell) => [`${width}x${height}, ${cell}`, at({ width, height, cell })]),
    ),
  },
  {
    n: 4,
    // Capped at 20k because `varied` declares a height per row, and a million-key record is a
    // different measurement (allocation) wearing this factor's name.
    title: "Declared row heights against relation size",
    ask: "what a per-row height costs the write pass",
    cells: [1000, 20000].flatMap((rows) =>
      ["uniform", "varied"].flatMap((extent) =>
        ["plain", "heavy"].map((cell) => [`${rows} rows, ${extent}, ${cell}`, at({ rows, extent, cell })]),
      ),
    ),
  },
]

const blocks = only === null ? BLOCKS : BLOCKS.filter((b) => b.n === only)

if (!argv.includes("--no-build")) {
  const built = spawnSync("npx", ["vite", "build", "-c", "bench/scroll/vite.config.ts"], {
    cwd: PACKAGE,
    stdio: "inherit",
  })
  if (built.status !== 0) process.exit(built.status ?? 1)
}
if (!existsSync(join(DIST, "index.html"))) {
  console.error(`bench/scroll: no build at ${DIST}`)
  process.exit(1)
}

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".map": "application/json" }

const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent((req.url ?? "/").split("?")[0])).replace(/^(\.\.[/\\])+/, "")
  const file = join(DIST, path === "/" ? "index.html" : path)
  if (!file.startsWith(DIST) || !existsSync(file)) {
    res.writeHead(404).end("not found")
    return
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" })
  createReadStream(file).pipe(res)
})
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
const origin = `http://127.0.0.1:${server.address().port}`

const browser = await chromium.launch({ headless: true })
const results = new Map()

async function measure(cfg) {
  const key = keyOf(cfg)
  const held = results.get(key)
  if (held !== undefined) return held
  const page = await browser.newPage({ viewport: { width: cfg.width + 48, height: cfg.height + 48 } })
  try {
    await page.goto(`${origin}/index.html?${key}`, { waitUntil: "load" })
    await page.waitForSelector(".sg-row", { timeout: 30000 })
    const run = await page.evaluate(([warm, frames]) => window.__bench(warm, frames), [WARM, FRAMES])
    results.set(key, run)
    return run
  } finally {
    await page.close()
  }
}

const STAGES = ["signal-grid.base", "signal-grid.plan", "signal-grid.frame", "signal-grid.dom", "signal-grid.vars"]
const stageMs = (run, name) => run.stages.find((it) => it.stage === name)?.ms ?? 0
const n1 = (value) => value.toFixed(1)

const report = []
for (const block of blocks) {
  process.stderr.write(`block ${block.n}: ${block.title}\n`)
  const rows = []
  for (const [label, cfg] of block.cells) {
    process.stderr.write(`  ${label}\n`)
    const run = await measure(cfg)
    rows.push({ label, query: keyOf(cfg), ...run })
  }
  report.push({ ...block, rows })
}

await browser.close()
server.close()

const machine = [
  `- node ${process.version}, ${process.platform} ${process.arch}`,
  `- ${cpus().length} x ${cpus()[0]?.model ?? "unknown cpu"}`,
  `- ${(totalmem() / 1024 ** 3).toFixed(0)} GiB RAM`,
  `- chromium headless through \`scripts/browser-queue.mjs\`, ${WARM} warm-up frames then ${FRAMES} measured, 240 px per frame`,
  `- run ${new Date().toISOString().slice(0, 10)}`,
]

// Stage columns are per measured frame, not the run total: the frame budget is per frame, and a
// total only says how long the run was. `p50` sits on the vsync tick whenever the work fits, so
// the stage columns are what separates two cells that both read 8.3.
const table = (rows) => {
  const head = ["case", "p50 ms", "p95 ms", "worst ms", "slow", "rows held", "nodes", "style B", ...STAGES.map((s) => s.split(".")[1] + " ms/f")]
  const body = rows.map((r) => [
    r.label,
    n1(r.p50),
    n1(r.p95),
    n1(r.worst),
    String(r.slow),
    String(r.held),
    String(r.nodes),
    String(r.styleBytes),
    ...STAGES.map((s) => (stageMs(r, s) / Math.max(1, r.frames)).toFixed(2)),
  ])
  return [
    `| ${head.join(" | ")} |`,
    `| ${head.map(() => "---").join(" | ")} |`,
    ...body.map((line) => `| ${line.join(" | ")} |`),
  ].join("\n")
}

const markdown = [
  "## Scroll under load: the factor matrix",
  "",
  ...machine,
  "",
  `Baseline: ${BASE.rows.toLocaleString()} rows, ${BASE.width}x${BASE.height}, ${BASE.cell} cells, ${BASE.extent} heights, overscan ${BASE.overscan}, content-visibility off.`,
  "",
  ...report.flatMap((block) => [`### ${block.n}. ${block.title}`, "", `Asks: ${block.ask}.`, "", table(block.rows), ""]),
].join("\n")

writeFileSync(
  join(PACKAGE, "bench/scroll.json"),
  JSON.stringify({ warm: WARM, frames: FRAMES, base: BASE, machine, blocks: report }, null, 2) + "\n",
)
process.stdout.write(markdown + "\n")
