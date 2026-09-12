import { describe, expect, test } from "vitest"
import { firstValueFrom, of } from "rxjs"
import type { Graph } from "@hafley66/grapht-model"
import { fcoseGraphLayout, layout } from "../../src/index.js"

const graph: Graph = {
  outer: { id: "outer", type: "node" },
  left: { id: "left", type: "node", parentId: "outer" },
  nested: { id: "nested", type: "node", parentId: "left" },
  deepLeaf: { id: "deepLeaf", type: "node", parentId: "nested" },
  right: { id: "right", type: "node", parentId: "outer" },
  rightLeaf: { id: "rightLeaf", type: "node", parentId: "right" },
  directed: { id: "directed", type: "edge", parentId: "outer", fromId: "deepLeaf", toId: "rightLeaf", direction: "forward" },
  parallel: { id: "parallel", type: "edge", parentId: "outer", fromId: "deepLeaf", toId: "rightLeaf", direction: "forward" },
  undirected: { id: "undirected", type: "edge", parentId: "outer", fromId: "deepLeaf", toId: "rightLeaf", direction: "none" },
  bidirectional: { id: "bidirectional", type: "edge", parentId: "outer", fromId: "deepLeaf", toId: "rightLeaf", direction: "both" },
  edgeToEdge: { id: "edgeToEdge", type: "edge", parentId: "outer", fromId: "directed", toId: "bidirectional", direction: "forward" },
  chainedEdge: { id: "chainedEdge", type: "edge", parentId: "outer", fromId: "edgeToEdge", toId: "undirected", direction: "forward" },
}

function rounded(value: number): number {
  return Math.round(value * 1000) / 1000
}

function snapshotOf(geometry: ReturnType<typeof fcoseGraphLayout>) {
  return {
    revisionId: geometry.revisionId,
    boundsById: Object.fromEntries(Object.entries(geometry.boundsById).map(([id, bounds]) => [id, Object.fromEntries(Object.entries(bounds).map(([key, value]) => [key, rounded(value)]))])),
    endpointAnchorById: Object.fromEntries(Object.entries(geometry.endpointAnchorById).map(([id, anchor]) => [id, Object.fromEntries(Object.entries(anchor).map(([key, value]) => [key, rounded(value)]))])),
    routesById: Object.fromEntries(Object.entries(geometry.routesById).map(([id, route]) => [id, [...route].map(rounded)])),
    headerBoundsById: Object.fromEntries(Object.entries(geometry.headerBoundsById).map(([id, bounds]) => [id, Object.fromEntries(Object.entries(bounds).map(([key, value]) => [key, rounded(value)]))])),
  }
}

function contains(outer: { x: number; y: number; width: number; height: number }, inner: { x: number; y: number; width: number; height: number }): boolean {
  return outer.x <= inner.x
    && outer.y <= inner.y
    && outer.x + outer.width >= inner.x + inner.width
    && outer.y + outer.height >= inner.y + inner.height
}

