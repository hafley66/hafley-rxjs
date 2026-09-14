import { describe, expect, it } from "vitest"
import type { GraphFrame } from "../../src/2_graph/0_frame.ts"
import { createDocumentGraphFrameResource } from "./8_documentRenderer.ts"

const artifact = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 4000"><rect width="700" height="4000" fill="#fff"/></svg>`

const frame: GraphFrame = {
  graph: {
    seq: { id: "seq", type: "node", layout: { mode: "sealed", bounds: { x: 0, y: 0, width: 700, height: 4000 }, geometryRevisionId: "seq:g1" } },
    alice: { id: "alice", type: "node", parentId: "seq" },
    bob: { id: "bob", type: "node", parentId: "seq" },
    carol: { id: "carol", type: "node", parentId: "seq" },
  },
  geometry: {
    revisionId: "seq:1",
    boundsById: { seq: { x: 0, y: 0, width: 700, height: 4000 } },
    endpointAnchorById: {},
    routesById: {},
    headerBoundsById: {},
    columnBoundsById: {
      alice: { x: 0, y: 0, width: 100, height: 3900 },
      bob: { x: 300, y: 0, width: 100, height: 3900 },
      carol: { x: 600, y: 0, width: 100, height: 3900 },
    },
  },
  camera: { x: 0, y: 0, scale: 1, viewport: { x: 0, y: 0, width: 800, height: 600 } },
  presentation: {
    stickyHeaders: [],
    hiddenIds: new Set(),
    focusedIds: new Set(),
    labelsById: { alice: { text: "Alice Client" }, bob: { text: "Bob Gateway" }, carol: { text: "Carol Store" } },
    sealedSvgArtifactsByRootId: {
      seq: { rootId: "seq", revisionId: "seq:svg:1", geometryRevisionId: "seq:g1", svg: artifact, sourceBounds: { x: 0, y: 0, width: 700, height: 4000 }, fit: "contain" },
    },
  },
}

const mount = () => {
  const host = document.createElement("div")
  host.style.cssText = "position:relative;width:800px;height:600px"
  document.body.appendChild(host)
  const resource = createDocumentGraphFrameResource(host, undefined, { inset: 8, fullWidth: 60, chipWidth: 32, gap: 4 })
  resource.render(frame, { enterIds: ["seq"], updateIds: [], exitIds: [] })
  return { host, resource }
}

const chips = (host: HTMLElement) =>
  [...host.querySelectorAll("[data-sticky-ribbon] [data-sticky-id]")].map(node => ({
    id: node.getAttribute("data-sticky-id"),
    detail: node.getAttribute("data-detail"),
    left: Math.round(Number(node.querySelector("rect")?.getAttribute("x"))),
    width: Math.round(Number(node.querySelector("rect")?.getAttribute("width"))),
    text: node.querySelector("text")?.textContent,
  }))

describe("document renderer sticky ribbon", () => {
  it("pins one header per column above the diagram", () => {
    const { host, resource } = mount()
    try {
      expect(chips(host)).toEqual([
        { id: "alice", detail: "full", left: 8, width: 100, text: "Alice Client" },
        { id: "bob", detail: "full", left: 300, width: 100, text: "Bob Gateway" },
        { id: "carol", detail: "full", left: 600, width: 100, text: "Carol Store" },
      ])
    } finally {
      resource.unsubscribe()
      host.remove()
    }
  })

  it("condenses to initials when the column is unreadable at this zoom", () => {
    const { host, resource } = mount()
    try {
      resource.applyCamera({ x: 0, y: 0, scale: 0.3, viewport: { x: 0, y: 0, width: 800, height: 600 } })
      expect(chips(host)).toEqual([
        { id: "alice", detail: "chip", left: 8, width: 32, text: "AC" },
        { id: "bob", detail: "chip", left: 90, width: 32, text: "BG" },
        { id: "carol", detail: "chip", left: 180, width: 32, text: "CS" },
      ])
    } finally {
      resource.unsubscribe()
      host.remove()
    }
  })

  it("keeps the ribbon in screen space while the diagram zooms", () => {
    const { host, resource } = mount()
    try {
      const before = host.querySelector("[data-sticky-ribbon] rect")?.getAttribute("height")
      resource.applyCamera({ x: 0, y: 0, scale: 4, viewport: { x: 0, y: 0, width: 800, height: 600 } })
      const after = host.querySelector("[data-sticky-ribbon] rect")?.getAttribute("height")
      expect(after).toBe(before)
    } finally {
      resource.unsubscribe()
      host.remove()
    }
  })

  it("drops the ribbon once the lifelines leave the viewport", () => {
    const { host, resource } = mount()
    try {
      resource.applyCamera({ x: 0, y: -5000, scale: 1, viewport: { x: 0, y: 0, width: 800, height: 600 } })
      expect(chips(host)).toEqual([])
    } finally {
      resource.unsubscribe()
      host.remove()
    }
  })
})

