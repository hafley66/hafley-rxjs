import { expect, it } from "vitest"
import { sequenceFrame } from "./proof/0_sequenceFrame.ts"
import { createCytoscapeGraphFrameResource } from "./6_graphRenderer.ts"
import { createDocumentGraphFrameResource } from "./8_documentRenderer.ts"

it("renders all source messages as native edges without an SVG artifact or node images", async () => {
  const frame = await sequenceFrame({ width: 1280, height: 800 })
  const host = document.createElement("div")
  host.style.cssText = "position:relative;width:1280px;height:800px"
  document.body.appendChild(host)
  const doc = createDocumentGraphFrameResource(host, undefined, { inset: 44 })
  doc.render(frame, { enterIds: ["seq"], updateIds: [], exitIds: [] })
  const documentCount = host.querySelectorAll("*").length
  doc.unsubscribe()
  const native = createCytoscapeGraphFrameResource(host, undefined, { inset: 44 })
  try {
    native.render(frame, { enterIds: ["seq"], updateIds: [], exitIds: [] })
    const messages = Object.values(frame.graph).filter(item => item.type === "edge")
    expect(messages.length).toBe(125)
    expect(native.cy.edges().map(edge => ({ id: edge.data("graphId"), label: edge.data("label") })).sort((a,b) => a.id.localeCompare(b.id))).toEqual(messages.map(item => ({ id: item.id, label: (item.data as {label:string}).label })).sort((a,b) => a.id.localeCompare(b.id)))
    expect({
      edges: native.cy.edges().length,
      actors: native.cy.nodes(".graph-actor-shape").length,
      svgArtifacts: native.sealedSvgViews.size,
      nodeImages: native.cy.nodes().filter(node => node.style("background-image") !== "none").length,
      reducedDOM: host.querySelectorAll("*").length < documentCount / 2,
    }).toMatchInlineSnapshot(`
      {
        "actors": 16,
        "edges": 125,
        "nodeImages": 0,
        "reducedDOM": true,
        "svgArtifacts": 0,
      }
    `)
    expect(host.querySelectorAll("svg:not(:has([data-sticky-ribbon]))").length).toBe(0)
  } finally { native.unsubscribe(); host.remove() }
})
