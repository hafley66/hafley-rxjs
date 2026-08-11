import { chromium } from "@playwright/test"
import { createHash } from "node:crypto"
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { spawn } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const results = resolve(here, "../../results")
const fixtureDir = resolve(here, "../../.cache/render-fixtures")
const fixtureGenerator = resolve(here, "../../scripts/0_generate_renderer_fixture.mjs")
const headed = process.env.GRAPHT_BREAKPOINT_HEADED === "1"
const captureScreenshots = process.env.GRAPHT_BREAKPOINT_SCREENSHOTS === "1"
const demo = headed || captureScreenshots
const outputStem = demo ? "3_renderer_demo" : "2_renderer_breakpoints"
const rawPath = resolve(results, `${outputStem}.jsonl`)
const runningPath = resolve(results, `${outputStem}.${process.pid}.running.jsonl`)
const holdMs = Number(process.env.GRAPHT_BREAKPOINT_HOLD_MS ?? (headed ? 5_000 : 0))
const slowMoMs = Number(process.env.GRAPHT_BREAKPOINT_SLOW_MO_MS ?? 0)
const sizes = (process.env.GRAPHT_BREAKPOINT_SIZES ?? (demo ? "1000,10000" : "1000,5000,10000,25000,50000,100000,250000,500000,1000000,2000000")).split(",").map(Number).filter(value => Number.isSafeInteger(value) && value > 0)
const timeoutMs = Number(process.env.GRAPHT_BREAKPOINT_TIMEOUT_MS ?? 60_000)
const workerTimeoutMs = timeoutMs + Math.max(0, holdMs) + 10_000
const browserArgs = ["--enable-precise-memory-info", "--disable-background-networking"]
const rendererApps = {
  cytoscape: { cwd: resolve(here, "../2_render_cytoscape"), port: 4173, receipt: "#receipt" },
  canvaskit: { cwd: resolve(here, "../3_render_canvaskit"), port: 4174, path: "/5_index.html", receipt: "#receipt" },
  sigma: { cwd: here, port: 4179, receipt: "#receipt" },
}
const selectedImplementations = (process.env.GRAPHT_BREAKPOINT_RENDERERS ?? (demo ? "cytoscape,canvaskit,sigma" : "cytoscape,canvaskit,sigma,vello-wgpu")).split(",").filter(Boolean)

function runChild(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", chunk => { stdout += chunk })
    child.stderr.on("data", chunk => { stderr += chunk })
    child.on("error", reject)
    child.on("close", code => resolvePromise({ child, code, stdout, stderr }))
  })
}

async function psSnapshot() {
  const result = await runChild("ps", ["-axo", "pid=,ppid=,rss="])
  return result.stdout
}

async function sampleProcessTree(pid, task) {
  let peak = 0
  let latest = ""
  const sample = async () => { latest = await psSnapshot(); peak = Math.max(peak, processTreeFrom(latest, pid)) }
  await sample()
  const timer = setInterval(() => { void sample() }, 50)
  try { return await task(() => sample()) } finally { clearInterval(timer); await sample() }
}

function processTreeFrom(text, pid) {
  const rows = text.split("\n").map(line => line.trim().split(/\s+/).map(Number)).filter(row => row.length >= 3 && row.every(Number.isFinite))
  const children = new Map()
  for (const [child, parent, rss] of rows) children.set(parent, [...(children.get(parent) ?? []), [child, rss]])
  const visit = current => [current, ...(children.get(current) ?? []).flatMap(([child]) => visit(child))]
  const pids = new Set(visit(pid))
  return rows.filter(([value]) => pids.has(value)).reduce((sum, [, , rss]) => sum + rss, 0)
}

async function waitForServer(port) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { await fetch(`http://127.0.0.1:${port}`); return } catch {}
    await new Promise(resolvePromise => setTimeout(resolvePromise, 100))
  }
  throw new Error(`Vite server did not start on ${port}`)
}

