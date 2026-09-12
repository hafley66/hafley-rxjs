import { type AnySpec, type ValuesOf } from "@hafley66/report-shell"
import type { Algo, AlgoCtx, AlgoOut } from "../kit/2_algo.js"
import { KH_DEFAULTS, KH_GLYPHS, khGlyph, type KhOpts } from "../lib/8_khfont.js"

// the curve knobs shared by every kh section (anatomy algo and the word section)
export const KH_CURVE_INPUTS = {
  weight: { kind: "range", hint: "stroke thickness in em fractions", min: 0.04, max: 0.3, step: 0.005, default: 0.13, group: "glyph", roll: [0.07, 0.22] },
  contrast: { kind: "range", hint: "mid-stroke swell: the calligraphic thick-thin modulation along each spine", min: 0, max: 1, step: 0.01, default: 0.35, group: "glyph" },
  cut: { kind: "range", hint: "chisel terminal length in em; 0 gives butt ends", min: 0, max: 0.4, step: 0.005, default: 0.1, group: "glyph" },
  cutAngle: { kind: "range", hint: "terminal skew in degrees, the angled pen cut", min: -60, max: 60, default: 24, group: "glyph" },
  tension: { kind: "range", hint: "spline tension: 0 flattens toward the control polygon, 1.4 swings wide", min: 0, max: 1.4, step: 0.05, default: 0.9, group: "curve" },
  jitter: { kind: "range", hint: "control-point wobble in em, seeded", min: 0, max: 0.06, step: 0.002, default: 0, group: "curve" },
  seed: { kind: "seed", hint: "seeds the control-point wobble", default: 1 },
} as const satisfies AnySpec
export type CurveInputs = ValuesOf<typeof KH_CURVE_INPUTS>

export const SPEC = {
  letter: { kind: "select", hint: "glyph drawn in the cell; corners are split strokes so their cut ends notch together", options: Object.keys(KH_GLYPHS), default: "K", group: "glyph" },
  ...KH_CURVE_INPUTS,
  spines: { kind: "bool", hint: "draw the sampled centerline inside each outline as a depth layer", default: true, label: "spines" },
  minPx: { kind: "range", hint: "outline thinner than this many px drops from the cell (LOD)", min: 1, max: 6, step: 0.5, default: 2 },
} as const satisfies AnySpec
export type Params = ValuesOf<typeof SPEC>

export const khOpts = (p: CurveInputs): KhOpts => ({
  ...KH_DEFAULTS,
  weight: p.weight, contrast: p.contrast, cut: p.cut, cutAngle: p.cutAngle,
  tension: p.tension, jitter: p.jitter, seed: p.seed, tracking: KH_DEFAULTS.tracking,
})

export function generate(p: Params, ctx: AlgoCtx): AlgoOut {
  const base = KH_GLYPHS[p.letter]
  if (!base) return { paths: [], caption: `no glyph for ${p.letter}`, lod: [] }
  const k = ctx.size * 0.72
  const g = khGlyph(p.letter, khOpts(p), [(-base.adv * k) / 2, -k / 2], k)
  if (!g) return { paths: [], caption: `no glyph for ${p.letter}`, lod: [] }
  const px = (t: number) => p.weight * k * (1 + p.contrast / 2) * t
  const thin = g.strokes.filter(s => px((s.w0 + s.w1) / 2) < p.minPx)
  const kept = thin.length === g.strokes.length ? [] : thin
  const keep = g.strokes.filter(s => !kept.includes(s))
  const paths = [
    ...keep.map(s => ({ d: s.d, z: 0.2 })),
    ...(p.spines ? keep.map(s => ({ d: s.spine, z: 0.85 })) : []),
  ]
  return {
    paths,
    caption: `${p.letter} · ${keep.length} strokes · w ${p.weight}`,
    lod: kept.length ? [`${kept.length} strokes < ${p.minPx}px`] : [],
  }
}

export const ALGO: Algo<Params> = {
  name: "kh",
  spec: SPEC,
  presets: {
    "hairline · sharp": { weight: 0.07, contrast: 0.15, cut: 0.16, cutAngle: 38, tension: 1.1 },
    "logo · chisel": { weight: 0.13, contrast: 0.35, cut: 0.1, cutAngle: 24, tension: 0.9 },
    "brush · soft": { weight: 0.2, contrast: 0.6, cut: 0.04, cutAngle: 10, tension: 0.6 },
    "wobble · sketched": { weight: 0.1, contrast: 0.25, cut: 0.12, cutAngle: -30, tension: 1.25, jitter: 0.04, seed: 5 },
  },
  run: generate,
}
