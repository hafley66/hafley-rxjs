import { type AnySpec, useDrawIn, type ValuesOf } from "@hafley66/report-shell"
import { useRef } from "react"
import { KH_CURVE_INPUTS, khOpts, ALGO as source_kh } from "../algos/19_kh.js"
import type { PageSpec } from "../app/0_pages.js"
import { SLICE_SPEC } from "../kit/slice/0_spec.js"
import { f } from "../lib/1_geom.js"
import { KH_DEFAULTS, KH_GLYPHS, type KhOpts, khGlyph, khText } from "../lib/8_khfont.js"
import { FIT_DEFAULTS, type FitOpts, fitGlyph, fitText } from "../lib/8a_khFit.js"
import { NIB_DEFAULTS, type Terminal, type Width, nibOutline, nibSpine } from "../lib/8b_nib.js"
import { type MorphGlyph, mixGlyph, toMorph, trails } from "../lib/8c_khMorph.js"
import { KH_HOOKS, ornamentStrokes } from "../lib/8d_khOrnament.js"
import { Section } from "../ui/2_Section.js"
import { SliceTiming } from "../ui/3a_SliceTiming.js"
import { AlgoSection } from "../ui/4_Algo.js"

const SIZES = [64, 96, 160, 240]
const WORD_POOL = ["KINGDOM HEARTS", "SORA", "RIKU", "KAIRI", "KEYBLADE", "GUMMI SHIP", "XEHANORT", "DARKNESS", "LIGHT"]
const section_kh = { ...source_kh, name: "kh" }
// scaffold:bindings

const FIT_SPEC = {
  text: {
    kind: "text",
    hint: "word(s) set in the fitted KH letterforms (centerlines + widths regressed from the fan TTF)",
    default: "KINGDOM HEARTS",
    size: 40,
    pool: WORD_POOL,
  },
  pxEm: {
    kind: "range",
    hint: "render size: px per em; the hero svg scales to fit but cells and the exported width use this directly",
    min: 12,
    max: 480,
    step: 1,
    default: 72,
    group: "glyph",
  },
  tracking: {
    kind: "range",
    hint: "letter spacing in em",
    min: 0,
    max: 0.4,
    step: 0.01,
    default: 0.06,
    group: "glyph",
  },
  weight: {
    kind: "range",
    hint: "stroke thickness scale; 1 keeps the TTF's measured widths",
    min: 0.3,
    max: 2.5,
    step: 0.01,
    default: 1,
    group: "glyph",
  },
  contrast: {
    kind: "range",
    hint: "mid-stroke swell on top of the fitted taper",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0,
    group: "glyph",
  },
  jitter: {
    kind: "range",
    hint: "control-point wobble in em, seeded",
    min: 0,
    max: 0.06,
    step: 0.002,
    default: 0,
    group: "curve",
  },
  fitseed: { kind: "seed", hint: "seeds the wobble", default: 1 },
  spines: { kind: "bool", hint: "draw the fitted centerlines as a depth layer", default: false, label: "spines" },
} as const satisfies AnySpec
type F = ValuesOf<typeof FIT_SPEC>

function FitLetterCell({ ch, o }: { ch: string; o: FitOpts }) {
  const k = 22
  const g = fitGlyph(ch, o, [0, 0], k)
  if (!g) return null
  const cx = (g.adv * k) / 2
  return (
    <div className="cell grid justify-items-center gap-0.5 text-[10px] text-muted">
      <svg viewBox={`${f(-cx - 2)} -3 ${f(g.adv * k + 4)} ${k + 5}`} width={f(g.adv * k + 6)} height={k + 8}>
        <title>{ch}</title>
        {g.strokes.map((s, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: strokes are positional and rebuilt as one set
          <path key={i} d={s.d} pathLength={1} />
        ))}
      </svg>
      <span>{ch}</span>
    </div>
  )
}

