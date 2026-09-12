
import { createCytoscapeGraphFrameResource } from "./6_graphRenderer.ts"
import type { GraphFrame } from "@hafley66/grapht"
import { describe, expect, it, vi } from "vitest"

const frame: GraphFrame = {
  graph: {
    a: { id: "a", type: "node" },
    b: { id: "b", type: "node" },
    ab: { id: "ab", type: "edge", fromId: "a", toId: "b", direction: "forward" },
    audit: { id: "audit", type: "edge", fromId: "ab", toId: "a", direction: "none" },
  },
  geometry: {
    revisionId: "one",
    boundsById: {
      a: { x: 8, y: 16, width: 4, height: 8 },
      b: { x: 28, y: 36, width: 4, height: 8 },
      ab: { x: 16, y: 24, width: 8, height: 12 },
      audit: { x: 14, y: 24, width: 2, height: 2 },
    },
    endpointAnchorById: { a: { x: 10, y: 20 }, b: { x: 30, y: 40 }, ab: { x: 20, y: 30 }, audit: { x: 15, y: 25 } },
    routesById: {},
    headerBoundsById: {},
  },
  camera: { x: 4, y: 5, scale: 2, viewport: { x: 0, y: 0, width: 100, height: 80 } },
  presentation: {
    stickyHeaders: [],
    hiddenIds: new Set(),
    focusedIds: new Set(["ab"]),
    labelsById: { a: { text: "Alice" }, b: { text: "Bob" }, ab: { text: "calls" }, audit: { text: "audits" } },
    sealedSvgArtifactsByRootId: {},
  },
}

