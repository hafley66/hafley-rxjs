// @comment-ok: the representation decision this file exists to make, weighed against the two font
// modules it replaces the outline emitter for, and with no runtime home
//
// A variable-width pen stroke as cubic Beziers rather than as a sampled polygon.
//
// `8_khfont.ts` and `8a_khFit.ts` both walk a Catmull-Rom centerline at ~48 samples per em unit,
// offset each sample by the half-width, and emit the two walls as one `M...L...L...Z`. Three costs
// follow from that and all three are visible: the facets show at 240 px/em and slice's arc-length
// cutter inherits every vertex; a per-sample offset folds wherever the half-width exceeds the local
// radius of curvature, and nothing removes the fold, so the wall crosses itself and the fill rule
// punches a hole; a six-point letter becomes ~300 points, so two glyphs have no correspondence and
// there is nothing to interpolate between.
//
// Keeping the control polygon answers all three. A Catmull-Rom span converts to one cubic exactly,
// that cubic offsets to one cubic by Tiller-Hanson, and a stroke comes out at `spans * 2 + 2`
// segments. Tiller, W. and Hanson, E., "Offsetting Rational B-Spline Curves", IEEE CG&A 4(9), 1984:
// offset each leg of the control polygon along its own normal, then intersect consecutive offset
// legs. Exact for a straight leg, and inside a fraction of a percent at the curvatures a letterform
// uses, which is far under the width the nib draws with.
import { f, type Pt } from "./1_geom.js"

export type Cubic = readonly [Pt, Pt, Pt, Pt]

/** Nib width along one stroke, as a multiple of the caller's weight. Three numbers because the
 * swell of a calligraphic stroke sits in the middle and a start-to-end ramp cannot express it. */
export type Width = readonly [number, number, number]

/** What closes an open stroke. `cut` is the chisel the KH face uses on its stems. */
export type Terminal = "cut" | "point" | "round" | "flat"

const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]]
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]]
const scale = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k]
const len = (a: Pt): number => Math.hypot(a[0], a[1])
/** Left normal, which is the wall side under a y-down em box. */
const norm = (a: Pt): Pt => {
  const l = len(a) || 1
  return [-a[1] / l, a[0] / l]
}

/** Catmull-Rom as exact cubics, one per span: the tangent both font modules use is
 * `tension * (p[i+1] - p[i-1])`, and a Hermite segment is `[p1, p1 + m0/3, p2 - m1/3, p2]`. */
export function crCubics(pts: readonly Pt[], closed: boolean, tension: number): Cubic[] {
  const p = pts.slice()
  if (closed && p.length > 1) {
    const first = p[0]
    const last = p[p.length - 1]
    if (first[0] === last[0] && first[1] === last[1]) p.pop()
  }
  const n = p.length
  if (n < 2) return []
  const at = (i: number): Pt => (closed ? p[(i + n) % n] : p[Math.max(0, Math.min(n - 1, i))])
  const out: Cubic[] = []
  const spans = closed ? n : n - 1
  for (let i = 0; i < spans; i++) {
    const p1 = at(i)
    const p2 = at(i + 1)
    const m0 = scale(sub(at(i + 1), at(i - 1)), tension / 3)
    const m1 = scale(sub(at(i + 2), at(i)), tension / 3)
    out.push([p1, add(p1, m0), sub(p2, m1), p2])
  }
  return out
}

const EPS = 1e-9
/** How far past its own leg an offset intersection may land before it is discarded. */
const REACH = 2.5

/** Where two lines meet, or null within `EPS` of parallel. */
function meet(a0: Pt, a1: Pt, b0: Pt, b1: Pt): Pt | null {
  const ax = a1[0] - a0[0]
  const ay = a1[1] - a0[1]
  const bx = b1[0] - b0[0]
  const by = b1[1] - b0[1]
  const den = ax * by - ay * bx
  if (Math.abs(den) < EPS) return null
  const t = ((b0[0] - a0[0]) * by - (b0[1] - a0[1]) * bx) / den
  return [a0[0] + ax * t, a0[1] + ay * t]
}

/** One cubic offset to one cubic, a signed distance per leg so a taper stays one segment. A
 * zero-length leg has no normal; borrowing a neighbour's keeps a pinned corner off the origin. */
export function offsetCubic(c: Cubic, d0: number, d1: number, d2: number): Cubic {
  const legs: [Pt, Pt][] = [
    [c[0], c[1]],
    [c[1], c[2]],
    [c[2], c[3]],
  ]
  const dist = [d0, d1, d2]
  const normals: (Pt | null)[] = legs.map(([a, b]) =>
    len(sub(b, a)) < EPS ? null : norm(sub(b, a)),
  )
  const fallback = normals.find(it => it !== null) ?? ([0, 0] as Pt)
  const moved = legs.map(([a, b], i) => {
    const off = scale(normals[i] ?? fallback, dist[i])
    return [add(a, off), add(b, off)] as [Pt, Pt]
  })
  // A near-parallel pair meets far away without tripping `EPS`, and one such handle throws a spike
  // across the page. Past `REACH` leg lengths the offset leg's own end is the better answer.
  const near = (hit: Pt | null, fallbackPt: Pt, leg: [Pt, Pt]): Pt => {
    if (hit === null) return fallbackPt
    const reach = len(sub(leg[1], leg[0])) * REACH
    return len(sub(hit, fallbackPt)) > reach ? fallbackPt : hit
  }
  const q1 = near(meet(moved[0][0], moved[0][1], moved[1][0], moved[1][1]), moved[0][1], legs[0])
  const q2 = near(meet(moved[1][0], moved[1][1], moved[2][0], moved[2][1]), moved[2][0], legs[2])
  return [moved[0][0], q1, q2, moved[2][1]]
}

