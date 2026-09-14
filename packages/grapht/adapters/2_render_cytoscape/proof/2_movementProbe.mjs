import { expect } from "@playwright/test"

/** Real pointer gestures exercise both native inputs and source-SVG inputs against the same log. */
export async function verifyMovement(page) {
  const panel = page.locator("#interaction-controls")
  const openPanel = async open => { if (await panel.evaluate(el => el.open) !== open) await panel.locator(":scope > summary").click() }
  const position = async (mode, edge = false) => {
    if (mode === "cytoscape") return JSON.parse(await page.locator("#host").getAttribute(edge ? "data-grapht-movable-edge-position" : "data-grapht-movable-position"))
    return page.locator(`[data-graph-role="${edge ? "message-line" : "actor-shape"}"]`).first().evaluate((element, edge) => {
      if (edge) { const point = element.getPointAtLength(element.getTotalLength() / 2).matrixTransform(element.getScreenCTM()); return { x: point.x, y: point.y } }
      const b = element.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
    }, edge)
  }
  for (const fixture of ["paired-mermaid", "paired-d2"]) {
    await page.locator("#paired-example").selectOption(fixture)
    await expect(page.locator("body")).toHaveAttribute("data-source", fixture)
    await page.locator("#ribbon").uncheck()
    await page.locator("#groups").uncheck()
    for (const mode of ["document", "cytoscape"]) {
      await page.locator(mode === "document" ? "#document" : "#renderer-cytoscape").click()
      await expect(page.locator("#readout")).toContainText(`${fixture} | ${mode}`)
      if (mode === "cytoscape") await expect(page.locator("#host")).toHaveAttribute("data-grapht-native-edge-count", "4")
      await openPanel(true)
      await page.locator("#edit-movement").check()
      await openPanel(false)
      for (const edge of [false, true]) {
        const before = await position(mode, edge)
        const delta = edge ? { x: 0, y: 35 } : { x: 35, y: 0 }
        await page.mouse.move(before.x, before.y)
        await page.mouse.down()
        await page.mouse.move(before.x + delta.x, before.y + delta.y, { steps: 5 })
        await page.mouse.up()
        await expect.poll(async () => {
          const after = await position(mode, edge)
          return { x: Math.round(after.x - before.x), y: Math.round(after.y - before.y) }
        }, { message: `${fixture} ${mode} ${edge ? "message" : "actor"} drag` }).toEqual(delta)
        await openPanel(true)
        await expect(page.locator("#undo-move")).toBeEnabled()
        await page.locator("#undo-move").click()
        await expect.poll(async () => { const after = await position(mode, edge); return { x: Math.round(after.x - before.x), y: Math.round(after.y - before.y) } }).toEqual({ x: 0, y: 0 })
        await page.locator("#redo-move").click()
        await expect.poll(async () => { const after = await position(mode, edge); return { x: Math.round(after.x - before.x), y: Math.round(after.y - before.y) } }).toEqual(delta)
        if (fixture === "paired-d2" && mode === "cytoscape" && edge) {
          await page.reload()
          await page.locator("#paired-example").selectOption(fixture)
          await expect(page.locator("body")).toHaveAttribute("data-source", fixture)
          await page.locator("#renderer-cytoscape").click()
          await expect(page.locator("#host")).toHaveAttribute("data-grapht-native-edge-count", "4")
          await expect.poll(async () => { const after = await position(mode, edge); return { x: Math.round(after.x - before.x), y: Math.round(after.y - before.y) } }).toEqual(delta)
          await openPanel(true)
        }
        await page.locator("#undo-move").click()
        await openPanel(false)
      }
      await openPanel(true)
      await page.locator("#edit-movement").uncheck()
      await openPanel(false)
    }
  }
  await page.locator("#ribbon").check()
  await page.locator("#groups").check()
  await page.locator("#sequence").click()
  await page.locator("#document").click()
}
