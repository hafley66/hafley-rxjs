import { type AnySpec, type ValuesOf } from "@hafley66/report-shell"
import type { Algo, AlgoCtx, AlgoOut } from "../kit/2_algo.js"
import { arc, circle, f, line, M, polar, poly, TAU } from "../lib/1_geom.js"
import { foilRing } from "../lib/2_foil.js"

export const SPEC = {
  bays: { kind: "range", hint: "square vault bays along each axis", min: 1, max: 3, step: 1, default: 1 },
  ribs: { kind: "range", hint: "radiating ribs in each corner fan", min: 4, max: 22, step: 1, default: 13 },
  rings: { kind: "range", hint: "transverse ribs crossing each fan", min: 1, max: 8, step: 1, default: 5 },
  spread: { kind: "range", hint: "fan radius relative to the bay width", min: 0.48, max: 0.92, step: 0.01, default: 0.71 },
  bend: { kind: "range", hint: "curve of the fan ribs between pier and outer web", min: -0.18, max: 0.18, step: 0.01, default: 0.04 },
  liernes: { kind: "range", hint: "concentric star webs around the central boss", min: 0, max: 5, step: 1, default: 3 },
  minPx: { kind: "range", hint: "spacing threshold for reducing ribs", min: 1, max: 4, step: 0.5, default: 2 },
  // scaffold:inputs
} as const satisfies AnySpec
export type Params = ValuesOf<typeof SPEC>

export function generate(p: Params, ctx: AlgoCtx): AlgoOut {
  const paths: AlgoOut["paths"] = []
  const span = ctx.size * 0.84, w = span / p.bays
  const ribs = Math.min(p.ribs, Math.max(4, Math.floor(w / (ctx.minPx * 4))))
  for (let by = 0; by < p.bays; by++) for (let bx = 0; bx < p.bays; bx++) {
    const x = -span / 2 + bx * w, y = -span / 2 + by * w
    const cx = x + w / 2, cy = y + w / 2
    paths.push({ d: poly([[x, y], [x + w, y], [x + w, y + w], [x, y + w]]), z: 0 })
    for (let corner = 0; corner < 4; corner++) {
      const ox = x + (corner === 1 || corner === 2 ? w : 0)
      const oy = y + (corner >= 2 ? w : 0)
      const start = corner * Math.PI / 2
      const radius = w * p.spread
      for (let i = 0; i <= ribs; i++) {
        const a = start + i / ribs * Math.PI / 2
        const dx = Math.cos(a) * radius, dy = Math.sin(a) * radius
        paths.push({ d: `${M(ox, oy)}C${f(ox + dx * 0.18 - dy * p.bend)} ${f(oy + dy * 0.18 + dx * p.bend)} ${f(ox + dx * 0.72 - dy * p.bend)} ${f(oy + dy * 0.72 + dx * p.bend)} ${f(ox + dx)} ${f(oy + dy)}`, z: 0.35, cls: "[--w:0.65]" })
      }
      for (let ring = 1; ring <= p.rings; ring++) {
        const r = radius * (0.2 + 0.8 * ring / p.rings)
        const a = polar(r, start), b = polar(r, start + Math.PI / 2)
        paths.push({ d: M(ox + a[0], oy + a[1]) + arc(r, ox + b[0], oy + b[1]), z: 0.6, cls: "opacity-65 [--w:0.65]" })
      }
      paths.push({ d: circle(ox, oy, w * 0.032), z: 0 })
      paths.push({ d: line(ox, oy, cx, cy), z: 0.15 })
    }
    for (let ring = 1; ring <= p.liernes; ring++) {
      const r = w * (0.07 + ring * 0.04)
      paths.push({ d: poly(Array.from({ length: 8 }, (_, i) => {
        const q = polar(i % 2 ? r * 0.6 : r, i / 8 * TAU)
        return [cx + q[0], cy + q[1]]
      })), z: 0.2 })
    }
    paths.push({ d: foilRing(cx, cy, w * 0.045, 4), z: 0 })
  }
  return { paths, caption: `${p.bays ** 2} bays · ${ribs} ribs per fan`, lod: ribs < p.ribs ? ["ribs reduced"] : [] }
}

export const ALGO: Algo<Params> = {
  name: "fanvault", spec: SPEC,
  presets: { perpendicular: { bays: 1, ribs: 16, rings: 6, bend: 0, liernes: 3 }, stellar: { bays: 1, ribs: 9, rings: 3, bend: 0.14, liernes: 5 }, nave: { bays: 3, ribs: 8, rings: 4, bend: 0, liernes: 2 } },
  run: generate,
}
