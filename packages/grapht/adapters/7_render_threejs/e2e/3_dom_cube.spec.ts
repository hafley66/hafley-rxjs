import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { expect, test } from "@playwright/test"

// CSS2D lab: HTML popovers parented into the Three.js scene graph track projected
// cube vertices. Asserts (1) the CSS2D layer is placed at scale 1 under devicePixelRatio 2,
// (2) popovers are live DOM and move, (3) the light config holds its 30 fps cap while the
// heavy config (full-window 2x MSAA, uncapped) starves under SwiftShader. Renderer-process
// CDP metrics are written to the receipt for reference only.

const receiptsDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "receipts")
const KEYS = ["TaskDuration", "ScriptDuration", "LayoutDuration", "RecalcStyleDuration", "LayoutCount", "RecalcStyleCount", "JSHeapUsedSize"] as const
type Metrics = Record<(typeof KEYS)[number], number>

test.use({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 })

async function measure(page: import("@playwright/test").Page, url: string, windowMs: number): Promise<{ delta: Metrics; frames: number; fps: number }> {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send("Performance.enable")
  await page.goto(url)
  await page.waitForFunction(() => (window as unknown as { __cube?: unknown }).__cube !== undefined)
  await page.waitForTimeout(1000)
  const snap = async (): Promise<Metrics> => {
    const { metrics } = await cdp.send("Performance.getMetrics")
    return Object.fromEntries(metrics.filter((m) => (KEYS as readonly string[]).includes(m.name)).map((m) => [m.name, m.value])) as Metrics
  }
  const framesOf = () => page.evaluate(() => (window as unknown as { __cube: { frames: () => number } }).__cube.frames())
  const a = await snap()
  const f0 = await framesOf()
  await page.waitForTimeout(windowMs)
  const z = await snap()
  const f1 = await framesOf()
  const delta = Object.fromEntries(KEYS.map((k) => [k, z[k] - a[k]])) as Metrics
  await cdp.detach()
  const frames = f1 - f0
  return { delta, frames, fps: frames / (windowMs / 1000) }
}

test("DOM layer sits at scale 1 under dpr 2 and popovers are live DOM", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(String(e)))
  await page.goto("/labs/dom-cube.html")
  await page.waitForFunction(() => document.querySelectorAll(".pop").length === 8)
  const before = await page.evaluate(() => [...document.querySelectorAll(".pop")].map((el) => el.getBoundingClientRect().x))
  await page.waitForTimeout(400)
  const after = await page.evaluate(() => {
    const pops = [...document.querySelectorAll(".pop")]
    const layer = pops[0].parentElement as HTMLElement
    const canvas = document.querySelector("canvas") as HTMLCanvasElement
    const rect = layer.getBoundingClientRect()
    return {
      xs: pops.map((el) => el.getBoundingClientRect().x),
      layerId: layer.id,
      layerTransform: getComputedStyle(layer).transform,
      layerCss: [rect.width, rect.height],
      canvasAttr: [canvas.width, canvas.height],
      canvasCss: [canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height],
    }
  })
  expect(errors).toEqual([])
  expect(after.layerId).toBe("dom-layer")
  expect(after.layerTransform).toBe("none")
  expect(after.layerCss).toEqual([800, 600])
  expect(after.canvasAttr).toEqual([800, 600])
  expect(after.canvasCss).toEqual([800, 600])
  expect(after.xs.some((x, i) => Math.abs(x - before[i]) > 1)).toBe(true)
  await page.screenshot({ path: resolve(receiptsDir, "generated", "dom-cube.png") })
})

test("light config holds its frame cap while the heavy config starves", async ({ page }) => {
  const windowMs = 4000
  const heavy = await measure(page, "/labs/dom-cube.html?heavy=1", windowMs)
  const light = await measure(page, "/labs/dom-cube.html", windowMs)
  // Renderer-process CDP metrics are receipt only: under --use-angle=swiftshader the
  // raster cost lives in the GPU process, so achieved frame throughput is the measurement
  // that survives both in-process GL and ANGLE configurations.
  const receipt = { windowMs, heavy, light, fpsRatio: light.fps / Math.max(heavy.fps, 1e-6), measuredAt: new Date().toISOString() }
  await mkdir(resolve(receiptsDir, "generated"), { recursive: true })
  await writeFile(resolve(receiptsDir, "generated", "dom-cube.perf.json"), JSON.stringify(receipt, null, 2))
  expect(light.fps).toBeGreaterThan(25)          // holds its 30 fps cap
  expect(heavy.fps).toBeLessThan(light.fps / 2)  // full-window 2x MSAA uncapped cannot
})