const groupArtifact = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 4000"><rect width="700" height="4000" fill="#fff"/></svg>`

const groupFrame: GraphFrame = {
  graph: {
    seq: { id: "seq", type: "node", layout: { mode: "sealed", bounds: { x: 0, y: 0, width: 700, height: 4000 }, geometryRevisionId: "seq:g1" } },
    outer: { id: "outer", type: "node", parentId: "seq" },
    inner: { id: "inner", type: "node", parentId: "outer" },
  },
  geometry: {
    revisionId: "seq:2",
    boundsById: {
      seq: { x: 0, y: 0, width: 700, height: 4000 },
      outer: { x: 40, y: 100, width: 600, height: 2000 },
      inner: { x: 80, y: 300, width: 500, height: 900 },
    },
    endpointAnchorById: {},
    routesById: {},
    headerBoundsById: {
      outer: { x: 40, y: 100, width: 600, height: 22 },
      inner: { x: 80, y: 300, width: 500, height: 22 },
    },
  },
  camera: { x: 0, y: 0, scale: 1, viewport: { x: 0, y: 0, width: 800, height: 600 } },
  presentation: {
    stickyHeaders: [],
    hiddenIds: new Set(),
    focusedIds: new Set(),
    labelsById: { outer: { text: "loop retry" }, inner: { text: "alt cache hit" } },
    sealedSvgArtifactsByRootId: {
      seq: { rootId: "seq", revisionId: "seq:svg:2", geometryRevisionId: "seq:g1", svg: groupArtifact, sourceBounds: { x: 0, y: 0, width: 700, height: 4000 }, fit: "contain" },
    },
  },
}

const bars = (host: HTMLElement) =>
  [...host.querySelectorAll("[data-sticky-groups] [data-sticky-id]")].map(node => ({
    id: node.getAttribute("data-sticky-id"),
    state: node.getAttribute("data-state"),
    top: Math.round(Number(node.querySelector("rect")?.getAttribute("y"))),
    text: node.querySelector("text")?.textContent,
  }))

const mountGroups = (sticky = {}) => {
  const host = document.createElement("div")
  host.style.cssText = "position:relative;width:800px;height:600px"
  document.body.appendChild(host)
  const resource = createDocumentGraphFrameResource(host, undefined, { inset: 8, gap: 4, height: 22, ...sticky })
  resource.render(groupFrame, { enterIds: ["seq"], updateIds: [], exitIds: [] })
  return { host, resource }
}

describe("document renderer sticky group headers", () => {
  it("leaves a group header in place while its frame is on screen", () => {
    const { host, resource } = mountGroups()
    try {
      expect(bars(host)).toEqual([
        { id: "outer", state: "natural", top: 100, text: "loop retry" },
        { id: "inner", state: "natural", top: 300, text: "alt cache hit" },
      ])
    } finally {
      resource.unsubscribe()
      host.remove()
    }
  })

  it("stacks a nested group under its parent once both scroll past the top", () => {
    const { host, resource } = mountGroups()
    try {
      resource.applyCamera({ x: 0, y: -500, scale: 1, viewport: { x: 0, y: 0, width: 800, height: 600 } })
      expect(bars(host)).toEqual([
        { id: "outer", state: "stuck", top: 8, text: "loop retry" },
        { id: "inner", state: "stuck", top: 34, text: "alt cache hit" },
      ])
    } finally {
      resource.unsubscribe()
      host.remove()
    }
  })

  it("does not paint a group whose header sits below the viewport", () => {
    const { host, resource } = mountGroups()
    try {
      resource.applyCamera({ x: 0, y: 0, scale: 1, viewport: { x: 0, y: 0, width: 800, height: 200 } })
      expect(bars(host).map(bar => bar.id)).toEqual(["outer"])
    } finally {
      resource.unsubscribe()
      host.remove()
    }
  })

  it("stacks group headers below the ribbon when both are on", () => {
    const host = document.createElement("div")
    host.style.cssText = "position:relative;width:800px;height:600px"
    document.body.appendChild(host)
    const withColumns: GraphFrame = {
      ...groupFrame,
      geometry: { ...groupFrame.geometry, columnBoundsById: { outer: { x: 0, y: 0, width: 200, height: 3900 } } },
    }
    const resource = createDocumentGraphFrameResource(host, undefined, { inset: 8, gap: 4, height: 22 })
    try {
      resource.render(withColumns, { enterIds: ["seq"], updateIds: [], exitIds: [] })
      resource.applyCamera({ x: 0, y: -500, scale: 1, viewport: { x: 0, y: 0, width: 800, height: 600 } })
      expect(bars(host).map(bar => [bar.id, bar.top])).toEqual([
        ["outer", 34],
        ["inner", 60],
      ])
    } finally {
      resource.unsubscribe()
      host.remove()
    }
  })

  it("paints nothing when group headers are switched off", () => {
    const { host, resource } = mountGroups({ groups: false })
    try {
      expect(bars(host)).toEqual([])
    } finally {
      resource.unsubscribe()
      host.remove()
    }
  })
})

