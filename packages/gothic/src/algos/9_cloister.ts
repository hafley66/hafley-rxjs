import { type AnySpec, type ValuesOf } from "@hafley66/report-shell"
import type { Algo, AlgoCtx, AlgoOut } from "../kit/2_algo.js"
import { circle, f, line, M, type Pt } from "../lib/1_geom.js"
import { ogive } from "../lib/2a_architecture.js"

export const SPEC = {
  bays: { kind: "range", hint: "repeated arch bays receding down the cloister", min: 3, max: 18, step: 1, default: 10 },
  perspective: { kind: "range", hint: "rate at which successive bays recede", min: 0.15, max: 0.7, step: 0.025, default: 0.3 },
  vanish: { kind: "range", hint: "horizontal vanishing point as a fraction of the cell", min: -0.2, max: 0.2, step: 0.01, default: 0.06 },
  horizon: { kind: "range", hint: "vertical vanishing point as a fraction of the cell", min: -0.2, max: 0.1, step: 0.01, default: -0.06 },
  mouldings: { kind: "range", hint: "outlines around each transverse vault rib", min: 1, max: 3, step: 1, default: 2 },
  paving: { kind: "range", hint: "longitudinal stone joints across the floor", min: 2, max: 10, step: 1, default: 6 },
  minPx: { kind: "range", hint: "smallest projected bay width in pixels", min: 1, max: 4, step: 0.5, default: 2, static: true },
  // scaffold:inputs
} as const satisfies AnySpec
export type Params = ValuesOf<typeof SPEC>

export function generate(p: Params, ctx: AlgoCtx): AlgoOut {
  const paths: AlgoOut["paths"] = []
  const S = ctx.size
  const point = (x: number, y: number, depth: number): Pt => {
    const q = 1 / (1 + depth * p.perspective)
    return [S * (x * q + p.vanish * (1 - q)), S * (y * q + p.horizon * (1 - q))]
  }
  const segment = (a: Pt, b: Pt, z: number) => paths.push({ d: line(a[0], a[1], b[0], b[1]), z })
  let bays = 0
  for (let bay = p.bays; bay >= 0; bay--) {
    const q = 1 / (1 + bay * p.perspective), z = bay / p.bays
    if (S * q < ctx.minPx * 10) continue
    const left = point(-0.42, 0.43, bay), right = point(0.42, 0.43, bay)
    const spring = point(0, -0.02, bay)
    for (let mould = 0; mould < p.mouldings; mould++) {
      const inset = mould * S * q * 0.012
      paths.push({ d: ogive(spring[0], spring[1], S * q * 0.84 - inset * 2, S * q * 0.42 - inset), z, cls: bay ? "opacity-70 [--w:0.7]" : "[--w:0.9]" })
    }
    segment(left, point(-0.42, -0.02, bay), z)
    segment(right, point(0.42, -0.02, bay), z)
    segment(left, right, z)
    const crown = point(0, -0.44, bay)
    paths.push({ d: circle(crown[0], crown[1], Math.max(0.65, S * q * 0.005)), z })
    if (bay < p.bays) for (const side of [-1, 1]) {
      const x = side * 0.42
      const a = point(x, 0.02, bay), b = point(x, -0.25, bay + 0.5), c = point(x, 0.02, bay + 1)
      const c1 = point(x, -0.13, bay), c2 = point(x, -0.24, bay + 0.2)
      const c3 = point(x, -0.24, bay + 0.8), c4 = point(x, -0.13, bay + 1)
      paths.push({ d: `${M(...a)}C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(b[0])} ${f(b[1])}C${f(c3[0])} ${f(c3[1])} ${f(c4[0])} ${f(c4[1])} ${f(c[0])} ${f(c[1])}`, z })
      segment(point(x, 0.43, bay), a, z)
      segment(point(x, 0.43, bay + 1), c, z)
    }
    bays++
  }
  for (let i = 0; i <= p.paving; i++) {
    const x = -0.42 + i / p.paving * 0.84
    segment(point(x, 0.43, 0), point(x, 0.43, p.bays), 0.7)
  }
  for (const side of [-1, 1]) segment(point(side * 0.42, -0.02, 0), point(side * 0.42, -0.02, p.bays), 0.4)
  segment(point(0, -0.44, 0), point(0, -0.44, p.bays), 0.3)
  return { paths, caption: `${bays - 1} bays · receding arcade`, lod: [] }
}

export const ALGO: Algo<Params> = {
  name: "cloister", spec: SPEC,
  presets: { nave: { bays: 12, perspective: 0.3, vanish: 0, horizon: -0.08, paving: 6 }, oblique: { bays: 10, perspective: 0.35, vanish: 0.18, horizon: -0.04, paving: 8 }, endless: { bays: 18, perspective: 0.2, vanish: -0.03, horizon: -0.13, mouldings: 3 } },
  run: generate,
}
