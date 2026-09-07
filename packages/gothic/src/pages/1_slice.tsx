import { type RefObject, useEffect, useMemo, useRef } from "react"
import type { PageSpec } from "../app/0_pages.js"
import type { SectionState } from "../app/2_state.js"
import type { AnySpec, ValuesOf } from "../kit/0_spec.js"
import {
  CURVES,
  FLY,
  GAPS,
  type Part,
  type Stroke,
  alongPts,
  clamp01,
  f,
  line,
  polyShape,
  schedule,
  seal,
  strokesOf,
} from "../lib/index.js"
import { reducedMotion, useClock } from "../ui/0_hooks.js"
import { Section } from "../ui/2_Section.js"

const SPEC = {
  seed: { kind: "seed", default: 7 },
  reveal: {
    kind: "select",
    options: ["draw", "cut", "slide", "draw+slide", "glow"],
    default: "draw",
    pool: ["draw", "cut", "cut", "slide", "draw+slide", "glow"],
  },
  cut: { kind: "range", min: 8, max: 160, default: 48, label: "cut px", roll: [12, 92], group: "cut" },
  angle: { kind: "range", min: 0, max: 360, default: 215, group: "cut" },
  jit: { kind: "range", min: 0, max: 180, default: 18, label: "jitter", roll: [0, 40], group: "cut" },
  dist: { kind: "range", min: 0.3, max: 3, step: 0.1, default: 1.2, roll: [0.5, 2.5], group: "cut" },
  flight: { kind: "range", min: 60, max: 600, step: 10, default: 160, roll: [80, 320], group: "cut" },
  order: {
    kind: "select",
    options: [
      "sweep",
      "radial",
      "radial-in",
      "path",
      "subpath",
      "golden",
      "golden-angle",
      "vdc",
      "spectral",
      "hilbert",
      "random",
    ],
    default: "sweep",
    pool: [
      "sweep",
      "radial",
      "radial-in",
      "path",
      "subpath",
      "golden",
      "golden",
      "golden-angle",
      "vdc",
      "spectral",
      "spectral",
      "hilbert",
    ],
    group: "order",
  },
  curve: { kind: "select", options: [...Object.keys(CURVES), ...Object.keys(GAPS)], default: "linear", group: "order" },
  ordN: { kind: "range", min: 1, max: 8, step: 0.5, default: 2, label: "N/β/k", roll: [1, 6], group: "order" },
  gain: { kind: "range", min: 0, max: 4, step: 0.1, default: 1.5, roll: [0.3, 3], group: "order" },
  silence: { kind: "range", min: 1, max: 8, step: 0.5, default: 2.5, roll: [1.5, 5], group: "order" },
  spread: { kind: "range", min: 0, max: 3000, step: 50, default: 800, roll: [200, 1600], group: "order" },
  burst: { kind: "range", min: 1, max: 16, default: 10, label: "steps", roll: [1, 15], group: "order" },
  fease: { kind: "select", options: Object.keys(FLY), default: "back", label: "fly ease", group: "fly" },
  stretch: { kind: "range", min: 0, max: 2.5, step: 0.05, default: 0.9, roll: [0, 2.2], group: "fly" },
  os: { kind: "range", min: 0, max: 1.4, step: 0.05, default: 0.5, label: "overshoot", roll: [0, 1.2], group: "fly" },
  ailen: { kind: "range", min: 0.5, max: 5, step: 0.1, default: 2, label: "ai len", roll: [0.5, 4], group: "fly" },
  ai: { kind: "bool", default: true, label: "afterimage", static: true },
  weight: { kind: "range", min: 0.4, max: 2.5, step: 0.1, default: 1, static: true },
  run: { kind: "bool", default: true, label: "play", static: true },
} as const satisfies AnySpec
type V = ValuesOf<typeof SPEC>

// the keys that only change how the strokes move, so the geometry is kept
const HEAVY = [
  "seed",
  "cut",
  "angle",
  "jit",
  "dist",
  "flight",
  "order",
  "curve",
  "ordN",
  "gain",
  "silence",
  "spread",
  "burst",
  "ailen",
  "reveal",
] as const

