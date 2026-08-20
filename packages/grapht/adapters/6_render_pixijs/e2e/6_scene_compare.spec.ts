import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { expect, test } from "@playwright/test"

// Same spinning cube, three sinks: scene pipeline -> pixi(), scene pipeline -> dom(), and native
// Pixi with direct sprite writes (no Scene/keyframes/frames). Frames per second per (renderer, n).

const receiptsDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "receipts")
type Lab = { renderer: string; frames(): number; inspect(): { ids: { length: number }; ready: boolean } }

async function measure(page: import("@playwright/test").Page, renderer: string, n: number, windowMs: number) {
  await page.goto(`/labs/scene-cube.html?renderer=${renderer}&n=${n}`)
  await page.waitForFunction(() => (window as unknown as { __lab?: Lab }).__lab?.inspect().ready === true)
  await page.waitForTimeout(500)
  const f0 = await page.evaluate(() => (window as unknown as { __lab: Lab }).__lab.frames())
  await page.waitForTimeout(windowMs)
  const f1 = await page.evaluate(() => (window as unknown as { __lab: Lab }).__lab.frames())
  const views = await page.evaluate(() => (window as unknown as { __lab: Lab }).__lab.inspect().ids.length)
  const frames = f1 - f0
  return { renderer, n, views, frames, fps: +(frames / (windowMs / 1000)).toFixed(1), msPerFrame: +(windowMs / Math.max(frames, 1)).toFixed(2) }
}

test("dom renderer mounts the cube as HTML elements with SVG edges", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(String(e)))
  const r = await measure(page, "dom", 1000, 500)
  expect(errors).toEqual([])
  expect(r.views).toBe(1008)
  expect(await page.locator("#host line").count()).toBe(12)
  expect(await page.locator('.scene-item[data-kind="card"]').count()).toBe(8)
  expect(await page.locator("#host canvas").count()).toBe(0)
  await page.screenshot({ path: resolve(receiptsDir, "generated", "scene-cube-dom.png") })
})

test("compare receipt: pixi vs dom vs native at matched loads", async ({ page }) => {
  test.setTimeout(300_000)
  const windowMs = 3000
  const plan: [string, number][] = [
    ["native", 1_000], ["pixi", 1_000], ["dom", 1_000],
    ["native", 5_000], ["pixi", 5_000], ["dom", 5_000],
    ["native", 20_000], ["pixi", 20_000], ["dom", 20_000],
    ["native", 100_000], ["pixi", 100_000],
  ]
  const rows = []
  for (const [renderer, n] of plan) rows.push(await measure(page, renderer, n, windowMs))
  const receipt = { windowMs, headless: "chromium swiftshader 800x600", rows, measuredAt: new Date().toISOString() }
  await mkdir(resolve(receiptsDir, "generated"), { recursive: true })
  await writeFile(resolve(receiptsDir, "generated", "scene-cube.compare.json"), JSON.stringify(receipt, null, 2))
  for (const r of rows) expect(r.frames).toBeGreaterThan(0)
})
