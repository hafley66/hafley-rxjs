// Kingdom-Hearts-style letterforms: every letter is a set of curved strokes whose
// outline is built from a sampled centerline with a width profile and chisel-cut
// terminals. Pure geometry; the slice kit animates the resulting path strings.
import { hash, mulberry32 } from "./0_rng.js"
import { mix, type Pt, pl, poly } from "./1_geom.js"

export type KhStroke = { pts: readonly Pt[]; w?: readonly [number, number]; loop?: boolean }
export type KhGlyph = { adv: number; s: readonly KhStroke[] }
export type KhOpts = {
  weight: number
  contrast: number
  cut: number
  cutAngle: number
  tension: number
  tracking: number
  jitter: number
  seed: number
}
export const KH_DEFAULTS: KhOpts = { weight: 0.13, contrast: 0.35, cut: 0.1, cutAngle: 24, tension: 0.9, tracking: 0.06, jitter: 0, seed: 1 }

const st = (pts: Pt[], w?: [number, number]): KhStroke => ({ pts, w })
const lp = (pts: Pt[], w?: [number, number]): KhStroke => ({ pts, w, loop: true })
const G = (s: KhStroke[]): KhGlyph => ({ adv: 0, s })

// em box: x 0..adv, y 0 (top) .. 1 (baseline). Corners are split strokes so the
// Catmull-Rom chain never rounds them; their overlapping cut ends make the notches.
export const KH_GLYPHS: Record<string, KhGlyph> = {
  A: G([st([[0.5, 0.02], [0.08, 1]], [0.8, 1]), st([[0.5, 0.02], [0.92, 1]], [0.8, 1]), st([[0.17, 0.68], [0.83, 0.68]], [0.7, 0.7])]),
  B: G([st([[0.16, 0.02], [0.16, 1]]), st([[0.16, 0.02], [0.44, 0], [0.62, 0.08], [0.64, 0.3], [0.5, 0.46], [0.16, 0.5]], [0.6, 1]), st([[0.16, 0.5], [0.5, 0.53], [0.7, 0.62], [0.7, 0.84], [0.52, 0.97], [0.16, 1]], [0.55, 1])]),
  C: G([st([[0.84, 0.16], [0.6, 0], [0.26, 0.04], [0.08, 0.3], [0.06, 0.55], [0.14, 0.8], [0.34, 0.97], [0.62, 1], [0.84, 0.84]], [0.8, 0.8])]),
  D: G([st([[0.16, 0.02], [0.16, 1]]), st([[0.16, 0.02], [0.5, 0.04], [0.74, 0.24], [0.78, 0.52], [0.68, 0.8], [0.44, 0.97], [0.16, 1]], [0.7, 1])]),
  E: G([st([[0.16, 0.02], [0.16, 1]]), st([[0.16, 0.02], [0.8, 0.02]]), st([[0.16, 0.5], [0.66, 0.5]]), st([[0.16, 1], [0.82, 1]])]),
  F: G([st([[0.16, 0.02], [0.16, 1]]), st([[0.16, 0.02], [0.8, 0.02]]), st([[0.16, 0.5], [0.64, 0.5]])]),
  G: G([st([[0.86, 0.14], [0.62, 0], [0.26, 0.04], [0.08, 0.3], [0.07, 0.58], [0.18, 0.84], [0.44, 0.98], [0.72, 0.94], [0.87, 0.74]], [0.8, 0.9]), st([[0.87, 0.72], [0.52, 0.72]])]),
  H: G([st([[0.14, 0.02], [0.14, 1]]), st([[0.86, 0.02], [0.86, 1]]), st([[0.14, 0.5], [0.86, 0.5]])]),
  I: G([st([[0.13, 0.02], [0.13, 1]])]),
  J: G([st([[0.4, 0.02], [0.42, 0.64], [0.34, 0.9], [0.14, 0.97], [0.03, 0.76]], [1, 0.8])]),
  K: G([st([[0.14, 0.02], [0.14, 1]]), st([[0.8, 0.02], [0.18, 0.52]]), st([[0.4, 0.44], [0.62, 0.66], [0.84, 1]], [0.9, 0.75])]),
  L: G([st([[0.14, 0.02], [0.14, 1], [0.78, 1]])]),
  M: G([st([[0.08, 1], [0.08, 0.02], [0.5, 0.62]]), st([[0.5, 0.62], [0.92, 0.02], [0.92, 1]])]),
  N: G([st([[0.12, 1], [0.12, 0.02]]), st([[0.12, 0.02], [0.88, 1]]), st([[0.88, 1], [0.88, 0.02]])]),
  O: G([lp([[0.5, 0.02], [0.2, 0.05], [0.05, 0.28], [0.05, 0.5], [0.05, 0.72], [0.2, 0.95], [0.5, 0.98], [0.8, 0.95], [0.95, 0.72], [0.95, 0.5], [0.95, 0.28], [0.8, 0.05], [0.5, 0.02]])]),
  P: G([st([[0.16, 0.02], [0.16, 1]]), st([[0.16, 0.02], [0.44, 0], [0.64, 0.1], [0.64, 0.32], [0.5, 0.46], [0.16, 0.5]], [0.6, 1])]),
  Q: G([lp([[0.5, 0.02], [0.2, 0.05], [0.05, 0.28], [0.05, 0.5], [0.05, 0.72], [0.2, 0.95], [0.5, 0.98], [0.8, 0.95], [0.95, 0.72], [0.95, 0.5], [0.95, 0.28], [0.8, 0.05], [0.5, 0.02]]), st([[0.58, 0.7], [0.88, 1.02]])]),
  R: G([st([[0.16, 0.02], [0.16, 1]]), st([[0.16, 0.02], [0.44, 0], [0.63, 0.1], [0.63, 0.34], [0.48, 0.47], [0.16, 0.5]], [0.6, 1]), st([[0.44, 0.46], [0.64, 0.66], [0.76, 1]], [0.95, 0.75])]),
  S: G([st([[0.8, 0.16], [0.58, 0], [0.26, 0.06], [0.18, 0.28], [0.32, 0.5], [0.62, 0.58], [0.8, 0.72], [0.76, 0.93], [0.48, 1], [0.2, 0.87]], [0.7, 0.7])]),
  T: G([st([[0.06, 0.02], [0.92, 0.02]]), st([[0.49, 0.04], [0.49, 1]], [1.15, 0.9])]),
  U: G([st([[0.08, 0.02], [0.08, 0.56], [0.2, 0.9], [0.5, 0.98], [0.8, 0.9], [0.92, 0.56], [0.92, 0.02]])]),
  V: G([st([[0.06, 0.02], [0.5, 1]], [1, 0.85]), st([[0.5, 1], [0.94, 0.02]], [0.85, 1])]),
  W: G([st([[0.04, 0.02], [0.26, 1], [0.5, 0.3]]), st([[0.5, 0.3], [0.74, 1], [0.96, 0.02]])]),
  X: G([st([[0.1, 0.02], [0.9, 1]]), st([[0.9, 0.02], [0.1, 1]])]),
  Y: G([st([[0.08, 0.02], [0.5, 0.52]]), st([[0.92, 0.02], [0.5, 0.52]]), st([[0.5, 0.5], [0.5, 1]])]),
  Z: G([st([[0.08, 0.02], [0.88, 0.02], [0.08, 1], [0.9, 1]])]),
}

