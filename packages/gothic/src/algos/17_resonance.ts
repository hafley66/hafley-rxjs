import { type AnySpec, type ValuesOf } from "@hafley66/report-shell"
import { contours } from "d3-contour"
import type { Algo, AlgoCtx, AlgoOut } from "../kit/2_algo.js"
import { poly, type Pt } from "../lib/1_geom.js"

export const SPEC = {
  m: { kind: "range", hint: "first standing-wave mode", min: 1, max: 9, step: 1, default: 3 },
  n: { kind: "range", hint: "second standing-wave mode", min: 1, max: 9, step: 1, default: 5 },
  bias: { kind: "range", hint: "relative strength of the crossed wave", min: 0.2, max: 1.8, step: 0.05, default: 0.85 },
  levels: { kind: "range", hint: "contour thresholds through the wave field", min: 3, max: 15, step: 2, default: 7 },
  // scaffold:inputs
} as const satisfies AnySpec
export type Params = ValuesOf<typeof SPEC>
export function generate(p: Params, ctx: AlgoCtx): AlgoOut {
  const N = 96, R = ctx.size * 0.44
  const values = Array.from({ length: N * N }, (_, i) => {
    const x = (i % N / (N - 1) - 0.5) * Math.PI, y = (Math.floor(i / N) / (N - 1) - 0.5) * Math.PI
    return Math.cos(p.m * x) * Math.cos(p.n * y) - p.bias * Math.cos(p.n * x) * Math.cos(p.m * y)
  })
  const paths: AlgoOut["paths"] = []
  const levels = Array.from({ length: p.levels }, (_, i) => (i / (p.levels - 1) * 2 - 1) * 0.75)
  for (const shape of contours().size([N, N]).thresholds(levels)(values)) {
    for (const polygon of shape.coordinates) for (const ring of polygon) {
      paths.push({ d: poly(ring.map(([x, y]): Pt => [(x / N * 2 - 1) * R, (y / N * 2 - 1) * R])), z: Math.abs(shape.value) })
    }
  }
  return { paths, caption: "standing-wave inscriptions", lod: [] }
}
export const ALGO: Algo<Params> = { name: "resonance", spec: SPEC, presets: { "crossed modes": { m: 3, n: 5, bias: 1 }, "lattice": { m: 4, n: 7, bias: 0.6 }, "quiet": { m: 1, n: 3, levels: 3 } }, run: generate }
