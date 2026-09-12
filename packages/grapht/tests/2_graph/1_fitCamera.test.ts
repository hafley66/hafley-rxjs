import { describe, expect, test } from "vitest"
import { fitGraphCamera, type GraphGeometry } from "../../src/index.js"

function geometry(overrides: Partial<GraphGeometry> = {}): GraphGeometry {
  return {
    revisionId: "geometry",
    boundsById: {},
    endpointAnchorById: {},
    routesById: {},
    headerBoundsById: {},
    ...overrides,
  }
}

describe("fitGraphCamera", () => {
  test("fits negative fCoSE coordinates from bounds, routes, and headers", () => {
    const camera = fitGraphCamera(
      geometry({
        boundsById: { node: { x: -100, y: -50, width: 80, height: 30 } },
        routesById: { edge: new Float32Array([-120, -40, 20, 50]) },
        headerBoundsById: { group: { x: -110, y: -60, width: 100, height: 10 } },
      }),
      { x: 0, y: 0, width: 200, height: 100 },
      10,
    )

    expect(camera).toMatchInlineSnapshot(`
      {
        "scale": 0.7272727272727273,
        "viewport": {
          "height": 100,
          "width": 200,
          "x": 0,
          "y": 0,
        },
        "x": 136.36363636363637,
        "y": 53.63636363636364,
      }
    `)
  })

  test("centers empty geometry at the viewport origin with unit scale", () => {
    expect(fitGraphCamera(geometry(), { x: 30, y: 40, width: 200, height: 80 }, 16)).toMatchInlineSnapshot(`
      {
        "scale": 1,
        "viewport": {
          "height": 80,
          "width": 200,
          "x": 30,
          "y": 40,
        },
        "x": 130,
        "y": 80,
      }
    `)
  })

  test("centers fitted content inside a viewport with a nonzero origin", () => {
    expect(
      fitGraphCamera(
        geometry({ boundsById: { node: { x: 10, y: 20, width: 40, height: 20 } } }),
        { x: 100, y: 200, width: 120, height: 80 },
        10,
      ),
    ).toMatchInlineSnapshot(`
      {
        "scale": 2.5,
        "viewport": {
          "height": 80,
          "width": 120,
          "x": 100,
          "y": 200,
        },
        "x": 85,
        "y": 165,
      }
    `)
  })
})
