import { M, TAU, arc, circle, f, line } from "./1_geom.js"
import { foilRing } from "./2_foil.js"
import { scene, sceneMarkup } from "./3_seal.js"

export type EyeOpts = { iris?: number; lobes?: number; double?: boolean; lash?: number; lashLen?: number }
/* ============ 1. gothic eye: vesica lids, exact fits ============
   lid arc: chord W, sagitta H/2 -> r = (W^2/4 + H^2/4) / H. iris radius <= H/2 (tangent to both lids at the axis). */
export function eye(W: number, H: number, o: EyeOpts = {}, minPx = 2) {
  const sc = scene(minPx)
  const r = ((W * W) / 4 + (H * H) / 4) / H
  const iris = Math.min(H / 2, W * (o.iris ?? 0.24))
  const lobes = o.lobes ?? 5
  sc.path(M(-W / 2, 0) + arc(r, W / 2, 0, 1) + arc(r, -W / 2, 0, 1))
  if (o.double && H * 0.12 >= minPx) {
    const r2 = ((W * 0.86) ** 2 / 4 + (H * 0.72) ** 2 / 4) / (H * 0.72)
    sc.path(M(-W * 0.43, 0) + arc(r2, W * 0.43, 0, 1) + arc(r2, -W * 0.43, 0, 1))
  }
  if ((TAU * iris) / lobes >= minPx * 1.5) sc.path(foilRing(0, 0, iris, lobes))
  else sc.path(circle(0, 0, iris))
  if (iris * 0.45 >= 0.6) sc.path(circle(0, 0, iris * 0.45), "dark")
  // lashes: ticks along the upper lid, normal to the arc, count fits the arc length
  const cy = r - H / 2
  const k = Math.max(0, Math.round(W / (o.lash ?? 6)))
  if (k && o.lash !== 0 && W / k >= minPx * 1.5) {
    const a0 = Math.asin(W / 2 / r)
    for (let i = 1; i < k; i++) {
      const a = -Math.PI / 2 - a0 + (2 * a0 * i) / k
      const len = H * (o.lashLen ?? 0.3) * (1 - 0.6 * Math.abs((2 * i) / k - 1))
      sc.path(line(r * Math.cos(a), cy + r * Math.sin(a), (r + len) * Math.cos(a), cy + (r + len) * Math.sin(a)))
    }
  }
  const pad = H * (o.lashLen ?? 0.3) + 1
  return {
    sc,
    svg: `<svg viewBox="${f(-W / 2 - 1)} ${f(-H / 2 - pad)} ${f(W + 2)} ${f(H + 2 * pad)}" width="${W + 2}" height="${f(H + 2 * pad)}">${sceneMarkup(sc)}</svg>`,
  }
}
