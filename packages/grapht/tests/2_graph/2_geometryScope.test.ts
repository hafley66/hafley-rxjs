import { describe, expect, test } from "vitest"
import type { Graph } from "@hafley66/grapht-model"
import { composeGraphGeometryScopes, sealedGeometryTransformOf, type GraphGeometry, type SealedGeometryScope } from "../../src/index.js"

function scopedGraph(): Graph {
  return {
    sequence: {
      id: "sequence",
      type: "node",
      layout: { mode: "sealed", bounds: { x: 10, y: 20, width: 100, height: 200 }, geometryRevisionId: "native:2" },
    },
    group: { id: "group", type: "node", parentId: "sequence" },
    nestedGroup: { id: "nestedGroup", type: "node", parentId: "group" },
    actor: { id: "actor", type: "node", parentId: "nestedGroup" },
    message: { id: "message", type: "edge", parentId: "nestedGroup", fromId: "actor", toId: "actor", direction: "forward" },
    sibling: { id: "sibling", type: "node" },
  }
}

function outerGeometry(): GraphGeometry {
  return {
    revisionId: "outer:2",
    boundsById: {
      sequence: { x: 100, y: 200, width: 300, height: 100 },
      sibling: { x: 500, y: 20, width: 50, height: 30 },
    },
    endpointAnchorById: {
      sequence: { x: 250, y: 250 },
      sibling: { x: 525, y: 35 },
    },
    routesById: {
      outerEdge: new Float32Array([250, 250, 525, 35]),
    },
    headerBoundsById: {},
  }
}

function nativeScope(): SealedGeometryScope {
  return {
    rootId: "sequence",
    fit: "contain",
    geometry: {
      revisionId: "native:2",
      boundsById: {
        actor: { x: 20, y: 40, width: 20, height: 10 },
      },
      endpointAnchorById: {
        actor: { x: 30, y: 80 },
      },
      routesById: {
        message: new Float32Array([10, 20, 110, 220]),
      },
      headerBoundsById: {
        group: { x: 10, y: 20, width: 100, height: 200 },
        nestedGroup: { x: 20, y: 40, width: 40, height: 60 },
      },
    },
  }
}

function snapshotOf(geometry: GraphGeometry) {
  return {
    revisionId: geometry.revisionId,
    boundsById: geometry.boundsById,
    endpointAnchorById: geometry.endpointAnchorById,
    routesById: Object.fromEntries(Object.entries(geometry.routesById).map(([id, route]) => [id, [...route]])),
    headerBoundsById: geometry.headerBoundsById,
  }
}

describe("sealed graph geometry scope composition", () => {
  test("contains translated native geometry with a nonzero source origin", () => {
    const outer = outerGeometry()
    const scope = nativeScope()
    const source = JSON.stringify(snapshotOf(scope.geometry))
    const composed = composeGraphGeometryScopes(outer, scopedGraph(), [scope])

    expect({
      transform: sealedGeometryTransformOf({ x: 10, y: 20, width: 100, height: 200 }, { x: 100, y: 200, width: 300, height: 100 }, "contain"),
      geometry: snapshotOf(composed),
    }).toMatchInlineSnapshot(`
      {
        "geometry": {
          "boundsById": {
            "actor": {
              "height": 5,
              "width": 10,
              "x": 230,
              "y": 210,
            },
            "sequence": {
              "height": 100,
              "width": 300,
              "x": 100,
              "y": 200,
            },
            "sibling": {
              "height": 30,
              "width": 50,
              "x": 500,
              "y": 20,
            },
          },
          "endpointAnchorById": {
            "actor": {
              "x": 235,
              "y": 230,
            },
            "sequence": {
              "x": 250,
              "y": 250,
            },
            "sibling": {
              "x": 525,
              "y": 35,
            },
          },
          "headerBoundsById": {
            "group": {
              "height": 100,
              "width": 50,
              "x": 225,
              "y": 200,
            },
            "nestedGroup": {
              "height": 30,
              "width": 20,
              "x": 230,
              "y": 210,
            },
          },
          "revisionId": "geometry:composed:1ea75e7a",
          "routesById": {
            "message": [
              225,
              200,
              275,
              300,
            ],
            "outerEdge": [
              250,
              250,
              525,
              35,
            ],
          },
        },
        "transform": {
          "scaleX": 0.5,
          "scaleY": 0.5,
          "translateX": 220,
          "translateY": 190,
        },
      }
    `)
    expect({
      nativeUnchanged: JSON.stringify(snapshotOf(scope.geometry)) === source,
      nativeRouteReused: composed.routesById.message === scope.geometry.routesById.message,
      rootRetained: composed.boundsById.sequence,
      deterministic: composed.revisionId === composeGraphGeometryScopes(outer, scopedGraph(), [scope]).revisionId,
    }).toMatchInlineSnapshot(`
      {
        "deterministic": true,
        "nativeRouteReused": false,
        "nativeUnchanged": true,
        "rootRetained": {
          "height": 100,
          "width": 300,
          "x": 100,
          "y": 200,
        },
      }
    `)
  })

  test("rejects deterministic collisions, stale native revisions, missing outer bounds, and non-finite rectangles", () => {
    const graph = scopedGraph()
    const scope = nativeScope()
    const collision = outerGeometry()
    collision.boundsById = { ...collision.boundsById, actor: { x: 0, y: 0, width: 1, height: 1 } }
    const missingRoot = outerGeometry()
    missingRoot.boundsById = { sibling: missingRoot.boundsById.sibling }
    const staleScope = nativeScope()
    staleScope.geometry = { ...staleScope.geometry, revisionId: "native:stale" }

    expect(() => composeGraphGeometryScopes(collision, graph, [scope])).toThrow("sealed geometry collision for bounds actor in scope sequence")
    expect(() => composeGraphGeometryScopes(outerGeometry(), graph, [staleScope])).toThrow("sealed geometry scope sequence revision native:stale does not match sealed geometry revision native:2")
    expect(() => composeGraphGeometryScopes(missingRoot, graph, [scope])).toThrow("sealed geometry scope sequence has no outer bounds")
    expect(() => sealedGeometryTransformOf({ x: Number.NaN, y: 0, width: 1, height: 1 }, { x: 0, y: 0, width: 1, height: 1 }, "contain")).toThrow("sealed geometry source bounds must have finite coordinates and dimensions")
    expect(() => sealedGeometryTransformOf({ x: 0, y: 0, width: 1, height: 1 }, { x: 0, y: 0, width: Number.POSITIVE_INFINITY, height: 1 }, "contain")).toThrow("sealed geometry target bounds must have finite coordinates and dimensions")
  })

  test("changes the composed revision when sealed source bounds change", () => {
    const graph = scopedGraph()
    const first = composeGraphGeometryScopes(outerGeometry(), graph, [nativeScope()])
    const changedGraph = scopedGraph()
    const sequence = changedGraph.sequence
    if (sequence.type !== "node" || sequence.layout?.mode !== "sealed") throw new Error("expected sealed sequence root")
    sequence.layout = { ...sequence.layout, bounds: { ...sequence.layout.bounds, x: 11 } }
    const second = composeGraphGeometryScopes(outerGeometry(), changedGraph, [nativeScope()])

    expect({ first: first.revisionId, second: second.revisionId, changed: first.revisionId !== second.revisionId }).toMatchInlineSnapshot(`
      {
        "changed": true,
        "first": "geometry:composed:1ea75e7a",
        "second": "geometry:composed:04011c01",
      }
    `)
  })
})
