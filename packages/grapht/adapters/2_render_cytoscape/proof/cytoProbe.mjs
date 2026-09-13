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
  for (const source of ["arch", "sequence"]) {
    const rootId = source === "arch" ? "epic" : "seq"
    await page.locator(`#${source}`).click()
    await page.getByRole("button", { name: "cytoscape renderer", exact: true }).click()
    await expect(page.locator('#readout')).toContainText(`${source} | cytoscape`)
    // Wait for the lazy import and render, including failures caught by the page itself.
    await expect.poll(async () => ({
      failed: (await page.locator('#readout').textContent()).includes("failed"),
      canvas: await page.locator('#host canvas').count() > 0,
      svg: await page.locator(`#host [data-revision-id="${rootId}:svg:1"] svg`).count() > 0,
    })).toEqual({ failed: false, canvas: true, svg: true })
    await page.getByRole("button", { name: "document renderer", exact: true }).click()
    await expect(page.locator('#host canvas')).toHaveCount(0)
    await expect(page.locator("#host svg").first()).toBeVisible()
  }
  expect(errors).toEqual([])
  console.log("Production proof passed: architecture and sequence render in Cytoscape and return to document mode.")
} finally {
  await browser?.close()
  await new Promise((resolve, reject) => server ? server.httpServer.close(error => error ? reject(error) : resolve()) : resolve())
}
