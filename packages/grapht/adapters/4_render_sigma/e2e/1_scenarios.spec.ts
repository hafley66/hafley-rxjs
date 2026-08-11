import { expect, test } from "@playwright/test"

test("runs the shared scenario table after visual validity", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.stack ?? error.message))
  await page.goto("/?nodes=1000&pause=1")
  await expect(page.locator("#sigma-container[data-visual-valid='true']"), errors.join("\n")).toHaveCount(1, { timeout: 30_000 })
  await expect(page.locator("#sigma-container")).toHaveScreenshot("scenarios.png")
  await page.evaluate(() => window.dispatchEvent(new Event("grapht-continue")))
  const receipt = page.locator("#receipt")
  await expect(receipt, errors.join("\n")).toHaveText(/\S+/, { timeout: 30_000 })
  const value = JSON.parse(await receipt.textContent() ?? "{}") as { status: string; visualValidity?: { valid: boolean }; scenarios: { scenario: string; sample: { support: string } }[] }
  expect(value).toMatchObject({ status: "healthy", visualValidity: { valid: true } })
  expect(value.scenarios.map(item => item.scenario)).toContain("camera-pan")
  expect(value.scenarios.map(item => item.scenario)).toContain("graph-dispose")
})
