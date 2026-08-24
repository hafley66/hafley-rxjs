import { expect, test } from "@playwright/test"

test("Pixi projects Mermaid, D2 sequence, and D2 code SVG text", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.stack ?? error.message))
  await page.goto("/labs/sequence-formats.html")

  const lab = page.locator("#sequence-formats[data-ready='true']")
  await expect(lab).toHaveAttribute("data-format", "mermaid")
  await expect(lab).toHaveAttribute("data-invalid-text-positions", "0")

  await page.getByRole("button", { name: "D2 sequence" }).click()
  await expect(lab).toHaveAttribute("data-format", "d2-sequence")
  await expect(lab).toHaveAttribute("data-invalid-text-positions", "0")

  await page.getByRole("button", { name: "D2 code block" }).click()
  await expect(lab).toHaveAttribute("data-format", "d2-code")
  await expect(lab).toHaveAttribute("data-invalid-text-positions", "0")
  await expect(lab).toHaveAttribute("data-code-block-count", "1")
  expect(Number(await lab.getAttribute("data-text-count"))).toBe(5)
  await expect(lab).toHaveScreenshot("pixi-d2-code-block.png", { animations: "disabled" })
  expect(errors).toEqual([])
})
