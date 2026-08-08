import { expect, test } from "@playwright/test"

test("generic rectangles compose DOM and Cytoscape canvas content", async ({ page }, testInfo) => {
  await page.goto("/e2e-rectangle-lab.html")
  await expect(page.locator('[data-kind="session"]')).toContainText("src/3_engine.ts")
  await expect(page.getByTestId("cytoscape-rectangle").locator("canvas")).toHaveCount(3)

  await page.evaluate(() => window.__rectangleLab.events.$({ type: "moved", id: "session", position: { x: 170, y: 120 } }))
  await expect.poll(() => page.evaluate(() => window.__rectangleLab.rectangles.$().find(({ id }) => id === "session")?.position)).toEqual({ x: 170, y: 120 })
  await page.getByRole("button", { name: "Undo" }).click()
  await expect.poll(() => page.evaluate(() => window.__rectangleLab.rectangles.$().find(({ id }) => id === "session")?.position)).toEqual({ x: 30, y: 70 })

  await testInfo.attach("rectangle-event-journal", {
    body: Buffer.from(JSON.stringify(await page.evaluate(() => ({ journal: window.__rectangleLab.journal.$(), rectangles: window.__rectangleLab.rectangles.$() })), null, 2)),
    contentType: "application/json",
  })
  await page.screenshot({ path: "test-results/react-flow-cytoscape-rectangles.png", fullPage: true })
})
