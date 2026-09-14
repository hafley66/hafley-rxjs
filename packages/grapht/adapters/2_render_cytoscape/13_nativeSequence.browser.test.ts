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

it("rethemes native sequence canvas and sticky overlays without moving the camera", async () => {
  const frame = await sequenceFrame({ width: 1280, height: 800 })
  const host = document.createElement("div")
  host.style.cssText = "position:relative;width:1280px;height:800px"
  document.body.appendChild(host)
  const native = createCytoscapeGraphFrameResource(host, undefined, { inset: 44, fullWidth: 70, chipWidth: 34, gap: 4 })
  try {
    native.render(frame, { enterIds: ["seq"], updateIds: [], exitIds: [] })
    const sample = () => ({
      actorFill: native.cy.$(".graph-actor-shape").first().style("background-color"),
      actorBorder: native.cy.$(".graph-actor-shape").first().style("border-color"),
      lifelineFill: native.cy.$("node[nativeKind = 'lifeline']").first().style("background-color"),
      messageLine: native.cy.$(".graph-native-message").first().style("line-color"),
      messageText: native.cy.$(".graph-native-message").first().style("color"),
      ribbonFill: host.querySelector("[data-sticky-ribbon] [data-sticky-id] rect")?.getAttribute("fill"),
      groupFill: host.querySelector("[data-sticky-groups] [data-sticky-id] rect")?.getAttribute("fill"),
      background: host.style.background,
    })
    const cameraBefore = { pan: native.cy.pan(), zoom: native.cy.zoom() }
    const light = sample()
    native.applyTheme("dark")
    const dark = sample()
    native.applyTheme("light")
    const restored = sample()
    expect(host.querySelectorAll("[data-sticky-ribbon] [data-sticky-id]").length).toBeGreaterThan(0)
    expect(host.querySelectorAll("[data-sticky-groups] [data-sticky-id]").length).toBeGreaterThan(0)
    expect(dark).not.toEqual(light)
    expect(restored).toEqual(light)
    expect({
      darkActorFill: dark.actorFill,
      darkActorBorder: dark.actorBorder,
      darkLifelineFill: dark.lifelineFill,
      darkMessageLine: dark.messageLine,
      darkMessageText: dark.messageText,
      darkRibbonFill: dark.ribbonFill,
      darkGroupFill: dark.groupFill,
      lightRibbonFill: light.ribbonFill,
      lightGroupFill: light.groupFill,
    }).toMatchInlineSnapshot(`
      {
        "darkActorBorder": "rgb(96,165,250)",
        "darkActorFill": "rgb(30,41,59)",
        "darkGroupFill": "#172554",
        "darkLifelineFill": "rgb(71,85,105)",
        "darkMessageLine": "rgb(148,163,184)",
        "darkMessageText": "rgb(226,232,240)",
        "darkRibbonFill": "#1e293b",
        "lightGroupFill": "#EDF0FD",
        "lightRibbonFill": "#E3E9FD",
      }
    `)
    expect(dark.background).not.toBe("")
    expect(restored.background).toBe("")
    expect({ pan: native.cy.pan(), zoom: native.cy.zoom() }).toEqual(cameraBefore)
  } finally { native.unsubscribe(); host.remove() }
})
