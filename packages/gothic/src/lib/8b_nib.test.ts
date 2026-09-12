import { describe, expect, it } from "vitest"
import type { Pt } from "./1_geom.js"
import { crCubics, nibOutline, nibSpine, offsetCubic, type Cubic } from "./8b_nib.js"
import { mixGlyph, resample, toMorph } from "./8c_khMorph.js"

const STEM: Pt[] = [
  [0, 0],
  [0, 1],
]
const BOWL: Pt[] = [
  [0.5, 0],
  [1, 0.5],
  [0.5, 1],
  [0, 0.5],
]
const W = [1, 1, 1] as const
const OPTS = { weight: 0.05, contrast: 0, cutAngle: 24, overshoot: 0.9 }

const segments = (d: string): number => [...d].filter(c => c === "C").length

describe("crCubics", () => {
  it("emits one cubic per span, not one per sample", () => {
    expect(crCubics(BOWL, false, 0.5)).toHaveLength(3)
    expect(crCubics(BOWL, true, 0.5)).toHaveLength(4)
  })

  it("pins the span ends on the control points it was given", () => {
    const [first] = crCubics(STEM, false, 0.5)
    expect(first[0]).toEqual([0, 0])
    expect(first[3]).toEqual([0, 1])
  })

  it("drops a repeated last point on a closed run rather than making a zero-length span", () => {
    const ring: Pt[] = [...BOWL, [0.5, 0]]
    expect(crCubics(ring, true, 0.5)).toHaveLength(4)
  })
})

describe("offsetCubic", () => {
  it("moves a straight leg by exactly the distance asked for", () => {
    const line: Cubic = [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ]
    expect(offsetCubic(line, 2, 2, 2)).toEqual([
      [0, 2],
      [1, 2],
      [2, 2],
      [3, 2],
    ])
  })

  // Two offset legs within a hair of parallel meet far off the page without tripping the parallel
  // test, and one such handle threw a spike across the whole word.
  it("keeps a near-parallel pair from throwing its handle across the page", () => {
    const nearly: Cubic = [
      [0, 0],
      [1, 0],
      [2, 1e-7],
      [3, 0],
    ]
    const out = offsetCubic(nearly, 5, 5, 5)
    for (const [x, y] of out) {
      expect(Math.abs(x)).toBeLessThan(20)
      expect(Math.abs(y)).toBeLessThan(20)
    }
  })
})

describe("nibOutline", () => {
  it("costs two walls plus two caps, whatever the control count", () => {
    expect(segments(nibOutline(BOWL, false, 0.9, W, OPTS))).toBe(6)
    expect(segments(nibOutline(STEM, false, 0.9, W, OPTS))).toBe(2)
  })

  it("closes a loop as two rings, which is the stroke and its counter", () => {
    const d = nibOutline(BOWL, true, 0.9, W, OPTS)
    expect([...d].filter(c => c === "M")).toHaveLength(2)
    expect([...d].filter(c => c === "Z")).toHaveLength(2)
  })

  it("answers an empty string for a run with no span", () => {
    expect(nibOutline([[0, 0]], false, 0.9, W, OPTS)).toBe("")
    expect(nibSpine([], false, 0.9)).toBe("")
  })
})

describe("toMorph", () => {
  const K = [{ pts: STEM }, { pts: [[0.8, 0] as Pt, [0.2, 0.5] as Pt] }, { pts: [[0.3, 0.4] as Pt, [0.9, 1] as Pt] }]
  const O = [{ pts: BOWL, loop: true }]

  it("gives every glyph the same shape whatever its table held", () => {
    const a = toMorph(K, 1, 0.9)
    const b = toMorph(O, 1, 0.9)
    expect(a.s).toHaveLength(b.s.length)
    expect(a.s.map(s => s.pts.length)).toEqual(b.s.map(s => s.pts.length))
  })

  it("pads with zero-width strokes, so the letter with fewer draws the same number", () => {
    const padded = toMorph(O, 1, 0.9).s.filter(s => s.w[1] === 0)
    expect(padded).toHaveLength(5)
  })

  it("orders longest first, so a stem pairs with a stem", () => {
    const runs = toMorph(K, 1, 0.9).s.map(s =>
      s.pts.reduce((sum, p, i) => (i === 0 ? 0 : sum + Math.hypot(p[0] - s.pts[i - 1][0], p[1] - s.pts[i - 1][1])), 0),
    )
    expect([...runs].sort((x, y) => y - x)).toEqual(runs)
  })
})

describe("mixGlyph", () => {
  const a = toMorph([{ pts: STEM }], 1, 0.9)
  const b = toMorph([{ pts: [[1, 0] as Pt, [1, 1] as Pt] }], 1, 0.9)

  it("lands on each end exactly", () => {
    expect(mixGlyph(a, b, 0).s[0].pts).toEqual(a.s[0].pts)
    expect(mixGlyph(a, b, 1).s[0].pts).toEqual(b.s[0].pts)
  })

  it("puts the halfway frame halfway", () => {
    expect(mixGlyph(a, b, 0.5).s[0].pts[0][0]).toBeCloseTo(0.5, 6)
  })
})

describe("resample", () => {
  it("spaces by arc length, so a straight run comes back evenly split", () => {
    const pts = resample(crCubics(STEM, false, 0.5), 5)
    expect(pts).toHaveLength(5)
    expect(pts[2][1]).toBeCloseTo(0.5, 2)
  })
})
