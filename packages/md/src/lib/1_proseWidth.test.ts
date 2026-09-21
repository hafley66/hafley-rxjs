import { describe, expect, it } from "vitest"
import {
  clampProseWidth,
  normalizeProseWidthBounds,
} from "./1_proseWidth.js"

describe("prose width", () => {
  it("clamps values and repairs editable bounds", () => {
    expect(normalizeProseWidthBounds({ min: 900, max: 500 })).toEqual({ min: 900, max: 900 })
    expect(normalizeProseWidthBounds({ min: -10, max: 9000 })).toEqual({ min: 240, max: 2400 })
    expect([
      clampProseWidth(200, { min: 420, max: 1200 }),
      clampProseWidth(900, { min: 420, max: 1200 }),
      clampProseWidth(1400, { min: 420, max: 1200 }),
    ]).toMatchInlineSnapshot(`
      [
        420,
        900,
        1200,
      ]
    `)
  })

})
