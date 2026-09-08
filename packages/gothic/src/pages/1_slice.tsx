import type { AnySpec } from "@hafley66/report-shell"
import { Signal } from "@hafley66/signals"
import { useMemo } from "react"
import { combineLatest, defer, distinctUntilChanged, EMPTY, finalize, ignoreElements, switchMap, tap } from "rxjs"
import type { PageSpec } from "../app/0_pages.js"
import type { SectionState } from "../app/2_state.js"
import {
  f,
  line,
  type Part,
  polyShape,
  type Stroke,
} from "../lib/index.js"
import { sliceSeal, type CoreParams } from "../lib/3a_sealCore.js"
import { reducedMotion } from "../ui/0_hooks.js"
import { SLICE_SPEC, SLICE_PRESETS, type SliceParams } from "../kit/slice/0_spec.js"
import { playback, type PlaybackRuntime } from "../kit/1a_playback.js"
import { AnimationControls } from "../ui/1b_AnimationControls.js"
import { slicePaths } from "../lib/6a_slicePaths.js"
import { paintSlice } from "../ui/1a_slicePose.js"
import { propertyMotion } from "../kit/4_propertyMotion.js"
import { Section } from "../ui/2_Section.js"

const SPEC = {
  ...SLICE_SPEC,
  core: { kind: "select", options: ["original", "iris", "blades", "lattice"], default: "original", hint: "inner construction; original preserves the existing seal", group: "core" },
  coreSides: { kind: "range", min: 2, max: 9, default: 5, label: "core sides", hint: "symmetry of the new core", group: "core" },
  coreSize: { kind: "range", min: 0.16, max: 0.46, step: 0.01, default: 0.34, label: "core radius", hint: "fraction of the seal reserved for the new core", group: "core" },
  coreTurn: { kind: "range", min: -90, max: 90, default: 18, label: "core turn", hint: "angular offset inside the core, in degrees", group: "core" },
  coreFrame: { kind: "select", options: ["open", "circle", "polygon"], default: "open", label: "core frame", hint: "optional enclosing shape for the new core", group: "core" },
} as const satisfies AnySpec
const PRESETS = { ...SLICE_PRESETS,
  "core · original": { core: "original" },
  "core · iris": { core: "iris", coreSides: 5, coreTurn: 18, coreSize: 0.34, coreFrame: "open" },
  "core · opposed blades": { core: "blades", coreSides: 2, coreTurn: -24, coreSize: 0.38, coreFrame: "open" },
  "core · rung lattice": { core: "lattice", coreSides: 3, coreTurn: 42, coreSize: 0.4, coreFrame: "polygon" },
} as const
type V = SliceParams & CoreParams

// the keys that only change how the strokes move, so the geometry is kept
const HEAVY = [
  "core", "coreSides", "coreSize", "coreTurn", "coreFrame",
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
  return { ...slicePaths(parts, { ...k, seed }, { size }), label }
}

/* ============ pose(t): pure per-frame transform, so the scrub slider and the clock share one path ============ */