describe("Cytoscape GraphFrame resource", () => {
  it("projects edge endpoints through private anchor nodes", () => {
    const resource = createCytoscapeGraphFrameResource()
    resource.render(frame, { enterIds: Object.keys(frame.graph), updateIds: [], exitIds: [] })
    expect(
      resource.cy
        .elements()
        .map(element => ({ id: element.id(), kind: element.data("kind"), source: element.data("source"), target: element.data("target") }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    ).toMatchInlineSnapshot(`
      [
        {
          "id": "a",
          "kind": "node",
          "source": undefined,
          "target": undefined,
        },
        {
          "id": "ab",
          "kind": "edge",
          "source": "a",
          "target": "b",
        },
        {
          "id": "ab::endpoint-anchor",
          "kind": "edge-anchor",
          "source": undefined,
          "target": undefined,
        },
        {
          "id": "audit",
          "kind": "edge",
          "source": "ab::endpoint-anchor",
          "target": "a",
        },
        {
          "id": "audit::endpoint-anchor",
          "kind": "edge-anchor",
          "source": undefined,
          "target": undefined,
        },
        {
          "id": "b",
          "kind": "node",
          "source": undefined,
          "target": undefined,
        },
      ]
    `)
    const node = resource.cy.$id("a")[0]
    resource.cy.$id("a").position({ x: 91, y: 92 })
    resource.render(
      { ...frame, presentation: { ...frame.presentation, focusedIds: new Set() } },
      { enterIds: [], updateIds: Object.keys(frame.graph), exitIds: [] },
    )
    expect(resource.cy.$id("a").position()).toMatchInlineSnapshot(`
      {
        "x": 91,
        "y": 92,
      }
    `)
    resource.render(
      {
        ...frame,
        geometry: {
          ...frame.geometry,
          revisionId: "two",
          boundsById: { ...frame.geometry.boundsById, a: { x: 8, y: 17, width: 6, height: 10 }, ab: { x: 16, y: 24, width: 10, height: 14 } },
          endpointAnchorById: { ...frame.geometry.endpointAnchorById, a: { x: 11, y: 22 } },
        },
      },
      { enterIds: [], updateIds: Object.keys(frame.graph), exitIds: [] },
    )
    expect({
      retained: resource.cy.$id("a")[0] === node,
      position: resource.cy.$id("a").position(),
      dimensions: {
        node: { width: resource.cy.$id("a").width(), height: resource.cy.$id("a").height() },
        edgeAnchor: { width: resource.cy.$id("ab::endpoint-anchor").width(), height: resource.cy.$id("ab::endpoint-anchor").height() },
      },
      colors: {
        node: resource.cy.$id("a").style("background-color"),
        edge: resource.cy.$id("ab").style("line-color"),
        focusedEdge: resource.cy.$id("ab").style("target-arrow-color"),
      },
    }).toMatchInlineSnapshot(`
      {
        "colors": {
          "edge": "rgb(251,191,36)",
          "focusedEdge": "rgb(251,191,36)",
          "node": "rgb(30,41,59)",
        },
        "dimensions": {
          "edgeAnchor": {
            "height": 14,
            "width": 10,
          },
          "node": {
            "height": 10,
            "width": 6,
          },
        },
        "position": {
          "x": 11,
          "y": 22,
        },
        "retained": true,
      }
    `)
    resource.unsubscribe()
  })

  it("uses canonical labels for native elements and retained sticky header views", () => {
    const context = new Proxy(
      { canvas: { width: 0, height: 0 }, measureText: () => ({ width: 0 }) },
      { get: (target, property) => property in target ? target[property as keyof typeof target] : () => {} },
    )
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => context as unknown as CanvasRenderingContext2D)
    const host = document.createElement("div")
    document.body.appendChild(host)
    const resource = createCytoscapeGraphFrameResource(host)
    const labeledFrame: GraphFrame = {
      graph: {
        group: { id: "group", type: "node" },
        a: { id: "a", type: "node", parentId: "group" },
        b: { id: "b", type: "node", parentId: "group" },
        ab: { id: "ab", type: "edge", fromId: "a", toId: "b", direction: "forward", parentId: "group" },
      },
      geometry: {
        revisionId: "labels-one",
        boundsById: {},
        endpointAnchorById: { a: { x: 10, y: 20 }, b: { x: 30, y: 20 } },
        routesById: {},
        headerBoundsById: { group: { x: 2, y: 3, width: 40, height: 12 } },
      },
      camera: { x: 4, y: 5, scale: 2, viewport: { x: 0, y: 0, width: 100, height: 80 } },
      presentation: {
        stickyHeaders: [{ id: "group", depth: 0, top: 7, visible: true, state: "stuck" }],
        hiddenIds: new Set(),
        focusedIds: new Set(),
        labelsById: { group: { text: "Service" }, a: { text: "Alice" }, ab: { text: "calls" } },
        sealedSvgArtifactsByRootId: {},
      },
    }
    resource.render(labeledFrame, { enterIds: Object.keys(labeledFrame.graph), updateIds: [], exitIds: [] })
    const header = resource.headerViews.get("group")
    const initialHeader = { text: header?.textContent, style: header?.getAttribute("style") }
    resource.render(
      {
        ...labeledFrame,
        presentation: { ...labeledFrame.presentation, labelsById: { group: { text: "Services" }, a: { text: "Alicia" }, ab: { text: "calls" } } },
      },
      { enterIds: [], updateIds: Object.keys(labeledFrame.graph), exitIds: [] },
    )
    const retainedHeader = header === resource.headerViews.get("group")
    const updatedHeader = { text: header?.textContent, style: header?.getAttribute("style") }
    resource.render(
      { ...labeledFrame, presentation: { ...labeledFrame.presentation, stickyHeaders: [], labelsById: { a: { text: "Alicia" }, ab: { text: "calls" } } } },
      { enterIds: [], updateIds: Object.keys(labeledFrame.graph), exitIds: [] },
    )
    const result = {
      nativeLabels: {
        group: resource.cy.$id("group").data("label"),
        node: resource.cy.$id("a").data("label"),
        edge: resource.cy.$id("ab").data("label"),
      },
      retainedHeader,
      initialHeader,
      updatedHeader,
      headersAfterExit: [...resource.headerViews.keys()],
    }
    resource.unsubscribe()
    host.remove()
    getContext.mockRestore()

    expect(result).toMatchInlineSnapshot(`
      {
        "headersAfterExit": [],
        "initialHeader": {
          "style": "position:absolute;box-sizing:border-box;left:8px;top:7px;width:80px;height:24px;pointer-events:none;background:#172554;border:1px solid #93c5fd;border-radius:3px;color:#f8fafc;font:600 12px/1.2 system-ui,sans-serif;padding:2px 6px;white-space:nowrap",
          "text": "Service",
        },
        "nativeLabels": {
          "edge": "calls",
          "group": "",
          "node": "Alicia",
        },
        "retainedHeader": true,
        "updatedHeader": {
          "style": "position:absolute;box-sizing:border-box;left:8px;top:7px;width:80px;height:24px;pointer-events:none;background:#172554;border:1px solid #93c5fd;border-radius:3px;color:#f8fafc;font:600 12px/1.2 system-ui,sans-serif;padding:2px 6px;white-space:nowrap",
          "text": "Services",
        },
      }
    `)
  })

  it("retains sealed SVG overlays while excluding sealed descendants from Cytoscape", () => {
    const context = new Proxy(
      { canvas: { width: 0, height: 0 }, measureText: () => ({ width: 0 }) },
      { get: (target, property) => property in target ? target[property as keyof typeof target] : () => {} },
    )
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => context as unknown as CanvasRenderingContext2D)
    const host = document.createElement("div")
    document.body.appendChild(host)
    const resource = createCytoscapeGraphFrameResource(host)
    const sealedFrame: GraphFrame = {
      graph: {
        sequence: { id: "sequence", type: "node", layout: { mode: "sealed", bounds: { x: 10, y: 20, width: 100, height: 200 }, geometryRevisionId: "sequence:geometry:1" } },
        group: { id: "group", type: "node", parentId: "sequence" },
        actor: { id: "actor", type: "node", parentId: "group", data: { layout: "renderer-data-is-ignored" } },
        message: { id: "message", type: "edge", parentId: "group", fromId: "actor", toId: "actor", direction: "forward" },
        sibling: { id: "sibling", type: "node" },
      },
      geometry: {
        revisionId: "outer:1",
        boundsById: { sequence: { x: 100, y: 200, width: 300, height: 100 }, sibling: { x: 10, y: 10, width: 20, height: 20 } },
        endpointAnchorById: { sequence: { x: 250, y: 250 }, sibling: { x: 20, y: 20 } },
        routesById: {},
        headerBoundsById: {},
      },
      camera: { x: 4, y: 5, scale: 2, viewport: { x: 0, y: 0, width: 100, height: 80 } },
      presentation: {
        stickyHeaders: [], hiddenIds: new Set(), focusedIds: new Set(), labelsById: {},
        sealedSvgArtifactsByRootId: {
          sequence: {
            rootId: "sequence",
            revisionId: "sequence:svg:1",
            geometryRevisionId: "sequence:geometry:1",
            svg: '<svg viewBox="10 20 100 200"><script id="script">alert(1)</script><foreignObject id="html"><div>bad</div></foreignObject><rect id="native" onclick="alert(1)"/><a id="unsafe-link" href="javascript:alert(1)">bad</a></svg>',
            sourceBounds: { x: 10, y: 20, width: 100, height: 200 },
            fit: "contain",
          },
        },
      },
    }

    resource.render(sealedFrame, { enterIds: Object.keys(sealedFrame.graph), updateIds: [], exitIds: [] })
    const first = resource.sealedSvgViews.get("sequence")
    const firstTransform = first?.getAttribute("style")
    resource.render({ ...sealedFrame, camera: { ...sealedFrame.camera, x: 10 } }, { enterIds: [], updateIds: Object.keys(sealedFrame.graph), exitIds: [] })
    const retained = resource.sealedSvgViews.get("sequence")
    const cameraTransform = retained?.getAttribute("style")
    const replacement = {
      ...sealedFrame,
      presentation: {
        ...sealedFrame.presentation,
        sealedSvgArtifactsByRootId: {
          sequence: { ...sealedFrame.presentation.sealedSvgArtifactsByRootId.sequence, revisionId: "sequence:svg:2", svg: '<svg viewBox="10 20 100 200"><circle id="replacement"/></svg>' },
        },
      },
    }
    resource.render(replacement, { enterIds: [], updateIds: Object.keys(replacement.graph), exitIds: [] })
    const second = resource.sealedSvgViews.get("sequence")
    resource.render({ ...replacement, presentation: { ...replacement.presentation, sealedSvgArtifactsByRootId: {} } }, { enterIds: [], updateIds: Object.keys(replacement.graph), exitIds: [] })
    const result = {
      cyIds: resource.cy.elements().map(element => element.id()).sort(),
      firstSvg: first?.querySelector("svg")?.outerHTML,
      sanitized: {
        script: first?.querySelector("script")?.outerHTML ?? null,
        foreignObject: first?.querySelector("foreignObject")?.outerHTML ?? null,
        onclick: first?.querySelector("#native")?.getAttribute("onclick") ?? null,
        unsafeHref: first?.querySelector("#unsafe-link")?.getAttribute("href") ?? null,
      },
      firstTransform,
      retainedAcrossCamera: first === retained,
      cameraTransform,
      replacedByRevision: first !== second,
      staleViewRemoved: first?.isConnected,
      replacementSvg: second?.querySelector("svg")?.outerHTML,
      viewsAfterArtifactExit: [...resource.sealedSvgViews.keys()],
    }
    resource.unsubscribe()
    const layersAfterUnsubscribe = host.querySelectorAll("[data-grapht-overlay]").length
    host.remove()
    getContext.mockRestore()

    expect(result).toMatchInlineSnapshot(`
      {
        "cameraTransform": "position:absolute;left:0;top:0;width:0;height:0;transform-origin:0 0;pointer-events:auto;transform:matrix(1,0,0,1,450,385)",
        "cyIds": [
          "sequence",
          "sibling",
        ],
        "firstSvg": "<svg viewBox="10 20 100 200" style="position: absolute; left: 10px; top: 20px; width: 100px; height: 200px;"><rect id="native"></rect><a id="unsafe-link">bad</a></svg>",
        "firstTransform": "position:absolute;left:0;top:0;width:0;height:0;transform-origin:0 0;pointer-events:auto;transform:matrix(1,0,0,1,444,385)",
        "replacedByRevision": true,
        "replacementSvg": "<svg viewBox="10 20 100 200" style="position: absolute; left: 10px; top: 20px; width: 100px; height: 200px;"><circle id="replacement"></circle></svg>",
        "retainedAcrossCamera": true,
        "sanitized": {
          "foreignObject": null,
          "onclick": null,
          "script": null,
          "unsafeHref": null,
        },
        "staleViewRemoved": false,
        "viewsAfterArtifactExit": [],
      }
    `)
    expect(layersAfterUnsubscribe).toBe(0)
  })
})

it("probe: importNode realm", () => {
  const parsed = new DOMParser().parseFromString('<svg viewBox="0 0 10 10"><rect id="r"/></svg>', "image/svg+xml")
  const imported = document.importNode(parsed.documentElement, true)
  console.log("probe", imported.constructor.name, imported instanceof SVGSVGElement, String(imported))
  expect(true).toBe(true)
})
