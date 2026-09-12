// @comment-ok: what the source face is made of, read off the TTF, and why it is a generated layer
// rather than glyph data; no runtime home
//
// Rendering Kingdom_Hearts_Font.ttf at 160 px/em shows a face that is not the geometric sans
// `KH_GLYPHS` draws. It carries heavy stroke contrast, a hook on nearly every terminal, barbs off
// the stems, flag serifs at the tops, and negative side bearings so the letters interlock: `A` is
// 362 units wide on a 290 advance.
//
// That is also why the medial-axis fit in `8a_khFit.ts` came out as spaghetti. A skeleton of the
// raster turns every barb and flag into its own chain, so `A` fitted to 8 strokes, `E` to 10 and
// `G` to 12, several of them doubling back. 0.705 IoU by bulk overlap, a scribble to look at.
//
// An ornament is a short pen stroke hung off a host stroke's end, generated from the host's own
// tangent and half-width. Three consequences: one amount knob sweeps the whole face from plain to
// ornate, every ornament goes through `nibOutline` like any other stroke, and ornaments carry the
// fixed shape `8c_khMorph.ts` needs, so a letter keeps its decoration across a morph instead of
// having it baked into an outline.
import { type Pt } from "./1_geom.js"
import { crCubics, type Width } from "./8b_nib.js"

export type OrnamentKind = "none" | "curl" | "flag" | "barb" | "wedge"

export interface Ornament {
  readonly kind: OrnamentKind
  /** Length as a multiple of the host's half-width at the end it hangs off. */
  readonly size: number
  /** Turn off the host tangent in degrees. Positive swings toward the left normal. */
  readonly angle: number
  /** How far the run bends back on itself. 0 is straight, 1 is a quarter turn. */
  readonly curl: number
  /** Width at the far tip, relative to the host's width there. 0 tapers to nothing. */
  readonly taper: number
}

export const NO_ORNAMENT: Ornament = { kind: "none", size: 0, angle: 0, curl: 0, taper: 0 }

/** Read off the raster, then swept on one letter: `curl` past 1.2 tucks the foot back under the
 * stem, under 0.8 it opens into a swash, and past 2.2 it closes into a loop. */
export const ORNAMENTS: Readonly<Record<Exclude<OrnamentKind, "none">, Ornament>> = {
  curl: { kind: "curl", size: 5, angle: 34, curl: 1.35, taper: 0.06 },
  flag: { kind: "flag", size: 4, angle: 128, curl: 0.9, taper: 0.2 },
  barb: { kind: "barb", size: 2.6, angle: 78, curl: 0.5, taper: 0 },
  wedge: { kind: "wedge", size: 2.2, angle: 16, curl: 0, taper: 0 },
}

const rotate = (v: Pt, rad: number): Pt => {
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]
}

/** Points along the ornament's run. 5 is enough for a quarter turn and keeps the morph vector
 * short; the nib turns them into cubics the same way it does any stroke. */
export const ORN_POINTS = 5

/** One ornament's control points, hung off `at` with the host's `tangent` and `half` width. */
export function ornamentPts(at: Pt, tangent: Pt, half: number, o: Ornament, amount: number): Pt[] {
  const reach = o.size * half * amount
  if (o.kind === "none" || reach <= 0) return []
  const turn = (o.curl * Math.PI) / 2
  const start = rotate(tangent, (o.angle * Math.PI) / 180)
  const out: Pt[] = [at]
  // Constant-curvature run: each step turns by the same angle, so `curl` reads as a fraction of a
  // quarter turn whatever the length is.
  let dir = start
  let cursor = at
  const step = reach / (ORN_POINTS - 1)
  for (let i = 1; i < ORN_POINTS; i++) {
    dir = rotate(dir, turn / (ORN_POINTS - 1))
    cursor = [cursor[0] + dir[0] * step, cursor[1] + dir[1] * step]
    out.push(cursor)
  }
  return out
}

/** Where an ornament hangs and what kind it is. `end` picks which terminal of the host stroke. */
export interface Hook {
  /** Index into the glyph's stroke list. */
  readonly stroke: number
  readonly end: "head" | "tail"
  readonly kind: Exclude<OrnamentKind, "none">
  /** Flips the turn, so a mirrored pair of stems hooks outward on both sides. */
  readonly mirror?: boolean
}

export interface OrnStroke {
  readonly pts: readonly Pt[]
  readonly w: Width
  readonly loop: false
}

export interface HostStroke {
  readonly pts: readonly Pt[]
  readonly w?: readonly [number, number]
  readonly loop?: boolean
}

const unit = (v: Pt): Pt => {
  const l = Math.hypot(v[0], v[1]) || 1
  return [v[0] / l, v[1] / l]
}

