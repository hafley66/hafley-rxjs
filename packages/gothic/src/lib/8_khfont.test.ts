import { expect, it } from "vitest"
import { KH_DEFAULTS, KH_GLYPHS, khGlyph, khText } from "./8_khfont.js"

it("every glyph emits finite closed outlines and a spine per stroke", () => {
  for (const [ch, g] of Object.entries(KH_GLYPHS)) {
    const r = khGlyph(ch, { ...KH_DEFAULTS, jitter: 0.02, seed: 7 })
    expect(r, ch).not.toBeNull()
    expect(r!.strokes.length).toBe(g.s.length)
    for (const s of r!.strokes) {
      expect(s.d.startsWith("M"), ch).toBe(true)
      expect(s.d.endsWith("Z"), ch).toBe(true)
      expect(s.d).not.toMatch(/NaN|Infinity/)
      expect(s.spine.startsWith("M")).toBe(true)
      expect(s.spine).not.toMatch(/NaN/)
    }
  }
})

it("khText lays glyphs left to right; spaces advance; text folds to caps", () => {
  const a = khText("AB A", KH_DEFAULTS)
  const b = khText("ABA", KH_DEFAULTS)
  expect(a.glyphs).toBe(3)
  expect(a.width).toBeGreaterThan(b.width)
  expect(a.d.length).toBe(b.d.length)
  expect(khText("ab a", KH_DEFAULTS)).toEqual(a)
  expect(khText("KI NG", KH_DEFAULTS).width).toBeGreaterThan(khText("KING", KH_DEFAULTS).width)
})

it("jitter is seeded: same seed reproduces, a new seed diverges", () => {
  const o = { ...KH_DEFAULTS, jitter: 0.04 }
  expect(khText("KINGDOM", o)).toEqual(khText("KINGDOM", o))
  expect(khText("KINGDOM", o).d).not.toEqual(khText("KINGDOM", { ...o, seed: 99 }).d)
})

it("the chisel cut reshapes open terminals and leaves loops alone", () => {
  const flat = khGlyph("I", { ...KH_DEFAULTS, cut: 0 })!
  const chisel = khGlyph("I", { ...KH_DEFAULTS, cut: 0.2, cutAngle: 45 })!
  expect(flat.strokes[0].d).not.toEqual(chisel.strokes[0].d)
  const ring0 = khGlyph("O", { ...KH_DEFAULTS, cut: 0 })!
  const ring1 = khGlyph("O", { ...KH_DEFAULTS, cut: 0.2, cutAngle: 45 })!
  expect(ring0.strokes[0].d).toEqual(ring1.strokes[0].d)
})

it("spacing and tracking widen the line deterministically", () => {
  expect(khText("HI", { ...KH_DEFAULTS, tracking: 0.3 }).width).toBeGreaterThan(
    khText("HI", { ...KH_DEFAULTS, tracking: 0 }).width,
  )
  expect(khText("HI", KH_DEFAULTS).width).toMatchSnapshot()
})
