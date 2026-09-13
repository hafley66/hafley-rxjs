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