type Inst = { strokes: Stroke[]; T: number; bursts: number; size: number; label: string }
const SIZES = [32, 48, 64, 96, 160]
const withD = (parts: Part[]) => parts.filter(p => p.d)

function build(parts: Part[], k: V, seed: number, size: number, label: string): Inst {
  const strokes = strokesOf(parts, k, seed, size)
  const sch = schedule(strokes, k, seed)
  return { strokes, T: sch.T, bursts: sch.bursts, size, label }
}

/* ============ pose(t): pure per-frame transform, so the scrub slider and the clock share one path ============ */
function pose(inst: Inst, t: number, k: V) {
  for (const s of inst.strokes) {
    if (!s.el) continue
    const u = clamp01((t - s.t0) / s.dur)
    const age = t - s.t0 - s.dur
    const op = f(clamp01(u / 0.25))
    if (s._op !== op) {
      s.el.style.opacity = String(op)
      s._op = op
    }
    const p = FLY[k.fease](u, k.os)
    const slide = k.reveal === "slide" || k.reveal === "draw+slide"
    const off = !slide ? 0 : t < s.t0 ? s.D : s.D * (k.reveal === "draw+slide" ? 0.35 : 1) * (1 - p)
    // draw: dasharray 1 on a pathLength=1 path; offset +(1-p) grows from the start, -(1-p) grows from the end
    // cut: a blade rides the stroke from 30% before its start to 30% past its end; ink appears only behind the blade
    const isCut = k.reveal === "cut"
    const hq = isCut ? -0.3 + 1.6 * clamp01(p) : 0
    const drawn = isCut ? clamp01(hq) : clamp01(p)
    if (isCut && s.bl) {
      const on = u > 0 && u < 1
      const q = s.rev ? 1 - clamp01(hq) : clamp01(hq)
      const [bx, by, tx, ty] = alongPts(s.pts, q)
      const bw = Math.max(3, s.diag * 0.3)
      const bd = on ? line(bx - ty * bw, by + tx * bw, bx + ty * bw, by - tx * bw) : ""
      if (s._bd !== bd) {
        s.bl.setAttribute("d", bd)
        s.bl.style.strokeOpacity = on ? "1" : "0"
        s._bd = bd
      }
    }
    const dash = k.reveal === "draw" || k.reveal === "draw+slide" || isCut ? f((s.rev ? -1 : 1) * (1 - drawn)) : null
    if (s._dash !== dash) {
      s.el.style.strokeDasharray = dash === null ? "" : "1"
      s.el.style.strokeDashoffset = dash === null ? "" : String(dash)
      s._dash = dash
    }
    const st =
      u >= 1 ? 0 : k.stretch * (u < 0.85 ? u / 0.85 : Math.cos(((u - 0.85) / 0.15) * 4.712) * (1 - (u - 0.85) / 0.15))
    const deg = f((s.th * 180) / Math.PI)
    const c = Math.cos(s.th)
    const sn = Math.sin(s.th)
    const tr = `translate(${f(off * c)} ${f(off * sn)}) translate(${f(s.cx)} ${f(s.cy)}) rotate(${deg}) scale(${f(1 + st)} 1) rotate(${-deg}) translate(${f(-s.cx)} ${f(-s.cy)})`
    if (s._tr !== tr) {
      s.el.setAttribute("transform", tr)
      s._tr = tr
    }
    const w = f(k.weight * (age >= 0 && age < 80 ? 1 + 1.5 * (1 - age / 80) : 1))
    if (s._w !== w) {
      s.el.style.strokeWidth = String(w)
      s._w = w
    }
    if (s.ai) {
      const o = k.ai && age >= 0 && age < 120 ? f(0.85 * (1 - age / 120)) : 0
      if (s._ao !== o) {
        s.ai.style.strokeOpacity = String(o)
        s._ao = o
      }
    }
  }
}

