import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { expect, test } from "@playwright/test"

// pixi() Renderer over the @hafley66/scene pipeline: sprites by id with a pool, cards as DOMContainer,
// kept ids tween between steps, unsubscribe tears the canvas down.

const receiptsDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "receipts")

type Lab = { step: { next(i: number): void; value: number }; inspect(): { ids: string[]; pooled: number; ready: boolean } | null }
const lab = (page: import("@playwright/test").Page) => page.evaluate(() => (window as unknown as { __lab: Lab }).__lab.inspect())
const setStep = (page: import("@playwright/test").Page, i: number) => page.evaluate((n) => (window as unknown as { __lab: Lab }).__lab.step.next(n), i)
const xOf = (page: import("@playwright/test").Page, id: string) =>
  page.evaluate((target) => {
    const host = document.getElementById("host") as HTMLElement & { __pixiScene?: { views: Map<string, { x: number }> } }
    return host.__pixiScene?.views.get(target)?.x ?? null
  }, id)

test("mounts, draws scene 0 with 300 sprites and 4 DOM cards", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(String(e)))
  await page.goto("/labs/scene-grid.html")
  await page.waitForFunction(() => (window as unknown as { __lab: Lab }).__lab.inspect()?.ready === true)
  const info = await lab(page)
  expect(errors).toEqual([])
  expect(info?.ids.length).toBe(304)
  expect(await page.locator(".scene-card").count()).toBe(4)
  expect(await page.locator("#host canvas").count()).toBe(1)
  await page.screenshot({ path: resolve(receiptsDir, "generated", "scene-grid-0.png") })
})

const viewOf = (page: import("@playwright/test").Page, id: string, tag: string) =>
  page.evaluate(
    ([target, mark]) => {
      const host = document.getElementById("host") as HTMLElement & { __pixiScene?: { views: Map<string, { __tag?: string }> } }
      const view = host.__pixiScene?.views.get(target)
      if (!view) return null
      if (mark) view.__tag = mark
      return view.__tag ?? null
    },
    [id, tag] as const,
  )

test("step 0 -> 1 keeps n100..n299, recycles the 100 exited sprites into the 100 entrants, and tweens a kept id", async ({ page }) => {
  await page.goto("/labs/scene-grid.html")
  await page.waitForFunction(() => (window as unknown as { __lab: Lab }).__lab.inspect()?.ready === true)
  await viewOf(page, "n0", "was-n0")
  const before = await xOf(page, "n150")
  await setStep(page, 1)
  const midHandle = await page.waitForFunction(
    (start) => {
      const host = document.getElementById("host") as HTMLElement & { __pixiScene?: { views: Map<string, { x: number }> } }
      const x = host.__pixiScene?.views.get("n150")?.x
      return x !== undefined && x !== start ? x : false
    },
    before,
    { polling: 16, timeout: 2000 },
  )
  const mid = (await midHandle.jsonValue()) as number
  await page.waitForTimeout(900)
  const after = await xOf(page, "n150")
  const info = await lab(page)
  expect(info?.ids).toContain("n150")
  expect(info?.ids).not.toContain("n0")
  expect(info?.ids).toContain("n399")
  expect(info?.ids.length).toBe(304)
  expect(info?.pooled).toBe(0)
  const recycled = await Promise.all(ids100to399(page))
  expect(recycled).toContain("was-n0")
  expect(before).toBe(400)
  expect(after).toBe(280)
  expect(mid).toBeGreaterThan(280)
  expect(mid).toBeLessThan(400)
  await page.screenshot({ path: resolve(receiptsDir, "generated", "scene-grid-1.png") })
})

function ids100to399(page: import("@playwright/test").Page) {
  return Array.from({ length: 100 }, (_, i) => viewOf(page, `n${300 + i}`, ""))
}

test("step 2 ring reuses pooled sprites, then unsubscribe removes the canvas", async ({ page }) => {
  await page.goto("/labs/scene-grid.html")
  await page.waitForFunction(() => (window as unknown as { __lab: Lab }).__lab.inspect()?.ready === true)
  await setStep(page, 1)
  await page.waitForTimeout(700)
  await setStep(page, 2)
  await page.waitForTimeout(700)
  const info = await lab(page)
  expect(info?.ids.length).toBe(404)
  expect(info?.pooled).toBe(0)
  await page.screenshot({ path: resolve(receiptsDir, "generated", "scene-grid-2.png") })
  await page.evaluate(() => (window as unknown as { __lab: { sub: { unsubscribe(): void } } }).__lab.sub.unsubscribe())
  await page.waitForTimeout(200)
  expect(await page.locator("#host canvas").count()).toBe(0)
  expect(await page.locator(".scene-card").count()).toBe(0)
})
