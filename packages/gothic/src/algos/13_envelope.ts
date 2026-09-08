import { type AnySpec, type ValuesOf } from "@hafley66/report-shell"
import type { Algo, AlgoCtx, AlgoOut } from "../kit/2_algo.js"
import { circle, line, polar, TAU } from "../lib/1_geom.js"

export const SPEC = {
  rays: { kind: "range", hint: "straight chords whose envelope forms the figure", min: 32, max: 240, step: 4, default: 128 },
  ratio: { kind: "range", hint: "angular multiplier between the two chord endpoints", min: 2, max: 9, step: 0.25, default: 3 },
  offset: { kind: "range", hint: "phase displacement of the inner endpoint", min: 0, max: 1, step: 0.01, default: 0.12 },
  inner: { kind: "range", hint: "radius of the second endpoint circle", min: 0.25, max: 1, step: 0.01, default: 0.86 },
  // scaffold:inputs
} as const satisfies AnySpec
export type Params = ValuesOf<typeof SPEC>
export function generate(p: Params, ctx: AlgoCtx): AlgoOut {
  const R = ctx.size * 0.46
  const paths = [{ d: circle(0, 0, R), z: 0 }]
  for (let i = 0; i < p.rays; i++) {
    const a = i / p.rays * TAU
    const x = polar(R, a), y = polar(R * p.inner, a * p.ratio + p.offset * TAU)
    paths.push({ d: line(...x, ...y), z: 0.45 })
  }
  return { paths, caption: "chord envelopes", lod: [] }
}
export const ALGO: Algo<Params> = { name: "envelope", spec: SPEC, presets: { "three cusps": { ratio: 4, inner: 1 }, "nested heart": { ratio: 2, inner: 0.62 }, "sunwheel": { ratio: 8, inner: 0.9 } }, run: generate }
