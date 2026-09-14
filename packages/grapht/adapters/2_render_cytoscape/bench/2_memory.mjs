// Fresh browser per trial; CDP forces GC and samples the same target's JS heap at each phase.
import { build, preview } from "vite"
import { chromium } from "playwright"
import { fileURLToPath } from "node:url"
import { writeFileSync } from "node:fs"
import assert from "node:assert/strict"
import { processMemory } from "../../../../trace/dist/10_processMemory.js"
import { chromiumMemory } from "../../../../trace/dist/index.js"
const root = fileURLToPath(new URL(".", import.meta.url))
const outDir = "/private/tmp/grapht-memory-build"
await build({ configFile: false, root, build: { outDir, emptyOutDir: true, target: "esnext" }, logLevel: "error" })
const server = await preview({ configFile: false, root, build: { outDir }, preview: { host: "127.0.0.1", port: 0 } })
const results = []
const copies = (process.env.COPIES ?? "1,2,4,8,16").split(",").map(Number)
const trials = Number(process.env.TRIALS ?? 3)
try {
  for (const count of copies) for (let trial = 0; trial < trials; trial++) for (const mode of trial % 2 ? ["cytoscape", "document"] : ["document", "cytoscape"]) {
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
      const browserCdp = await browser.newBrowserCDPSession()
      const cdp = await page.context().newCDPSession(page)
      await cdp.send("Performance.enable")
      await page.goto(`${server.resolvedUrls.local[0]}?mode=${mode}&copies=${count}`)
      await page.waitForFunction(() => window.benchmark)
      const heap = async () => {
        await cdp.send("HeapProfiler.collectGarbage")
        const { metrics } = await cdp.send("Performance.getMetrics")
        return Object.fromEntries(metrics.map(metric => [metric.name, metric.value]))
      }
      const imported = await heap()
      await page.evaluate(() => window.benchmark.prepare())
      const prepared = await heap()
      const start = performance.now()
      await page.evaluate(() => window.benchmark.mount())
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      const mounted = await heap()
      const chromiumSample = await chromiumMemory(cdp)
      assert.ok(chromiumSample.jsHeapUsedBytes > 0)
      assert.ok(chromiumSample.domNodes > 0)
      assert.ok(chromiumSample.embedderHeapUsedBytes === undefined || chromiumSample.embedderHeapUsedBytes >= 0)
      const processes = (await browserCdp.send("SystemInfo.getProcessInfo")).processInfo
      const resident = await processMemory(processes.map(item => item.id))
      const rss = resident.map(row => ({ ...row, type: processes.find(item => item.id === row.pid).type }))
      assert.ok(rss.some(row => row.type === "renderer" && row.rssBytes > 0))
      const counts = await page.evaluate(() => window.benchmark.counts())
      assert.equal(counts.graph, count * 148 + 1)
      assert.equal(counts.edges, mode === "cytoscape" ? count * 125 : 0)
      assert.equal(counts.dom, mode === "cytoscape" ? 72 : count * 513 + 82)
      await page.evaluate(() => window.benchmark.unsubscribe())
      const released = await heap()
      const result = { copies: count, messages: count * 125, trial, mode, browser: browser.version(), imported: imported.JSHeapUsedSize, prepared: prepared.JSHeapUsedSize, mounted: mounted.JSHeapUsedSize, rendererDelta: mounted.JSHeapUsedSize - prepared.JSHeapUsedSize, released: released.JSHeapUsedSize, mountAndMeasureMs: performance.now() - start, ...counts, rss, chromium: chromiumSample }
      results.push(result)
      writeFileSync(process.env.OUT ?? "/private/tmp/grapht-memory.json", JSON.stringify(results, null, 2))
      console.log(JSON.stringify(result))
    } finally { await browser.close() }
  }
} finally { await new Promise(resolve => server.httpServer.close(resolve)) }
