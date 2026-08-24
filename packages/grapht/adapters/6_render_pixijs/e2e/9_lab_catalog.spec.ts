import { expect, test } from "@playwright/test"

test("demo catalog groups labs and persists the selected preview", async ({ page }) => {
  await page.goto("/labs/index.html?demo=ecosystem")

  await expect(page.locator(".demo-group h3")).toHaveText(["Graph rendering", "Scene pipeline"])
  await expect(page.locator(".demo-entry")).toHaveText([
    "Renderer benchmark",
    "Interactive graph canvas",
    "Pixi ecosystem sequence",
    "Scene grid",
    "Scene cube",
    "DOM cube",
  ])
  await expect(page.locator("[data-demo='ecosystem']")).toHaveAttribute("aria-current", "page")
  await expect(page.locator("#demo-frame")).toHaveAttribute("src", "./ecosystem.html")
  await expect(page.locator("#demo-title")).toHaveText("Pixi ecosystem sequence")

  await page.locator("[data-demo='scene-cube']").click()
  await expect(page).toHaveURL(/\?demo=scene-cube$/)
  await expect(page.locator("#demo-frame")).toHaveAttribute("src", "./scene-cube.html")

  await page.locator("#demo-filter").fill("DOM cube")
  await expect(page.locator(".demo-entry:not([hidden])")).toHaveText(["DOM cube"])
  await expect(page.locator(".demo-group:not([hidden]) h3")).toHaveText(["Scene pipeline"])
})

test("queryless server root opens the structured catalog", async ({ page }) => {
  await page.goto("/")

  await expect(page).toHaveURL(/\/labs\/$/)
  await expect(page.locator("[data-demo='ecosystem']")).toHaveAttribute("aria-current", "page")
  await expect(page.locator("#demo-frame")).toHaveAttribute("src", "./ecosystem.html")
})
