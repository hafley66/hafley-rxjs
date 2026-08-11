import { describe, expect, it } from "vitest"
import { edgeTriangles, fitCamera, panCamera, screenToWorld, worldToScreen, zoomCamera } from "../src/7_geometryMath.js"

describe("edgeTriangles", () => {
  it("writes two triangles per edge, closed around the line", () => {
    const positions = new Float32Array([0, 0, 10, 0])
    const result = edgeTriangles(positions, [[0, 1]], 2)
    expect({ vertexCount: result.positions.length / 2, indexCount: result.indices.length, uvCount: result.uvs.length / 2 }).toMatchInlineSnapshot(`
      {
        "indexCount": 6,
        "uvCount": 4,
        "vertexCount": 4,
      }
    `)
    expect(result.indices).toEqual(new Uint32Array([0, 1, 2, 0, 2, 3]))
  })

  it("keeps the quad centered on the segment", () => {
    const positions = new Float32Array([0, 0, 10, 0])
    const result = edgeTriangles(positions, [[0, 1]], 2)
    expect(Array.from(result.positions)).toMatchInlineSnapshot(`
      [
        0,
        -2,
        0,
        2,
        10,
        2,
        10,
        -2,
      ]
    `)
  })
})

describe("camera transform", () => {
  it("fits a grid into the viewport", () => {
    const camera = fitCamera(new Float32Array([0, 0, 0, 100, 100, 0, 100, 100]), { width: 800, height: 600 })
    expect(roundOne(camera)).toMatchInlineSnapshot(`
      {
        "scale": 5.4,
        "tx": 130,
        "ty": 30,
      }
    `)
  })

  it("zooms around an anchor without drifting the anchor world point", () => {
    const start = { scale: 2, tx: 10, ty: 20 }
    const anchor = { x: 100, y: 100 }
    const before = screenToWorld(start, anchor.x, anchor.y)
    const next = zoomCamera(start, 2, anchor.x, anchor.y)
    const after = screenToWorld(next, anchor.x, anchor.y)
    expect({ x: round(after.x), y: round(after.y) }).toEqual({ x: round(before.x), y: round(before.y) })
    expect({ scale: next.scale, tx: round(next.tx), ty: round(next.ty) }).toMatchInlineSnapshot(`
      {
        "scale": 4,
        "tx": -80,
        "ty": -60,
      }
    `)
  })

  it("pans by an exact screen delta", () => {
    const next = panCamera({ scale: 2, tx: 10, ty: 20 }, 5, -3)
    expect(roundOne(next)).toEqual({ scale: 2, tx: 15, ty: 17 })
  })

  it("round-trips world and screen coordinates", () => {
    const camera = { scale: 3, tx: 40, ty: 50 }
    const screen = worldToScreen(camera, 7, 9)
    const world = screenToWorld(camera, screen.x, screen.y)
    expect({ x: round(world.x), y: round(world.y) }).toMatchInlineSnapshot(`
      {
        "x": 7,
        "y": 9,
      }
    `)
  })
})

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

function roundOne(camera: { scale: number; tx: number; ty: number }): { scale: number; tx: number; ty: number } {
  return { scale: round(camera.scale), tx: round(camera.tx), ty: round(camera.ty) }
}
