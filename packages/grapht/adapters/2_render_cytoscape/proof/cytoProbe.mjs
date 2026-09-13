// Exercise the shipped chunks: a development-server import can hide UMD/global collisions.
import { chromium, expect } from "@playwright/test"
import { preview } from "vite"
import { fileURLToPath } from "node:url"

const base = "/hafley-rxjs/grapht/proof/"
const server = process.argv[2] ? undefined : await preview({
  configFile: false,
  base,
  build: { outDir: fileURLToPath(new URL("../../../site/dist/proof", import.meta.url)) },
  preview: { host: "127.0.0.1", port: 0, open: false },
})
let browser
try {
  browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const errors = []
  page.on("pageerror", error => errors.push(error.message))
  await page.goto(process.argv[2] ?? server.resolvedUrls.local[0])
  await expect(page.locator("#host svg").first()).toBeVisible()
  await expect(page.locator('[data-performance-readout]')).toHaveCount(1)
  await expect(page.locator('[data-metric="fps"]')).toHaveText(/^\d+$/)
  await expect(page.locator('[data-metric="used"]')).toHaveText(/^(\d+\.\d MiB|unavailable)$/)
  await page.locator("#arch").click()
  await expect(page.locator("#renderer-cytoscape")).toBeDisabled()
  await expect(page.locator("#host canvas")).toHaveCount(0)
  for (const source of ["sequence", "sequence"]) {
    const rootId = source === "arch" ? "epic" : "seq"
    await page.locator(`#${source}`).click()
    const ribbon = page.locator("[data-sticky-ribbon] [data-sticky-id]")
    const groups = page.locator("[data-sticky-groups] [data-sticky-id]")
    if (source === "sequence") await expect(ribbon).toHaveCount(16)
    const documentNodes = await page.locator("#host *").count()
    const expectedHeaders = (await page.locator("[data-sticky-id] text").allTextContents()).sort()
    await page.getByRole("button", { name: "cytoscape renderer", exact: true }).click()
    await expect(page.locator('#readout')).toContainText(`${source} | cytoscape`)
    // Wait for the lazy import and render, including failures caught by the page itself.
    await expect.poll(async () => ({
      failed: (await page.locator('#readout').textContent()).includes("failed"),
      canvas: await page.locator('#host canvas').count() > 0,
      svg: await page.locator(`#host [data-revision-id] svg`).count() > 0,
    })).toEqual({ failed: false, canvas: true, svg: false })
    await expect.poll(async () => (await page.locator("[data-sticky-id] text").allTextContents()).sort()).toEqual(expectedHeaders)
    if (source === "sequence") {
      const groupCount = await groups.count()
      expect(groupCount).toBeGreaterThan(0)
      await page.locator("#ribbon").uncheck()
      await expect(ribbon).toHaveCount(0)
      await page.locator("#groups").uncheck()
      await expect(groups).toHaveCount(0)
      await page.locator("#ribbon").check()
      await page.locator("#groups").check()
      await expect(ribbon).toHaveCount(16)
      await expect(groups).toHaveCount(groupCount)
    }
    await expect(page.locator("#host")).toHaveAttribute("data-grapht-native-edge-count", "125")
    const nativeNodes = await page.locator("#host *").count()
    expect(nativeNodes).toBeLessThan(documentNodes / 2)
    const camera = async () => {
      const value = await page.locator("#readout").textContent()
      const match = /camera x (-?[\d.]+) y (-?[\d.]+) scale ([\d.]+)/.exec(value)
      return { x: Number(match[1]), y: Number(match[2]), scale: Number(match[3]) }
    }
    const before = await camera()
    await page.mouse.move(640, 400)
    await page.mouse.wheel(0, 100)
    await expect.poll(async () => (await camera()).y).toBeLessThan(before.y - 100)
    expect((await camera()).scale).toBe(before.scale)
    await page.keyboard.down("Control")
    await page.mouse.wheel(0, -100)
    await page.keyboard.up("Control")
    await expect.poll(async () => (await camera()).scale).toBeGreaterThan(before.scale)
    await page.getByRole("button", { name: "fit", exact: true }).click()
    await expect.poll(camera).toEqual(before)
    // Fit must cancel the entire half-second tail, including pending animation frames.
    await page.waitForTimeout(550)
    expect(await camera()).toEqual(before)
    console.log(`Native sequence: DOM ${documentNodes} -> ${nativeNodes}`)
    await page.getByRole("button", { name: "document renderer", exact: true }).click()
    await expect(page.locator('#host canvas')).toHaveCount(0)
    await expect(page.locator("#host svg").first()).toBeVisible()
    const domBefore = await camera()
    await page.mouse.move(640, 400)
    await page.mouse.wheel(0, 100)
    await expect.poll(async () => (await camera()).y).toBeLessThan(domBefore.y - 100)
    expect((await camera()).scale).toBe(domBefore.scale)
    await page.getByRole("button", { name: "fit", exact: true }).click()
    await expect.poll(camera).toEqual(domBefore)
  }
  expect(errors).toEqual([])
  console.log("Production proof passed: native sequence, reduced DOM, shared wheel pan/zoom, sticky toggles, and document return.")
} finally {
  await browser?.close()
  await new Promise((resolve, reject) => server ? server.httpServer.close(error => error ? reject(error) : resolve()) : resolve())
}
