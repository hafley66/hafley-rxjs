import { describe, expect, it } from "vitest"
import { buildGraph, decodePositions, DEFAULT_SPACING } from "./1_graphology.js"

describe("Sigma geometry boundary", () => {
  it("decodes grapht-geometry/0 little-endian positions", () => {
    const bytes = new Uint8Array(8)
    const view = new DataView(bytes.buffer)
    view.setFloat32(0, 10.5, true)
    view.setFloat32(4, -2.25, true)
    expect(Array.from(decodePositions(bytes.buffer))).toMatchInlineSnapshot(`
      [
        10.5,
        -2.25,
      ]
    `)
  })

  it("imports fixture topology without invoking layout", () => {
    const graph = buildGraph({
      nodeIds: ["a", "b", "c"],
      positions: new Float32Array([0, 0, DEFAULT_SPACING, 0, DEFAULT_SPACING, DEFAULT_SPACING]),
      edges: [[0, 1], [1, 2]],
    })
    expect({ order: graph.order, size: graph.size, positions: graph.mapNodes((node, attrs) => [node, attrs.x, attrs.y]) }).toMatchInlineSnapshot(`
      {
        "order": 3,
        "positions": [
          [
            "a",
            0,
            0,
          ],
          [
            "b",
            10,
            0,
          ],
          [
            "c",
            10,
            10,
          ],
        ],
        "size": 2,
      }
    `)
  })
})
