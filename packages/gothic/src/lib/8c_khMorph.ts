// @comment-ok: the correspondence decision, which is what an animate-to-target study needs and
// what the glyph tables cannot supply, weighed against them and with no runtime home
//
// Two letters interpolate when they are two vectors of the same length. A glyph table is not:
// `KH_GLYPHS.K` holds 3 strokes of 2 to 3 points, `KH_GLYPHS.O` holds 1 loop of 13, and `KH_FIT.G`
// holds 12 chains of whatever the medial axis left. Nothing pairs with anything, which is why the
// animate-to-target study had nothing to animate.
//
// Normalizing costs one resample. Every stroke becomes `POINTS` control points spaced by arc
// length along the curve its own control polygon describes, and every glyph becomes `STROKES` of
// them, ordered longest first so the stem of one letter pairs with the stem of the next. A glyph
// with fewer strokes pads with a degenerate one at its own centre, so the extra stroke of the
// richer letter grows out of the middle rather than sliding in from the origin.
//
// Resampled points are control points again, not samples: a Catmull-Rom through 10 arc-length
// samples of a curve is that curve to within a fraction of the nib width, and keeping them as
// control points is what lets the nib, the tension and the terminals stay live knobs after the
// morph rather than being baked into an outline.
import { type Pt } from "./1_geom.js"
import { crCubics, type Cubic, type Width } from "./8b_nib.js"

export interface MorphStroke {
  readonly pts: readonly Pt[]
  readonly w: Width
  readonly loop: boolean
}

export interface MorphGlyph {
  readonly adv: number
  readonly s: readonly MorphStroke[]
}

/** Control points per stroke after normalizing. 10 holds a bowl to under a nib width. */
export const POINTS = 10
/** Strokes per glyph. The richest letter in either table that is worth pairing. */
export const STROKES = 6

const cubicAt = (c: Cubic, t: number): Pt => {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const d = 3 * u * t * t
  const e = t * t * t
  return [
    a * c[0][0] + b * c[1][0] + d * c[2][0] + e * c[3][0],
    a * c[0][1] + b * c[1][1] + d * c[2][1] + e * c[3][1],
  ]
}

const STEPS = 24

/** Cumulative chord length down a span chain, at `STEPS` samples per span. */
function walk(spans: readonly Cubic[]): { pts: Pt[]; at: number[] } {
  const pts: Pt[] = []
  const at: number[] = []
  let run = 0
  for (let i = 0; i < spans.length; i++) {
    for (let j = 0; j <= STEPS; j++) {
      if (i > 0 && j === 0) continue
      const p = cubicAt(spans[i], j / STEPS)
      if (pts.length > 0) {
        const last = pts[pts.length - 1]
        run += Math.hypot(p[0] - last[0], p[1] - last[1])
      }
      pts.push(p)
      at.push(run)
    }
  }
  return { pts, at }
}

/** `n` points spaced by arc length, both ends included. */
export function resample(spans: readonly Cubic[], n: number): Pt[] {
  const { pts, at } = walk(spans)
  if (pts.length === 0) return []
  const total = at[at.length - 1]
  if (!(total > 0)) return Array.from({ length: n }, () => pts[0])
  const out: Pt[] = []
  let cursor = 0
  for (let i = 0; i < n; i++) {
    const want = (total * i) / (n - 1)
    while (cursor < at.length - 2 && at[cursor + 1] < want) cursor += 1
    const span = at[cursor + 1] - at[cursor] || 1
    const t = (want - at[cursor]) / span
    const a = pts[cursor]
    const b = pts[cursor + 1] ?? a
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
  }
  return out
}

const lengthOf = (pts: readonly Pt[]): number => {
  let run = 0
  for (let i = 1; i < pts.length; i++) run += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  return run
}

const centre = (strokes: readonly { pts: readonly Pt[] }[]): Pt => {
  let x = 0
  let y = 0
  let n = 0
  for (const s of strokes) for (const p of s.pts) { x += p[0]; y += p[1]; n += 1 }
  return n === 0 ? [0, 0] : [x / n, y / n]
}

export interface RawStroke {
  readonly pts: readonly Pt[]
  readonly w?: readonly [number, number]
  readonly loop?: boolean
}

/** A glyph table entry as a fixed-shape vector: `STROKES` strokes of `POINTS` points, longest
 * first, padded at the glyph's own centre. */
export function toMorph(
  strokes: readonly RawStroke[],
  adv: number,
  tension: number,
  count = STROKES,
  points = POINTS,
): MorphGlyph {
  const built = strokes.map(s => {
    const pts = resample(crCubics(s.pts, s.loop === true, tension), points)
    const w0 = s.w?.[0] ?? 1
    const w1 = s.w?.[1] ?? 1
    return { pts, w: [w0, (w0 + w1) / 2, w1] as Width, loop: s.loop === true, run: lengthOf(pts) }
  })
  built.sort((a, b) => b.run - a.run)
  const kept = built.slice(0, count)
  const mid = centre(kept.length > 0 ? kept : built)
  while (kept.length < count) {
    kept.push({ pts: Array.from({ length: points }, () => mid), w: [0, 0, 0], loop: false, run: 0 })
  }
  return { adv, s: kept.map(({ pts, w, loop }) => ({ pts, w, loop })) }
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/** Two normalized glyphs at `t`. `loop` is topology, so it swaps at the midpoint rather than
 * interpolating; a padded stroke carries zero width and grows out of the glyph's own centre. */
export function mixGlyph(a: MorphGlyph, b: MorphGlyph, t: number): MorphGlyph {
  const n = Math.min(a.s.length, b.s.length)
  const s: MorphStroke[] = []
  for (let i = 0; i < n; i++) {
    const x = a.s[i]
    const y = b.s[i]
    const m = Math.min(x.pts.length, y.pts.length)
    const pts: Pt[] = []
    for (let j = 0; j < m; j++) {
      pts.push([lerp(x.pts[j][0], y.pts[j][0], t), lerp(x.pts[j][1], y.pts[j][1], t)])
    }
    s.push({
      pts,
      w: [lerp(x.w[0], y.w[0], t), lerp(x.w[1], y.w[1], t), lerp(x.w[2], y.w[2], t)],
      loop: t < 0.5 ? x.loop : y.loop,
    })
  }
  return { adv: lerp(a.adv, b.adv, t), s }
}

/** Where a stroke's first control point starts and where it ends, so a caller can draw the flight
 * a point takes across a morph without evaluating the whole glyph. */
export function trails(a: MorphGlyph, b: MorphGlyph): [Pt, Pt][] {
  const out: [Pt, Pt][] = []
  const n = Math.min(a.s.length, b.s.length)
  for (let i = 0; i < n; i++) {
    const m = Math.min(a.s[i].pts.length, b.s[i].pts.length)
    for (let j = 0; j < m; j++) out.push([a.s[i].pts[j], b.s[i].pts[j]])
  }
  return out
}
