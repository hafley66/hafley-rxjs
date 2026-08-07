import { expect, test } from "@playwright/test"

test("the package culls 500 nodes and retains DOM-sourced panel state", async ({ page }, testInfo) => {
  await page.goto("/e2e-perf-lab.html")
  await expect(page.locator(".dv-tab")).toHaveCount(2)
  await expect(page.getByTestId("details-panel")).toBeVisible()

  const input = page.getByLabel("Panel 1 input")
  await input.fill("retained through package state")
  await expect.poll(() => page.evaluate(() => window.__dockFlowPerf.state.$().values["panel-0"]))
    .toBe("retained through package state")

  await page.getByRole("button", { name: "500 nodes" }).click()
  await expect.poll(() => page.evaluate(() => window.__dockFlowPerf.state.$().requestedNodes)).toBe(500)
  const mounted = await page.getByTestId("live-panel").count()
  expect(mounted).toBeLessThan(500)

  await testInfo.attach("react-dock-and-flow-state", {
    body: Buffer.from(JSON.stringify({ mounted, state: await page.evaluate(() => window.__dockFlowPerf.state.$()) }, null, 2)),
    contentType: "application/json",
  })
  await page.screenshot({ path: "test-results/react-dock-and-flow-perf.png", fullPage: true })
})

