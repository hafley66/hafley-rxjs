import { expect, test } from "@hafley66/vitest-playwright"

test("camera frames preserve elements; GPU keeps crossing edges and exact FS segments", async ({ page, baseURL }) => {
  await page.goto(baseURL!)
  const moduleUrl = `/@fs${new URL("./6_graphRenderer.ts", import.meta.url).pathname}`
  const result = await page.evaluate(async url => {
    const { createCytoscapeGraphFrameResource } = await new Function("url", "return import(url)")(url)
    const host = document.createElement("div")
    host.style.cssText = "position:fixed;inset:0;width:800px;height:600px;z-index:100"
    document.body.append(host)
    const resource = createCytoscapeGraphFrameResource(host, undefined, undefined, { gpu: true, minimap: true })
    const frame = {
      graph: { a: { id: "a", type: "node" }, b: { id: "b", type: "node" }, ab: { id: "ab", type: "edge", fromId: "a", toId: "b", direction: "none" } },
      geometry: { revisionId: "one", boundsById: { a: { x: -1000, y: 100, width: 20, height: 20 }, b: { x: 2000, y: 300, width: 20, height: 20 } }, endpointAnchorById: {}, routesById: { ab: new Float32Array([-990, 110, 300, 110, 300, 310, 2010, 310]) }, headerBoundsById: {} },
      camera: { x: 0, y: 0, scale: 1, viewport: { x: 0, y: 0, width: 800, height: 600 } },
      presentation: { stickyHeaders: [], hiddenIds: new Set(), focusedIds: new Set(), labelsById: {}, sealedSvgArtifactsByRootId: {} },
    }
    const receipt = { enterIds: [], updateIds: [], exitIds: [] }
    resource.render(frame, receipt)
    let mutations = 0
    resource.cy.on("add remove data position style", () => mutations++)
    resource.render({ ...frame, camera: { ...frame.camera, x: 10, y: 20 } }, receipt)
    const cameraMutations = mutations
    const drawing = resource.cy.renderer().drawing
    const points = drawing._getEdgePoints
    const spans: number[][] = []
    drawing._getEdgePoints = function (edge: unknown) {
      const result = points.call(this, edge)
      if (result) spans.push([...result])
      return result
    }
    resource.cy.forceRender()
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const stats = { ...drawing.graphtStats }
    const pan = { ...resource.cy.pan() }
    // Changing labels must still invalidate the camera-only shortcut.
    resource.render({ ...frame, presentation: { ...frame.presentation, labelsById: { a: { text: "updated" } } } }, receipt)
    const label = resource.cy.$id("a").data("label")
    resource.render({ ...frame, graph: {}, geometry: { ...frame.geometry, revisionId: "empty", boundsById: {}, routesById: {} } }, receipt)
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const image = host.querySelector("img") as HTMLImageElement
    await image.decode()
    const canvas = document.createElement("canvas"); canvas.width = 200; canvas.height = 150
    const context = canvas.getContext("2d")!; context.drawImage(image, 0, 0)
    const emptyMap = context.getImageData(0, 0, 200, 150).data.every(value => value === 0)
    const emptyViewHidden = (host.querySelector(".cytoscape-navigatorView") as HTMLElement).hidden
    resource.unsubscribe()
    host.remove()
    return { cameraMutations, stats, pan, label, spans, emptyMap, emptyViewHidden }
  }, moduleUrl)
  expect({ mutations: result.cameraMutations, pan: result.pan, label: result.label, stats: result.stats }).toEqual({ mutations: 0, pan: { x: 10, y: 20 }, label: "updated", stats: { submitted: 1, culled: 3 } })
  expect([result.emptyMap, result.emptyViewHidden]).toEqual([true, true])
  expect(result.spans.length).toBeGreaterThanOrEqual(3)
  expect(result.spans.every(span => span.length === 4 && span.every(Number.isFinite))).toBe(true)
  expect(result.spans.map(span => span.map(value => Math.round(value * 1e6) / 1e6))).toContainEqual([300, 110, 300, 310])
})
