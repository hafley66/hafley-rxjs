import { GRAPH_STYLES } from "../../src/lib/0_graphStyle.js"
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
    native.applyTheme("light")
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
    expect(restored.background).toBe("rgb(253, 253, 251)")
    expect({ pan: native.cy.pan(), zoom: native.cy.zoom() }).toEqual(cameraBefore)
  } finally { native.unsubscribe(); host.remove() }
})

it("shares presets and caller palettes across DOM and native renderers without changing geometry", async () => {
  const { GRAPH_STYLES } = await import("../../src/lib/0_graphStyle.js")
  const frame = await sequenceFrame({ width: 1280, height: 800 })
  const hosts = [document.createElement("div"), document.createElement("div")]
  for (const host of hosts) { host.style.cssText = "position:relative;width:1280px;height:800px"; document.body.append(host) }
  const doc = createDocumentGraphFrameResource(hosts[0], undefined, { inset: 44 })
  const cy = createCytoscapeGraphFrameResource(hosts[1], undefined, { inset: 44 })
  try {
    for (const renderer of [doc, cy]) renderer.render(frame, { enterIds: ["seq"], updateIds: [], exitIds: [] })
    const svg = hosts[0].querySelector("svg:not(:has([data-sticky-ribbon]))")!
    const viewBox = svg.getAttribute("viewBox")
    const positions = cy.cy.nodes().map(node => ({ id: node.id(), ...node.position() }))
    const samples = []
    for (const theme of ["dark", "light", { ...GRAPH_STYLES.dark, actorBackground: "#123456", messageLine: "#abcdef" }] as const) {
      doc.applyTheme(theme); cy.applyTheme(theme)
      const actor = svg.querySelector("rect.actor")!
      const message = svg.querySelector(".messageLine0")!
      const sample = { domActor: getComputedStyle(actor).fill, cyActor: cy.cy.$(".graph-actor-shape").first().style("background-color").replaceAll(",", ", "), domMessage: getComputedStyle(message).stroke, cyMessage: cy.cy.$(".graph-native-message").first().style("line-color").replaceAll(",", ", ") }
      expect(sample.domActor).toBe(sample.cyActor)
      expect(sample.domMessage).toBe(sample.cyMessage)
      samples.push([sample.domActor, sample.domMessage])
      expect(svg.getAttribute("viewBox")).toBe(viewBox)
      expect(cy.cy.nodes().map(node => ({ id: node.id(), ...node.position() }))).toEqual(positions)
    }
    expect(samples).toMatchInlineSnapshot(`
      [
        [
          "rgb(30, 41, 59)",
          "rgb(148, 163, 184)",
        ],
        [
          "rgb(219, 234, 254)",
          "rgb(71, 85, 105)",
        ],
        [
          "rgb(18, 52, 86)",
          "rgb(171, 205, 239)",
        ],
      ]
    `)
    expect(hosts[0].querySelectorAll("style[data-grapht-style]").length).toBe(1)
  } finally { doc.unsubscribe(); cy.unsubscribe(); hosts.forEach(host => host.remove()) }
})

