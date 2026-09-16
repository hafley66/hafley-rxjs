// Throwaway probe: compare the DOM-realm rasterizers on one fixture.
// Measures per library: element capture, full-page capture (beyond the viewport), whether a nested
// <canvas> subtree lands in the pixels, and whether it works from a background tab.
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import Fastify from "fastify"
import { chromium } from "playwright"
import { rolldown } from "rolldown"

const pngSize = dataUrl => {
  const buffer = Buffer.from(dataUrl.replace(/^data:image\/[a-z+]+;base64,/, ""), "base64")
  return buffer.length > 24 ? { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), bytes: buffer.length } : { bytes: buffer.length }
}

const fixture = `<!doctype html><html><head><style>
  body { margin:0 }
  #target { position:relative; width:400px; height:200px; background:#123456; color:#fff; font-size:20px }
  #target canvas { position:absolute; left:300px; top:100px; width:80px; height:40px }
  #spacer { height:4000px; background:#eeeeee }
</style></head><body>
<div id="target">hello<canvas width="80" height="40"></canvas></div>
<div id="spacer"></div>
<script>
  const ctx = document.querySelector("#target canvas").getContext("2d")
  ctx.fillStyle = "#0000ff"; ctx.fillRect(0, 0, 80, 40)
</script></body></html>`

const RUN = `async ([library, mode]) => {
  const node = mode === "full" ? document.documentElement : document.querySelector("#target")
  const options = mode === "full"
    ? { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, pixelRatio: 1, skipFonts: true, backgroundColor: "#ffffff" }
    : { pixelRatio: 1, skipFonts: true }
  const started = performance.now()
  let dataUrl
  try {
    if (library === "html-to-image") dataUrl = await globalThis.__L.toPng(node, options)
    else if (library === "modern-screenshot") dataUrl = await globalThis.__L.domToPng(node, options)
    else { const fn = globalThis.__L.default ?? globalThis.__L; const canvas = await fn(node, options); dataUrl = canvas.toDataURL("image/png") }
  } catch (error) { return { error: error.name + ": " + error.message } }
  const duration = Math.round(performance.now() - started)
  const probe = new Image()
  await new Promise((resolve, reject) => { probe.onload = resolve; probe.onerror = () => reject(new Error("reload failed")); probe.src = dataUrl })
  const canvas = document.createElement("canvas"); canvas.width = probe.width; canvas.height = probe.height
  canvas.getContext("2d").drawImage(probe, 0, 0)
  let canvasSubtree = null, background = null
  try {
    canvasSubtree = Array.from(canvas.getContext("2d").getImageData(mode === "full" ? 330 : 330, mode === "full" ? 120 : 120, 1, 1).data)
    background = Array.from(canvas.getContext("2d").getImageData(10, 10, 1, 1).data)
  } catch (error) { canvasSubtree = error.name }
  return { duration, width: probe.width, height: probe.height, bytes: Math.round(dataUrl.length * 0.75), background, canvasSubtree }
}`

const libraries = ["html-to-image", "modern-screenshot", "html2canvas"]
const bundles = {}
for (const library of libraries) {
  const bundle = await rolldown({ input: library, platform: "browser", transform: { target: "chrome120" } })
  const { output } = await bundle.generate({ format: "iife", name: "__L", codeSplitting: false })
  bundles[library] = output[0].code
  await bundle.close()
}

const directory = mkdtempSync(join(tmpdir(), "bewpp-libs-"))
const app = Fastify()
app.get("/fixture.html", (_request, reply) => reply.type("text/html").send(fixture))
const address = await app.listen({ host: "127.0.0.1", port: 0 })
const context = await chromium.launchPersistentContext(join(directory, "profile"), { channel: "chromium", viewport: { width: 800, height: 600 } })

try {
  const foreground = await context.newPage()
  await foreground.goto("about:blank")
  const report = {}
  for (const library of libraries) {
    const page = await context.newPage()
    await page.goto(`${address}/fixture.html`)
    await page.addScriptTag({ content: bundles[library] })
    const element = await page.evaluate(`(${RUN})(${JSON.stringify([library, "element"])})`)
    const full = await page.evaluate(`(${RUN})(${JSON.stringify([library, "full"])})`)
    // Background-tab check: another page takes focus, this one is no longer visible.
    await foreground.bringToFront()
    const background = await page.evaluate(`(${RUN})(${JSON.stringify([library, "element"])})`)
    report[library] = { element, full, "element from background tab": background, "bundle bytes": bundles[library].length }
    await page.close()
  }
  console.log(JSON.stringify(report, null, 2))
} finally {
  await context.close()
  await app.close()
}