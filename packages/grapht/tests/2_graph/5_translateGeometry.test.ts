import { expect, it } from "vitest"
import { translateGraphGeometry } from "../../src/2_graph/5_translateGeometry.js"

it("moves graph items and attached route endpoints", () => {
  const graph = {
    a: { id: "a", type: "node" },
    b: { id: "b", type: "node" },
    ab: { id: "ab", type: "edge", fromId: "a", toId: "b", direction: "forward" },
  } as const
  const geometry = translateGraphGeometry(graph, {
    revisionId: "one",
    boundsById: { a: { x: 0, y: 0, width: 10, height: 10 }, b: { x: 20, y: 0, width: 10, height: 10 } },
    endpointAnchorById: { a: { x: 5, y: 5 }, b: { x: 25, y: 5 } },
    routesById: { ab: new Float32Array([5, 5, 15, 5, 25, 5]) },
    headerBoundsById: {},
  }, { a: { x: 3, y: 4 }, b: { x: -2, y: 6 } })
  expect({
    bounds: geometry.boundsById,
    anchors: geometry.endpointAnchorById,
    route: [...geometry.routesById.ab],
  }).toMatchInlineSnapshot(`
    {
      "anchors": {
        "a": {
          "x": 8,
          "y": 9,
        },
        "b": {
          "x": 23,
          "y": 11,
        },
      },
      "bounds": {
        "a": {
          "height": 10,
          "width": 10,
          "x": 3,
          "y": 4,
        },
        "b": {
          "height": 10,
          "width": 10,
          "x": 18,
          "y": 6,
        },
      },
      "route": [
        8,
        9,
        15,
        5,
        23,
        11,
      ],
    }
  `)
})
