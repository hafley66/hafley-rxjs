import { describe, expect, it } from "vitest"
import { resolvePortLocation, type PortLocation } from "../src/index.js"

describe("resolvePortLocation", () => {
  it("resolves every port location variant", () => {
    const context = {
      ownerBounds: { x: 10, y: 20, width: 100, height: 50 },
      pathsById: { route: new Float32Array([0, 0, 100, 0, 100, 100]) },
    }
    const locations: PortLocation[] = [
      { kind: "absolute", point: { x: 7, y: 8 } },
      { kind: "relative-box", x: 0.25, y: 0.5 },
      { kind: "side", side: "right", offset: { unit: "ratio", value: 0.5 }, orientation: { mode: "tangent" } },
      { kind: "boundary", offset: { unit: "length", value: 125 }, lateralOffset: 3, orientation: { mode: "reverse-tangent" } },
      { kind: "path", pathId: "route", offset: { unit: "ratio", value: 0.75 }, lateralOffset: 4, orientation: { mode: "fixed", angle: 1.25 } },
    ]
    expect(locations.map(location => resolvePortLocation(location, context))).toMatchInlineSnapshot(`
      [
        {
          "angle": 0,
          "normal": {
            "x": 0,
            "y": 1,
          },
          "position": {
            "x": 7,
            "y": 8,
          },
          "tangent": {
            "x": 1,
            "y": 0,
          },
        },
        {
          "angle": 0,
          "normal": {
            "x": 0,
            "y": 1,
          },
          "position": {
            "x": 35,
            "y": 45,
          },
          "tangent": {
            "x": 1,
            "y": 0,
          },
        },
        {
          "angle": 1.5707963267948966,
          "normal": {
            "x": -1,
            "y": 0,
          },
          "position": {
            "x": 110,
            "y": 45,
          },
          "tangent": {
            "x": 0,
            "y": 1,
          },
        },
        {
          "angle": 4.71238898038469,
          "normal": {
            "x": -1,
            "y": 0,
          },
          "position": {
            "x": 107,
            "y": 45,
          },
          "tangent": {
            "x": 0,
            "y": 1,
          },
        },
        {
          "angle": 1.25,
          "normal": {
            "x": -1,
            "y": 0,
          },
          "position": {
            "x": 96,
            "y": 50,
          },
          "tangent": {
            "x": 0,
            "y": 1,
          },
        },
      ]
    `)
  })
})
