// @comment-ok: the "real chromium, not a stubbed DOM" choice and the peak-sampling method are the two things a reader has to know before trusting these numbers
// Mounts every example in a real chromium and fails the run when one throws, leaves a subscription
// or a listener behind after teardown, or carries an empty `source`.
//
// Playwright rather than a headless DOM, because examples read `?raw` and `*.css` imports that only
// a bundler resolves, and because what a render puts on screen is a function of a measured
// viewport: a stubbed DOM reports a zero-height box and every example windows nothing.
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { chromium } from "playwright"
import { createServer } from "vite"

// Peak is the largest of these samples rather than one reading: an example that allocates on a
// timer has not reached its high-water mark at the frame its first row paints.
const PEAK_SAMPLES = 3
const PEAK_INTERVAL_MS = 50

/** Above this, a retained figure is reported as a leak with the example's name on it. */
const LEAK_BYTES = 512 * 1024

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
  const painted = await page.evaluate((it) => window.__exampleMount(it), index)
  let peak = await heapBytes(client)
  for (let sample = 0; sample < PEAK_SAMPLES; sample++) {
    await wait(PEAK_INTERVAL_MS)
    const now = await heapBytes(client)
    if (now !== null && (peak === null || now > peak)) peak = now
  }
  const left = await page.evaluate((it) => window.__exampleTeardown(it), index)
  await settle(client)
  const after = await heapBytes(client)
  return { baseline, peak, after, painted, nodesAfterTeardown: left }
}

async function heapPass(page, ids, repeats) {
  const client = await page.context().newCDPSession(page)
  await client.send("Performance.enable")
  await client.send("HeapProfiler.enable")
  const rows = []
  for (let index = 0; index < ids.length; index++) {
    const cycles = []
    for (let repeat = 0; repeat < repeats; repeat++) cycles.push(await heapCycle(client, page, index))
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
      painted: Math.max(...usable.map((it) => it.painted)),
      leaks: median(retained) > LEAK_BYTES,
      reason: null,
    })
  }
  await client.detach()
  return rows
}

const heapMethod = (repeats, note) =>
  `Playwright over CDP: HeapProfiler.enable, then per example per repeat, HeapProfiler.collectGarbage, Performance.getMetrics JSHeapUsedSize as the baseline, mount, ${PEAK_SAMPLES} samples ${PEAK_INTERVAL_MS} ms apart taking the largest as the peak, teardown, two collectGarbage calls, one more JSHeapUsedSize as retained. Every example is mounted and torn down twice by the leak pass before any of this runs, so a page-lifetime allocation is already made. ${repeats} repeats per example, reported as the median with the spread across those repeats beside it. An example retaining more than ${LEAK_BYTES} bytes over its own baseline is named as a leak.${note === undefined ? "" : ` ${note}`}`

// Options: root, entry, paintedLabel, note (what the package adds to the heap method), audit (an
// async hook given the page, returning problem strings), argv.
export async function runExampleCheck(options) {
  const root = options.root
  const entry = options.entry ?? "/examples/_check/index.html"
  const paintedLabel = options.paintedLabel ?? "painted"
  const argv = options.argv ?? process.argv.slice(2)

  const flag = (name, fallback) => {
    const found = argv.find((it) => it.startsWith(`--${name}=`))
    return found === undefined ? fallback : found.slice(name.length + 3)
  }

  const repeats = Math.max(1, Number(flag("repeat", "3")))
  const memoryOut = resolve(root, flag("memory-json", "out/examples-memory.json"))
  const skipMemory = argv.includes("--no-memory")

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
  let heap = []
  let audited = []
  try {
    await page.goto(new URL(entry, url).toString(), { waitUntil: "load" })
    await page.waitForFunction(() => window.__ready === true, undefined, { timeout: 60_000 })
    results = await page.evaluate(() => window.__exampleCheck())
    if (options.audit !== undefined) audited = await options.audit(page)
    if (!skipMemory) {
      const ids = await page.evaluate(() => window.__exampleIds)
      heap = await heapPass(page, ids, repeats)
    }
  } finally {
    await browser.close()
    await server.close()
  }

  const width = Math.max(...results.map((it) => it.id.length), 7)
  console.log(`${pad("example", width)}   ok   bytes  ${paintedLabel.padStart(6)}   left   open   pinned  listen  resize  failures`)
  for (const result of results) {
    console.log(
      [
        pad(result.id, width),
        result.ok ? " ok " : "FAIL",
        String(result.sourceBytes).padStart(6),
        String(result.painted).padStart(6),
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
    mkdirSync(dirname(memoryOut), { recursive: true })
    writeFileSync(
      memoryOut,
      `${JSON.stringify(
        {
          method: heapMethod(repeats, options.note),
          samples: repeats,
          leakBytes: LEAK_BYTES,
          measuredAt: new Date().toISOString(),
          examples: heap,
        },
        null,
        2,
      )}\n`,
    )
    console.log(`\nheap samples written to ${memoryOut}`)
  }

  for (const problem of audited) console.log(`  ${problem}`)

  const failed = results.filter((it) => !it.ok)
  if (consoleErrors.length > 0) {
    console.log("\npage errors:")
    for (const error of consoleErrors.slice(0, 20)) console.log(`  ${error}`)
  }
  console.log(`\n${results.length} examples, ${results.length - failed.length} clean, ${failed.length} failed`)
  if (failed.length > 0 || audited.length > 0 || consoleErrors.length > 0) process.exitCode = 1
  return { results, heap }
}
