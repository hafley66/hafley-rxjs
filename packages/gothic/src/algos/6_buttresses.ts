import { type AnySpec, type ValuesOf } from "@hafley66/report-shell"
import type { Algo, AlgoCtx, AlgoOut } from "../kit/2_algo.js"
import { f, line, M, poly } from "../lib/1_geom.js"
import { lancet, spire } from "../lib/2a_architecture.js"

export const SPEC = {
  bays: { kind: "range", hint: "repeated structural frames in the oblique elevation", min: 1, max: 5, step: 1, default: 3 },
  tiers: { kind: "range", hint: "flying arches between each pier and the nave", min: 1, max: 3, step: 1, default: 2 },
  span: { kind: "range", hint: "distance from the nave to the outer piers", min: 0.23, max: 0.38, step: 0.01, default: 0.32 },
  lift: { kind: "range", hint: "height of the upper flying arch at the nave", min: 0.56, max: 0.78, step: 0.01, default: 0.7 },
  rake: { kind: "range", hint: "horizontal projection between repeated bays", min: 0.015, max: 0.055, step: 0.005, default: 0.035 },
  crockets: { kind: "range", hint: "paired leaf ornaments on the pier pinnacles", min: 0, max: 8, step: 1, default: 5 },
  minPx: { kind: "range", hint: "smallest ornament size in pixels", min: 1, max: 4, step: 0.5, default: 2 },
  // scaffold:inputs
} as const satisfies AnySpec
export type Params = ValuesOf<typeof SPEC>

export function generate(p: Params, ctx: AlgoCtx): AlgoOut {
  const paths: AlgoOut["paths"] = []
  const S = ctx.size * 0.88, base = S * 0.45
  for (let bay = p.bays - 1; bay >= 0; bay--) {
    const dx = (bay - (p.bays - 1) / 2) * S * p.rake, dy = -bay * S * 0.024
    const z = bay / Math.max(1, p.bays - 1)
    const cls = bay ? "opacity-45 [--w:0.7]" : "[--w:0.85]"
    const path = (d: string) => paths.push({ d, z, cls })
    const y = base + dy
    path(poly([[dx - S * 0.09, y], [dx - S * 0.09, y - S * 0.79], [dx, y - S * 0.94], [dx + S * 0.09, y - S * 0.79], [dx + S * 0.09, y]]))
    path(lancet(dx, y - S * 0.04, S * 0.105, S * 0.66))
    for (const side of [-1, 1]) {
      const wall = dx + side * S * 0.09, pier = dx + side * S * p.span
      path(poly([[pier - S * 0.035, y], [pier - S * 0.025, y - S * 0.45], [pier + S * 0.025, y - S * 0.45], [pier + S * 0.035, y]]))
      for (let tier = 0; tier < p.tiers; tier++) {
        const wy = y - S * (p.lift - tier * 0.15), py = y - S * (0.43 - tier * 0.115)
        const gap = pier - wall, t = S * 0.025
        path(`${M(wall, wy)}C${f(wall + gap * 0.2)} ${f(wy + S * 0.17)} ${f(pier - gap * 0.28)} ${f(py)} ${f(pier)} ${f(py)}L${f(pier)} ${f(py + t)}C${f(pier - gap * 0.34)} ${f(py + t)} ${f(wall + gap * 0.16)} ${f(wy + S * 0.2)} ${f(wall)} ${f(wy + t * 1.8)}Z`)
      }
      for (const d of spire(pier, y - S * 0.43, S * 0.078, S * 0.28, S * 0.078 > ctx.minPx * 6 ? p.crockets : 0)) path(d)
      path(line(pier - S * 0.052, y, pier + S * 0.052, y))
    }
  }
  return { paths, caption: `${p.bays} frames · ${p.tiers} flying tiers`, lod: [] }
}

export const ALGO: Algo<Params> = {
  name: "buttresses", spec: SPEC,
  presets: { elevation: { bays: 1, tiers: 2, span: 0.35, lift: 0.72 }, forest: { bays: 5, tiers: 3, span: 0.28, lift: 0.77, rake: 0.035 }, low: { bays: 3, tiers: 1, span: 0.37, lift: 0.58 } },
  run: generate,
}
