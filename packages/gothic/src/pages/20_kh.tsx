import { type AnySpec, useDrawIn, type ValuesOf } from "@hafley66/report-shell"
import { useRef } from "react"
import type { PageSpec } from "../app/0_pages.js"
import { ALGO as source_kh, khOpts, KH_CURVE_INPUTS } from "../algos/19_kh.js"
import { SLICE_SPEC } from "../kit/slice/0_spec.js"
import { khGlyph, khText, type KhOpts } from "../lib/8_khfont.js"
import { f } from "../lib/1_geom.js"
import { Section } from "../ui/2_Section.js"
import { SliceTiming } from "../ui/3a_SliceTiming.js"
import { AlgoSection } from "../ui/4_Algo.js"

const SIZES = [64, 96, 160, 240]
const WORD_POOL = ["KINGDOM HEARTS", "SORA", "RIKU", "KAIRI", "KEYBLADE", "GUMMI SHIP", "XEHANORT", "DARKNESS", "LIGHT"]
const section_kh = { ...source_kh, name: "kh" }
// scaffold:bindings

const WORD_SPEC = {
  text: { kind: "text", hint: "word(s) set in the cut-stroke letters on one line; every letter below animates the page timing", default: "KINGDOM HEARTS", size: 40, pool: WORD_POOL },
  tracking: { kind: "range", hint: "letter spacing in em", min: 0, max: 0.4, step: 0.01, default: 0.06, group: "glyph" },
  ...KH_CURVE_INPUTS,
  spines: { kind: "bool", hint: "draw the sampled centerline inside each outline as a depth layer", default: false, label: "spines" },
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

function NotebookPage() {
  return (
    <>
      <Section page="kh" slice def={{ id: "word", title: "word: the text set in those strokes; the letter row reuses the icons draw-in", spec: WORD_SPEC }}>
        {v => <WordBody v={v as W} />}
      </Section>
      <AlgoSection page="kh" slice algo={section_kh} sizes={SIZES} title="glyph anatomy: one letter's chisel-cut strokes at study sizes" />
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
    timing: SLICE_SPEC,
    // scaffold:specs
  },
  Component: NotebookPage,
}