function Cell({ inst, ailen }: { inst: Inst; ailen: number }) {
  const ref = useRef<SVGSVGElement>(null)
  const S = inst.size + 4
  useEffect(() => {
    const svg = ref.current
    if (!svg) return
    const ink = svg.querySelectorAll<SVGPathElement>(".ink path")
    const ai = svg.querySelectorAll<SVGPathElement>(".slash path")
    const bl = svg.querySelectorAll<SVGPathElement>(".blade path")
    inst.strokes.forEach((s, i) => {
      s.el = ink[i] ?? null
      s.ai = ai[i] ?? null
      s.bl = bl[i] ?? null
      s._op = undefined
      s._tr = null
      s._w = null
      s._ao = null
      s._dash = null
      s._bd = undefined
    })
    return () => {
      for (const s of inst.strokes) {
        s.el = null
        s.ai = null
        s.bl = null
      }
    }
  }, [inst])
  return (
    <div className="cell grid justify-items-center gap-1 text-[10px] text-muted">
      <svg
        ref={ref}
        viewBox={`${f(-S / 2)} ${f(-S / 2)} ${S} ${S}`}
        width={S}
        height={S}
        className="overflow-hidden"
        role="img"
        aria-label={inst.label}
      >
        <title>{inst.label}</title>
        <g className="slash">
          {inst.strokes.map((s, i) => {
            const Ln = s.diag * ailen
            const c = Math.cos(s.th) * Ln
            const sn = Math.sin(s.th) * Ln
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: strokes are positional and rebuilt as one set
              <path key={i} d={line(s.cx - c, s.cy - sn, s.cx + c, s.cy + sn)} strokeWidth={0.75} strokeOpacity={0} />
            )
          })}
        </g>
        <g className="blade">
          {inst.strokes.map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: strokes are positional and rebuilt as one set
            <path key={i} d="" strokeWidth={1.6} strokeOpacity={0} />
          ))}
        </g>
        <g className="ink">
          {inst.strokes.map((s, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: strokes are positional and rebuilt as one set
            <path key={i} d={s.d} pathLength={1} />
          ))}
        </g>
      </svg>
      <span>{`${inst.label} · ${inst.strokes.length} strokes · ${inst.bursts} starts · cycle ${inst.T}ms`}</span>
    </div>
  )
}

function Plot({ inst }: { inst: Inst }) {
  const st = inst.strokes.slice().sort((a, b) => a.i - b.i)
  const n = st.length
  const W = 640
  const H = Math.min(260, Math.max(60, n * 2))
  const X = (t: number) => f((t / inst.T) * W)
  const Y = (i: number) => f(((i + 0.5) / n) * H)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="stroke timing plot">
      <title>stroke timing plot</title>
      <path strokeOpacity={0.35} d={st.map(s => `M${X(s.t0)} ${Y(s.i)}H${X(s.t0 + s.dur)}`).join("")} />
      <path strokeWidth={2} d={st.map(s => `M${X(s.t0 + s.dur)} ${Y(s.i)}h.01`).join("")} />
      <path
        strokeOpacity={0.25}
        strokeDasharray="3 3"
        d={st.map((s, j) => `${j ? "L" : "M"}${X(s.t0)} ${Y(s.i)}`).join("")}
      />
    </svg>
  )
}

type BodyProps = {
  v: V
  state: SectionState<AnySpec>
  stats: RefObject<HTMLSpanElement | null>
  scrub: RefObject<HTMLInputElement | null>
}