async function startServer(app) {
  const child = spawn("pnpm", ["exec", "vite", "--host", "127.0.0.1", "--port", String(app.port)], { cwd: app.cwd, stdio: ["ignore", "pipe", "pipe"] })
  await waitForServer(app.port)
  return child
}

function visualValidity(value) {
  const visual = value.visualValidity
  if (!visual || visual.valid !== true) return "receipt did not establish a valid rendered scene"
  if (visual.drawnNodeCount !== value.nodeCount || visual.drawnEdgeCount !== value.edgeCount) return "drawn node or edge counter does not match the common fixture"
  if (!(visual.positionSpanX > 0 && visual.positionSpanY > 0)) return "common fixture positions collapsed to one point"
  return null
}

async function browserPoint(browser, browserPid, app, implementation, nodeCount) {
  const context = await browser.newContext()
  const page = await context.newPage()
  let peakRssKb = 0
  if (browserPid) peakRssKb = processTreeFrom(await psSnapshot(), browserPid)
  let sampling = false
  const sampleTimer = setInterval(async () => {
    if (sampling) return
    sampling = true
    if (!browserPid) return
    try { const text = await psSnapshot(); peakRssKb = Math.max(peakRssKb, processTreeFrom(text, browserPid)) } finally { sampling = false }
  }, 250)
  const started = Date.now()
  try {
    page.on("pageerror", error => { page.__graphtPageError = `${error.name}: ${error.message}` })
    await page.goto(`http://127.0.0.1:${app.port}${app.path ?? "/"}?nodes=${nodeCount}&fixture=grid-${nodeCount}`, { waitUntil: "domcontentloaded", timeout: timeoutMs })
    await page.waitForFunction(selector => { const element = document.querySelector(selector); return Boolean(element?.textContent?.trim() || (element && "value" in element && String(element.value).trim())) }, app.receipt, { timeout: timeoutMs })
    const value = JSON.parse(await page.locator(app.receipt).evaluate(element => element.textContent?.trim() || ("value" in element ? String(element.value) : "{}")))
    const pageError = page.__graphtPageError
    if (pageError && value.status === "healthy") value.pageError = pageError
    value.implementation = implementation
    value.nodeCount = nodeCount
    value.peakRssKb = peakRssKb
    const visualFailure = value.status === "healthy" ? visualValidity(value) : null
    if (visualFailure) { value.status = "visual-invalid"; value.setupValid = false; value.statusReason = visualFailure; value.reason = visualFailure }
    value.softThreshold = value.status === "healthy" && (value.firstRenderMs > 5_000 || value.interactionP95Ms > 100)
      ? (value.firstRenderMs > 5_000 ? "firstRender>5s" : "interactionP95>100ms") : null
    if (demo) {
      await page.evaluate(receipt => {
        const overlay = document.createElement("pre")
        overlay.dataset.graphtPerf = "receipt"
        overlay.textContent = JSON.stringify(receipt, null, 2)
        Object.assign(overlay.style, {
          position: "fixed", inset: "12px 12px auto auto", zIndex: "2147483647",
          maxWidth: "min(46vw, 680px)", maxHeight: "calc(100vh - 24px)", overflow: "auto",
          margin: "0", padding: "12px", border: "1px solid #64748b", borderRadius: "6px",
          background: "rgb(2 6 23 / 92%)", color: "#e2e8f0", font: "12px/1.4 ui-monospace, monospace",
          whiteSpace: "pre-wrap", pointerEvents: "none",
        })
        document.body.append(overlay)
      }, value)
      if (captureScreenshots && value.status === "healthy") {
        const screenshotDir = resolve(results, "3_renderer_demo_screens")
        await mkdir(screenshotDir, { recursive: true })
        const screenshot = resolve(screenshotDir, `${implementation}-${nodeCount}.png`)
        await page.screenshot({ path: screenshot, fullPage: true })
        value.screenshot = screenshot
      }
      if (headed && holdMs > 0) await new Promise(resolvePromise => setTimeout(resolvePromise, holdMs))
    }
    return value
  } catch (error) {
    return { implementation, setupValid: false, status: error.name === "TimeoutError" ? "runner-timeout" : "hard-failure", nodeCount, peakRssKb, statusReason: error instanceof Error ? `${error.name}: ${error.message}` : String(error), reason: error instanceof Error ? `${error.name}: ${error.message}` : String(error), elapsedMs: Date.now() - started }
  } finally {
    if (browserPid) peakRssKb = Math.max(peakRssKb, processTreeFrom(await psSnapshot(), browserPid))
    clearInterval(sampleTimer)
    await context.close().catch(() => {})
  }
}

