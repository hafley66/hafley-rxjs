import { type AnySpec, type ValuesOf } from "@hafley66/report-shell"
import type { Algo, AlgoCtx, AlgoOut } from "../kit/2_algo.js"
import { mulberry32 } from "../lib/0_rng.js"
import { line } from "../lib/1_geom.js"
import { lancet, spire } from "../lib/2a_architecture.js"

export const SPEC = {
  seed: { kind: "seed", hint: "height variation across the spire cluster", default: 21 },
  towers: { kind: "range", hint: "main pinnacles in the skyline", min: 3, max: 9, step: 1, default: 5 },
  tiers: { kind: "range", hint: "smaller pinnacles growing from each tower", min: 0, max: 3, step: 1, default: 2 },
  height: { kind: "range", hint: "height of the central pinnacle relative to the cell", min: 0.55, max: 0.88, step: 0.01, default: 0.8 },
  shoulder: { kind: "range", hint: "height retained by the outer towers", min: 0.3, max: 1, step: 0.02, default: 0.58 },
  chaos: { kind: "range", hint: "seeded perturbation of tower heights", min: 0, max: 0.25, step: 0.01, default: 0.08 },
  crockets: { kind: "range", hint: "paired curled leaves climbing each needle", min: 0, max: 12, step: 1, default: 8 },
  minPx: { kind: "range", hint: "smallest leaf or subsidiary spire in pixels", min: 1, max: 4, step: 0.5, default: 2, static: true },
  // scaffold:inputs
} as const satisfies AnySpec
export type Params = ValuesOf<typeof SPEC>

export function generate(p: Params, ctx: AlgoCtx): AlgoOut {
  const paths: AlgoOut["paths"] = []
  const rng = mulberry32(ctx.seed)
  const S = ctx.size, base = S * 0.44, step = S * 0.8 / (p.towers - 1)
  let satellites = 0
  for (let i = 0; i < p.towers; i++) {
    const x = -S * 0.4 + i * step
    const edge = Math.abs(i - (p.towers - 1) / 2) / ((p.towers - 1) / 2)
    const h = S * p.height * (1 - edge * (1 - p.shoulder)) * (1 - rng() * p.chaos)
    const w = step * 0.58
    const z = edge * 0.45
    for (const d of spire(x, base, w, h, w > ctx.minPx * 6 ? p.crockets : 0)) paths.push({ d, z })
    for (let tier = 0; tier < p.tiers; tier++) {
      const sh = h * (0.27 - tier * 0.045), sw = w * (0.42 - tier * 0.06)
      if (sw < ctx.minPx * 2.5) continue
      for (const side of [-1, 1]) {
        const sx = x + side * w * (0.62 - tier * 0.1), sy = base - h * (0.12 + tier * 0.2)
        for (const d of spire(sx, sy, sw, sh, sw > ctx.minPx * 5 ? Math.floor(p.crockets / 2) : 0)) paths.push({ d, z: z + 0.35, cls: "[--w:0.7]" })
        paths.push({ d: line(x + side * w * 0.25, sy + sh * 0.14, sx, sy), z })
        satellites++
      }
    }
    if (i < p.towers - 1) paths.push({ d: lancet(x + step / 2, base, step * 0.52, S * 0.16), z: 0.65 })
  }
  paths.push({ d: line(-S * 0.46, base, S * 0.46, base), z: 0 })
  return { paths, caption: `${p.towers} pinnacles · ${satellites} satellites`, lod: [] }
}

export const ALGO: Algo<Params> = {
  name: "spires", spec: SPEC,
  presets: { crown: { towers: 5, tiers: 2, shoulder: 0.58, chaos: 0, crockets: 8 }, thicket: { towers: 9, tiers: 3, shoulder: 0.85, chaos: 0.22, crockets: 11 }, needles: { towers: 7, tiers: 0, shoulder: 0.4, chaos: 0.05, crockets: 3 } },
  run: generate,
}
