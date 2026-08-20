import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { expect, test } from "@playwright/test"

// Spinning cube through scene -> keyframes(layout) -> frames(t=1) -> pixi(). Every tick is a new
// keyframe with an all-keep diff; this measures the per-frame cost of the abstraction at scale.

const receiptsDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "receipts")
type Lab = { n: number; frames(): number; inspect(): { ids: string[]; ready: boolean } | null }
const labOf = (page: import("@playwright/test").Page) => page.evaluate(() => (window as unknown as { __lab: Lab }).__lab.inspect())

async function measure(page: import("@playwright/test").Page, n: number, windowMs: number) {
  await page.goto(`/labs/scene-cube.html?n=${n}`)
  await page.waitForFunction(() => (window as unknown as { __lab: Lab }).__lab.inspect()?.ready === true)
  await page.waitForTimeout(500)
  const f0 = await page.evaluate(() => (window as unknown as { __lab: Lab }).__lab.frames())
  await page.waitForTimeout(windowMs)
  const f1 = await page.evaluate(() => (window as unknown as { __lab: Lab }).__lab.frames())
  const frames = f1 - f0
  return { n, frames, fps: frames / (windowMs / 1000), msPerFrame: windowMs / Math.max(frames, 1) }
}

test("renders n=2000 cube points plus 8 DOM corner cards and keeps spinning", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(String(e)))
  const r = await measure(page, 2000, 1000)
  const info = await labOf(page)
  expect(errors).toEqual([])
  expect(info?.ids.length).toBe(2008)
  expect(await page.locator(".scene-card").count()).toBe(8)
  expect(r.frames).toBeGreaterThan(5)
  await page.screenshot({ path: resolve(receiptsDir, "generated", "scene-cube.png") })
})

test("load receipt: frames per second at 1k, 20k, 100k points", async ({ page }) => {
  test.setTimeout(120_000)
  const windowMs = 3000
  const rows = []
  for (const n of [1_000, 20_000, 100_000]) rows.push(await measure(page, n, windowMs))
  const receipt = { windowMs, headless: "chromium swiftshader", rows, measuredAt: new Date().toISOString() }
  await mkdir(resolve(receiptsDir, "generated"), { recursive: true })
  await writeFile(resolve(receiptsDir, "generated", "scene-cube.load.json"), JSON.stringify(receipt, null, 2))
  for (const r of rows) expect(r.frames).toBeGreaterThan(0)
})
