import { expect, test } from "@playwright/test"

test("Pixi v8 ecosystem packages render and interact in one sequence scene", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.stack ?? error.message))
  await page.goto("/labs/ecosystem.html")

  const lab = page.locator("#ecosystem[data-ready='true']")
  await expect(lab, errors.join("\n")).toHaveCount(1)
  await expect(lab).toHaveAttribute("data-viewport-plugins", "drag,pinch,wheel,decelerate,clampZoom")
  await expect(lab).toHaveAttribute("data-layout", "true")
  await expect(lab).toHaveAttribute("data-ui-button", "true")
  await expect(lab).toHaveAttribute("data-cullable", "true")
  await expect(lab).toHaveAttribute("data-dom-container", "true")
  expect(Number(await lab.getAttribute("data-svg-element-nodes"))).toBeGreaterThan(20)
  await expect(page.locator("#receipt")).toContainText('"message": 3')
  await expect(page.locator("#receipt")).toContainText('"note": 1')

  const canvas = lab.locator("canvas")
  const box = await canvas.boundingBox()
  if (!box) throw new Error("ecosystem canvas has no bounds")
  await page.mouse.click(box.x + 65, box.y + 37)
  await expect(lab).toHaveAttribute("data-fit-count", "1")
  await page.mouse.click(box.x + 160, box.y + 37)
  await expect(lab).toHaveAttribute("data-active-tool", "SVGScene")
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.568)
  await expect(lab).toHaveAttribute("data-hovered-role", "message")
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.54)
  await expect(lab).toHaveAttribute("data-hovered-role", "message")

  await page.mouse.wheel(0, -180)
  await page.mouse.move(box.x + 30, box.y + box.height - 30)
  await page.mouse.down()
  await page.mouse.move(box.x + 65, box.y + box.height - 5)
  await page.mouse.up()
  await expect(lab).toHaveAttribute("data-ticker-started", "false", { timeout: 2_000 })

  await expect(lab).toHaveScreenshot("pixi-ecosystem-sequence.png", { animations: "disabled" })
  expect(errors).toEqual([])
})
