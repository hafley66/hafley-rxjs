import { expect, test } from "@playwright/test"
import { mkdir, writeFile } from "node:fs/promises"

test("renders the shared fixture with Vello in Chromium before scenarios", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.stack ?? error.message))
  await page.goto("/?nodes=1000&pause=1")
  const canvas = page.locator("#graph[data-visual-valid='true']")
  await expect(canvas, errors.join("\n")).toHaveCount(1, { timeout: 60_000 })
  await page.waitForTimeout(2_000)
  await page.screenshot({ path: "receipts/chromium/vello-chromium.png", fullPage: false })
  await page.evaluate(() => window.dispatchEvent(new Event("grapht-continue")))
  const receipt = page.locator("#receipt")
  await expect(receipt, errors.join("\n")).toHaveText(/\S+/, { timeout: 60_000 })
  const value = JSON.parse(await receipt.textContent() ?? "{}") as { status: string; visualValidity?: { valid: boolean }; scenarios: { scenario: string; sample: { support: string } }[] }
  expect(value).toMatchObject({ status: "healthy", visualValidity: { valid: true } })
  expect(value.scenarios.map(item => item.scenario)).toContain("camera-pan")
  expect(value.scenarios.map(item => item.scenario)).toContain("camera-wheel-zoom")
  expect(value.scenarios.map(item => item.scenario)).toContain("style-update")
  expect(value.scenarios.map(item => item.scenario)).toContain("position-update")
  expect(value.scenarios.map(item => item.scenario)).toContain("viewport-resize")
  expect(value.scenarios.map(item => item.scenario)).toContain("layout-apply")
  expect(value.scenarios.map(item => item.scenario)).toContain("position-animation")
  expect(value.scenarios.map(item => item.scenario)).toContain("graph-replace")
  expect(value.scenarios.map(item => item.scenario)).toContain("graph-dispose")
  await mkdir("receipts/chromium", { recursive: true })
  await writeFile("receipts/chromium/vello-chromium.receipt.json", JSON.stringify(value, null, 2))
})
