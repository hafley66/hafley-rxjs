import { describe, expect, test } from "vitest"
import { projectViewportWheel } from "../src/16_viewportWheel.js"

describe("viewport wheel gestures", () => {
  test("separates pinch zoom, vertical scroll, and command scroll", () => {
    expect([
      projectViewportWheel({ ctrlKey: true, metaKey: false, deltaX: 0, deltaY: -12 }),
      projectViewportWheel({ ctrlKey: false, metaKey: false, deltaX: 3, deltaY: 40 }),
      projectViewportWheel({ ctrlKey: false, metaKey: true, deltaX: 0, deltaY: 40 }),
      projectViewportWheel({ ctrlKey: false, metaKey: true, deltaX: 12, deltaY: 40 }),
    ]).toMatchInlineSnapshot(`
      [
        {
          "type": "pinch",
        },
        {
          "type": "pan",
          "x": -3,
          "y": -40,
        },
        {
          "type": "pan",
          "x": -40,
          "y": 0,
        },
        {
          "type": "pan",
          "x": -12,
          "y": 0,
        },
      ]
    `)
  })
})
