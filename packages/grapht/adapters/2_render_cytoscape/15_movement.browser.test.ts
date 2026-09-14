import { expect, it } from "vitest"
import { sequenceFrame } from "./proof/0_sequenceFrame.ts"
import { moveGraphFrame } from "../../src/2_graph/23_manualMovement.js"
import { d2SvgFrame } from "../../src/2_graph/22_d2SvgFrame.js"
import { createDocumentGraphFrameResource } from "./8_documentRenderer.ts"
import { createCytoscapeGraphFrameResource } from "./6_graphRenderer.ts"

it.each(["paired-d2", "paired-mermaid"] as const)("projects and restores actor lanes and message routes in both renderers: %s", async example => {
  const frame = await sequenceFrame({ width: 800, height: 600 }, example)
  const actor = Object.keys(frame.geometry.columnBoundsById!)[0]
  const message = Object.values(frame.graph).find(item => item.type === "edge" && item.fromId === actor)!
  const moved = moveGraphFrame(frame, { [actor]: { x: 40, y: 0 }, [message.id]: { x: 0, y: 25 } }, true)
  const host = document.createElement("div")
  host.style.cssText = "position:relative;width:800px;height:600px"
  document.body.appendChild(host)
  const receipt = { enterIds: [], updateIds: [], exitIds: [] }
  const doc = createDocumentGraphFrameResource(host)
  try {
    doc.render(frame, receipt)
    const shape = host.querySelector<SVGGraphicsElement>(`[data-graph-id="${CSS.escape(actor)}"][data-graph-role="actor-shape"]`)!
    const before = shape.getBoundingClientRect().x
    doc.render(moved, receipt)
    expect(shape.getBoundingClientRect().x - before).toBeCloseTo(40 * frame.camera.scale, 3)
    const path = host.querySelector<SVGGeometryElement>(`[data-graph-id="${CSS.escape(message.id)}"][data-graph-role="message-line"]`)!
    // Screen endpoints must agree with canonical world geometry even through nested D2 viewports.
    const source = path.getPointAtLength(0).matrixTransform(path.getScreenCTM()!)
    const expected = { x: moved.geometry.routesById[message.id][0] * frame.camera.scale + frame.camera.x + host.getBoundingClientRect().x, y: moved.geometry.routesById[message.id][1] * frame.camera.scale + frame.camera.y + host.getBoundingClientRect().y }
    expect(source.x).toBeCloseTo(expected.x, 2)
    expect(source.y).toBeCloseTo(expected.y, 2)
    doc.render(frame, receipt)
    expect(shape.getBoundingClientRect().x).toBeCloseTo(before, 3)
  } finally { doc.unsubscribe() }
  const cyto = createCytoscapeGraphFrameResource(host)
  try {
    cyto.render(moved, receipt)
    const edge = cyto.cy.edges().filter(edge => edge.data("graphId") === message.id).first() as import("cytoscape").EdgeSingular
    expect(edge.source().position().x).toBeCloseTo(moved.geometry.routesById[message.id][0], 3)
    expect(edge.source().position().y).toBeCloseTo(moved.geometry.routesById[message.id][1], 3)
    cyto.render(frame, receipt)
    expect(edge.source().position().x).toBeCloseTo(frame.geometry.routesById[message.id][0], 3)
    expect(cyto.cy.edges(".graph-native-message").length).toBe(4)
  } finally { cyto.unsubscribe(); host.remove() }
})

it("retains scoped D2 object identities and resolves local connection endpoints", () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><svg viewBox="-10 0 300 100" width="300" height="100">${["scope.a", "scope.b"].map((id, i) => `<g class="${btoa(id)}"><g class="shape"><rect x="${i * 200}" y="10" width="40" height="40"/></g><text>${id}</text></g>`).join("")}<g class="${btoa("scope.(a -&gt; b)[0]")}"><path class="connection" d="M40 30 L200 30"/></g></svg></svg>`
  const frame = d2SvgFrame(document, svg, "scope: { a -> b }", { width: 600, height: 300 })
  const edge = frame.graph["scope.(a -> b)[0]"]
  expect(edge).toEqual({ id: "scope.(a -> b)[0]", type: "edge", fromId: "scope.a", toId: "scope.b", direction: "forward", parentId: "epic", data: { label: "" } })
  expect(frame.presentation.sealedSvgArtifactsByRootId.epic.source?.text).toBe("scope: { a -> b }")
  expect([...frame.geometry.routesById[edge.id]].slice(0, 2)).toEqual([50, 30])
})

it("keeps D2 multiline labels at their measured position with bounded native wrapping", () => {
  const frame = d2SvgFrame(document, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><g class="${btoa("container")}"><g class="shape"><rect width="400" height="300"/></g><text x="20" y="25" style="font-size:16px"><tspan x="20" dy="0">Source identity</tspan><tspan x="20" dy="24">Revision IDs preserve source states.</tspan></text></g></svg>`, "container: source identity", { width: 800, height: 600 })
  const host = document.createElement("div")
  host.style.cssText = "position:relative;width:800px;height:600px"
  document.body.appendChild(host)
  const resource = createCytoscapeGraphFrameResource(host)
  try {
    resource.render(frame, { enterIds: [], updateIds: [], exitIds: [] })
    const shape = resource.cy.nodes('[nativeKind="actor-shape"]').first()
    const label = resource.cy.nodes('[nativeKind="source-label"]').first()
    expect({ shapeLabel: shape.data("label"), text: label.data("label"), count: resource.cy.nodes('[nativeKind="source-label"]').length, wrap: label.style("text-wrap"), outline: label.style("text-outline-width") }).toEqual({ shapeLabel: "", text: "Source identity\nRevision IDs preserve source states.", count: 1, wrap: "wrap", outline: "0px" })
    expect((resource.cy.elements() as any).sortByZIndex().last().data("nativeKind")).toBe("source-label")
    expect(label.position().y).toBeLessThan(60)
    expect(label.data("width")).toBeLessThan(400)
    expect(parseFloat(label.style("text-max-width"))).toBeCloseTo(label.data("width"), 2)
    resource.applyTheme("dark")
    expect(label.style("color")).toBe("rgb(226,232,240)")
  } finally { resource.unsubscribe(); host.remove() }
})

it("does not invalidate native styles for repeated or unrelated hover paint", async () => {
  const frame = await sequenceFrame({ width: 800, height: 600 }, "paired-mermaid")
  const actors = Object.keys(frame.geometry.columnBoundsById!)
  const host = document.createElement("div")
  host.style.cssText = "position:relative;width:800px;height:600px"
  document.body.appendChild(host)
  const resource = createCytoscapeGraphFrameResource(host)
  try {
    resource.render(frame, { enterIds: [], updateIds: [], exitIds: [] })
    const writes = new Set<string>()
    resource.cy.on("style", event => { if (event.target !== resource.cy) writes.add(String(event.target.data("graphId"))) })
    const hops = { [actors[0]]: 0, [actors[1]]: 1 }
    resource.applyHover!(hops)
    expect(writes.size).toBeGreaterThan(0)
    writes.clear()
    resource.applyHover!({ ...hops })
    expect([...writes]).toEqual([])
    resource.applyHover!({ ...hops, [actors[1]]: 2 })
    expect(writes.has(actors[1])).toBe(true)
    expect(writes.has(actors[2])).toBe(false)
    expect(writes.has(actors[0])).toBe(false)
  } finally { resource.unsubscribe(); host.remove() }
})
