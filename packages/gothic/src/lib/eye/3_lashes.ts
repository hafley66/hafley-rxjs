import { type Pt, type SealSpec, TAU } from "../index.js"

export type Slot = { a: number; long: boolean }
export function lashSlots(mode: string, s: SealSpec): Slot[] {
  if (mode === "none") return []
  const k = mode === "slots" ? s.n : mode === "slots×k" ? s.n * s.k : 9
  const out: Slot[] = []
  for (let i = 0; i < k; i++) {
    const a = mode === "arclen" ? (-Math.PI * (i + 1)) / (k + 1) : s.rot + (i * TAU) / k
    const m = ((a % TAU) + TAU) % TAU
    if (m > Math.PI + 0.12 && m < TAU - 0.12) out.push({ a: m - TAU, long: mode !== "slots×k" || i % s.k === 0 })
  }
  return out.sort((p, q) => p.a - q.a)
}
/* Lashes ride the lid margin: constant length, direction rotates from the lid normal toward straight down as the lid
   closes (a shut eye shows lashes pointing down, never shrunk). aUp = upper aperture 0..1 at the apex. */
export function lashLines(up: Pt[], slots: Slot[], lashLen: number, aUp: number): [Pt, Pt][] {
  const N = up.length - 1
  const r = (1 - aUp) * 0.65
  return slots.map(({ a, long }) => {
    // slot angle -> lid sample by x (cos a), so the root stays put while the lid travels
    const best = Math.round(((Math.cos(a) + 1) / 2) * N)
    const [x0, y0] = up[best]
    const j1 = Math.min(best + 1, N)
    const j0 = Math.max(best - 1, 0)
    const tx = up[j1][0] - up[j0][0]
    const ty = up[j1][1] - up[j0][1]
    const tl = Math.hypot(tx, ty) || 1
    const dx0 = (ty / tl) * 0.5 + Math.cos(a) * 0.5
    const dy0 = (-tx / tl) * 0.5 + Math.sin(a) * 0.5
    // shut target: down and a little outward, so a closed lid shows a splayed fringe rather than a comb
    const dx = dx0 * (1 - r) + 0.35 * Math.sign(x0) * r
    const dy = dy0 * (1 - r) + r
    const dl = Math.hypot(dx, dy) || 1
    const len = lashLen * (long ? 1 : 0.55)
    return [
      [x0, y0],
      [x0 + (dx / dl) * len, y0 + (dy / dl) * len],
    ]
  })
}