it("matches document headers in Cytoscape through zoom, pan, toggles and teardown", async () => {
  const { createCytoscapeGraphFrameResource } = await import("./6_graphRenderer.ts")
  const hosts = [document.createElement("div"), document.createElement("div")]
  for (const host of hosts) {
    host.style.cssText = "position:relative;width:800px;height:600px"
    document.body.appendChild(host)
  }
  const options = { inset: 8, gap: 4, height: 22 }
  const dom = createDocumentGraphFrameResource(hosts[0], undefined, options)
  const cyto = createCytoscapeGraphFrameResource(hosts[1], undefined, options)
  const combined = { ...groupFrame, geometry: { ...groupFrame.geometry, columnBoundsById: frame.geometry.columnBoundsById } }
  const headers = (host: HTMLElement) => [...host.querySelectorAll("[data-sticky-id]")].map(node => node.outerHTML)
  try {
    for (const resource of [dom, cyto]) resource.render(combined, { enterIds: ["seq"], updateIds: [], exitIds: [] })
    expect(headers(hosts[1])).toEqual(headers(hosts[0]))
    expect(hosts[1].querySelectorAll("[data-sticky-ribbon] [data-sticky-id]").length).toBe(3)
    for (const camera of [{ ...frame.camera, y: -500 }, { ...frame.camera, scale: 0.3 }, { ...frame.camera, y: -5000 }]) {
      dom.applyCamera(camera)
      cyto.cy.viewport({ zoom: camera.scale, pan: { x: camera.x, y: camera.y } })
      expect(headers(hosts[1])).toEqual(headers(hosts[0]))
    }
    for (const resource of [dom, cyto]) {
      resource.render(combined, { enterIds: [], updateIds: ["seq"], exitIds: [] })
      resource.applySticky({ ribbon: false, groups: false })
    }
    expect(hosts.map(headers)).toEqual([[], []])
    for (const resource of [dom, cyto]) resource.applySticky({ ribbon: true, groups: true })
    expect(headers(hosts[1])).toEqual(headers(hosts[0]))
    expect(hosts[1].querySelectorAll("[data-sticky-ribbon] [data-sticky-id]").length).toBe(3)
  } finally {
    dom.unsubscribe()
    cyto.unsubscribe()
    expect(hosts.map(host => host.querySelectorAll("[data-sticky-id]").length)).toEqual([0, 0])
    for (const host of hosts) host.remove()
  }
})

it("uses the same wheel pan and cursor zoom in both renderers", async () => {
  const { createCytoscapeGraphFrameResource } = await import("./6_graphRenderer.ts")
  const hosts = [document.createElement("div"), document.createElement("div")]
  for (const host of hosts) { host.style.cssText = "position:relative;width:800px;height:600px"; document.body.appendChild(host) }
  let domCamera = frame.camera
  const dom = createDocumentGraphFrameResource(hosts[0], { cameraInput$: { next: camera => { domCamera = camera } } })
  const cyto = createCytoscapeGraphFrameResource(hosts[1], undefined, {})
  const results: unknown[] = []
  try {
    for (const resource of [dom, cyto]) resource.render(frame, { enterIds: ["seq"], updateIds: [], exitIds: [] })
    for (const gesture of [{ deltaY: 100 }, { deltaY: 50, shiftKey: true }, { deltaY: -100, ctrlKey: true }, { deltaY: 100, metaKey: true }, { deltaX: 1, deltaY: 2, deltaMode: 1 }]) {
      for (const host of hosts) {
        const rect = host.getBoundingClientRect()
        const target = host.querySelector("canvas") ?? host.querySelector("svg")!
        target.dispatchEvent(new WheelEvent("wheel", { ...gesture, clientX: rect.left + 400, clientY: rect.top + 300, bubbles: true, cancelable: true }))
      }
      const pan = cyto.cy.pan()
      expect({ x: pan.x, y: pan.y, scale: cyto.cy.zoom() }).toEqual({ x: domCamera.x, y: domCamera.y, scale: domCamera.scale })
      results.push({ x: Math.round(pan.x), y: Math.round(pan.y), scale: Number(cyto.cy.zoom().toFixed(3)) })
    }
    expect(results).toMatchInlineSnapshot(`
      [
        {
          "scale": 1,
          "x": 0,
          "y": -100,
        },
        {
          "scale": 1,
          "x": -50,
          "y": -100,
        },
        {
          "scale": 1.197,
          "x": -139,
          "y": -179,
        },
        {
          "scale": 1,
          "x": -50,
          "y": -100,
        },
        {
          "scale": 1,
          "x": -66,
          "y": -132,
        },
      ]
    `)
  } finally { dom.unsubscribe(); cyto.unsubscribe(); for (const host of hosts) host.remove() }
})