function FitBody({ v }: { v: F }) {
  const row = useRef<HTMLDivElement>(null)
  const o = { ...FIT_DEFAULTS, weight: FIT_DEFAULTS.weight * v.weight, contrast: v.contrast, tracking: v.tracking }
  const emH = 1.28
  // pxEm drives the render literally; the svg only shrinks to the host width
  // via CSS when the requested size overflows, so huge values stay inspectable
  const k = v.pxEm
  const t = fitText(v.text.trim() || "KH", o, k, v.jitter, v.fitseed)
  const w = Math.max(t.width, k * 0.1)
  const dw = w + 0.32 * k
  const dh = emH * k + 0.32 * k
  // biome-ignore lint/correctness/useExhaustiveDependencies: the letter row follows every word value
  useDrawIn(row, [v.text, JSON.stringify(o), v.jitter, v.fitseed])
  return (
    <div className="grid gap-4">
      <svg
        viewBox={`${f(-0.16 * k)} ${f(-0.16 * k)} ${f(dw)} ${f(dh)}`}
        width={Math.round(dw)}
        height={Math.round(dh)}
        className="mx-auto max-w-full"
        role="img"
        aria-label={v.text}
      >
        <title>{v.text}</title>
        {t.d.map((d, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: strokes are positional and rebuilt as one set
          <path key={i} d={d} pathLength={1} />
        ))}
        {v.spines
          ? t.spine.map((d, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: strokes are positional and rebuilt as one set
              <path key={i} d={d} pathLength={1} data-z={0.85} style={{ "--z": 0.85 } as React.CSSProperties} />
            ))
          : null}
      </svg>
      <div ref={row} className="row flex flex-wrap items-end gap-1.5 rounded-md bg-well px-2 py-1.5">
        {v.text
          .toUpperCase()
          .split("")
          .filter(ch => ch !== " ")
          .map((ch, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: letter cells are positional and rebuilt as one set
            <FitLetterCell key={i} ch={ch} o={{ ...o, tracking: 0 }} />
          ))}
      </div>
      <span className="text-[10px] text-muted">{`${t.glyphs} glyphs · ${t.d.length} strokes · ${f(t.width / k)} em wide · fitted tension`}</span>
    </div>
  )
}

const WORD_SPEC = {
  text: {
    kind: "text",
    hint: "word(s) set in the cut-stroke letters on one line; every letter below animates the page timing",
    default: "KINGDOM HEARTS",
    size: 40,
    pool: WORD_POOL,
  },
  tracking: {
    kind: "range",
    hint: "letter spacing in em",
    min: 0,
    max: 0.4,
    step: 0.01,
    default: 0.06,
    group: "glyph",
  },
  ...KH_CURVE_INPUTS,
  spines: {
    kind: "bool",
    hint: "draw the sampled centerline inside each outline as a depth layer",
    default: false,
    label: "spines",
  },
} as const satisfies AnySpec
type W = ValuesOf<typeof WORD_SPEC>

function LetterCell({ ch, o }: { ch: string; o: KhOpts }) {
  const k = 22
  const g = khGlyph(ch, o, [0, 0], k)
  if (!g) return null
  const cx = (g.adv * k) / 2
  return (
    <div className="cell grid justify-items-center gap-0.5 text-[10px] text-muted">
      <svg viewBox={`${f(-cx - 2)} -3 ${f(g.adv * k + 4)} ${k + 5}`} width={f(g.adv * k + 6)} height={k + 8}>
        {g.strokes.map((s, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: strokes are positional and rebuilt as one set
          <path key={i} d={s.d} pathLength={1} />
        ))}
      </svg>
      <span>{ch}</span>
    </div>
  )
}

function WordBody({ v }: { v: W }) {
  const row = useRef<HTMLDivElement>(null)
  const o = { ...khOpts(v), tracking: v.tracking }
  const emH = 1.28
  // px per em: app.css strokes paths in user units, so the hero svg works in px like the cells
  const k = Math.min(72, 760 / Math.max(v.text.trim().length, 4))
  const t = khText(v.text.trim() || "KH", o, k)
  const w = Math.max(t.width, k * 0.1)
  const dw = w + 0.32 * k
  const dh = emH * k + 0.32 * k
  // biome-ignore lint/correctness/useExhaustiveDependencies: the letter row follows every word value
  useDrawIn(row, [v.text, JSON.stringify(o)])
  return (
    <div className="grid gap-4">
      <svg
        viewBox={`${f(-0.16 * k)} ${f(-0.16 * k)} ${f(dw)} ${f(dh)}`}
        width={Math.round(dw)}
        height={Math.round(dh)}
        className="overflow-hidden"
        role="img"
        aria-label={v.text}
      >
        <title>{v.text}</title>
        {t.d.map((d, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: strokes are positional and rebuilt as one set
          <path key={i} d={d} pathLength={1} />
        ))}
        {v.spines
          ? t.spine.map((d, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: strokes are positional and rebuilt as one set
              <path key={i} d={d} pathLength={1} data-z={0.85} style={{ "--z": 0.85 } as React.CSSProperties} />
            ))
          : null}
      </svg>
      <div ref={row} className="row flex flex-wrap items-end gap-1.5 rounded-md bg-well px-2 py-1.5">
        {v.text
          .toUpperCase()
          .split("")
          .filter(ch => ch !== " ")
          .map((ch, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: letter cells are positional and rebuilt as one set
            <LetterCell key={i} ch={ch} o={{ ...o, tracking: 0 }} />
          ))}
      </div>
      <span className="text-[10px] text-muted">{`${t.glyphs} glyphs · ${t.d.length} strokes · ${f(t.width / k)} em wide · cut ${o.cut} @ ${o.cutAngle}°`}</span>
    </div>
  )
}