async function browserWorker(implementation, nodeCount) {
  const app = rendererApps[implementation]
  let server
  let browserServer
  let browser
  try {
    server = await startServer(app)
    browserServer = await chromium.launchServer({ headless: !headed, args: browserArgs, slowMo: Math.max(0, slowMoMs) })
    browser = await chromium.connect({ wsEndpoint: browserServer.wsEndpoint() })
    const value = await browserPoint(browser, browserServer.process().pid, app, implementation, nodeCount)
    process.stdout.write(`${JSON.stringify(value)}\n`)
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ implementation, nodeCount, setupValid: false, status: "worker-failure", statusReason: error instanceof Error ? `${error.name}: ${error.message}` : String(error) })}\n`)
    process.exitCode = 1
  } finally {
    if (browser) await closeSoon(browser.close().catch(() => {}))
    if (browserServer) await closeSoon(browserServer.close().catch(() => {}))
    if (server) server.kill("SIGTERM")
  }
}

async function isolatedBrowserPoint(implementation, nodeCount) {
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "--browser-worker", implementation, String(nodeCount)], { cwd: here, stdio: ["ignore", "pipe", "pipe"] })
  let stdout = ""
  let stderr = ""
  child.stdout.on("data", chunk => { stdout += chunk })
  child.stderr.on("data", chunk => { stderr += chunk })
  let peakRssKb = processTreeFrom(await psSnapshot(), child.pid)
  let sampling = false
  const sampler = setInterval(async () => {
    if (sampling) return
    sampling = true
    try { peakRssKb = Math.max(peakRssKb, processTreeFrom(await psSnapshot(), child.pid)) } finally { sampling = false }
  }, 250)
  let timedOut = false
  const result = await new Promise(resolvePromise => {
    const timeout = setTimeout(() => { timedOut = true; child.kill("SIGKILL") }, workerTimeoutMs)
    child.on("close", code => { clearTimeout(timeout); resolvePromise({ code }) })
  })
  clearInterval(sampler)
  peakRssKb = Math.max(peakRssKb, processTreeFrom(await psSnapshot(), child.pid))
  if (timedOut) return { implementation, nodeCount, setupValid: false, status: "runner-timeout", statusReason: `isolated renderer worker exceeded ${workerTimeoutMs}ms`, reason: stderr.trim(), peakRssKb }
  const lines = stdout.trim().split("\n").filter(Boolean)
  let value
  try { value = JSON.parse(lines.at(-1) ?? "{}") } catch { value = { implementation, nodeCount, setupValid: false, status: "worker-failure", statusReason: `${stderr.trim()} ${stdout.trim()}`.trim() } }
  value.peakRssKb = Math.max(value.peakRssKb ?? 0, peakRssKb)
  if (!value.status) { value.status = /wgpu error|Validation Error|buffer binding/i.test(stderr) ? "renderer-error" : result.code === null ? "process-signal" : "process-exit"; value.setupValid = false; value.statusReason = stderr.trim() || `native probe exited ${result.code}`; value.reason = value.statusReason }
  if (result.code !== 0 && value.status === "healthy") { value.status = "worker-failure"; value.setupValid = false; value.statusReason = `worker exited ${result.code}`; value.reason = value.statusReason }
  return value
}

async function velloPoint(binary, nodeCount, fixturePath) {
  const fixtureHash = createHash("sha256").update(await readFile(fixturePath)).digest("hex")
  const child = spawn(binary, [fixturePath, fixtureHash], { stdio: ["ignore", "pipe", "pipe"] })
  let stdout = ""
  let stderr = ""
  let peakRssKb = 0
  peakRssKb = processTreeFrom(await psSnapshot(), child.pid)
  let sampling = false
  const timer = setInterval(async () => { if (sampling) return; sampling = true; try { const text = await psSnapshot(); peakRssKb = Math.max(peakRssKb, processTreeFrom(text, child.pid)) } finally { sampling = false } }, 250)
  const result = await new Promise(resolvePromise => {
    const timeout = setTimeout(() => { child.kill("SIGKILL"); resolvePromise({ code: null, timedOut: true }) }, timeoutMs)
    child.stdout.on("data", chunk => { stdout += chunk })
    child.stderr.on("data", chunk => { stderr += chunk })
    child.on("close", code => { clearTimeout(timeout); resolvePromise({ code, timedOut: false }) })
  })
  clearInterval(timer)
  peakRssKb = Math.max(peakRssKb, processTreeFrom(await psSnapshot(), child.pid))
  const lines = stdout.trim().split("\n").filter(Boolean)
  let value
  try { value = JSON.parse(lines.at(-1) ?? "{}") } catch { value = { status: "hard-failure", reason: `${stderr.trim()} ${stdout.trim()}`.trim() } }
  value.implementation = "vello-wgpu"
  value.nodeCount = nodeCount
  value.peakRssKb = peakRssKb
  const visualFailure = value.status === "healthy" ? visualValidity(value) : null
  if (visualFailure) { value.status = "visual-invalid"; value.setupValid = false; value.statusReason = visualFailure; value.reason = visualFailure }
  if (!value.status) {
    value.status = /wgpu error|Validation Error|buffer binding/i.test(stderr) ? "renderer-error" : result.code === null ? "process-signal" : "process-exit"
    value.setupValid = false
    value.statusReason = stderr.trim() || `native probe exited ${result.code}`
    value.reason = value.statusReason
  }
  if (result.timedOut) { value.status = "runner-timeout"; value.setupValid = false; value.statusReason = `native probe exceeded ${timeoutMs}ms`; value.reason = value.statusReason }
  if (result.code !== 0 && value.status === "healthy") { value.status = "hard-failure"; value.setupValid = false; value.statusReason = `native probe exited ${result.code}`; value.reason = value.statusReason }
  value.softThreshold = value.status === "healthy" && (value.firstRenderMs > 5_000 || value.interactionP95Ms > 100)
    ? (value.firstRenderMs > 5_000 ? "firstRender>5s" : "interactionP95>100ms") : null
  return value
}

function csvValue(value) { return value == null ? "" : JSON.stringify(value) }
function statusClass(value) { return value.status === "healthy" && !value.softThreshold ? "healthy" : value.status === "healthy" ? "soft-threshold" : value.status }
function closeSoon(promise, timeout = 3_000) { return Promise.race([promise, new Promise(resolvePromise => setTimeout(resolvePromise, timeout))]) }

function makeSvg(rows) {
  const width = 1200, height = 720, left = 90, right = 40, top = 40, bottom = 100
  const panels = [{ key: "firstRenderMs", title: "first render (ms)", y: top }, { key: "peakRssKb", title: "peak process RSS (MiB)", y: 380 }]
  const healthy = rows.filter(row => row.status === "healthy")
  const maxX = Math.log10(Math.max(...rows.map(row => row.nodeCount), 10))
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><style>text{font:13px sans-serif;fill:#18202c}.axis{stroke:#718096}.line{fill:none;stroke-width:2}.cytoscape{stroke:#2563eb}.canvaskit{stroke:#16a34a}.sigma{stroke:#9333ea}.vello-wgpu{stroke:#ea580c}.soft-threshold{stroke:#ca8a04}</style><rect width="100%" height="100%" fill="#fff"/>${panels.map(panel => { const values = rows.map(row => panel.key === "peakRssKb" ? row.peakRssKb / 1024 : row[panel.key]).filter(Number.isFinite); const maxY = Math.max(...values, 1); const x = n => left + (Math.log10(n) / maxX) * (width - left - right); const y = v => panel.y + 250 - (v / maxY) * 250; const lines = ["cytoscape", "canvaskit", "sigma", "vello-wgpu"].map(name => { const points = rows.filter(row => row.implementation === name && row.status === "healthy").map(row => `${x(row.nodeCount)},${y(panel.key === "peakRssKb" ? row.peakRssKb / 1024 : row[panel.key])}`).join(" "); return points ? `<polyline class="line ${name}" points="${points}"/>` : "" }).join(""); return `<text x="${left}" y="${panel.y - 14}">${panel.title}</text><line class="axis" x1="${left}" y1="${panel.y + 250}" x2="${width - right}" y2="${panel.y + 250}"/><line class="axis" x1="${left}" y1="${panel.y}" x2="${left}" y2="${panel.y + 250}"/>${lines}<text x="${left}" y="${panel.y + 270}">1k</text><text x="${width - right - 30}" y="${panel.y + 270}">2m</text>` }).join("")}<text x="${width / 2 - 60}" y="${height - 25}">nodes (log scale)</text></svg>`
}

