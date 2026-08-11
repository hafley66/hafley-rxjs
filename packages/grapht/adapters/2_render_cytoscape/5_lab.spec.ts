import { describe, expect, it } from "vitest"
import { makeFixture } from "./3_fixture.ts"
import { createProjection, exerciseInteraction } from "./1_projection.ts"

describe("Cytoscape projection contract", () => {
  it("projects deterministic external geometry at every fixture size", () => {
    expect([1_000, 5_000, 10_000].map(size => { const geometry = makeFixture(size as 1_000 | 5_000 | 10_000); const projection = createProjection(geometry); const value = exerciseInteraction(projection, geometry.nodeIds[0]); projection.dispose(); return [value.visibleNodes, value.visibleEdges, value.selectedId] })).toMatchInlineSnapshot(`
      [
        [
          1000,
          1936,
          "n0_0",
        ],
        [
          5000,
          9858,
          "n0_0",
        ],
        [
          10000,
          19800,
          "n0_0",
        ],
      ]
    `)
  })

  it("reads camera state after fit, pan, and zoom", () => {
    const geometry = makeFixture(1_000); const projection = createProjection(geometry); const value = exerciseInteraction(projection, "n0_0")
    expect(value.selectedId).toBe("n0_0")
    expect(value.camera.zoom).toBeGreaterThan(0)
    expect(value.camera.pan).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }))
    projection.dispose()
  })
})