function SliceBody({ v, state, stats, scrub }: BodyProps) {
  const key = HEAVY.map(k => v[k]).join("|")
  // biome-ignore lint/correctness/useExhaustiveDependencies: key lists every value the geometry depends on
  const insts = useMemo(() => {
    const hero = build(withD(seal(118, v.seed, { kFirst: true, pupil: false }).sc.parts), v, v.seed, 240, "hero")
    const sizes = SIZES.map((S, i) =>
      build(withD(seal(S / 2 - 2, v.seed, { kFirst: true, pupil: false }).sc.parts), v, v.seed + i * 7919, S, `${S}`),
    )
    const test = build(polyShape(112), v, v.seed ^ 0x1d3, 240, "polyline")
    return { hero, sizes, test, all: [hero, ...sizes, test] }
  }, [key])

  useEffect(() => {
    document.documentElement.style.setProperty("--w", String(v.weight))
  }, [v.weight])
  useEffect(() => {
    if (stats.current)
      stats.current.textContent = `${insts.hero.strokes.length} strokes · ${insts.hero.bursts} bursts · cycle ${insts.hero.T}ms`
  }, [insts, stats])

  const clk = useClock(elapsed => {
    const base = insts.hero.T || 1000
    const t = elapsed % base
    for (const inst of insts.all) pose(inst, t % inst.T, v)
  })
  useEffect(() => {
    clk.run(v.run)
  }, [clk, v.run])
  useEffect(() => {
    const input = scrub.current
    if (!input) return
    clk.bindScrub(input, () => insts.hero.T || 1000)
  }, [clk, insts, scrub])
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new stroke set restarts the cycle
  useEffect(() => {
    clk.reset()
  }, [clk, insts])
  // reduced motion: land every stroke and pause, so the page is still readable
  useEffect(() => {
    if (!reducedMotion) return
    clk.seek(insts.hero.T || 1000)
    state.set({ run: false })
  }, [clk, insts, state])

  const trace = insts.hero.strokes
    .slice()
    .sort((a, b) => a.i - b.i)
    .slice(0, 400)
    .map(
      s =>
        `${String(s.i).padStart(4)}  θ ${((s.th * 180) / Math.PI).toFixed(1).padStart(7)}°  start ${String(Math.round(s.t0)).padStart(6)}ms  land ${String(Math.round(s.t0 + s.dur)).padStart(6)}ms  D ${Math.round(s.D)}`,
    )
    .join("\n")

  return (
    <>
      <section>
        <h2 className="mb-2 font-medium text-muted">
          hero: every subpath cut into equal arc-length strokes; each slides in along its own chord by dist
          chord-lengths, fading up over the first quarter of flight; angle only orders the sweep
        </h2>
        <div className="row flex flex-wrap items-end gap-5">
          <Cell inst={insts.hero} ailen={v.ailen} />
        </div>
      </section>
      <section>
        <h2 className="mb-2 font-medium text-muted">same seal at 32 / 48 / 64 / 96 / 160, each on its own cycle</h2>
        <div className="row flex flex-wrap items-end gap-5">
          {insts.sizes.map(inst => (
            <Cell key={inst.size} inst={inst} ailen={v.ailen} />
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-2 font-medium text-muted">polyline test shape: star, zigzag, spiral</h2>
        <div className="row flex flex-wrap items-end gap-5">
          <Cell inst={insts.test} ailen={v.ailen} />
        </div>
      </section>
      <section>
        <h2 className="mb-2 font-medium text-muted">
          timing plot (hero): x = time, one row per stroke in landing order; bar = flight window, dot = land; the curve
          is the start-time distribution
        </h2>
        <Plot inst={insts.hero} />
      </section>
      <section>
        <h2 className="mb-2 font-medium text-muted">step trace (hero): stroke · theta · start · land</h2>
        <div className="h-[200px] overflow-auto whitespace-pre rounded-md bg-well p-2 font-mono text-[11px] text-muted">
          {trace}
        </div>
      </section>
    </>
  )
}

function SlicePage() {
  const stats = useRef<HTMLSpanElement>(null)
  const scrub = useRef<HTMLInputElement>(null)
  const extra = (
    <>
      <label className="inline-flex items-center gap-1.5">
        scrub
        <input
          ref={scrub}
          className="o w-60 accent-ink"
          type="range"
          min={0}
          max={100}
          step={0.2}
          defaultValue={reducedMotion ? 100 : 0}
        />
      </label>
      <span ref={stats} />
    </>
  )
  return (
    <Section page="slice" def={{ id: "slice", title: "slice", spec: SPEC }} extra={extra}>
      {(v, ctx) => <SliceBody v={v as V} state={ctx.state} stats={stats} scrub={scrub} />}
    </Section>
  )
}

export const PAGE: PageSpec = {
  id: "slice",
  title: "gothic: judgement cut",
  path: "/slice",
  specs: { slice: SPEC },
  Component: SlicePage,
}