// advance = right extent of the strokes plus a bearing; left bearings live in the points
for (const g of Object.values(KH_GLYPHS)) {
  g.adv = Math.max(...g.s.flatMap(s => s.pts.map(p => p[0]))) + 0.08
}

// Catmull-Rom through the control points, tension-scaled tangents, seeded wobble.
function spline(pts: readonly Pt[], closed: boolean, tension: number, jitter: number, rng: () => number): Pt[] {
  const P = pts.map(([x, y]) => [x + (rng() - 0.5) * jitter, y + (rng() - 0.5) * jitter] as Pt)
  if (closed && P.length > 1 && P[0][0] === P[P.length - 1][0] && P[0][1] === P[P.length - 1][1]) P.pop()
  const n = P.length
  if (n < 2) return P
  const at = (i: number): Pt => (closed ? P[(i + n) % n] : P[Math.max(0, Math.min(n - 1, i))])
  const out: Pt[] = []
  const segs = closed ? n : n - 1
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2)
    const steps = Math.max(6, Math.round(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 48))
    const m0x = tension * (p2[0] - p0[0]), m0y = tension * (p2[1] - p0[1])
    const m1x = tension * (p3[0] - p1[0]), m1y = tension * (p3[1] - p1[1])
    for (let j = 0; j < steps; j++) {
      const t = j / steps, t2 = t * t, t3 = t2 * t
      const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2
      out.push([h00 * p1[0] + h10 * m0x + h01 * p2[0] + h11 * m1x, h00 * p1[1] + h10 * m0y + h01 * p2[1] + h11 * m1y])
    }
  }
  out.push(closed ? out[0].slice() as Pt : at(n - 1))
  return out
}

