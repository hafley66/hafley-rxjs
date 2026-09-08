import { defaultsOf } from "@hafley66/report-shell"
import { expect, it } from "vitest"
import { ALGO as envelope } from "./13_envelope.js"
import { ALGO as braid } from "./14_braid.js"
import { ALGO as conformal } from "./15_conformal.js"
import { ALGO as cells } from "./16_cells.js"
import { ALGO as resonance } from "./17_resonance.js"

it("adds twenty geometry controls across five deterministic path families", () => {
  const algos = [envelope, braid, conformal, cells, resonance]
  expect(algos.map(algo => [algo.name, Object.keys(algo.spec)])).toMatchInlineSnapshot(`
    [
      [
        "envelope",
        [
          "rays",
          "ratio",
          "offset",
          "inner",
        ],
      ],
      [
        "braid",
        [
          "strands",
          "crossings",
          "width",
          "phase",
        ],
      ],
      [
        "conformal",
        [
          "rings",
          "meridians",
          "focus",
          "turn",
        ],
      ],
      [
        "cells",
        [
          "seed",
          "sites",
          "relax",
          "inset",
        ],
      ],
      [
        "resonance",
        [
          "m",
          "n",
          "bias",
          "levels",
        ],
      ],
    ]
  `)
  for (const algo of algos) {
    const defaults = defaultsOf(algo.spec)
    const extrema = ["min", "max"].map(bound => Object.fromEntries(Object.entries(algo.spec).filter(([, field]) => field.kind === "range").map(([key, field]) => [key, (field as unknown as Record<string, number>)[bound]])))
    for (const preset of [{}, ...Object.values(algo.presets), ...extrema]) {
      const p = { ...defaults, ...preset }
      const ctx = { size: 400, seed: 7, minPx: 2 }
      const out = algo.run(p as never, ctx)
      expect(algo.run(p as never, ctx)).toEqual(out)
      expect(out.paths.length).toBeGreaterThan(0)
      expect(out.paths.every(path => !/NaN|Infinity/.test(path.d))).toBe(true)
    }
  }
})