describe("fcoseGraphLayout", () => {
  test("projects compound graphs and edge endpoints through fCoSE", () => {
    const first = fcoseGraphLayout(graph, new AbortController().signal)
    const second = fcoseGraphLayout(graph, new AbortController().signal)
    const edgeToEdgeRoute = first.routesById.edgeToEdge
    const chainedRoute = first.routesById.chainedEdge

    expect(snapshotOf(first)).toMatchInlineSnapshot(`
      {
        "boundsById": {
          "deepLeaf": {
            "height": 34,
            "width": 50,
            "x": -642.28,
            "y": -97.204,
          },
          "left": {
            "height": 136,
            "width": 152,
            "x": -693.28,
            "y": -148.204,
          },
          "nested": {
            "height": 85,
            "width": 101,
            "x": -667.78,
            "y": -122.704,
          },
          "outer": {
            "height": 321.032,
            "width": 450.56,
            "x": -718.78,
            "y": -238.266,
          },
          "right": {
            "height": 85,
            "width": 101,
            "x": -394.72,
            "y": -42.299,
          },
          "rightLeaf": {
            "height": 34,
            "width": 50,
            "x": -369.22,
            "y": -16.799,
          },
        },
        "endpointAnchorById": {
          "bidirectional": {
            "x": -443.776,
            "y": -93.131,
          },
          "chainedEdge": {
            "x": -344.091,
            "y": -87.045,
          },
          "deepLeaf": {
            "x": -617.28,
            "y": -80.204,
          },
          "directed": {
            "x": -464.341,
            "y": -140.318,
          },
          "edgeToEdge": {
            "x": -352.176,
            "y": -195.766,
          },
          "left": {
            "x": -617.28,
            "y": -80.204,
          },
          "nested": {
            "x": -617.28,
            "y": -80.204,
          },
          "outer": {
            "x": -493.5,
            "y": -77.75,
          },
          "parallel": {
            "x": -502.044,
            "y": 40.266,
          },
          "right": {
            "x": -344.22,
            "y": 0.201,
          },
          "rightLeaf": {
            "x": -344.22,
            "y": 0.201,
          },
          "undirected": {
            "x": -474.786,
            "y": -29.634,
          },
        },
        "headerBoundsById": {
          "left": {
            "height": 24,
            "width": 152,
            "x": -693.28,
            "y": -148.204,
          },
          "nested": {
            "height": 24,
            "width": 101,
            "x": -667.78,
            "y": -122.704,
          },
          "outer": {
            "height": 24,
            "width": 450.56,
            "x": -718.78,
            "y": -238.266,
          },
          "right": {
            "height": 24,
            "width": 101,
            "x": -394.72,
            "y": -42.299,
          },
        },
        "revisionId": "cytoscape-fcose:a2336242",
        "routesById": {
          "bidirectional": [
            -617.28,
            -80.204,
            -443.776,
            -93.131,
            -344.22,
            0.201,
          ],
          "chainedEdge": [
            -352.176,
            -195.766,
            -344.091,
            -87.045,
            -474.786,
            -29.634,
          ],
          "directed": [
            -617.28,
            -80.204,
            -464.341,
            -140.318,
            -344.22,
            0.201,
          ],
          "edgeToEdge": [
            -464.341,
            -140.318,
            -352.176,
            -195.766,
            -443.776,
            -93.131,
          ],
          "parallel": [
            -617.28,
            -80.204,
            -502.044,
            40.266,
            -344.22,
            0.201,
          ],
          "undirected": [
            -617.28,
            -80.204,
            -474.786,
            -29.634,
            -344.22,
            0.201,
          ],
        },
      }
    `)
    expect({
      sameGeometry: JSON.stringify(snapshotOf(first)) === JSON.stringify(snapshotOf(second)),
      containment: {
        outerLeft: contains(first.boundsById.outer, first.boundsById.left),
        leftNested: contains(first.boundsById.left, first.boundsById.nested),
        nestedLeaf: contains(first.boundsById.nested, first.boundsById.deepLeaf),
        outerRight: contains(first.boundsById.outer, first.boundsById.right),
        rightLeaf: contains(first.boundsById.right, first.boundsById.rightLeaf),
      },
      headers: Object.fromEntries(Object.entries(first.headerBoundsById).map(([id, bounds]) => [id, bounds.height > 0 && bounds.width > 0])),
      routeLengths: Object.fromEntries(Object.entries(first.routesById).map(([id, route]) => [id, route.length])),
      edgeToEdgeAnchors: {
        firstRouteStartsAtDirected: [edgeToEdgeRoute[0], edgeToEdgeRoute[1]].map(rounded),
        directedAnchor: [first.endpointAnchorById.directed.x, first.endpointAnchorById.directed.y].map(rounded),
        firstRouteEndsAtBidirectional: [edgeToEdgeRoute[4], edgeToEdgeRoute[5]].map(rounded),
        bidirectionalAnchor: [first.endpointAnchorById.bidirectional.x, first.endpointAnchorById.bidirectional.y].map(rounded),
        chainedStartsAtEdgeToEdge: [chainedRoute[0], chainedRoute[1]].map(rounded),
        edgeToEdgeAnchor: [first.endpointAnchorById.edgeToEdge.x, first.endpointAnchorById.edgeToEdge.y].map(rounded),
      },
    }).toMatchInlineSnapshot(`
      {
        "containment": {
          "leftNested": true,
          "nestedLeaf": true,
          "outerLeft": true,
          "outerRight": true,
          "rightLeaf": true,
        },
        "edgeToEdgeAnchors": {
          "bidirectionalAnchor": [
            -443.776,
            -93.131,
          ],
          "chainedStartsAtEdgeToEdge": [
            -352.176,
            -195.766,
          ],
          "directedAnchor": [
            -464.341,
            -140.318,
          ],
          "edgeToEdgeAnchor": [
            -352.176,
            -195.766,
          ],
          "firstRouteEndsAtBidirectional": [
            -443.776,
            -93.131,
          ],
          "firstRouteStartsAtDirected": [
            -464.341,
            -140.318,
          ],
        },
        "headers": {
          "left": true,
          "nested": true,
          "outer": true,
          "right": true,
        },
        "routeLengths": {
          "bidirectional": 6,
          "chainedEdge": 6,
          "directed": 6,
          "edgeToEdge": 6,
          "parallel": 6,
          "undirected": 6,
        },
        "sameGeometry": true,
      }
    `)
  })

  test("is consumable by layout", async () => {
    const value = await firstValueFrom(of(graph).pipe(layout(fcoseGraphLayout)))
    expect(value.geometry.revisionId).toBe("cytoscape-fcose:a2336242")
  })

  test("uses sealed sequence roots as outer-layout rectangles", () => {
    const scopedGraph: Graph = {
      sequence: {
        id: "sequence",
        type: "node",
        layout: { mode: "sealed", bounds: { x: 20, y: 40, width: 240, height: 160 }, geometryRevisionId: "sequence:1" },
      },
      sequenceGroup: { id: "sequenceGroup", type: "node", parentId: "sequence" },
      actor: { id: "actor", type: "node", parentId: "sequenceGroup" },
      activation: { id: "activation", type: "node", parentId: "actor" },
      sequenceMessage: { id: "sequenceMessage", type: "edge", parentId: "sequenceGroup", fromId: "actor", toId: "activation", direction: "forward" },
      sibling: { id: "sibling", type: "node" },
      externalEdge: { id: "externalEdge", type: "edge", fromId: "sibling", toId: "actor", direction: "forward" },
      excluded: { id: "excluded", type: "node", layout: { mode: "excluded" } },
      excludedChild: { id: "excludedChild", type: "node", parentId: "excluded" },
      excludedEdge: { id: "excludedEdge", type: "edge", parentId: "excluded", fromId: "excluded", toId: "excludedChild", direction: "forward" },
    }

    const geometry = fcoseGraphLayout(scopedGraph, new AbortController().signal)
    const route = geometry.routesById.externalEdge

    expect({
      bounds: geometry.boundsById,
      anchors: geometry.endpointAnchorById,
      routes: Object.fromEntries(Object.entries(geometry.routesById).map(([id, points]) => [id, [...points].map(rounded)])),
      headers: geometry.headerBoundsById,
      externalRoute: {
        startsAtSibling: [route[0], route[1]].map(rounded),
        sibling: [geometry.endpointAnchorById.sibling.x, geometry.endpointAnchorById.sibling.y].map(rounded),
        endsAtSealedRoot: [route[4], route[5]].map(rounded),
        sealedRoot: [geometry.endpointAnchorById.sequence.x, geometry.endpointAnchorById.sequence.y].map(rounded),
      },
    }).toMatchInlineSnapshot(`
      {
        "anchors": {
          "externalEdge": {
            "x": 88.71090157209699,
            "y": 88.71090157209699,
          },
          "sequence": {
            "x": 0,
            "y": 0,
          },
          "sibling": {
            "x": -88.71090157209699,
            "y": -88.71090157209699,
          },
        },
        "bounds": {
          "sequence": {
            "height": 160,
            "width": 240,
            "x": -120,
            "y": -80,
          },
          "sibling": {
            "height": 34,
            "width": 50,
            "x": -113.71090157209699,
            "y": -105.71090157209699,
          },
        },
        "externalRoute": {
          "endsAtSealedRoot": [
            0,
            0,
          ],
          "sealedRoot": [
            0,
            0,
          ],
          "sibling": [
            -88.711,
            -88.711,
          ],
          "startsAtSibling": [
            -88.711,
            -88.711,
          ],
        },
        "headers": {},
        "routes": {
          "externalEdge": [
            -88.711,
            -88.711,
            88.711,
            88.711,
            0,
            0,
          ],
        },
      }
    `)
  })
})
