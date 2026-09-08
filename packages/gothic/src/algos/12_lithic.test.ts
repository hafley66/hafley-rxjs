import { defaultsOf, type AnySpec } from "@hafley66/report-shell"
import { expect, it } from "vitest"
import { ALGO as astrolabe, slitMask } from "./10_astrolabe.js"
import { ALGO as ossuary, respiration, rib } from "./11_ossuary.js"
import { ALGO as lithic, cubic, growPetal, partial } from "./12_lithic.js"
import { type Pt } from "../lib/1_geom.js"

it("renders repeatable finite geometry across presets, sizes and control extremes", () => {
  for (const algo of [astrolabe, ossuary, lithic]) {
    const defaults = defaultsOf(algo.spec as AnySpec)
    const low = Object.fromEntries(Object.entries(algo.spec).filter(([, s]) => s.kind === "range").map(([key, s]) => [key, "min" in s ? s.min : 0]))
    const high = Object.fromEntries(Object.entries(algo.spec).filter(([, s]) => s.kind === "range").map(([key, s]) => [key, "max" in s ? s.max : 1]))
    for (const preset of [{}, ...Object.values(algo.presets), low, high]) {
      for (const size of [256, 720]) {
        const p = { ...defaults, ...preset }
        const ctx = { size, seed: 17, minPx: 2 }
        const first = algo.run(p as never, ctx)
        expect(algo.run(p as never, ctx)).toEqual(first)
        const raw = first.raw?.join("") ?? ""
        expect(raw).not.toMatch(/NaN|Infinity|undefined/)
        const ids = [...raw.matchAll(/\sid="([^"]+)"/g)].map(m => m[1])
        expect(new Set(ids).size).toBe(ids.length)
        for (const match of raw.matchAll(/url\(#([^)]+)\)/g)) expect(ids).toContain(match[1])
      }
    }
  }
})

it("keeps breathing periodic, holds the inhale, and returns to closed masonry", () => {
  const times = [0, 0.22, 0.44, 0.5, 0.53, 0.655, 0.78, 1]
  expect(times.map(time => Number(respiration(time).toFixed(3)))).toEqual([0, 0.5, 1, 1, 1, 0.5, 0, 0])
  expect(rib(respiration(0))).toEqual(rib(respiration(1)))
  expect(rib(1)).not.toEqual(rib(0))
  expect((slitMask(72, 0.1, 0.5).match(/Z/g) ?? []).length).toBe(72)
})

it("joins every grown rib to its fork or stone boundary and preserves aperture area", () => {
  const left = Array.from({ length: 101 }, (_, i) => cubic([0, 0], [-82, -65], [-83, -207], [0, -300], i / 100))
  const outline = [...left, ...left.slice().reverse().map(([x, y]): Pt => [-x, y])]
  const inside = ([x, y]: Pt) => {
    let hit = false
    for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
      const [a, b] = outline[i], [c, d] = outline[j]
      if ((b > y) !== (d > y) && x < (c - a) * (y - b) / (d - b) + a) hit = !hit
    }
    return hit
  }
  const nearSegment = (point: Pt, a: Pt, b: Pt) => {
    const dx = b[0] - a[0], dy = b[1] - a[1]
    const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy)))
    return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy)
  }
  const receipt = []
  for (const seed of [0, 17, 51, 2147483647]) {
    const branches = growPetal(seed)
    const fork = branches[0].points.at(-1)
    for (const branch of branches.slice(1)) expect(branch.points[0]).toEqual(fork)
    expect(branches[3].points.at(-1)).toEqual([0, -300])
    expect(branches[1].points.at(-1)?.[0]).toBeCloseTo(-branches[2].points.at(-1)![0], 8)
    for (const branch of branches) {
      expect(partial(branch.points, 1)).toEqual(branch.points)
      expect(partial(branch.points, 0)).toEqual([branch.points[0], branch.points[0]])
      for (const point of branch.points.slice(1, -1)) expect(inside(point)).toBe(true)
    }
    let open = 0, area = 0
    for (let y = -299; y < 0; y += 2) for (let x = -82; x < 83; x += 2) {
      const point: Pt = [x, y]
      if (!inside(point)) continue
      area++
      const stone = branches.some(branch => branch.points.slice(1).some((b, i) => nearSegment(point, branch.points[i], b) < (0.8 + 9 * branch.width + 2.5) / 2))
      if (!stone) open++
    }
    expect(open / area).toBeGreaterThan(0.55)
    receipt.push({ seed, open: Math.round(open / area * 100), joints: branches.map(b => b.points.at(-1)?.map(n => Math.round(n))) })
  }
  expect(receipt).toMatchSnapshot()
})
