// Mounts every example in a real chromium and fails the run when one throws, leaves a subscription
// or a listener behind after teardown, or carries an empty `source`.
//
// Playwright rather than a headless DOM, because the examples read `?raw` and `*.css` imports that
// only a bundler resolves, and because the render plan is a function of a measured viewport: a
// stubbed DOM would report a zero-height scroll box and every example would window nothing. Both
// vite and playwright are already devDependencies, so nothing is added to run this.
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"
import { createServer } from "vite"

const root = fileURLToPath(new URL("..", import.meta.url))
const ENTRY = "/examples/_check/index.html"

const argv = process.argv.slice(2)
const flag = (name, fallback) => {
  const found = argv.find((it) => it.startsWith(`--${name}=`))
  return found === undefined ? fallback : found.slice(name.length + 3)
}

const REPEATS = Math.max(1, Number(flag("repeat", "3")))
const MEMORY_OUT = resolve(root, flag("memory-json", "out/examples-memory.json"))
const SKIP_MEMORY = argv.includes("--no-memory")

// Peak is the largest of these samples rather than one reading: an example that allocates on a timer
// has not reached its high-water mark at the frame its first row paints.
const PEAK_SAMPLES = 3
const PEAK_INTERVAL_MS = 50

/** Above this, a retained figure is reported as a leak with the example's name on it. */
const LEAK_BYTES = 512 * 1024

const HEAP_METHOD =
  `Playwright over CDP: HeapProfiler.enable, then per example per repeat, HeapProfiler.collectGarbage, Performance.getMetrics JSHeapUsedSize as the baseline, mount, ${PEAK_SAMPLES} samples ${PEAK_INTERVAL_MS} ms apart taking the largest as the peak, teardown, two collectGarbage calls, one more JSHeapUsedSize as retained. Every example is mounted and torn down twice by the leak pass before any of this runs, so a page-lifetime allocation is already made. ${REPEATS} repeats per example, reported as the median with the spread across those repeats beside it. An example retaining more than ${LEAK_BYTES} bytes over its own baseline is named as a leak. Two limits on how far a peak can be trusted: a peak near 0.5 MB is the measurement floor, and an example whose rows are built at module scope has a peak that depends on what the previous example left allocated, which is why virtualization-50k moves by more than 100 per cent between runs while the four stress examples, which build their rows inside mount, repeat to within 1 per cent.`

const pad = (text, width) => String(text).padEnd(width)

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle] : Math.round(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2)
}

const spread = (values) => Math.max(...values) - Math.min(...values)

const wait = (ms) => new Promise((done) => setTimeout(done, ms))

async function heapBytes(client) {
  const metrics = await client.send("Performance.getMetrics")
  return metrics.metrics.find((it) => it.name === "JSHeapUsedSize")?.value ?? null
}

async function settle(client) {
  await client.send("HeapProfiler.collectGarbage")
  await wait(20)
  await client.send("HeapProfiler.collectGarbage")
}

/** One mount-to-teardown cycle, sampled. Returns bytes, never a verdict. */
async function heapCycle(client, page, index) {
  await settle(client)
  const baseline = await heapBytes(client)
  const rows = await page.evaluate((it) => window.__exampleMount(it), index)
  let peak = await heapBytes(client)
  for (let sample = 0; sample < PEAK_SAMPLES; sample++) {
    await wait(PEAK_INTERVAL_MS)
    const now = await heapBytes(client)
    if (now !== null && (peak === null || now > peak)) peak = now
  }
  const left = await page.evaluate((it) => window.__exampleTeardown(it), index)
  await settle(client)
  const after = await heapBytes(client)
  return { baseline, peak, after, rows, nodesAfterTeardown: left }
}

async function heapPass(page, ids) {
  const client = await page.context().newCDPSession(page)
  await client.send("Performance.enable")
  await client.send("HeapProfiler.enable")
  const rows = []
  for (let index = 0; index < ids.length; index++) {
    const cycles = []
    for (let repeat = 0; repeat < REPEATS; repeat++) cycles.push(await heapCycle(client, page, index))
    const usable = cycles.filter((it) => it.baseline !== null && it.peak !== null && it.after !== null)
    if (usable.length === 0) {
      rows.push({ id: ids[index], reason: "Performance.getMetrics reported no JSHeapUsedSize" })
      continue
    }
    const peaks = usable.map((it) => it.peak - it.baseline)
    const retained = usable.map((it) => it.after - it.baseline)
    rows.push({
      id: ids[index],
      repeats: usable.length,
      baselineHeapBytes: median(usable.map((it) => it.baseline)),
      peakHeapBytes: median(peaks),
      peakSpreadBytes: spread(peaks),
      retainedHeapBytes: median(retained),
      retainedSpreadBytes: spread(retained),
      nodesAfterTeardown: Math.max(...usable.map((it) => it.nodesAfterTeardown)),
      rowsRendered: Math.max(...usable.map((it) => it.rows)),
      leaks: median(retained) > LEAK_BYTES,
      reason: null,
    })
  }
  await client.detach()
  return rows
}

