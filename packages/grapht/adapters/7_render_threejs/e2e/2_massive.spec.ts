import { mkdir, writeFile } from "node:fs/promises"
import { expect, test } from "@playwright/test"

const sizes = (process.env.GRAPHT_MASSIVE_SIZES ?? "1000,5000,10000,25000,50000,100000,250000,500000,1000000")
  .split(",")
  .map(Number)

test.describe.configure({ mode: "serial" })

for (const representation of ["retained", "particles"] as const) {
  for (const nodes of sizes) {
    test(`Three.js WebGL ${representation} ${nodes} nodes`, async ({ page }) => {
      test.setTimeout(900_000)
      const errors: string[] = []
      page.on("pageerror", error => errors.push(error.stack ?? error.message))
      const startedAt = performance.now()

      await page.goto(`/?nodes=${nodes}&renderer=webgl&representation=${representation}&pause=1`)
      const valid = page.locator("#three-container[data-visual-valid='true']")
      await expect(valid, errors.join("\n")).toHaveCount(1, { timeout: 120_000 })
      const visualReadyMs = performance.now() - startedAt

      await mkdir("receipts/massive", { recursive: true })
      await page.screenshot({ path: `receipts/massive/webgl-${representation}-${nodes}.png` })
      await page.evaluate(() => window.dispatchEvent(new Event("grapht-continue")))
      await expect(page.locator("#receipt"), errors.join("\n")).toHaveText(/\S+/, { timeout: 720_000 })

      const receipt = JSON.parse(await page.locator("#receipt").textContent() ?? "{}")
      const result = { nodes, representation, visualReadyMs, ...receipt }
      await writeFile(`receipts/massive/webgl-${representation}-${nodes}.json`, JSON.stringify(result, null, 2))
      expect(receipt.status).toBe("healthy")
      expect(receipt.visualValidity?.valid).toBe(true)
    })
  }
}