// closed outline = both offset walls; open outline adds a chisel tip at each end
function outline(cent: readonly Pt[], closed: boolean, w0: number, w1: number, o: KhOpts, origin: Pt, k: number): string {
  const n = cent.length
  const tan = (i: number): Pt => {
    const a = cent[closed ? (i - 1 + n) % n : Math.max(0, i - 1)]
    const b = cent[closed ? (i + 1) % n : Math.min(n - 1, i + 1)]
    const x = b[0] - a[0], y = b[1] - a[1], l = Math.hypot(x, y) || 1
    return [x / l, y / l]
  }
  const hw = (t: number) => o.weight * k * 0.5 * mix(w0, w1, t) * (1 + o.contrast * Math.sin(Math.PI * t ** 0.8))
  const wall: Pt[] = [], side: Pt[] = []
  for (let i = 0; i < n; i++) {
    const T = tan(i), h = hw(i / (n - 1))
    wall.push([origin[0] + cent[i][0] * k - T[1] * h, origin[1] + cent[i][1] * k + T[0] * h])
    side.push([origin[0] + cent[i][0] * k + T[1] * h, origin[1] + cent[i][1] * k - T[0] * h])
  }
  if (closed) return poly([...wall, ...side.slice().reverse()])
  const cutPx = o.cut * k, skew = cutPx * Math.tan((o.cutAngle * Math.PI) / 180)
  const tipE = tan(n - 1), tipS = tan(0)
  const end = cent[n - 1], beg = cent[0]
  const tipEnd: Pt = [origin[0] + end[0] * k + tipE[0] * cutPx - tipE[1] * skew, origin[1] + end[1] * k + tipE[1] * cutPx + tipE[0] * skew]
  const tipStart: Pt = [origin[0] + beg[0] * k - tipS[0] * cutPx + tipS[1] * skew, origin[1] + beg[1] * k - tipS[1] * cutPx - tipS[0] * skew]
  return poly([...wall, tipEnd, ...side.slice().reverse(), tipStart])
}

export type KhStrokeOut = { d: string; spine: string; w0: number; w1: number }

export function khGlyph(ch: string, o: KhOpts, origin: Pt = [0, 0], k = 1): { adv: number; strokes: KhStrokeOut[] } | null {
  const g = KH_GLYPHS[ch.toUpperCase()]
  if (!g) return null
  const rng = mulberry32((o.seed ^ Math.imul(hash(ch.toUpperCase()), 2654435761)) >>> 0)
  const strokes: KhStrokeOut[] = []
  for (const s of g.s) {
    const cent = spline(s.pts, !!s.loop, o.tension, o.jitter, rng)
    const at = (p: Pt): Pt => [origin[0] + p[0] * k, origin[1] + p[1] * k]
    strokes.push({
      d: outline(cent, !!s.loop, s.w?.[0] ?? 1, s.w?.[1] ?? 1, o, origin, k),
      spine: pl(cent.map(at)),
      w0: s.w?.[0] ?? 1,
      w1: s.w?.[1] ?? 1,
    })
  }
  return { adv: g.adv, strokes }
}

export type KhTextOut = { d: string[]; spine: string[]; width: number; glyphs: number }

export function khText(text: string, o: KhOpts, k = 1): KhTextOut {
  const out: KhTextOut = { d: [], spine: [], width: 0, glyphs: 0 }
  let x = 0
  for (const raw of text.trim().toUpperCase()) {
    const ch = raw
    if (raw === " ") {
      x += 0.3 * k
      continue
    }
    const g = khGlyph(ch, o, [x, 0], k)
    if (!g) continue
    for (const s of g.strokes) {
      out.d.push(s.d)
      out.spine.push(s.spine)
    }
    x += (g.adv + o.tracking) * k
    out.glyphs++
  }
  out.width = Math.max(0, x - o.tracking * k)
  return out
}