// --- nib: the cubic stroker, the ornament knob, and the morph -----------------

const LETTERS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"]
type P = [number, number]

/** One glyph as outlines, ornaments included, through `nibOutline`. Returns the spines too, so the
 * section can show the control curve the walls were built from. */
function nibGlyph(ch: string, x: number, k: number, v: N): { d: string[]; spine: string[]; adv: number } | null {
  const g = KH_GLYPHS[ch]
  if (g === undefined) return null
  const opts = {
    weight: KH_DEFAULTS.weight * v.weight * k * 0.5,
    contrast: v.contrast,
    cutAngle: v.cutAngle,
    overshoot: v.overshoot,
  }
  const term: readonly [Terminal, Terminal] = [v.terminal as Terminal, v.terminal as Terminal]
  const d: string[] = []
  const spine: string[] = []
  const put = (pts: readonly P[], loop: boolean, w: Width): void => {
    const moved = pts.map(([px, py]) => [x + px * k, py * k] as P)
    d.push(nibOutline(moved, loop, v.tension, w, opts, term))
    spine.push(nibSpine(moved, loop, v.tension))
  }
  for (const st of g.s) {
    const a = st.w?.[0] ?? 1
    const b = st.w?.[1] ?? 1
    put(st.pts as P[], st.loop === true, [a, (a + b) / 2, b])
  }
  const half = KH_DEFAULTS.weight * v.weight * 0.5
  for (const orn of ornamentStrokes(g.s, KH_HOOKS[ch] ?? [], v.tension, v.ornament, half)) {
    put(orn.pts as P[], false, orn.w)
  }
  return { d, spine, adv: g.adv }
}

const NIB_SPEC = {
  text: {
    kind: "text",
    hint: "word(s) drawn by the cubic stroker: one Catmull-Rom span offsets to one cubic, so a letter costs its control points rather than 48 samples per em unit",
    default: "KINGDOM",
    size: 40,
    pool: WORD_POOL,
  },
  pxEm: { kind: "range", hint: "px per em", min: 24, max: 320, step: 1, default: 120, group: "glyph" },
  tracking: { kind: "range", hint: "letter spacing in em", min: 0, max: 0.4, step: 0.01, default: 0.06, group: "glyph" },
  weight: { kind: "range", hint: "nib width scale", min: 0.2, max: 3, step: 0.05, default: 1, group: "glyph" },
  contrast: { kind: "range", hint: "mid-stroke swell on top of the width ramp", min: 0, max: 1.5, step: 0.05, default: 0.35, group: "glyph" },
  tension: { kind: "range", hint: "Catmull-Rom tangent scale; the span conversion reads it directly", min: 0.2, max: 1.6, step: 0.05, default: 0.9, group: "curve" },
  ornament: {
    kind: "range",
    hint: "how far the generated hooks, flags, barbs and wedges reach. 0 is the plain face; the stroke count holds at every value, so a morph still pairs",
    min: 0,
    max: 1.6,
    step: 0.05,
    default: 1,
    group: "curve",
  },
  terminal: { kind: "select", hint: "what closes an open stroke", options: ["cut", "point", "round", "flat"], default: "cut", group: "curve" },
  ink: { kind: "select", hint: "the walls filled as a letterform, or stroked the way the rest of this page draws", options: ["fill", "outline"], default: "fill" },
  cutAngle: { kind: "range", hint: "chisel angle off the perpendicular, degrees; only `cut` reads it", min: -60, max: 60, step: 1, default: 24, group: "curve" },
  overshoot: { kind: "range", hint: "how far a terminal reaches past the centerline end, as a multiple of the half-width there", min: 0, max: 2.5, step: 0.05, default: 0.9, group: "curve" },
  spines: { kind: "bool", hint: "draw the control curve the walls were offset from", default: false, label: "spines" },
} as const satisfies AnySpec
type N = ValuesOf<typeof NIB_SPEC>

