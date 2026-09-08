import { type AnySpec, type ValuesOf } from "@hafley66/report-shell"
import type { Algo, AlgoCtx, AlgoOut } from "../kit/2_algo.js"
import { circle } from "../lib/1_geom.js"

export const SPEC = {
  radius: { kind: "range", hint: "radius as a fraction of the cell size", min: 0.1, max: 0.45, step: 0.01, default: 0.35 },
  // scaffold:inputs
} as const satisfies AnySpec
export type Params = ValuesOf<typeof SPEC>

export function generate(p: Params, ctx: AlgoCtx): AlgoOut {
  // Replace this body with the generator. Inputs arrive in p; return paths in cell coordinates.
  return { paths: [{ d: circle(0, 0, ctx.size * p.radius), z: 0 }], caption: "@@ID@@", lod: [] }
}

export const ALGO: Algo<Params> = {
  name: "@@ID@@",
  spec: SPEC,
  presets: {},
  run: generate,
}