async function main() {
  const server = await createServer({
    root,
    configFile: false,
    logLevel: "warn",
    // HMR off and the watcher blind: a source edit landing mid-run would reload the page and
    // destroy the execution context the results are being read from.
    server: { port: 0, strictPort: false, hmr: false, watch: { ignored: ["**"] } },
  })
  await server.listen()
  const url = server.resolvedUrls?.local?.[0]
  if (url === undefined) throw new Error("vite did not report a local url")

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  const consoleErrors = []
  page.on("pageerror", (error) => consoleErrors.push(String(error)))
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })

  let results = []
  let videos = []
  let heap = []
  try {
    await page.goto(new URL(ENTRY, url).toString(), { waitUntil: "load" })
    await page.waitForFunction(() => window.__ready === true, undefined, { timeout: 60_000 })
    results = await page.evaluate(() => window.__exampleCheck())
    videos = await page.evaluate(async () => {
      const module = await import("/examples/videos.ts")
      return module.VIDEOS.map((v) => ({ id: v.id, sourcePath: v.sourcePath, missing: v.missing }))
    })
    if (!SKIP_MEMORY) {
      const ids = await page.evaluate(() => window.__exampleIds)
      heap = await heapPass(page, ids)
    }
  } finally {
    await browser.close()
    await server.close()
  }

  const width = Math.max(...results.map((r) => r.id.length), 7)
  console.log(
    `${pad("example", width)}   ok   bytes   rows   left   open   pinned  listen  resize  failures`,
  )
  for (const result of results) {
    console.log(
      [
        pad(result.id, width),
        result.ok ? " ok " : "FAIL",
        String(result.sourceBytes).padStart(6),
        String(result.rowsRendered).padStart(5),
        String(result.nodesAfterTeardown).padStart(5),
        String(result.openOwned).padStart(5),
        String(result.retainedByDeps).padStart(7),
        String(result.listenerBalance).padStart(6),
        String(result.observerBalance).padStart(6),
        result.failures.join("; "),
      ].join("  "),
    )
  }

  if (heap.length > 0) {
    const kb = (value) => (value === null || value === undefined ? "n/a" : `${(value / 1024).toFixed(0)} kB`)
    console.log(
      `\n${pad("example", width)}  ${"peak".padStart(9)}  ${"spread".padStart(9)}  ${"retained".padStart(9)}  ${"spread".padStart(9)}  nodes  note`,
    )
    for (const row of heap) {
      if (row.reason !== null && row.reason !== undefined) {
        console.log(`${pad(row.id, width)}   ${row.reason}`)
        continue
      }
      console.log(
        [
          pad(row.id, width),
          kb(row.peakHeapBytes).padStart(9),
          kb(row.peakSpreadBytes).padStart(9),
          kb(row.retainedHeapBytes).padStart(9),
          kb(row.retainedSpreadBytes).padStart(9),
          String(row.nodesAfterTeardown).padStart(5),
          row.leaks ? `retains over ${Math.round(LEAK_BYTES / 1024)} kB` : "",
        ].join("  "),
      )
    }
    mkdirSync(dirname(MEMORY_OUT), { recursive: true })
    writeFileSync(
      MEMORY_OUT,
      `${JSON.stringify({ method: HEAP_METHOD, samples: REPEATS, leakBytes: LEAK_BYTES, measuredAt: new Date().toISOString(), examples: heap }, null, 2)}\n`,
    )
    console.log(`\nheap samples written to ${join("packages", "signal-grid", flag("memory-json", "out/examples-memory.json"))}`)
  }

  const videoProblems = []
  for (const video of videos) {
    const present = existsSync(new URL(video.sourcePath, new URL("../", import.meta.url)))
    if (video.missing && present) videoProblems.push(`${video.id}: marked missing but the mp4 is there`)
    if (!video.missing && !present) videoProblems.push(`${video.id}: ${video.sourcePath} is not on disk`)
  }
  console.log(`\nvideos: ${videos.length} listed, ${videoProblems.length} mismatched`)
  for (const problem of videoProblems) console.log(`  ${problem}`)

  const failed = results.filter((result) => !result.ok)
  if (consoleErrors.length > 0) {
    console.log("\npage errors:")
    for (const error of consoleErrors.slice(0, 20)) console.log(`  ${error}`)
  }
  console.log(
    `\n${results.length} examples, ${results.length - failed.length} clean, ${failed.length} failed`,
  )
  if (failed.length > 0 || videoProblems.length > 0 || consoleErrors.length > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
