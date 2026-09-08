import { type AnySpec, type ValuesOf } from "@hafley66/report-shell"
import type { Algo, AlgoCtx, AlgoOut } from "../kit/2_algo.js"
import { mulberry32 } from "../lib/0_rng.js"
import { circle, line } from "../lib/1_geom.js"
import { foilRing } from "../lib/2_foil.js"
import { lancet } from "../lib/2a_architecture.js"

export const SPEC = {
  seed: { kind: "seed", hint: "branch proportions when asymmetry is above zero", default: 7 },
  depth: { kind: "range", hint: "recursive subdivisions inside the main lancet", min: 1, max: 5, step: 1, default: 4 },
  slender: { kind: "range", hint: "window width relative to its height", min: 0.4, max: 1, step: 0.02, default: 0.82 },
  rise: { kind: "range", hint: "height of child lancets relative to their parent", min: 0.54, max: 0.72, step: 0.01, default: 0.64 },
  stone: { kind: "range", hint: "mullion thickness relative to each opening", min: 0.02, max: 0.14, step: 0.01, default: 0.05 },
  asymmetry: { kind: "range", hint: "seeded difference between left and right child widths", min: 0, max: 0.3, step: 0.01, default: 0 },
  foils: { kind: "range", hint: "lobes in the crown lights", min: 3, max: 6, step: 1, default: 4 },
  casings: { kind: "range", hint: "concentric stone mouldings around the outer window", min: 1, max: 4, step: 1, default: 3, static: true },
  minPx: { kind: "range", hint: "smallest child opening in pixels", min: 1, max: 5, step: 0.5, default: 2, static: true },
  // scaffold:inputs
} as const satisfies AnySpec
export type Params = ValuesOf<typeof SPEC>

export function generate(p: Params, ctx: AlgoCtx): AlgoOut {
  const rng = mulberry32(ctx.seed)
  const paths: AlgoOut["paths"] = []
  let leaves = 0
  const H = ctx.size * 0.84, W = H * p.slender, base = ctx.size * 0.44
  for (let i = 1; i < p.casings; i++) {
    const pad = ctx.size * 0.012 * i
    paths.push({ d: lancet(0, base, W + pad * 2, H + pad * 1.2), z: 0, cls: "opacity-65" })
  }
  const branch = (cx: number, w: number, h: number, level: number) => {
    const z = level / Math.max(1, p.depth)
    paths.push({ d: lancet(cx, base, w, h), z })
    if (level >= p.depth - 1 || w < ctx.minPx * 12 || h < ctx.minPx * 16) { leaves++; return }
    const gap = w * p.stone
    const share = 0.5 + (rng() - 0.5) * p.asymmetry
    const left = (w - gap) * share, right = w - gap - left
    const childH = h * p.rise
    branch(cx - w / 2 + left / 2, left, childH, level + 1)
    branch(cx + w / 2 - right / 2, right, childH, level + 1)
    const r = Math.min(w * 0.14, h * (1 - p.rise) * 0.37)
    const y = base - childH - r * 1.12
    if (r > ctx.minPx * 1.5) {
      paths.push({ d: circle(cx, y, r * 1.12), z })
      paths.push({ d: foilRing(cx, y, r, p.foils), z })
    }
  }
  branch(0, W, H, 0)
  paths.push({ d: line(-W / 2 - ctx.size * 0.035, base, W / 2 + ctx.size * 0.035, base), z: 0 })
  return { paths, caption: `${leaves} lights · ${p.depth} generations`, lod: leaves < 2 ** (p.depth - 1) ? ["fine branches omitted"] : [] }
}

export const ALGO: Algo<Params> = {
  name: "architecture", spec: SPEC,
  presets: {
    rayonnant: { depth: 4, slender: 0.82, rise: 0.64, stone: 0.05, asymmetry: 0, foils: 4 },
    lancet: { depth: 3, slender: 0.48, rise: 0.68, stone: 0.06, asymmetry: 0, foils: 3 },
    flamboyant: { depth: 5, slender: 0.96, rise: 0.61, stone: 0.035, asymmetry: 0.23, foils: 5 },
  },
  run: generate,
}