function NibBody({ v }: { v: N }) {
  const k = v.pxEm
  const emH = 1.35
  let x = 0
  const d: string[] = []
  const spine: string[] = []
  let glyphs = 0
  for (const ch of (v.text.trim() || "KH").toUpperCase()) {
    if (ch === " ") {
      x += 0.3 * k
      continue
    }
    const g = nibGlyph(ch, x, k, v)
    if (g === null) continue
    d.push(...g.d)
    spine.push(...g.spine)
    x += (g.adv + v.tracking) * k
    glyphs += 1
  }
  const segments = [...d.join("")].filter(c => c === "C" || c === "L").length
  // `svg :is(path, circle, polyline) { fill: none }` in app.css beats a fill inherited from the
  // group, so the class has to land on the path itself.
  const ink = v.ink === "fill" ? "dark" : undefined
  const dw = Math.max(x, k) + 0.5 * k
  const dh = emH * k + 0.5 * k
  return (
    <div className="grid gap-4">
      <svg
        viewBox={`${f(-0.25 * k)} ${f(-0.2 * k)} ${f(dw)} ${f(dh)}`}
        width={Math.round(dw)}
        height={Math.round(dh)}
        className="mx-auto max-w-full"
        role="img"
        aria-label={v.text}
      >
        <title>{v.text}</title>
        <g fillRule="evenodd">
          {d.map((it, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: strokes are positional and rebuilt as one set
            <path key={i} d={it} pathLength={1} className={ink} />
          ))}
        </g>
        {v.spines
          ? spine.map((it, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: strokes are positional and rebuilt as one set
              <path key={i} d={it} pathLength={1} fill="none" data-z={0.85} style={{ "--z": 0.85 } as React.CSSProperties} />
            ))
          : null}
      </svg>
      <span className="text-[10px] text-muted">
        {`${glyphs} glyphs · ${d.length} strokes · ${segments} segments · ${d.join("").length} bytes of d · ${f(x / k)} em wide`}
      </span>
    </div>
  )
}

// --- morph -------------------------------------------------------------------

const MORPH_SPEC = {
  from: { kind: "select", hint: "the letter the frame leaves", options: LETTERS, default: "K" },
  to: { kind: "select", hint: "the letter the frame lands on", options: LETTERS, default: "N" },
  t: { kind: "range", hint: "where the frame sits between the two", min: 0, max: 1, step: 0.01, default: 0.5 },
  steps: { kind: "range", hint: "how many frames the strip draws", min: 2, max: 16, step: 1, default: 7, group: "strip" },
  pxEm: { kind: "range", hint: "px per em", min: 40, max: 260, step: 1, default: 130, group: "strip" },
  weight: { kind: "range", hint: "nib width scale", min: 0.2, max: 3, step: 0.05, default: 1, group: "glyph" },
  ornament: { kind: "range", hint: "hook reach; decoration survives the morph because an ornament is a stroke like any other", min: 0, max: 1.6, step: 0.05, default: 0.8, group: "glyph" },
  tension: { kind: "range", hint: "Catmull-Rom tangent scale", min: 0.2, max: 1.6, step: 0.05, default: 0.9, group: "curve" },
  flight: { kind: "bool", hint: "draw the line every control point travels between the two letters", default: false, label: "flight" },
  ink: { kind: "select", hint: "the walls filled as a letterform, or stroked the way the rest of this page draws", options: ["fill", "outline"], default: "fill" },
} as const satisfies AnySpec
type Mo = ValuesOf<typeof MORPH_SPEC>

/** A glyph plus its ornaments, normalized to one fixed-shape vector, so any letter pairs with any
 * other. Ornaments join the stroke list before normalizing rather than after, or they would have no
 * host to hang off once the control points have moved. */
function morphOf(ch: string, v: Mo): MorphGlyph {
  const g = KH_GLYPHS[ch] ?? KH_GLYPHS.O
  const half = KH_DEFAULTS.weight * v.weight * 0.5
  const orn = ornamentStrokes(g.s, KH_HOOKS[ch] ?? [], v.tension, v.ornament, half)
  return toMorph([...g.s, ...orn], g.adv, v.tension)
}

function morphPaths(m: MorphGlyph, x: number, k: number, v: Mo): string[] {
  const opts = { weight: KH_DEFAULTS.weight * v.weight * k * 0.5, contrast: 0.35, cutAngle: 24, overshoot: 0.9 }
  return m.s
    .filter(st => st.w[1] > 0.02)
    .map(st =>
      nibOutline(st.pts.map(([px, py]) => [x + px * k, py * k] as P), st.loop, v.tension, st.w, opts, ["cut", "cut"]),
    )
}

