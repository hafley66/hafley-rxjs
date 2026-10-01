import { expect, test } from "@hafley66/vitest-playwright"

test("type viewer renders directory branches and expands one level by double-click", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  const url = new URL("../../../../../boop2/docs/types/dist/index.html", import.meta.url)
  for (const source of ["TypeSpec", "Rust"]) for (const layout of ["FS", "zigzag"]) {
    await page.goto(`${url.href}?source=${source}&layout=${layout}`)
    await expect(page.locator("body")).toHaveAttribute("data-ready", `${source}:${layout}`)
    const initial = await page.evaluate(() => {
      const cy = (document.querySelector("#host") as unknown as { _cyreg: { cy: import("cytoscape").Core } })._cyreg.cy
      const node = cy.nodes('[kind = "node"]').first()
      return { count: cy.nodes('[kind = "node"]').length, point: node.renderedPosition(), compounds: cy.nodes(":parent").length, zoom: cy.zoom() }
    })
    expect(initial.compounds).toBe(0)
    expect(initial.zoom).toBe(1)
    expect(initial.count).toBeGreaterThan(0)
    await page.mouse.dblclick(initial.point.x, initial.point.y)
    await expect.poll(() => page.evaluate(() => {
      const cy = (document.querySelector("#host") as unknown as { _cyreg: { cy: import("cytoscape").Core } })._cyreg.cy
      return cy.nodes('[kind = "node"]').length
    })).toBeGreaterThan(initial.count)
    const expanded = await page.evaluate(() => {
      const cy = (document.querySelector("#host") as unknown as { _cyreg: { cy: import("cytoscape").Core } })._cyreg.cy
      return { compounds: cy.nodes(":parent").length, point: cy.nodes('[kind = "node"]').first().renderedPosition() }
    })
    expect(expanded.compounds).toBe(0)
    // Separate two double-click gestures beyond Cytoscape's multi-click window.
    await page.waitForTimeout(400)
    await page.mouse.dblclick(expanded.point.x, expanded.point.y)
    await expect(page.locator("#readout")).toContainText(`${initial.count} visible nodes`)
  }
  expect(errors).toEqual([])
})

test("explorer folds all, expands levels, reveals search results, and expands the full source", async ({ page }) => {
  await page.goto(new URL("../../../../../boop2/docs/types/dist/index.html", import.meta.url).href)
  await expect(page.locator("body")).toHaveAttribute("data-visible", "6")
  await page.getByRole("button", { name: "Expand one level", exact: true }).click()
  await expect(page.locator("body")).not.toHaveAttribute("data-visible", "6")
  await page.getByRole("button", { name: "Fold all", exact: true }).click()
  await expect(page.locator("body")).toHaveAttribute("data-visible", "6")
  await page.getByLabel("Find a type or file").fill("UnixMs")
  await page.locator("#results button").filter({ hasText: "schema/0_ids.tsp/Boop/UnixMs" }).first().click()
  await expect(page.locator("#details")).toContainText("UnixMs")
  await expect(page.locator("body")).not.toHaveAttribute("data-visible", "6")
  await page.getByRole("button", { name: "Expand all", exact: true }).click()
  await expect(page.locator("body")).toHaveAttribute("data-visible", "2920")
  await page.getByRole("button", { name: "Fold all", exact: true }).click()
  await expect(page.locator("body")).toHaveAttribute("data-visible", "6")
  const rootY = await page.evaluate(() => {
    const cy = (document.querySelector("#host") as unknown as { _cyreg: { cy: import("cytoscape").Core } })._cyreg.cy
    return cy.nodes('[kind = "node"]').first().renderedPosition().y
  })
  expect(rootY).toBeGreaterThan(48)
  expect(rootY).toBeLessThan(800)
})

test("minimap shows the viewport and moves the main camera on click", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  await page.goto(new URL("../../../../../boop2/docs/types/dist/index.html", import.meta.url).href)
  await page.getByRole("button", { name: "Expand one level", exact: true }).click()
  await page.getByRole("button", { name: "Expand one level", exact: true }).click()
  const minimap = page.getByLabel("Graph minimap", { exact: true })
  await expect(minimap).toBeVisible()
  await expect(minimap.locator("img")).toHaveAttribute("src", /^data:image\/png/)
  await expect(minimap.locator(".cytoscape-navigatorView")).toBeVisible()
  // The navigator coalesces content snapshots for 250ms.
  await page.waitForTimeout(400)
  const before = await page.evaluate(() => (document.querySelector("#host") as unknown as { _cyreg: { cy: import("cytoscape").Core } })._cyreg.cy.pan().y)
  const box = await minimap.boundingBox()
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height * 0.8)
  await expect.poll(() => page.evaluate(() => (document.querySelector("#host") as unknown as { _cyreg: { cy: import("cytoscape").Core } })._cyreg.cy.pan().y)).not.toBe(before)
  expect(errors).toEqual([])
})