type Clock = ReturnType<typeof playback<V>>
function Cell({ inst, ailen, params, clock, node, base }: {
  inst: Inst; ailen: number; params: Signal<V>; clock: Clock; node: Signal<SVGSVGElement | null>; base: number
}) {
  const model = useMemo(() => {
    const painted = Signal(node.$.pipe(distinctUntilChanged(), switchMap(svg => svg ? defer(() => {
      const ink = svg.querySelectorAll<SVGPathElement>(".ink path")
      const ai = svg.querySelectorAll<SVGPathElement>(".slash path")
      const bl = svg.querySelectorAll<SVGPathElement>(".blade path")
      inst.strokes.forEach((s, i) => {
        s.el = ink[i] ?? null; s.ai = ai[i] ?? null; s.bl = bl[i] ?? null
        s._op = undefined; s._tr = null; s._w = null; s._ao = null; s._dash = null; s._bd = undefined
      })
      return combineLatest([clock.frame.$, params.$]).pipe(tap(([frame, values]) => {
        paintSlice(inst.strokes, frame.time >= base ? inst.T : frame.time % inst.T, values)
      }), ignoreElements(), finalize(() => { for (const s of inst.strokes) { s.el = null; s.ai = null; s.bl = null } }))
    }) : EMPTY)), null)
    return { painted, ref(element: SVGSVGElement | null) { node.$(element) } }
  }, [inst, clock, node, params, base])
  model.painted.$()
  const S = inst.size + 4
  return (
    <div className="cell grid justify-items-center gap-1 text-[10px] text-muted">
      <svg
        ref={model.ref}
        viewBox={`${f(-S / 2)} ${f(-S / 2)} ${S} ${S}`}
        width={S}
        height={S}
        className="overflow-hidden"
        role="img"
        aria-label={inst.label}
      >
        <title>{inst.label}</title>
        {/* inline styles: app.css sets stroke-width on every svg path, which beats a presentation attribute */}
        <g className="slash">
          {inst.strokes.map((s, i) => {
            const Ln = s.diag * ailen
            const c = Math.cos(s.th) * Ln
            const sn = Math.sin(s.th) * Ln
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: strokes are positional and rebuilt as one set
              <path
                key={i}
                d={line(s.cx - c, s.cy - sn, s.cx + c, s.cy + sn)}
                style={{ strokeWidth: 0.75, strokeOpacity: 0 }}
              />
            )
          })}
        </g>
        <g className="blade">
          {inst.strokes.map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: strokes are positional and rebuilt as one set
            <path key={i} d="" style={{ strokeWidth: 1.6, strokeOpacity: 0 }} />
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

function SliceTransport({ clock, state, duration }: { clock: Clock; state: SectionState<AnySpec>; duration: number }) {
  const frame = clock.frame.$()
  return <AnimationControls label="Slice" duration={duration} time={frame.time} running={frame.active}
    onSeek={ms => { state.set({ time: ms / duration, run: false }); clock.seek(ms) }}
    onToggle={() => { clock.runtime.enabled.$(true); state.set({ run: !frame.active }) }}
    onReplay={() => { state.set({ time: 0, run: true }); clock.replay() }} />
}

function SliceBody({ v, state }: { v: V; state: SectionState<AnySpec> }) {
  const key = HEAVY.map(k => v[k]).join("|")
  // biome-ignore lint/correctness/useExhaustiveDependencies: key lists every value the geometry depends on
  const insts = useMemo(() => {
    const hero = build(withD(sliceSeal(118, v.seed, v).sc.parts), v, v.seed, 240, "hero")
    const sizes = SIZES.map((S, i) =>
      build(withD(sliceSeal(S / 2 - 2, v.seed, v).sc.parts), v, v.seed + i * 7919, S, `${S}`),
    )
    const test = build(polyShape(112), v, v.seed ^ 0x1d3, 240, "polyline")
    return { hero, sizes, test, all: [hero, ...sizes, test] }
  }, [key])

  const params = state.values as unknown as Signal<V>
  const input = propertyMotion(state.page).values(state) as unknown as Signal<V>
  const model = useMemo(() => {
    const runtime = Signal<PlaybackRuntime & { cells: Record<string, SVGSVGElement | null> }>({
      enabled: !reducedMotion, seek: null, cells: Object.fromEntries(insts.all.map(inst => [inst.label, null])),
    })
    const clock = playback(params, insts.hero.T, { input, reducedMotion, landOnReduce: true, runtime: runtime as unknown as Signal<PlaybackRuntime> })
    return { runtime, clock }
  }, [insts, params, input])
  const { clock } = model

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
      <SliceTransport clock={clock} state={state} duration={insts.hero.T} />
      <section>
        <h2 className="mb-2 font-medium text-muted">
          hero: every subpath cut into equal arc-length strokes; each slides in along its own chord by dist
          chord-lengths, fading up over the first quarter of flight; angle only orders the sweep
        </h2>
        <div className="row flex flex-wrap items-end gap-5">
          <Cell inst={insts.hero} ailen={v.ailen} params={input} clock={clock} node={model.runtime.cells.hero} base={insts.hero.T} />
        </div>
      </section>
      <section>
        <h2 className="mb-2 font-medium text-muted">same seal at 32 / 48 / 64 / 96 / 160, each on its own cycle</h2>
        <div className="row flex flex-wrap items-end gap-5">
          {insts.sizes.map(inst => (
            <Cell key={inst.size} inst={inst} ailen={v.ailen} params={input} clock={clock} node={model.runtime.cells[inst.label]} base={insts.hero.T} />
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-2 font-medium text-muted">polyline test shape: star, zigzag, spiral</h2>
        <div className="row flex flex-wrap items-end gap-5">
          <Cell inst={insts.test} ailen={v.ailen} params={input} clock={clock} node={model.runtime.cells.polyline} base={insts.hero.T} />
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
  return (
    <Section page="slice" def={{ id: "slice", title: "slice", spec: SPEC, presets: PRESETS }}>
      {(v, ctx) => <SliceBody v={v as V} state={ctx.state} />}
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