async function main() {
  await mkdir(results, { recursive: true })
  await mkdir(fixtureDir, { recursive: true })
  for (const nodeCount of sizes) {
    const generated = await runChild(process.execPath, [fixtureGenerator, String(nodeCount), fixtureDir])
    if (generated.code !== 0) throw new Error(`common fixture generation failed for ${nodeCount}: ${generated.stderr || generated.stdout}`)
  }
  const existingRows = process.env.GRAPHT_BREAKPOINT_APPEND_EXISTING === "1"
    ? (await readFile(rawPath, "utf8").catch(() => "")).split("\n").filter(Boolean).map(line => JSON.parse(line))
    : []
  const allRows = existingRows.filter(row => !(selectedImplementations.includes(row.implementation) && sizes.includes(row.nodeCount)))
  await writeFile(runningPath, allRows.map(row => JSON.stringify(row)).join("\n") + (allRows.length ? "\n" : ""))
  for (const implementation of Object.keys(rendererApps).filter(value => selectedImplementations.includes(value))) {
    process.stderr.write(`starting ${implementation}\n`)
    for (const nodeCount of sizes) {
      const row = await isolatedBrowserPoint(implementation, nodeCount)
      allRows.push(row)
      await appendFile(runningPath, `${JSON.stringify(row)}\n`)
      process.stderr.write(`${implementation} ${nodeCount} ${row.status}\n`)
      if (row.status !== "healthy") break
    }
  }
  const velloDir = resolve(here, "../5_render_vello_wgpu")
  const build = selectedImplementations.includes("vello-wgpu")
    ? await runChild("cargo", ["build", "--release", "--bin", "4_breakpoint_probe"], { cwd: velloDir })
    : { code: 0 }
  if (selectedImplementations.includes("vello-wgpu") && build.code === 0) {
    const binary = resolve(velloDir, "target/release/4_breakpoint_probe")
    for (const nodeCount of sizes) {
      const row = await velloPoint(binary, nodeCount, resolve(fixtureDir, `grid-${nodeCount}.json`))
      allRows.push(row)
      await appendFile(runningPath, `${JSON.stringify(row)}\n`)
      process.stderr.write(`vello-wgpu ${nodeCount} ${row.status}\n`)
      if (row.status !== "healthy") break
    }
  } else if (selectedImplementations.includes("vello-wgpu")) {
    allRows.push({ implementation: "vello-wgpu", status: "build-failure", nodeCount: 0, reason: build.stderr || build.stdout })
  }
  const rendererOrder = ["cytoscape", "canvaskit", "sigma", "vello-wgpu"]
  allRows.sort((left, right) => (rendererOrder.indexOf(left.implementation) - rendererOrder.indexOf(right.implementation)) || (left.nodeCount - right.nodeCount))
  const jsonl = allRows.map(row => JSON.stringify(row)).join("\n") + "\n"
  const fields = ["implementation", "nodeCount", "edgeCount", "fixtureMs", "graphConstructionMs", "sceneConstructionMs", "deviceConstructionMs", "rendererConstructionMs", "firstRenderMs", "interactionMedianMs", "interactionP95Ms", "jsHeapUsedBytes", "jsHeapTotalBytes", "wasmPages", "peakRssKb", "setupValid", "status", "softThreshold", "statusReason", "reason", "actualRender", "completion"]
  const csv = [fields.join(","), ...allRows.map(row => fields.map(field => csvValue(row[field])).join(","))].join("\n") + "\n"
  const grouped = Object.groupBy(allRows, row => row.implementation)
  const summary = Object.entries(grouped).map(([implementation, rows]) => {
    const healthy = rows.filter(row => row.status === "healthy" && !row.softThreshold)
    const soft = rows.find(row => row.softThreshold)
    const harness = rows.find(row => row.status === "runner-timeout" || row.status === "worker-failure" || row.status === "process-signal" || row.status === "process-exit")
    const hard = rows.find(row => row.status === "renderer-error" || row.status === "hard-failure")
    return { implementation, highestHealthy: healthy.at(-1) ?? null, firstSoftThreshold: soft ?? null, firstHarnessFailure: harness ?? null, firstRendererFailure: hard ?? null }
  })
  const reason = row => { const raw = String(row.statusReason ?? row.reason ?? ""); const marker = raw.indexOf("wgpu error:"); return (marker >= 0 ? raw.slice(marker) : raw).replace(/\s+/g, " ").slice(0, 360) }
  const markdown = `# Renderer breakpoint sweep\n\nDeterministic grid topology. x=node count. Time fields are browser/native renderer timings. RSS is the sampled renderer process tree. Hard break means crash, OOM, timeout, device loss, allocation failure, or renderer error. Soft thresholds remain healthy rows.\n\n| renderer | highest healthy | first soft threshold | first harness failure | first confirmed renderer failure |\n| --- | ---: | ---: | ---: | ---: |\n${summary.map(row => `| ${row.implementation} | ${row.highestHealthy ? `${row.highestHealthy.nodeCount} nodes` : "none"} | ${row.firstSoftThreshold ? `${row.firstSoftThreshold.nodeCount} nodes (${row.firstSoftThreshold.softThreshold})` : "none"} | ${row.firstHarnessFailure ? `${row.firstHarnessFailure.nodeCount} nodes (${row.firstHarnessFailure.status}: ${reason(row.firstHarnessFailure)})` : "none observed"} | ${row.firstRendererFailure ? `${row.firstRendererFailure.nodeCount} nodes (${row.firstRendererFailure.status}: ${reason(row.firstRendererFailure)})` : "none observed"} |`).join("\n")}\n\n| renderer | nodes | edges | first render ms | interaction p95 ms | peak RSS MiB | status |\n| --- | ---: | ---: | ---: | ---: | ---: | --- |\n${allRows.map(row => `| ${row.implementation} | ${row.nodeCount} | ${row.edgeCount ?? ""} | ${row.firstRenderMs ?? ""} | ${row.interactionP95Ms ?? ""} | ${row.peakRssKb == null ? "" : (row.peakRssKb / 1024).toFixed(2)} | ${statusClass(row)} |`).join("\n")}\n`
  await writeFile(runningPath, jsonl)
  await rename(runningPath, rawPath)
  await writeFile(resolve(results, `${outputStem}.csv`), csv)
  await writeFile(resolve(results, `${outputStem}.md`), markdown)
  await writeFile(resolve(results, `${outputStem}.svg`), makeSvg(allRows))
  const png = await runChild("rsvg-convert", ["-o", resolve(results, `${outputStem}.png`), resolve(results, `${outputStem}.svg`)])
  if (png.code !== 0) process.stderr.write(png.stderr)
  process.stdout.write(markdown)
}

if (process.argv[2] === "--browser-worker") await browserWorker(process.argv[3], Number(process.argv[4]))
else await main()