test("minimap reuses its thumbnail during pan and refreshes after folding", async ({ page }) => {
  await page.goto(new URL("../../../../../boop2/docs/types/dist/index.html", import.meta.url).href)
  await page.getByRole("button", { name: "Expand one level", exact: true }).click()
  const thumbnail = page.locator("[data-grapht-minimap] img")
  await expect(thumbnail).toHaveAttribute("src", /^data:image\/png/)
  await page.waitForTimeout(400)
  const before = await thumbnail.getAttribute("src")
  await page.evaluate(() => {
    const img = document.querySelector("[data-grapht-minimap] img")!
    img.setAttribute("data-updates", "0")
    const observer = new MutationObserver(records => {
      img.setAttribute("data-updates", String(Number(img.getAttribute("data-updates")) + records.length))
    })
    observer.observe(img, { attributes: true, attributeFilter: ["src"] })
  })
  await page.mouse.move(700, 400)
  await page.mouse.wheel(0, 500)
  await page.waitForTimeout(600)
  await expect(thumbnail).toHaveAttribute("data-updates", "0")
  await page.getByRole("button", { name: "Fold all", exact: true }).click()
  await expect.poll(() => thumbnail.getAttribute("src")).not.toBe(before)
})


test("GPU culls offscreen submissions without changing graph membership or rebuilding during pan", async ({ page }) => {
  await page.goto(new URL("../../../../../boop2/docs/types/dist/index.html", import.meta.url).href)
  await expect(page.locator("#host")).toHaveAttribute("data-grapht-backend", "webgl2")
  await page.getByRole("button", { name: "Expand all", exact: true }).click()
  await page.waitForTimeout(400)
  const read = () => page.evaluate(() => {
    const cy = (document.querySelector("#host") as any)._cyreg.cy
    return { nodes: cy.nodes('[kind = "node"]').length, ...cy.renderer().drawing.graphtStats }
  })
  const before = await read()
  expect(before.nodes).toBe(2920)
  expect(before.culled).toBeGreaterThan(before.submitted)
  await page.evaluate(() => {
    const cy = (document.querySelector("#host") as any)._cyreg.cy
    cy.graphtMutations = 0
    cy.on("add remove data style position", () => cy.graphtMutations++)
    cy.pan({ x: 16, y: -5000 })
  })
  await page.waitForTimeout(400)
  const after = await read()
  expect(after.nodes).toBe(before.nodes)
  expect(after.submitted).toBeGreaterThan(0)
  expect(after.culled).toBeGreaterThan(after.submitted)
  expect(await page.evaluate(() => (document.querySelector("#host") as any)._cyreg.cy.graphtMutations)).toBe(0)
})

test("GPU request falls back to Canvas when WebGL2 is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: any[]) {
      return type === "webgl2" ? null : (getContext as any).call(this, type, ...args)
    } as typeof getContext
  })
  await page.goto(new URL("../../../../../boop2/docs/types/dist/index.html", import.meta.url).href)
  await expect(page.locator("#host")).toHaveAttribute("data-grapht-backend", "canvas")
  await expect(page.locator("body")).toHaveAttribute("data-visible", "6")
  await page.getByRole("button", { name: "Expand one level", exact: true }).click()
  await expect(page.locator("body")).not.toHaveAttribute("data-visible", "6")
})

test("expanded FS overview fills both axes and tracks pan, zoom and minimap dragging", async ({ page }) => {
  await page.goto(new URL("../../../../../boop2/docs/types/dist/index.html", import.meta.url).href)
  await page.getByRole("button", { name: "Expand all", exact: true }).click()
  const image = page.locator("[data-grapht-minimap] img")
  await expect(image).toHaveJSProperty("naturalWidth", 200)
  await expect(image).toHaveJSProperty("naturalHeight", 150)
  await page.waitForTimeout(300)
  const pixelBounds = await image.evaluate((img: HTMLImageElement) => {
    const canvas = document.createElement("canvas"); canvas.width = 200; canvas.height = 150
    const ctx = canvas.getContext("2d")!; ctx.drawImage(img, 0, 0)
    const data = ctx.getImageData(0, 0, 200, 150).data
    const xs: number[] = [], ys: number[] = []
    for (let y = 0; y < 150; y++) for (let x = 0; x < 200; x++) if (data[(y * 200 + x) * 4 + 3]) { xs.push(x); ys.push(y) }
    return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }
  })
  expect(pixelBounds.width).toBeGreaterThan(170)
  expect(pixelBounds.height).toBeGreaterThan(125)
  const view = page.locator(".cytoscape-navigatorView")
  const before = await view.getAttribute("style")
  const thumbnail = await image.getAttribute("src")
  await page.evaluate(() => (document.querySelector("#host") as any)._cyreg.cy.pan({ x: -100, y: -30000 }))
  await expect.poll(() => view.getAttribute("style")).not.toBe(before)
  const panned = await view.getAttribute("style")
  await page.evaluate(() => (document.querySelector("#host") as any)._cyreg.cy.zoom(0.5))
  await expect.poll(() => view.getAttribute("style")).not.toBe(panned)
  expect(await image.getAttribute("src")).toBe(thumbnail)
  const box = await page.getByLabel("Graph minimap", { exact: true }).boundingBox()
  await page.mouse.move(box!.x + 100, box!.y + 60)
  await page.mouse.down()
  await page.mouse.move(box!.x + 120, box!.y + 120, { steps: 5 })
  await page.mouse.up()
  const center = await page.evaluate(() => {
    const cy = (document.querySelector("#host") as any)._cyreg.cy
    const bounds = cy.nodes().filter((n: any) => n.visible()).boundingBox({ includeLabels: false, includeOverlays: false })
    const extent = cy.extent()
    return ((extent.y1 + extent.y2) / 2 - bounds.y1) / bounds.h
  })
  expect(center).toBeGreaterThan(0.7)
  expect(center).toBeLessThan(0.95)
})