/** Every hook a glyph declares, as strokes ready for `nibOutline`. */
export function ornamentStrokes(
  strokes: readonly HostStroke[],
  hooks: readonly Hook[],
  tension: number,
  amount: number,
  half = 1,
): OrnStroke[] {
  const out: OrnStroke[] = []
  for (const hook of hooks) {
    const host = strokes[hook.stroke]
    if (host === undefined || host.loop === true) continue
    const spans = crCubics(host.pts, false, tension)
    if (spans.length === 0) continue
    const head = hook.end === "head"
    const span = head ? spans[0] : spans[spans.length - 1]
    const at = head ? span[0] : span[3]
    const raw: Pt = head ? [span[0][0] - span[1][0], span[0][1] - span[1][1]] : [span[3][0] - span[2][0], span[3][1] - span[2][1]]
    const w0 = host.w?.[0] ?? 1
    const w1 = host.w?.[1] ?? 1
    const hostW = head ? w0 : w1
    const spec = ORNAMENTS[hook.kind]
    const turned: Ornament = hook.mirror === true ? { ...spec, angle: -spec.angle, curl: -spec.curl } : spec
    const pts = ornamentPts(at, unit(raw), hostW * half, turned, amount)
    if (pts.length < 2) continue
    out.push({ pts, w: [hostW * 0.95, hostW * 0.45, hostW * turned.taper], loop: false })
  }
  return out
}

/** Which terminal of which stroke wears what, per letter of `KH_GLYPHS`. Stem feet hook, stem
 * heads fly a flag, and a diagonal takes a barb where the raster shows one. */
export const KH_HOOKS: Readonly<Record<string, readonly Hook[]>> = {
  A: [{ stroke: 0, end: "tail", kind: "curl" }, { stroke: 1, end: "tail", kind: "curl", mirror: true }],
  B: [{ stroke: 0, end: "head", kind: "flag" }, { stroke: 0, end: "tail", kind: "curl" }],
  C: [{ stroke: 0, end: "head", kind: "curl", mirror: true }, { stroke: 0, end: "tail", kind: "curl" }],
  D: [{ stroke: 0, end: "head", kind: "flag" }, { stroke: 0, end: "tail", kind: "curl" }],
  E: [{ stroke: 0, end: "tail", kind: "curl" }, { stroke: 1, end: "tail", kind: "barb" }, { stroke: 3, end: "tail", kind: "wedge" }],
  F: [{ stroke: 0, end: "tail", kind: "curl" }, { stroke: 1, end: "tail", kind: "barb" }],
  G: [{ stroke: 0, end: "head", kind: "curl", mirror: true }, { stroke: 1, end: "tail", kind: "wedge" }],
  H: [{ stroke: 0, end: "tail", kind: "curl" }, { stroke: 1, end: "tail", kind: "curl", mirror: true }, { stroke: 0, end: "head", kind: "flag" }],
  I: [{ stroke: 0, end: "head", kind: "flag" }, { stroke: 0, end: "tail", kind: "curl" }],
  J: [{ stroke: 0, end: "tail", kind: "curl" }],
  K: [{ stroke: 0, end: "tail", kind: "curl" }, { stroke: 1, end: "head", kind: "barb" }, { stroke: 2, end: "tail", kind: "curl", mirror: true }],
  L: [{ stroke: 0, end: "head", kind: "flag" }],
  M: [{ stroke: 0, end: "head", kind: "curl" }, { stroke: 1, end: "tail", kind: "curl", mirror: true }],
  N: [{ stroke: 0, end: "head", kind: "curl" }, { stroke: 2, end: "head", kind: "curl", mirror: true }],
  O: [],
  P: [{ stroke: 0, end: "head", kind: "flag" }, { stroke: 0, end: "tail", kind: "curl" }],
  Q: [{ stroke: 1, end: "tail", kind: "curl" }],
  R: [{ stroke: 0, end: "head", kind: "flag" }, { stroke: 2, end: "tail", kind: "curl", mirror: true }],
  S: [{ stroke: 0, end: "head", kind: "curl", mirror: true }, { stroke: 0, end: "tail", kind: "curl" }],
  T: [{ stroke: 0, end: "head", kind: "wedge" }, { stroke: 1, end: "tail", kind: "curl" }],
  U: [{ stroke: 0, end: "head", kind: "flag" }],
  V: [{ stroke: 0, end: "head", kind: "flag" }, { stroke: 1, end: "tail", kind: "curl", mirror: true }],
  W: [{ stroke: 0, end: "head", kind: "flag" }, { stroke: 1, end: "tail", kind: "curl", mirror: true }],
  X: [{ stroke: 0, end: "head", kind: "barb" }, { stroke: 1, end: "tail", kind: "curl" }],
  Y: [{ stroke: 0, end: "head", kind: "flag" }, { stroke: 2, end: "tail", kind: "curl" }],
  Z: [{ stroke: 0, end: "head", kind: "wedge" }],
}