it("shares hover gradients, logical hit IDs, and reversible fragment collapse", async () => {
  const { collapseSequenceFrame } = await import("../../src/2_graph/18_sequenceCollapse.ts")
  const frame = await sequenceFrame({ width: 1280, height: 800 })
  const groupId = Object.keys(frame.geometry.headerBoundsById)[0]
  const collapsed = collapseSequenceFrame(document, frame, new Set([groupId]))
  const host = document.createElement("div")
  host.style.cssText = "position:relative;width:1280px;height:800px"
  document.body.appendChild(host)
  const message = Object.values(frame.graph).find(item => item.type === "edge")!
  const focused = { ...frame, presentation: { ...frame.presentation, hopsById: { [message.id]: 2 } } }
  const hoverEvents: string[][] = []
  const doc = createDocumentGraphFrameResource(host, { cameraInput$: { next() {} }, focusInput$: { next(ids) { hoverEvents.push([...ids]) } } })
  try {
    doc.applyTheme("dark")
    doc.render(focused, { enterIds: [], updateIds: [], exitIds: [] })
    const element = [...host.querySelectorAll<SVGElement>('[data-graph-role="message-label"]')].find(el => el.dataset.graphId === message.id)!
    element.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }))
    expect({ opacity: element.style.opacity, focused: element.classList.contains("graph-focused"), hoverEvents }).toEqual({ opacity: "0.55", focused: true, hoverEvents: [[message.id]] })
    doc.render(collapsed, { enterIds: [], updateIds: [], exitIds: [] })
    expect([...host.querySelectorAll<SVGElement>("[data-graph-id]")].filter(el => collapsed.presentation.hiddenIds.has(el.dataset.graphId!)).every(el => el.style.display === "none")).toBe(true)
    expect(collapsed.geometry.boundsById.seq.height).toBeLessThan(frame.geometry.boundsById.seq.height)
    doc.render(frame, { enterIds: [], updateIds: [], exitIds: [] })
    expect([...host.querySelectorAll<SVGElement>("[data-graph-id]")].every(el => el.style.display !== "none")).toBe(true)
  } finally { doc.unsubscribe() }
  const native = createCytoscapeGraphFrameResource(host)
  try {
    native.render(focused, { enterIds: [], updateIds: [], exitIds: [] })
    const edge = native.cy.edges().filter(el => el.data("graphId") === message.id).first()
    expect({ opacity: edge.style("opacity"), textOpacity: edge.style("text-opacity"), focused: edge.hasClass("graph-focused") }).toEqual({ opacity: "1", textOpacity: "0.55", focused: true })
    native.render(collapsed, { enterIds: [], updateIds: [], exitIds: [] })
    expect(native.cy.elements().filter(el => collapsed.presentation.hiddenIds.has(el.data("graphId"))).toArray().every(el => el.hasClass("graph-hidden"))).toBe(true)
    native.render(frame, { enterIds: [], updateIds: [], exitIds: [] })
    expect(native.cy.elements(".graph-hidden").length).toBe(0)
  } finally { native.unsubscribe(); host.remove() }
})

it("groups existing actors in both adapters and restores all bindings after expansion", async () => {
  const { groupSequenceActors } = await import("../../src/2_graph/20_groupActors.ts")
  const { collapseSequenceFrame } = await import("../../src/2_graph/18_sequenceCollapse.ts")
  const { validateSealedSvgArtifacts } = await import("../../src/2_graph/3_sealedSvgArtifact.ts")
  const original = await sequenceFrame({ width: 1280, height: 800 })
  const actors = Object.keys(original.geometry.columnBoundsById!).slice(0, 2)
  const grouped = groupSequenceActors(original, "services", actors, "Services")
  const collapsed = collapseSequenceFrame(document, grouped, new Set(["services"]))
  expect(validateSealedSvgArtifacts(collapsed.graph, collapsed.presentation.sealedSvgArtifactsByRootId)).toBe(collapsed.presentation.sealedSvgArtifactsByRootId)
  expect({ parents: actors.map(id => grouped.graph[id].parentId), originalParents: actors.map(id => original.graph[id].parentId), retainedSource: grouped.presentation.sealedSvgArtifactsByRootId.seq.source }).toEqual({ parents: ["services", "services"], originalParents: ["seq", "seq"], retainedSource: original.presentation.sealedSvgArtifactsByRootId.seq.source })
  const host = document.createElement("div")
  host.style.cssText = "position:relative;width:1280px;height:800px"
  document.body.appendChild(host)
  for (const create of [createDocumentGraphFrameResource, createCytoscapeGraphFrameResource]) {
    const renderer = create(host)
    try {
      renderer.render(collapsed, { enterIds: [], updateIds: [], exitIds: [] })
      if ("cy" in renderer) {
        expect(renderer.cy.elements().filter(element => actors.includes(element.data("graphId"))).toArray().every(element => element.hasClass("graph-hidden"))).toBe(true)
        expect(renderer.cy.elements().filter(element => element.data("graphId") === "services").length).toBe(2)
      } else expect([...host.querySelectorAll<SVGElement>("[data-graph-id]")].filter(element => actors.includes(element.dataset.graphId!)).every(element => element.style.display === "none")).toBe(true)
      renderer.render(grouped, { enterIds: [], updateIds: [], exitIds: [] })
    } finally { renderer.unsubscribe() }
  }
  host.remove()
})

