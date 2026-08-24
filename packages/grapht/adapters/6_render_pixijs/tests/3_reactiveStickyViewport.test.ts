import { describe, expect, test } from "vitest"
import { projectReactiveStickyFrame } from "../src/14_reactiveStickyViewport.js"

describe("reactive sticky viewport projection", () => {
  test("projects camera state into renderer-neutral overlay geometry", () => {
    expect(projectReactiveStickyFrame({
      actorWorldTop: 55,
      actorScreenTop: 74,
      actorWorldHeight: 72,
      stackInset: 8,
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
            "localY": 146.66666666666669,
            "slot": 190,
            "state": "stuck",
            "top": 190,
            "visible": true,
          },
          {
            "id": "nested",
            "localY": 172.66666666666666,
            "slot": 232,
            "state": "stuck",
            "top": 232,
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