function MorphBody({ v }: { v: Mo }) {
  const a = morphOf(v.from, v)
  const b = morphOf(v.to, v)
  const k = v.pxEm
  const stride = k * 1.2
  const frames = Array.from({ length: v.steps }, (_unused, i) => i / (v.steps - 1))
  const flights = trails(a, b)
  // `svg :is(path, circle, polyline) { fill: none }` in app.css beats a fill inherited from the
  // group, so the class has to land on the path itself.
  const ink = v.ink === "fill" ? "dark" : undefined
  const HERO = 1.8
  const heroW = k * HERO * 1.1
  // One svg: the scrubbed frame at `HERO` scale on the left, the strip beside it on the same
  // baseline, so the two never disagree about how tall an em is.
  const dw = heroW + stride * v.steps + k * 0.5
  const dh = k * HERO * 1.45
  const drop = (dh - k * 1.45) * 0.62
  return (
    <div className="grid gap-4">
      <svg
        viewBox={`${f(-0.4 * k)} ${f(-0.3 * k * HERO)} ${f(dw)} ${f(dh)}`}
        width={Math.round(dw)}
        height={Math.round(dh)}
        className="mx-auto max-w-full"
        role="img"
        aria-label={`${v.from} to ${v.to}`}
      >
        <title>{`${v.from} to ${v.to} at ${f(v.t)}, then in ${v.steps} frames`}</title>
        <g transform={`scale(${f(HERO)})`} fillRule="evenodd">
          {morphPaths(mixGlyph(a, b, v.t), 0, k, v).map((it, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: strokes are positional and rebuilt as one set
            <path key={i} d={it} pathLength={1} className={ink} />
          ))}
        </g>
        {v.flight
          ? flights.map(([p, q], i) => (
              <path
                // biome-ignore lint/suspicious/noArrayIndexKey: flights are positional and rebuilt as one set
                key={i}
                d={`M${f(p[0] * k * HERO)} ${f(p[1] * k * HERO)}L${f(q[0] * k * HERO)} ${f(q[1] * k * HERO)}`}
                data-z={0.85}
                style={{ "--z": 0.85 } as React.CSSProperties}
              />
            ))
          : null}
        <g transform={`translate(${f(heroW)} ${f(drop)})`} fillRule="evenodd">
          {frames.flatMap((t, frame) =>
            morphPaths(mixGlyph(a, b, t), frame * stride, k, v).map((it, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: frames and strokes are both positional
              <path key={`${frame}-${i}`} d={it} pathLength={1} className={ink} />
            )),
          )}
        </g>
      </svg>
      <span className="text-[10px] text-muted">
        {`${a.s.length} strokes both sides · ${a.s[0]?.pts.length ?? 0} control points each · ${flights.length} points in flight`}
      </span>
    </div>
  )
}

function NotebookPage() {
  return (
    <>
      <Section
        page="kh"
        slice
        def={{
          id: "word",
          title: "word: the text set in those strokes; the letter row reuses the icons draw-in",
          spec: WORD_SPEC,
        }}
      >
        {v => <WordBody v={v as W} />}
      </Section>
      <Section
        page="kh"
        slice
        def={{
          id: "fit",
          title:
            "fit: the same text in the fitted letterforms (centerlines + widths regressed from the fan TTF, per-stroke tension)",
          spec: FIT_SPEC,
        }}
      >
        {v => <FitBody v={v as F} />}
      </Section>
      <Section
        page="kh"
        def={{
          id: "nib",
          title: "nib: the same letters through the cubic stroker, with the ornaments as one knob",
          spec: NIB_SPEC,
        }}
      >
        {v => <NibBody v={v as N} />}
      </Section>
      <Section
        page="kh"
        def={{
          id: "morph",
          title: "morph: any letter to any letter, because normalizing makes two glyphs two vectors of one length",
          spec: MORPH_SPEC,
        }}
      >
        {v => <MorphBody v={v as Mo} />}
      </Section>
      <AlgoSection
        page="kh"
        slice
        algo={section_kh}
        sizes={SIZES}
        title="glyph anatomy: one letter's chisel-cut strokes at study sizes"
      />
      <SliceTiming page="kh" />
      {/* scaffold:sections */}
    </>
  )
}

export const PAGE: PageSpec = {
  id: "kh",
  title: "gothic: kh",
  path: "/kh",
  specs: {
    kh: section_kh.spec,
    word: WORD_SPEC,
    fit: FIT_SPEC,
    nib: NIB_SPEC,
    morph: MORPH_SPEC,
    timing: SLICE_SPEC,
    // scaffold:specs
  },
  Component: NotebookPage,
}
