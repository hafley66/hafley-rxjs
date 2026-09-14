import { expect } from "@playwright/test"

/** Real pointer input catches overlays that synthetic renderer events bypass. */
export async function verifyHoverInteraction(page) {
  await page.locator("#dark").check()
  await page.locator("#interaction-controls").evaluate(element => { element.open = true })
  await page.locator("#hover-debug").check()
  await page.locator("#hover-mode").selectOption("both")
  await page.locator("#hover-relations").selectOption("actors")
  await page.locator("#hover-depth").fill("2")
  await page.locator("#hover-depth").dispatchEvent("change")
  await page.locator("#hover-color-mode").uncheck()
  await page.locator("#interaction-controls").evaluate(element => { element.open = false })
  for (const fixture of ["paired-d2", "paired-mermaid"]) {
    await page.locator("#paired-example").selectOption(fixture)
    await expect(page.locator("body")).toHaveAttribute("data-source", fixture)
    for (const mode of ["document", "cytoscape"]) {
      await page.locator(mode === "document" ? "#document" : "#renderer-cytoscape").click()
      await expect(page.locator(mode === "document" ? '#host [data-graph-role="actor-shape"]' : "#host canvas").first()).toBeVisible()
      for (const actor of ["alice", "archive"]) {
        const position = await page.locator("#host").evaluate((host, { mode, actor }) => {
          if (mode === "cytoscape") return host._cyreg.cy.nodes('[nativeKind="actor-shape"]').filter(node => node.data("graphId").includes(`:${actor}#`)).first().renderedPosition()
          const element = [...host.querySelectorAll('[data-graph-role="actor-shape"]')].find(element => element.dataset.graphId.includes(`:${actor}#`))
          const bounds = element.getBoundingClientRect()
          return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
        }, { mode, actor })
        await page.mouse.move(1, 790)
        await page.mouse.move(position.x, position.y)
        await expect(page.locator("#hover-inspector")).toContainText(`:${actor}#`)
        await expect.poll(() => page.locator("#host").evaluate((host, mode) => {
          return ["alice", "bob", "archive"].map(actor => {
            if (mode === "cytoscape") {
              const node = host._cyreg.cy.nodes('[nativeKind="actor-shape"]').filter(node => node.data("graphId").includes(`:${actor}#`)).first()
              return [Number(node.style("opacity")), node.hasClass("graph-focused")]
            }
            const binding = [...host.querySelectorAll('[data-graph-role="actor-shape"]')].find(element => element.dataset.graphId.includes(`:${actor}#`))
            const primitive = binding.localName === "g" ? binding.querySelector("rect, path, polygon") : binding
            return [Number(getComputedStyle(primitive).opacity), primitive.classList.contains("graph-focused")]
          })
        }, mode)).toEqual(actor === "alice" ? [[1, true], [1, true], [0.55, true]] : [[0.55, true], [1, true], [1, true]])
      }
    }
  }
  await page.locator("#interaction-controls").evaluate(element => { element.open = true })
  await page.locator("#hover-debug").uncheck()
  await page.locator("#interaction-controls").evaluate(element => { element.open = false })
}
