import { expect, it } from "vitest"
import { SLICE_DEFAULTS, SLICE_SPEC } from "../kit/slice/0_spec.js"
import { CURVES, GAPS } from "./6_slice.js"
import { slicePaths, splitPath } from "./6a_slicePaths.js"
import { seal } from "./3_seal.js"

it("measures exact semicircle chains from shuffled seals at every notebook size", () => {
  const receipt = [240, 32, 48, 64, 96, 160].map(size => {
    const timeline = slicePaths(seal(size / 2 - 2, 501470, { kFirst: true, pupil: false }).sc.parts, { cut: 33 }, { size })
    expect(timeline.strokes.every(s => s.pts.every(point => point.every(Number.isFinite)))).toBe(true)
    return [size, timeline.strokes.length, timeline.T]
  })
  expect(receipt).toMatchInlineSnapshot(`
    [
      [
        240,
        252,
        1370,
      ],
      [
        32,
        23,
        1370,
      ],
      [
        48,
        58,
        1370,
      ],
      [
        64,
        88,
        1370,
      ],
      [
        96,
        140,
        1370,
      ],
      [
        160,
        161,
        1370,
      ],
    ]
  `)
})

it("normalizes relative commands, implicit lineto, smooth curves, arcs and compound subpaths", () => {
  expect(splitPath("m10 20 10 0h10v10q10 20 20 0t20 0m40 0c0 20 20 20 20 0s20 -20 20 0a10 10 0 0 1 10 10z")).toMatchSnapshot()
  const path = "M0 0q20 -30 40 0t40 0m100 0h20v20z"
  const a = slicePaths([path], { cut: 12, seed: 8 })
  expect(a).toEqual(slicePaths([path], { cut: 12, seed: 8 }))
  expect(new Set(a.strokes.map(s => s.sub)).size).toBe(2)
  expect(a.strokes.every(s => s.pts.every(p => p.every(Number.isFinite)))).toBe(true)
  expect(a.strokes.filter(s => s.sub === 1).every(s => s.pts.every(([x]) => x <= 80.001))).toBe(true)
  expect(a.strokes.filter(s => s.sub === 2).every(s => s.pts.every(([x]) => x >= 179.999))).toBe(true)
  expect(slicePaths([[[0, 0], [30, 40]]], { cut: 100 }).strokes[0].pts.at(-1)).toEqual([30, 40])
  expect(splitPath("M0 0L1 2", "translate(5 6) scale(2)")).toEqual(["M5 6L7 10"])
})

it("keeps every seeded ordering and timing distribution finite, deterministic and bounded", () => {
  for (const order of SLICE_SPEC.order.options) {
    for (const curve of [...Object.keys(CURVES), ...Object.keys(GAPS)]) {
      const params = { ...SLICE_DEFAULTS, seed: 17, order, curve, cut: 12 }
      const timeline = slicePaths(["M-30 -20C-10 -90 70 90 90 20M-40 60H120"], params)
      expect(timeline).toEqual(slicePaths(["M-30 -20C-10 -90 70 90 90 20M-40 60H120"], params))
      expect(timeline.strokes.map(s => s.i).sort((a, b) => a - b)).toEqual(timeline.strokes.map((_, i) => i))
      expect(timeline.strokes.every(s => Number.isFinite(s.t0) && s.t0 >= 0 && s.t0 + s.dur <= timeline.T)).toBe(true)
    }
  }
  expect(slicePaths(["", "M0 0"])).toMatchObject({ strokes: [], T: 0, bursts: 0 })
  expect(() => slicePaths(["M0 0L100 0"], { cut: 1 }, { maxStrokes: 1 })).toThrow("maxStrokes")
  expect(() => splitPath("M 1 rubbish")).toThrow("Invalid SVG path")
})
