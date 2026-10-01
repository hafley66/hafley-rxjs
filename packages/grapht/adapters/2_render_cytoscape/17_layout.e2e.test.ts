import { expect, test } from "@hafley66/vitest-playwright"

test("proof page switches FS, zigzag and fCoSE through the Cytoscape renderer", async ({ page, baseURL }) => {
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  await page.goto(baseURL!)
  await expect(page.locator("#readout")).toContainText("sequence")
  for (const name of ["FS", "zigzag", "fCoSE", "FS"]) {
    await page.getByLabel("Graph layout", { exact: true }).selectOption(name)
    await expect(page.locator("#readout")).toContainText("layout | cytoscape")
    await expect(page.locator("body")).toHaveAttribute("data-layout", name)
    await expect(page.locator("#host canvas").first()).toBeVisible()
  }
  // Inspect actual Cytoscape projection, including bends and node-bound endpoints.
  const projection = await page.evaluate(() => {
    const cy = (document.querySelector("#host") as unknown as { _cyreg: { cy: import("cytoscape").Core } })._cyreg.cy
    const link = cy.$id("link")
    return { source: link.source().id(), target: link.target().id(), bends: link.data("segmentWeights").length, segmented: link.hasClass("graph-native-segments") }
  })
  expect(projection).toEqual({ source: "tests", target: "lib", bends: 2, segmented: true })
  expect(errors).toEqual([])
})
