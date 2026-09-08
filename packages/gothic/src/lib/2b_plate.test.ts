import { expect, it } from "vitest"
import { ink, plate, roundel } from "./2b_plate.js"

it("uses explicit SVG presentation and scopes every paint server to its artwork", () => {
  expect([ink("M0 0L1 1", "#111", "#eee", 1.236), roundel(2, "gold")]).toMatchInlineSnapshot(`
    [
      "<path d=\"M0 0L1 1\" style=\"fill:#111;stroke:#eee;stroke-width:1.24\" />",
      "<path d=\"M-2 0A2 2 0 1 1 2 0A2 2 0 1 1 -2 0\" style=\"fill:gold;stroke:none;stroke-width:1\" />",
    ]
  `)
  const markup = plate(256, "test-256", ink("M0 0H1"))
  expect([...markup.matchAll(/id="([^"]+)"/g)].map(match => match[1])).toEqual([
    "test-256-night", "test-256-gold", "test-256-bone", "test-256-glass",
  ])
  expect(markup).toContain('transform="scale(0.256)"')
  expect(markup).toContain('fill:url(#test-256-night)')
})
