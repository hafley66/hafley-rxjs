import { type AnySpec, type ValuesOf } from "@hafley66/report-shell"
import type { Algo, AlgoCtx, AlgoOut } from "../kit/2_algo.js"
import { circle, pl, TAU, type Pt } from "../lib/1_geom.js"

export const SPEC = {
  rings: { kind: "range", hint: "concentric coordinate lines in the source disk", min: 4, max: 24, step: 1, default: 14 },
  meridians: { kind: "range", hint: "radial coordinate lines before conformal mapping", min: 6, max: 48, step: 2, default: 24 },
  focus: { kind: "range", hint: "Möbius focus draws the grid toward one side", min: -0.8, max: 0.8, step: 0.02, default: 0.58 },
  turn: { kind: "range", hint: "orientation of the displaced pole", min: 0, max: 1, step: 0.01, default: 0.125 },
  // scaffold:inputs
} as const satisfies AnySpec
export type Params = ValuesOf<typeof SPEC>
export function generate(p: Params, ctx: AlgoCtx): AlgoOut {
  const R = ctx.size * 0.46
  const at = (r: number, t: number): Pt => {
    const x = r * Math.cos(t), y = r * Math.sin(t), a = p.focus
    const den = (1 + a * x) ** 2 + (a * y) ** 2
    const u = ((x + a) * (1 + a * x) + a * y * y) / den
    const v = y * (1 - a * a) / den
    const angle = p.turn * TAU
    return [R * (u * Math.cos(angle) - v * Math.sin(angle)), R * (u * Math.sin(angle) + v * Math.cos(angle))]
  }
  const paths = [{ d: circle(0, 0, R) }]
  for (let j = 1; j <= p.rings; j++) paths.push({ d: pl(Array.from({ length: 241 }, (_, i) => at(j / (p.rings + 1), i / 240 * TAU))) })
  for (let j = 0; j < p.meridians; j++) paths.push({ d: pl(Array.from({ length: 97 }, (_, i) => at(i / 96, j / p.meridians * TAU))) })
  return { paths, caption: "conformal pole grid", lod: [] }
}
export const ALGO: Algo<Params> = { name: "conformal", spec: SPEC, presets: { "pole": { focus: 0.7 }, "orthogonal": { focus: 0, rings: 12, meridians: 16 } }, run: generate }