it("shares hop colors, restores original paint, and keeps fitted DOM lifelines visible", async () => {
  const frame = await sequenceFrame({ width: 1280, height: 800 })
  const id = Object.keys(frame.geometry.columnBoundsById!)[0]
  const host = document.createElement("div")
  host.style.cssText = "position:relative;width:1280px;height:800px"
  document.body.appendChild(host)
  const doc = createDocumentGraphFrameResource(host)
  doc.applyTheme({ ...GRAPH_STYLES.dark, hopMode: "color" })
  doc.render(frame, { enterIds: [], updateIds: [], exitIds: [] })
  const binding = frame.presentation.sealedSvgArtifactsByRootId.seq.bindings!.find(b => b.graphId === id && b.role === "lifeline")!
  const line = host.querySelector<SVGElement>(`[id="${binding.elementId}"]`)!
  const original = getComputedStyle(line).stroke
  const colors = []
  for (const hop of [1, 2, 3]) { doc.applyHover!({ [id]: hop }); colors.push(getComputedStyle(line).stroke) }
  doc.applyTheme({ ...GRAPH_STYLES.light, hopMode: "color" })
  expect(getComputedStyle(line).stroke).toBe("rgb(194, 65, 12)")
  doc.applyTheme({ ...GRAPH_STYLES.dark, hopMode: "color" })
  doc.applyHover!({})
  expect(getComputedStyle(line).stroke).toBe(original)
  expect(getComputedStyle(host.querySelector(".actor-line")!).vectorEffect).toBe("non-scaling-stroke")
  doc.unsubscribe()
  const native = createCytoscapeGraphFrameResource(host)
  try {
    native.applyTheme({ ...GRAPH_STYLES.dark, hopMode: "color" })
    native.render(frame, { enterIds: [], updateIds: [], exitIds: [] })
    const edge = native.cy.nodes().filter(edge => edge.data("graphId") === id && edge.data("nativeKind") === "lifeline").first()
    const nativeColors = []
    for (const hop of [1, 2, 3]) { native.applyHover!({ [id]: hop }); nativeColors.push(edge.style("background-color")) }
    expect(colors.map(color => color.replaceAll(" ", ""))).toEqual(nativeColors)
    expect(nativeColors).toEqual(["rgb(56,189,248)", "rgb(74,222,128)", "rgb(251,146,60)"])
    native.applyHover!({})
    expect(edge.style("background-color")).toBe("rgb(71,85,105)")
  } finally { native.unsubscribe(); host.remove() }
})

