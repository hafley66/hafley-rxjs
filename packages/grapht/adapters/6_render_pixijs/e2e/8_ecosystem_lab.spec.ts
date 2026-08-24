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
  await expect(lab).toHaveAttribute("data-sticky-actors", "3")
  await expect(lab).toHaveAttribute("data-sticky-groups", "2")
  expect(Number(await lab.getAttribute("data-svg-element-nodes"))).toBeGreaterThan(20)
  await expect(page.locator("#receipt")).toContainText('"message": 3')
  await expect(page.locator("#receipt")).toContainText('"note": 1')

  const canvas = lab.locator("canvas")
  const box = await canvas.boundingBox()
  if (!box) throw new Error("ecosystem canvas has no bounds")
  await page.mouse.click(box.x + 65, box.y + 37)
  await expect(lab).toHaveAttribute("data-fit-count", "1")
  await page.mouse.click(box.x + 250, box.y + 37)
  await expect(lab).toHaveAttribute("data-active-tool", "viewport")
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.568)
  await expect(lab).toHaveAttribute("data-hovered-role", "message")
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.54)
  await expect(lab).toHaveAttribute("data-hovered-role", "message")

  await page.mouse.move(box.x + 30, box.y + box.height - 30)
  await page.mouse.down()
  await page.mouse.move(box.x + 65, box.y + box.height - 230)
  await page.mouse.up()
  await expect(lab).toHaveAttribute("data-sticky-group-states", /stuck/)
  await expect(lab).toHaveAttribute("data-ticker-started", "false", { timeout: 2_000 })
  await expect(lab).toHaveScreenshot("pixi-ecosystem-sequence.png", { animations: "disabled" })
  expect(errors).toEqual([])
})

test("Pixi text resolution follows viewport zoom", async ({ page }) => {
  await page.goto("/labs/ecosystem.html")
  const lab = page.locator("#ecosystem[data-ready='true']")
  await expect(lab).toHaveCount(1)
  const initialTextResolution = Number(await lab.getAttribute("data-text-resolution"))
  const box = await lab.locator("canvas").boundingBox()
  if (!box) throw new Error("ecosystem canvas has no bounds")

  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5)
  await page.mouse.wheel(0, -1_000)

  await expect.poll(async () => Number(await lab.getAttribute("data-text-resolution"))).toBeGreaterThan(initialTextResolution)
  await expect(lab).toHaveAttribute("data-ticker-started", "false", { timeout: 2_000 })
})

test("viewport keeps dragging after the pointer leaves the canvas", async ({ page }) => {
  await page.goto("/labs/ecosystem.html")
  const lab = page.locator("#ecosystem[data-ready='true']")
  await expect(lab).toHaveCount(1)
  const box = await lab.locator("canvas").boundingBox()
  if (!box) throw new Error("ecosystem canvas has no bounds")

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x - 120, box.y + box.height / 2, { steps: 12 })
  await expect(lab).toHaveAttribute("data-sticky-layout-requests", /[1-9]\d*/)
  await page.mouse.up()
  await expect(lab).toHaveAttribute("data-pan-probe", /"gotPointerCapture":1/)
  const panProbe = JSON.parse(await lab.getAttribute("data-pan-probe") ?? "null")
  expect({
    pointerMovesContinued: panProbe.pointerMoves >= 12,
    captured: panProbe.gotPointerCapture === 1,
    framesRendered: panProbe.frames > 0,
    stickyWorkBoundedByFrames: panProbe.stickyFlushes <= panProbe.frames,
  }).toEqual({
    pointerMovesContinued: true,
    captured: true,
    framesRendered: true,
    stickyWorkBoundedByFrames: true,
  })
  await expect(lab).toHaveAttribute("data-ticker-started", "false", { timeout: 2_000 })
})
