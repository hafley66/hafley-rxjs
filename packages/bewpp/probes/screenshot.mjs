// Throwaway probe: what does page.screenshot() mean under MV3?
// Captures run in the service worker (no focus games). Measures: permission floor, captured dimensions vs
// viewport vs document height, whether pixels follow the active tab, and whether a caller can target a tab.
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import Fastify from "fastify"
import { chromium } from "playwright"

const pngSize = dataUrl => {
  const buffer = Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64")
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), bytes: buffer.length }
}

const flat = `<!doctype html><html><body style="margin:0;background:#c00">
<div style="height:4000px"></div><script>window.__marker="flat-red"</script></body></html>`
const noise = `<!doctype html><html><body style="margin:0">
<canvas id="c" width="780" height="500"></canvas><script>
  const ctx = document.getElementById("c").getContext("2d")
  const image = ctx.createImageData(780, 500)
  for (let i = 0; i < image.data.length; i += 4) { image.data[i] = Math.random() * 255; image.data[i+1] = Math.random() * 255; image.data[i+2] = Math.random() * 255; image.data[i+3] = 255 }
  ctx.putImageData(image, 0, 0)
  window.__marker = "noise"
</script></body></html>`

const directory = mkdtempSync(join(tmpdir(), "bewpp-shot-"))
const extension = join(directory, "extension")
mkdirSync(extension)
writeFileSync(join(extension, "background.js"), "globalThis.shot = async () => { try { const u = await chrome.tabs.captureVisibleTab(undefined, { format: 'png' }); return { ok: true, dataUrl: u } } catch (e) { return { ok: false, error: String(e?.message ?? e) } } }\nchrome.runtime.onInstalled.addListener(() => {})")
writeFileSync(join(extension, "manifest.json"), JSON.stringify({
  manifest_version: 3, name: "shot-probe", version: "1.0",
  permissions: ["tabs"], host_permissions: ["<all_urls>"],
  background: { service_worker: "background.js" },
}, null, 2))

const app = Fastify()
app.get("/flat.html", (_request, reply) => reply.type("text/html").send(flat))
app.get("/noise.html", (_request, reply) => reply.type("text/html").send(noise))
const address = await app.listen({ host: "127.0.0.1", port: 0 })

const context = await chromium.launchPersistentContext(join(directory, "profile"), {
  channel: "chromium", viewport: { width: 800, height: 600 },
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
})

try {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker")
  const flatTab = await context.newPage()
  await flatTab.goto(`${address}/flat.html`)
  const noiseTab = await context.newPage()
  await noiseTab.goto(`${address}/noise.html`)

  const idFor = async url => worker.evaluate(async u => (await chrome.tabs.query({ url: u }))[0]?.id ?? null, url)
  const activate = async id => worker.evaluate(async i => { await chrome.tabs.update(i, { active: true }); return (await chrome.tabs.get(i)).active }, id)
  const shot = async () => worker.evaluate("shot()")

  const flatId = await idFor(`${address}/flat.html`)
  const noiseId = await idFor(`${address}/noise.html`)
  const windowId = await worker.evaluate(async i => (await chrome.tabs.get(i)).windowId, noiseId)

  await activate(flatId)
  const flatShot = await shot()
  const flatView = await flatTab.evaluate(() => ({ inner: [window.innerWidth, window.innerHeight], doc: document.documentElement.scrollHeight }))

  await activate(noiseId)
  const noiseShot = await shot()

  const rapid = []
  for (let index = 0; index < 6; index++) rapid.push(await shot())

  console.log(JSON.stringify({
    "flat page: viewport vs document height": flatView,
    "capture while flat tab active": flatShot.ok ? pngSize(flatShot.dataUrl) : flatShot.error,
    "capture while noise tab active": noiseShot.ok ? pngSize(noiseShot.dataUrl) : noiseShot.error,
    "pixels follow the active tab (byte size differs with entropy)": flatShot.ok && noiseShot.ok && noiseShot.dataUrl.length > flatShot.dataUrl.length * 3,
    "capture covers full document height": flatShot.ok && pngSize(flatShot.dataUrl).height >= flatView.doc,
    "rapid capture failures": rapid.filter(r => !r.ok).length,
    "rapid capture dimensions": rapid.filter(r => r.ok).map(r => `${pngSize(r.dataUrl).width}x${pngSize(r.dataUrl).height}`),
    "windowId available to caller": windowId,
  }, null, 2))
} finally {
  await context.close()
  await app.close()
}