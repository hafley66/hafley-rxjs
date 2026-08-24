import { describe, expect, test } from "vitest"
import { projectReactiveStickyFrame } from "../src/14_reactiveStickyViewport.js"

describe("reactive sticky viewport projection", () => {
  test("projects camera state into renderer-neutral overlay geometry", () => {
    expect(projectReactiveStickyFrame({
      actorWorldTop: 55,
      actorScreenTop: 74,
      inset: 80,
      gap: 6,
      items: [
        { id: "outer", worldTop: 196, boundaryWorldBottom: 790, localTop: -20, height: 24, order: 0 },
        { id: "nested", worldTop: 254, boundaryWorldBottom: 725, localTop: -18, height: 21, order: 1 },
      ],
    }, {
      x: 12,
      y: -180,
      scale: 1.5,
    })).toMatchInlineSnapshot(`
      {
        "actorLayer": {
          "scale": 1.5,
          "x": 12,
          "y": -8.5,
        },
        "groupLayer": {
          "scale": 1.5,
          "x": 12,
          "y": 0,
        },
        "placements": [
          {
            "id": "outer",
            "localY": 122.66666666666667,
            "slot": 154,
            "state": "stuck",
            "top": 154,
            "visible": true,
          },
          {
            "id": "nested",
            "localY": 152,
            "slot": 196,
            "state": "natural",
            "top": 201,
            "visible": true,
          },
        ],
        "viewport": {
          "scale": 1.5,
          "x": 12,
          "y": -180,
        },
      }
    `)
  })
})