/** Unit tangent at each end, reading past a coincident handle. */
function ends(c: Cubic): [Pt, Pt] {
  const head = len(sub(c[1], c[0])) > EPS ? sub(c[1], c[0]) : sub(c[3], c[0])
  const tail = len(sub(c[3], c[2])) > EPS ? sub(c[3], c[2]) : sub(c[3], c[0])
  const hl = len(head) || 1
  const tl = len(tail) || 1
  return [
    [head[0] / hl, head[1] / hl],
    [tail[0] / tl, tail[1] / tl],
  ]
}

export interface NibOpts {
  /** Half-width at the widest point, in control-point units. */
  readonly weight: number
  /** Swell in the middle on top of the width ramp. 0 keeps the ramp exactly. */
  readonly contrast: number
  /** Chisel angle in degrees off the perpendicular. Only `cut` reads it. */
  readonly cutAngle: number
  /** How far past the centerline end a terminal reaches, as a multiple of the half-width there. */
  readonly overshoot: number
}

export const NIB_DEFAULTS: NibOpts = { weight: 0.05, contrast: 0.3, cutAngle: 24, overshoot: 0.9 }

function widthAt(w: Width, o: NibOpts, t: number): number {
  const ramp = t < 0.5 ? w[0] + (w[1] - w[0]) * (t * 2) : w[1] + (w[2] - w[1]) * (t * 2 - 1)
  return o.weight * ramp * (1 + o.contrast * Math.sin(Math.PI * t ** 0.8))
}

const pt = (p: Pt): string => `${f(p[0])} ${f(p[1])}`
const curveTo = (c: Cubic): string => `C${pt(c[1])} ${pt(c[2])} ${pt(c[3])}`

/** One wall in run order. `flip` walks the control polygon backwards, which reverses the tangent
 * and so puts the left normal on the other side: the far wall, traced from the far end. */
function wall(spans: Cubic[], w: Width, o: NibOpts, flip: boolean): Cubic[] {
  const n = spans.length
  const out: Cubic[] = []
  for (let i = 0; i < n; i++) {
    const span = spans[flip ? n - 1 - i : i]
    const c: Cubic = flip ? [span[3], span[2], span[1], span[0]] : span
    const base = flip ? (n - 1 - i) / n : i / n
    const step = 1 / n
    // Three samples per span, not two: the swell is a sine over the whole stroke, and reading it
    // only at span ends steps the width at every control point.
    const at = (u: number): number => {
      const t = flip ? base + step * (1 - u) : base + step * u
      return widthAt(w, o, t)
    }
    out.push(offsetCubic(c, at(1 / 6), at(0.5), at(5 / 6)))
  }
  return out
}

/** A closed outline for one variable-width stroke. Every terminal is built from the centerline
 * tangent and the half-width there, so the two walls meet whatever kind the caller asked for. */
export function nibOutline(
  pts: readonly Pt[],
  closed: boolean,
  tension: number,
  w: Width,
  o: NibOpts,
  term: readonly [Terminal, Terminal] = ["cut", "cut"],
): string {
  const spans = crCubics(pts, closed, tension)
  if (spans.length === 0) return ""
  const left = wall(spans, w, o, false)
  const right = wall(spans, w, o, true)
  // Two rings for a loop. `fill-rule: evenodd` on the element punches the counter, which is the bowl.
  if (closed) {
    return (
      `M${pt(left[0][0])}${left.map(curveTo).join("")}Z` +
      `M${pt(right[0][0])}${right.map(curveTo).join("")}Z`
    )
  }
  const headTangent = ends(spans[0])[0]
  const tailTangent = ends(spans[spans.length - 1])[1]
  const back: Pt = [-headTangent[0], -headTangent[1]]
  const hStart = widthAt(w, o, 0)
  const hEnd = widthAt(w, o, 1)
  const cap = (from: Pt, to: Pt, out: Pt, half: number, kind: Terminal): string => {
    if (kind === "flat") return `L${pt(to)}`
    if (kind === "point") return `L${pt(add(from, scale(out, 0)))}L${pt(to)}`
    if (kind === "round") {
      const reach = half * o.overshoot * 1.3333
      return `C${pt(add(from, scale(out, reach)))} ${pt(add(to, scale(out, reach)))} ${pt(to)}`
    }
    const reach = half * o.overshoot
    const skew = reach * Math.tan((o.cutAngle * Math.PI) / 180)
    const side = norm(out)
    const a = add(add(from, scale(out, reach)), scale(side, skew))
    const b = add(add(to, scale(out, reach)), scale(side, -skew))
    return `L${pt(a)}L${pt(b)}L${pt(to)}`
  }
  return (
    `M${pt(left[0][0])}` +
    left.map(curveTo).join("") +
    cap(left[left.length - 1][3], right[0][0], tailTangent, hEnd, term[1]) +
    right.map(curveTo).join("") +
    cap(right[right.length - 1][3], left[0][0], back, hStart, term[0]) +
    "Z"
  )
}

/** The centerline as the same cubics the walls came from. For a spine overlay, and for slice, which
 * cuts by arc length and reads a curve more kindly than a 300-point polyline. */
export function nibSpine(pts: readonly Pt[], closed: boolean, tension: number): string {
  const spans = crCubics(pts, closed, tension)
  if (spans.length === 0) return ""
  return `M${pt(spans[0][0])}${spans.map(curveTo).join("")}${closed ? "Z" : ""}`
}
