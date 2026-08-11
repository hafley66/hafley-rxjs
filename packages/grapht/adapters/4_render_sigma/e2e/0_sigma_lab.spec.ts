import { test, expect } from "@playwright/test"

for (const fixture of ["grid-1k", "grid-5k", "grid-10k"]) {
  test(`projects ${fixture} through Sigma and records browser receipt`, async ({ page }) => {
    const pageErrors: string[] = []
    page.on("pageerror", error => pageErrors.push(error.stack ?? error.message))
    const nodes = { "grid-1k": 1_000, "grid-5k": 5_000, "grid-10k": 10_000 }[fixture]
    await page.goto(`/?nodes=${nodes}&pause=1`)
    await expect(page.locator("#sigma-container[data-visual-valid='true']"), pageErrors.join("\n")).toHaveCount(1, { timeout: 30_000 })
    await expect(page.locator("#sigma-container")).toHaveScreenshot(`${fixture}.png`)
    await page.evaluate(() => window.dispatchEvent(new Event("grapht-continue")))
    const receipt = page.locator("#receipt")
    await expect(receipt, pageErrors.join("\n")).toHaveText(/\S+/, { timeout: 30_000 })
    const value = JSON.parse(await receipt.textContent() ?? "{}") as {
      fixture: string
      nodeCount: number
      edgeCount: number
      visualValidity: { drawnNodeCount: number; canvasCount: number }
      canvasCount: number
    }
    expect(value).toMatchObject({ fixture: `grid-${nodes}` })
    expect(value.nodeCount).toBeGreaterThan(0)
    expect(value.edgeCount).toBeGreaterThan(0)
    expect(value.visualValidity.drawnNodeCount).toBeGreaterThan(0)
    expect(value.visualValidity.canvasCount).toBeGreaterThan(0)
  })
}