it("actor collapse removes empty nested message groups and retains groups with visible messages", async () => {
  const { groupSequenceActors } = await import("../../src/2_graph/20_groupActors.ts")
  const { collapseSequenceFrame } = await import("../../src/2_graph/18_sequenceCollapse.ts")
  const original = await sequenceFrame({ width: 1280, height: 800 })
  const actors = Object.keys(original.geometry.columnBoundsById!).filter(id => /:(AuthSvc|Inventory)#/.test(id))
  expect(actors.length).toBe(2)
  const grouped = groupSequenceActors(original, "services", actors, "Services")
  const collapsed = collapseSequenceFrame(document, grouped, new Set(["services"]))
  const empty = Object.keys(original.geometry.headerBoundsById).filter(id => /:(token renewal|retry renewal)#/.test(id))
  const mixed = Object.keys(original.geometry.headerBoundsById).find(id => id.includes(":stock available#"))!
  expect(empty.length).toBe(2)
  expect(empty.map(id => collapsed.presentation.hiddenIds.has(id))).toEqual([true, true])
  const preCollapsed = collapseSequenceFrame(document, grouped, new Set(["services", ...empty]))
  expect(empty.map(id => preCollapsed.presentation.hiddenIds.has(id))).toEqual([true, true])
  const restoredActors = collapseSequenceFrame(document, grouped, new Set(empty))
  expect(empty.filter(id => !restoredActors.presentation.hiddenIds.has(id)).length).toBe(1)

  expect(collapsed.presentation.hiddenIds.has(mixed)).toBe(false)
  expect(Object.values(collapsed.graph).filter(item => item.parentId === mixed && item.type === "edge" && !collapsed.presentation.hiddenIds.has(item.id)).length).toBeGreaterThan(0)
  expect(collapsed.geometry.boundsById.seq.height).toBeLessThan(grouped.geometry.boundsById.seq.height)
  const survivor = Object.values(collapsed.graph).find(item => item.parentId === mixed && item.type === "edge" && !collapsed.presentation.hiddenIds.has(item.id))!
  const outer = empty.find(id => id.includes(":token renewal#"))!
  const parallel = { ...grouped, geometry: { ...grouped.geometry, boundsById: { ...grouped.geometry.boundsById, [survivor.id]: grouped.geometry.boundsById[outer] } } }
  const sharedRows = collapseSequenceFrame(document, parallel, new Set(["services"]))
  expect(sharedRows.geometry.boundsById.seq.height).toBe(grouped.geometry.boundsById.seq.height)
  expect(sharedRows.presentation.hiddenIds.has(survivor.id)).toBe(false)

  expect(collapsed.camera).toEqual(grouped.camera)
  expect(collapsed.presentation.sealedSvgArtifactsByRootId.seq.source).toEqual(original.presentation.sealedSvgArtifactsByRootId.seq.source)
  const host = document.createElement("div")
  host.style.cssText = "position:relative;width:1280px;height:800px"
  document.body.appendChild(host)
  for (const create of [createDocumentGraphFrameResource, createCytoscapeGraphFrameResource]) {
    const renderer = create(host, undefined, { inset: 44 })
    try {
      renderer.render(collapsed, { enterIds: [], updateIds: [], exitIds: [] })
      for (const id of empty) {
        expect(host.querySelectorAll(`[data-sticky-id="${CSS.escape(id)}"]`).length).toBe(0)
        if ("cy" in renderer) expect(renderer.cy.elements().filter(element => element.data("graphId") === id).toArray().every(element => element.hasClass("graph-hidden"))).toBe(true)
        else expect([...host.querySelectorAll<SVGElement>(`[data-graph-id="${CSS.escape(id)}"]`)].every(element => element.style.display === "none")).toBe(true)
      }
      renderer.render(collapseSequenceFrame(document, grouped, new Set()), { enterIds: [], updateIds: [], exitIds: [] })
      if ("cy" in renderer) expect(renderer.cy.elements(".graph-hidden").length).toBe(0)
      else expect([...host.querySelectorAll<SVGElement>("[data-graph-id]")].every(element => element.style.display !== "none")).toBe(true)
    } finally { renderer.unsubscribe() }
  }
  host.remove()
})

it("ingests plain and semantically bound SVG without inventing endpoints", async () => {
  const { svgFrame } = await import("../../src/2_graph/21_svgFrame.ts")
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><rect id="a" x="10" y="10" width="40" height="40"/><rect id="b" x="210" y="10" width="40" height="40"/><path id="ab" d="M50 30 L210 30"/></svg>'
  const input = { svg, locator: "example.svg", viewport: { width: 600, height: 300 } }
  const plain = svgFrame(document, input)
  expect(Object.keys(plain.graph)).toEqual(["svg"])
  const frame = svgFrame(document, { ...input, graph: {
    a: { id: "a", type: "node" }, b: { id: "b", type: "node" },
    ab: { id: "ab", type: "edge", fromId: "a", toId: "b", direction: "forward" },
  }, bindings: [
    { elementId: "a", graphId: "a", role: "actor-shape", ordinal: 0 },
    { elementId: "b", graphId: "b", role: "actor-shape", ordinal: 0 },
    { elementId: "ab", graphId: "ab", role: "message-line", ordinal: 0 },
  ] })
  expect(frame.geometry.boundsById.a).toEqual({ x: 10, y: 10, width: 40, height: 40 })
  expect(frame.presentation.sealedSvgArtifactsByRootId.svg.source).toEqual({ language: "svg", locator: "example.svg", text: svg })
  expect(() => svgFrame(document, { ...input, svg: "<svg/>" })).toThrow("viewBox")
  expect(() => svgFrame(document, { ...input, bindings: [{ elementId: "missing", graphId: "svg", role: "actor-shape", ordinal: 0 }] })).toThrow("Missing bound SVG element")
  const host = document.createElement("div"); host.style.cssText = "width:600px;height:300px"; document.body.appendChild(host)
  const doc = createDocumentGraphFrameResource(host)
  doc.applyTheme("dark")
  doc.render(frame, { enterIds: [], updateIds: [], exitIds: [] })
  expect(getComputedStyle(host.querySelector("#a")!).fill).toBe("rgb(30, 41, 59)")
  doc.unsubscribe()
  const renderer = createCytoscapeGraphFrameResource(host)
  try {
    renderer.render(frame, { enterIds: [], updateIds: [], exitIds: [] })
    expect({ nodes: renderer.cy.nodes(".graph-actor-shape").length, edges: renderer.cy.edges().length }).toEqual({ nodes: 2, edges: 1 })
  } finally { renderer.unsubscribe(); host.remove() }
})
