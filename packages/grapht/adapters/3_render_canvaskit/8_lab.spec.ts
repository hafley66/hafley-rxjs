import { describe, expect, it } from "vitest"
import { makeFixture } from "./3_fixture.js"
import { fitCamera, pan, pickNearest, screenToWorld, zoomAt } from "./2_hitTest.js"

describe("CanvasKit projection contract", () => {
  it("uses deterministic external geometry for every benchmark size", () => {
    expect([1_000, 5_000, 10_000].map(size => {
      const geometry = makeFixture(size as 1_000 | 5_000 | 10_000)
      return [geometry.nodeCount, geometry.edgeCount, geometry.nodeIds[0], geometry.nodeIds.at(-1)]
    })).toMatchInlineSnapshot(`
      [
        [
          1000,
          1936,
          "n0_0",
          "n31_7",
        ],
        [
          5000,
          9858,
          "n0_0",
          "n70_29",
        ],
        [
          10000,
          19800,
          "n0_0",
          "n99_99",
        ],
      ]
    `)
  })

  it("round-trips camera transforms and picks the nearest node", () => {
    const geometry = makeFixture(1_000)
    const camera = fitCamera(geometry.positions, 1024, 768)
    const zoomed = zoomAt(pan(camera, 12, -8), 1.5, 512, 384)
    const world = screenToWorld([zoomed.tx + zoomed.scale * geometry.positions[0], zoomed.ty + zoomed.scale * geometry.positions[1]], zoomed)
    expect(world).toEqual([0, 0])
    expect(pickNearest([zoomed.tx, zoomed.ty], zoomed, geometry.positions, 12)).toEqual({ distance: 0, index: 0 })
  })
})
