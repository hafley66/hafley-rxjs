import { expect, test } from "@playwright/test"

test("Pixi graph canvas supports hover, selection, node drag, pan, zoom, and fit", async ({ page }) => {
  await page.goto("/labs/graph-canvas.html")
  const graph = page.locator("#graph[data-ready='true']")
  await expect(graph).toHaveCount(1)
  await expect(graph).toHaveAttribute("data-node-count", "8")
  await expect(graph).toHaveAttribute("data-edge-count", "10")

  const canvas = graph.locator("canvas")
  const box = await canvas.boundingBox()
  if (!box) throw new Error("Pixi graph canvas has no bounds")
  await page.mouse.move(box.x + box.width * 0.13, box.y + box.height * 0.5)
  await expect(page.locator("#state")).toContainText("hover: source")
  await page.mouse.click(box.x + box.width * 0.13, box.y + box.height * 0.5)
  await expect(page.locator("#state")).toContainText("selected: source")

  await page.mouse.wheel(0, -240)
  await page.mouse.move(box.x + 20, box.y + 20)
  await page.mouse.down()
  await page.mouse.move(box.x + 50, box.y + 45)
  await page.mouse.up()
  await page.locator("#fit").click()
  await expect(graph).toHaveScreenshot("pixi-graph-canvas.png", { animations: "disabled" })
})
