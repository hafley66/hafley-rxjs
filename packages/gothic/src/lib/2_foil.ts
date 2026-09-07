import { M, TAU, arc, type Pt } from "./1_geom.js"

// n lobes on radius R; lobe radius by bisection so neighbours touch, cusps on the union boundary
export type FoilGeom = { d: string; C: Pt[]; rho: number }
export function foilRingGeom(cx: number, cy: number, R: number, n: number, lambda = 1.15): FoilGeom {
  const P: Pt[] = []
  const N: Pt[] = []
  for (let i = 0; i < n; i++) {
    const t = -Math.PI / 2 + (i / n) * TAU
    P.push([cx + R * Math.cos(t), cy + R * Math.sin(t)])
    N.push([-Math.cos(t), -Math.sin(t)])
  }
  const centers = (rho: number): Pt[] => P.map((p, i) => [p[0] + N[i][0] * rho, p[1] + N[i][1] * rho])
  const g = (rho: number) => {
    const C = centers(rho)
    let w = -Infinity
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      w = Math.max(w, Math.hypot(C[j][0] - C[i][0], C[j][1] - C[i][1]) - 2 * rho)
    }
    return w
  }
  let lo = 0
  let hi = R
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2
    if (g(m) > 0) lo = m
    else hi = m
  }
  const rho = Math.min(hi * lambda, R * 0.97)
  const C = centers(rho)
  const cusp = (i: number, j: number): Pt => {
    const [x0, y0] = C[i]
    const [x1, y1] = C[j]
    const d = Math.hypot(x1 - x0, y1 - y0)
    const h = Math.sqrt(Math.max(0, rho * rho - (d / 2) ** 2))
    const mx = (x0 + x1) / 2
    const my = (y0 + y1) / 2
    const ux = (x1 - x0) / d
    const uy = (y1 - y0) / d
    const p1: Pt = [mx - uy * h, my + ux * h]
    const p2: Pt = [mx + uy * h, my - ux * h]
    return Math.hypot(p1[0] - cx, p1[1] - cy) > Math.hypot(p2[0] - cx, p2[1] - cy) ? p1 : p2
  }
  const ang = (c: Pt, p: Pt) => Math.atan2(p[1] - c[1], p[0] - c[0])
  const mod = (x: number) => ((x % TAU) + TAU) % TAU
  const cusps: Pt[] = []
  for (let i = 0; i < n; i++) cusps.push(cusp(i, (i + 1) % n))
  let d = M(cusps[n - 1][0], cusps[n - 1][1])
  for (let i = 0; i < n; i++) {
    const from = cusps[(i + n - 1) % n]
    const to = cusps[i]
    const as = ang(C[i], from)
    const ae = ang(C[i], to)
    let sweep = 1
    let span = mod(ae - as)
    if (mod(ang(C[i], P[i]) - as) > span) {
      sweep = 0
      span = TAU - span
    }
    d += arc(rho, to[0], to[1], sweep, span > Math.PI ? 1 : 0)
  }
  return { d: `${d}Z`, C, rho }
}
export const foilRing = (cx: number, cy: number, R: number, n: number, lambda = 1.15): string =>
  foilRingGeom(cx, cy, R, n, lambda).d
