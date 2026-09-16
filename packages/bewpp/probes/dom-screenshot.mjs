// Throwaway probe: DOM-realm screenshotting (foreignObject -> canvas) without chrome.debugger.
// Measures: does it work from a BACKGROUND tab, does it cover beyond the viewport, what breaks on
// cross-origin images, and what happens to canvas/iframe subtrees.
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import Fastify from "fastify"
import { chromium } from "playwright"

const page = `<!doctype html><html><head><style>
  body { margin:0 } #target { width:400px; height:200px; background:#123456; color:#fff; font-size:20px }
  #inner { width:100px; height:50px; background:#ff0000 }
  #spacer { height:4000px; background:#eeeeee }
  #box { width:200px; height:200px; background:#00ff00 }
</style></head><body>
<div id="target">hello <div id="inner"></div><canvas id="c" width="80" height="40"></canvas></div>
<div id="spacer"></div>
<div id="box"></div>
<script>
  const ctx = document.getElementById("c").getContext("2d")
  ctx.fillStyle = "#0000ff"; ctx.fillRect(0, 0, 80, 40)
</script>
</body></html>`

const CAPTURE = `async ([selector, full]) => {
  const sample = (canvas, points) => points.map(([x, y]) => Array.from(canvas.getContext("2d").getImageData(x, y, 1, 1).data))
  const el = selector ? document.querySelector(selector) : document.documentElement
  const rect = el.getBoundingClientRect()
  const width = Math.ceil(full ? document.documentElement.scrollWidth : rect.width)
  const height = Math.ceil(full ? document.documentElement.scrollHeight : rect.height)
  const props = ["background-color","color","width","height","display","position","margin","padding","font-size","border","box-sizing"]
  const clone = el.cloneNode(true)
  const sources = [el, ...el.querySelectorAll("*")]
  const targets = [clone, ...clone.querySelectorAll("*")]
  sources.forEach((node, index) => {
    const style = getComputedStyle(node); let css = ""
    for (const property of props) { const value = style.getPropertyValue(property); if (value) css += property + ":" + value + ";" }
    targets[index].setAttribute("style", (targets[index].getAttribute("style") || "") + css)
  })
  const html = new XMLSerializer().serializeToString(clone)
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">' + html + "</div></foreignObject></svg>"
  const bytes = new TextEncoder().encode(svg); let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const url = "data:image/svg+xml;base64," + btoa(binary)
  const image = new Image()
  await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error("svg image load failed")); image.src = url })
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height
  canvas.getContext("2d").drawImage(image, 0, 0)
  const result = { width, height, documentHeight: document.documentElement.scrollHeight, viewportHeight: window.innerHeight }
  try { result.bytes = canvas.toDataURL("image/png").length } catch (error) { result.error = error.name + ": " + error.message }
  try { result.pixels = sample(canvas, selector === "#target" ? [[10, 10], [10, 100], [150, 30]] : [[10, 10], [10, 4100]]) }
  catch (error) { result.pixelError = error.name }
  return result
}`

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64")

const app = Fastify()
app.get("/page.html", (_request, reply) => reply.type("text/html").send(page))
// Served on the second origin (localhost) with no CORS headers, so it taints a 127.0.0.1 canvas.
app.get("/cross.png", (_request, reply) => reply.type("image/png").send(png))
const primary = await app.listen({ host: "127.0.0.1", port: 0 })
const port = new URL(primary).port
const directory = mkdtempSync(join(tmpdir(), "bewpp-domshot-"))
const context = await chromium.launchPersistentContext(join(directory, "profile"), { channel: "chromium", viewport: { width: 800, height: 600 } })

try {
  const other = await context.newPage()
  await other.goto("about:blank")
  const target = await context.newPage()
  await target.goto(`http://127.0.0.1:${port}/page.html`)

  const capture = (selector, full) => target.evaluate(`(${CAPTURE})(${JSON.stringify([selector, full])})`)
  const withCross = await target.evaluate(async src => {
    const image = document.createElement("img"); image.src = src
    document.getElementById("target").appendChild(image)
    await new Promise(resolve => { image.onload = resolve; image.onerror = resolve })
    return image.complete && image.naturalWidth > 0
  }, `http://localhost:${port}/cross.png`)

  const crossCapture = await capture("#target", false)
  await target.evaluate(() => { for (const image of document.images) image.remove() })
  const imagesAfterRemoval = await target.evaluate(() => document.images.length)
  const sameDocumentCapture = await capture("#target", false)
  await target.reload({ waitUntil: "load" })
  const imagesAfterReload = await target.evaluate(() => document.images.length)
  const cleanCapture = await capture("#target", false)
  const fullCapture = await capture(null, true)

  const mechanism = await target.evaluate(async () => {
    const draw = async (svg, via) => {
      const url = via === "blob" ? URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })) : "data:image/svg+xml;base64," + btoa(svg)
      const image = new Image()
      try { await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error("load failed")); image.src = url }) }
      catch (error) { return "load: " + error.message }
      const canvas = document.createElement("canvas"); canvas.width = 20; canvas.height = 20
      canvas.getContext("2d").drawImage(image, 0, 0)
      if (via === "blob") URL.revokeObjectURL(url)
      try { canvas.toDataURL("image/png"); return "clean" } catch (error) { return error.name }
    }
    const rect = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="red"/></svg>'
    const foreign = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="background:#0f0;width:20px;height:20px">x</div></foreignObject></svg>'
    return {
      "plain svg via blob": await draw(rect, "blob"),
      "plain svg via data": await draw(rect, "data"),
      "foreignObject svg via blob": await draw(foreign, "blob"),
      "foreignObject svg via data": await draw(foreign, "data"),
    }
  })

  console.log(JSON.stringify({
    mechanism,
    "target tab was backgrounded while capturing": await other.evaluate(() => true) && (await context.pages()).indexOf(target) > 0,
    "cross-origin image loaded into the page": withCross,
    "element capture with cross-origin image": crossCapture,
    "images left in the tainted document": imagesAfterRemoval,
    "same-document capture after removing images": sameDocumentCapture,
    "images after reload": imagesAfterReload,
    "element capture on a fresh document": cleanCapture,
    "full-page capture": fullCapture,
  }, null, 2))
} finally {
  await context.close()
  await app.close()
}