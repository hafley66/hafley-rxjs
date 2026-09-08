import { describe, expect, it } from "vitest"
import { algoCtx } from "../kit/2_algo.js"
import { circle } from "../lib/index.js"
import { type Fma, fma2, xform } from "./2_fma.js"

const P: Fma = { seed: 7, n: 5, step: 2, depth: 2, sat: 0.9, minPx: 2, script: true, pupil: true }
const run = (p: Partial<Fma>, size: number) => fma2.run({ ...P, ...p }, algoCtx({ ...P, ...p }, size))
const nums = (d: string) => (d.match(/-?\d*\.?\d+/g) ?? []).map(Number)

describe("xform", () => {
  it("rotates about the origin then moves; a circle keeps its radius and lands on the new centre", () => {
    const d = xform(circle(0, 0, 10), 30, -5, Math.PI / 3)
    const xs = nums(d)
    expect(d).toMatch(/^M/)
    expect(d).toContain("A10 10 0 1 1 ")
    expect(xs.every(Number.isFinite)).toBe(true)
    // the two arc endpoints are diametrically opposite through (30, -5)
    const pts = d.split(/[MA]/).filter(Boolean)
    const [mx, my] = nums(pts[0])
    const end = nums(pts[1]).slice(-2)
    expect((mx + end[0]) / 2).toBeCloseTo(30, 1)
    expect((my + end[1]) / 2).toBeCloseTo(-5, 1)
  })
})

describe("fma2", () => {
  it("is deterministic and never emits NaN", () => {
    const a = run({}, 240)
    const b = run({}, 240)
    expect(a).toEqual(b)
    expect(a.paths.every(p => nums(p.d).every(Number.isFinite))).toBe(true)
    expect(a.caption).toBe("n5/2 · depth 2 · sats seal")
  })

  it("every count follows n: n satellites, n chords, an n-gon, n·2 ticks when script is off", () => {
    const out = run({ n: 7, step: 3, depth: 1, script: false }, 480)
    const R = 239
    const rp = R * 0.84
    const rs = ((rp * Math.sin(Math.PI / 7)) / (1 + Math.sin(Math.PI / 7))) * 0.9
    const sats = out.paths.filter(p => p.d.includes(`A${Math.round(rs * 100) / 100} `))
    expect(sats).toHaveLength(7)
    const lines = out.paths.filter(p => /^M[^A]*L[^L]*$/.test(p.d) && !p.d.endsWith("Z"))
    // 14 ticks + 7 chords
    expect(lines).toHaveLength(21)
    const polys = out.paths.filter(p => p.d.endsWith("Z") && (p.d.match(/L/g) ?? []).length === 6)
    // {7}, {7/3}, dual {7}
    expect(polys).toHaveLength(3)
    expect(out.caption).toBe("n7/3 · depth 1 · sats foil")
  })

  it("children inherit the family: the same seed at depth 2 contains depth 1 and adds nested rings; LOD shrinks with size", () => {
    const d1 = run({ depth: 1 }, 480)
    const d2 = run({ depth: 2 }, 480)
    expect(d2.paths.length).toBeGreaterThan(d1.paths.length)
    expect(d2.caption).toContain("depth 2")
    const small = run({ depth: 3 }, 48)
    expect(small.caption).toContain("depth 1")
    expect(small.lod.some(l => l.startsWith("seal→"))).toBe(true)
    expect(small.paths.length).toBeLessThan(run({ depth: 3 }, 160).paths.length)
    expect(run({ depth: 3 }, 160).paths.length).toBeLessThan(run({ depth: 3 }, 480).paths.length)
  })

  it("z runs 0 at the outer ring to 1 at the deepest core and every z sits in [0, 1]", () => {
    const flat = run({ depth: 1 }, 480)
    const zf = flat.paths.map(p => p.z ?? -1)
    expect(flat.paths[0].z).toBe(0)
    expect(Math.max(...zf)).toBe(1)
    const deep = run({ depth: 3 }, 480)
    const zd = deep.paths.map(p => p.z ?? -1)
    expect(Math.min(...zd)).toBe(0)
    expect(Math.max(...zd)).toBeLessThanOrEqual(1)
    expect(Math.max(...zd)).toBeGreaterThan(0.9)
  })

  it("n = 0 and step = 0 come from the seed and the step is coprime to n", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const m = run({ seed, n: 0, step: 0, depth: 1 }, 96).caption.match(/^n(\d)\/(\d)/)
      if (!m) throw new Error("caption")
      const n = Number(m[1])
      const k = Number(m[2])
      expect(n).toBeGreaterThanOrEqual(3)
      expect(n).toBeLessThanOrEqual(8)
      const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
      expect(gcd(n, k)).toBe(1)
    }
  })
})
