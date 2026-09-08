import { type AnySpec, type ValuesOf } from "@hafley66/report-shell"
import type { Algo, AlgoCtx, AlgoOut } from "../kit/2_algo.js"
import { pl, polar, TAU, type Pt } from "../lib/1_geom.js"

export const SPEC = {
  strands: { kind: "range", hint: "independent interlaced ribbons", min: 2, max: 7, step: 1, default: 3 },
  crossings: { kind: "range", hint: "radial oscillations around the braid", min: 2, max: 11, step: 1, default: 5 },
  width: { kind: "range", hint: "distance between each ribbon's engraved edges", min: 0.01, max: 0.06, step: 0.002, default: 0.026 },
  phase: { kind: "range", hint: "braid phase and over-under displacement", min: 0, max: 1, step: 0.01, default: 0.13 },
  // scaffold:inputs
} as const satisfies AnySpec
export type Params = ValuesOf<typeof SPEC>
export function generate(p: Params, ctx: AlgoCtx): AlgoOut {
  const R = ctx.size * 0.43
  const paths: AlgoOut["paths"] = []
  for (let s = 0; s < p.strands; s++) for (const edge of [-1, 1]) {
    let points: Pt[] = []
    for (let i = 0; i <= 960; i++) {
      const t = i / 960 * TAU, q = t * p.crossings + s / p.strands * TAU + p.phase * TAU
      const under = Math.cos(q) < -0.93
      if (under && points.length) { paths.push({ d: pl(points) }); points = [] }
      if (!under) points.push(polar(R * (0.74 + 0.2 * Math.sin(q) + edge * p.width), t))
    }
    if (points.length) paths.push({ d: pl(points) })
  }
  return { paths, caption: "interlaced ribbon seal", lod: [] }
}
export const ALGO: Algo<Params> = { name: "braid", spec: SPEC, presets: { "trinity": { strands: 3, crossings: 5 }, "sevenfold": { strands: 7, crossings: 3, width: 0.014 } }, run: generate }
