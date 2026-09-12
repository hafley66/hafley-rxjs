import { describe, expect, it } from "vitest"
import type { Pt } from "./1_geom.js"
import { KH_GLYPHS } from "./8_khfont.js"
import { KH_HOOKS, ORNAMENTS, ornamentPts, ornamentStrokes } from "./8d_khOrnament.js"

const AT: Pt = [0, 0]
const RIGHT: Pt = [1, 0]
const T = 0.9

const reach = (pts: readonly Pt[]): number =>
  Math.hypot(pts[pts.length - 1][0] - pts[0][0], pts[pts.length - 1][1] - pts[0][1])

describe("ornamentPts", () => {
  it("starts on the terminal it hangs off", () => {
    expect(ornamentPts(AT, RIGHT, 1, ORNAMENTS.curl, 1)[0]).toEqual(AT)
  })

  it("draws nothing at amount zero, which is the plain face", () => {
    expect(ornamentPts(AT, RIGHT, 1, ORNAMENTS.curl, 0)).toEqual([])
  })

  it("reaches further as the amount rises", () => {
    const half = reach(ornamentPts(AT, RIGHT, 1, ORNAMENTS.curl, 0.5))
    const full = reach(ornamentPts(AT, RIGHT, 1, ORNAMENTS.curl, 1))
    expect(full).toBeGreaterThan(half)
  })

  // A swept `curl` is the knob the face turns on: under 0.8 the run opens into a swash, past 1.2 it
  // tucks back under its host, and past 2.2 it closes on itself.
  it("tucks back toward its start as curl rises, which is what makes the foot a hook", () => {
    const open = reach(ornamentPts(AT, RIGHT, 1, { ...ORNAMENTS.curl, curl: 0.4 }, 1))
    const tucked = reach(ornamentPts(AT, RIGHT, 1, { ...ORNAMENTS.curl, curl: 2.2 }, 1))
    expect(tucked).toBeLessThan(open)
  })

  it("leaves a straight ornament straight, which is what a wedge is", () => {
    const pts = ornamentPts(AT, RIGHT, 1, ORNAMENTS.wedge, 1)
    const span = reach(pts)
    let run = 0
    for (let i = 1; i < pts.length; i++) run += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    expect(span).toBeCloseTo(run, 6)
  })
})

describe("ornamentStrokes", () => {
  it("mirrors the turn, so a pair of stems hooks outward on both sides", () => {
    const host = [{ pts: [[0, 0], [0, 1]] as Pt[] }]
    const plain = ornamentStrokes(host, [{ stroke: 0, end: "tail", kind: "curl" }], T, 1)
    const flipped = ornamentStrokes(host, [{ stroke: 0, end: "tail", kind: "curl", mirror: true }], T, 1)
    const a = plain[0].pts[plain[0].pts.length - 1]
    const b = flipped[0].pts[flipped[0].pts.length - 1]
    expect(Math.sign(a[0])).toBe(-Math.sign(b[0]))
  })

  it("hangs nothing off a loop, which has no terminal to hang from", () => {
    const ring = [{ pts: [[0, 0], [1, 0], [1, 1], [0, 1]] as Pt[], loop: true }]
    expect(ornamentStrokes(ring, [{ stroke: 0, end: "tail", kind: "curl" }], T, 1)).toEqual([])
  })

  it("skips a hook naming a stroke the glyph does not have", () => {
    const host = [{ pts: [[0, 0], [0, 1]] as Pt[] }]
    expect(ornamentStrokes(host, [{ stroke: 9, end: "tail", kind: "curl" }], T, 1)).toEqual([])
  })
})

describe("KH_HOOKS", () => {
  it("covers every letter the glyph table holds", () => {
    expect(Object.keys(KH_HOOKS).sort()).toEqual(Object.keys(KH_GLYPHS).sort())
  })

  it("names a stroke that letter actually has", () => {
    for (const [ch, hooks] of Object.entries(KH_HOOKS)) {
      for (const hook of hooks) {
        expect(hook.stroke, `${ch} hook`).toBeLessThan(KH_GLYPHS[ch].s.length)
      }
    }
  })

  it("builds at least one ornament for every letter that declares one", () => {
    for (const [ch, hooks] of Object.entries(KH_HOOKS)) {
      if (hooks.length === 0) continue
      const built = ornamentStrokes(KH_GLYPHS[ch].s, hooks, T, 1, 0.065)
      expect(built.length, `${ch}`).toBeGreaterThan(0)
    }
  })
})
