import type { AnySpec, ValuesOf } from "@hafley66/report-shell"
import { type RefObject, useEffect, useRef } from "react"
import type { PageSpec } from "../app/0_pages.js"
import { sectionState } from "../app/2_state.js"
import {
  AU,
  type Au,
  activate,
  blinkAt,
  EXPR,
  type Frame,
  lashLines,
  lashSlots,
  lidPts,
  randomShape,
  type Scheduler,
  SHAPES,
  type Shape,
  type Slot,
  scheduler,
  TIMING,
  type Timing,
} from "../lib/eye/index.js"
import { f, line, mulberry32, type Pt, pl, type Scene, sceneMarkup, seal } from "../lib/index.js"
import { useClock } from "../ui/0_hooks.js"
import { Section } from "../ui/2_Section.js"

/* ============ markup once, pose per frame ============ */
type Knobs = { sh: Shape; N: number; lag: number; pop: number; dress: boolean }
type Ctl = { blink(): void; rewake(): void }
type Eye = {
  el: SVGSVGElement
  k: Knobs
  slots: Slot[]
  lashLen: number
  fixedAu: Au | null
  hero: boolean
  sch: Scheduler
  last: string
}

export function eyeSvg(W: number, H: number, seed: number, sh: Shape, lash: string) {
  const uid = `e${seed.toString(36)}_${W}`
  const R = (H / 2) * sh.iris * 1.05
  const sl = seal(R, seed, { uid, kFirst: true })
  const s = sl.s
  const slots = lashSlots(lash, s)
  const lashLen = H * 0.4
  const pad = lashLen + H * 0.55 + 2
  const svg = `<svg viewBox="${f(-W / 2 - 1)} ${f(-H / 2 - pad)} ${f(W + 2)} ${f(H + 2 * pad)}" width="${W + 2}" height="${f(H + 2 * pad)}" data-w="${W}" data-h="${H}">
  <defs><clipPath id="${uid}c"><path class="clip" d=""/></clipPath></defs>
  <g clip-path="url(#${uid}c)"><g class="seal kit-draw">${sceneMarkup(sl.sc)}</g></g>
  <g class="dress"><path class="crease" d=""/><path class="shadow" d=""/><path class="brow" d=""/><path class="feet" d=""/></g>
  <path class="lid up" d="" pathLength="1"/><path class="lid lo" d="" pathLength="1"/>
  <g class="lashes">${slots.map(() => `<path d="" pathLength="1"/>`).join("")}</g>
</svg>`
  const sc: Scene = sl.sc
  return {
    svg,
    s,
    slots,
    lashLen,
    caption: `n${s.n} k${s.k} · ${slots.length} lashes · ${s.bands.map(b => b.kind).join(" ")}${sc.lod.length ? ` · ${sc.lod.join(" ")}` : ""}`,
  }
}

const bulge = (x: number, c: { h: number; p: number; peak: number }) => {
  const u = (x - c.peak) / (x < c.peak ? 1 + c.peak : 1 - c.peak)
  return 1 - Math.abs(Math.min(1, Math.max(-1, u))) ** c.p
}

function dress(e: Eye, sh: Shape, W: number, H: number, au: Au, up: Pt[], lo: Pt[], fr: Frame, N: number) {
  const g = e.el.querySelector(".dress") as SVGGElement
  const set = (cls: string, d: string) => g.querySelector(`.${cls}`)?.setAttribute("d", d)
  if (!e.k.dress || H < 24) {
    for (const p of g.children) p.setAttribute("d", "")
    return
  }
  const mid = (pts: Pt[], a: number, b: number) => pts.filter((_, i) => i / N >= a && i / N <= b)
  const hh = H / 2
  set(
    "crease",
    pl(mid(up, 0.12, 0.88).map(([x, y]) => [x, y - hh * (0.18 + 0.12 * au.AU2) * au.AU5 * bulge(x / (W / 2), sh.up)])),
  )
  set("shadow", pl(mid(lo, 0.25, 0.8).map(([x, y]) => [x, y - hh * 0.1 * (1 - au.AU6) * bulge(x / (W / 2), sh.lo)])))
  const bw = W * 0.56
  const by = -hh * (0.95 + sh.up.h * 0.3) + hh * fr.browY
  set(
    "brow",
    pl(
      Array.from({ length: 24 }, (_, i): Pt => {
        const x = -1 + (2 * i) / 23
        return [
          x * bw - ((fr.browPinch * hh * (1 - x)) / 2) * 0.5,
          by -
            hh * 0.22 * (1 - Math.abs(x) ** 1.4) +
            ((fr.browPinch * hh * 0.6 * (1 - x)) / 2) * Math.max(0, 0.5 - Math.abs(x + 0.6)),
        ]
      }),
    ),
  )
  let d = ""
  const cx = (W / 2) * fr.wScale
  const cy = up[N][1]
  const k = au.AU6 * 0.8 + au.AU7 * 0.2
  for (let j = 0; j < 3; j++) {
    const a = (j - 1) * 0.32
    const len = W * 0.1 * k
    if (len > 1) d += line(cx + 1, cy, cx + 1 + len * Math.cos(a), cy + len * Math.sin(a))
  }
  set("feet", d)
}

function lashes(e: Eye, up: Pt[], aUp: number) {
  const ps = e.el.querySelectorAll(".lashes path")
  lashLines(up, e.slots, e.lashLen, aUp).forEach(([a, b], i) => {
    ps[i].setAttribute("d", line(a[0], a[1], b[0], b[1]))
  })
}

// au: full action-unit state; gaze in [-1,1]^2; dil = pupil scale
export function pose(e: Eye, au: Au, gaze = { x: 0, y: 0 }, dil = 1) {
  const el = e.el
  const W = Number(el.dataset.w)
  const H = Number(el.dataset.h)
  const { sh, N, lag, pop } = e.k
  const { up, lo, fr } = lidPts(sh, W, H, au, N, lag, pop)
  el.querySelector(".up")?.setAttribute("d", pl(up))
  el.querySelector(".lo")?.setAttribute("d", pl(lo))
  el.querySelector(".clip")?.setAttribute("d", `${pl(up)}${pl(lo.slice().reverse()).replace("M", "L")}Z`)
  const yc = (-sh.tilt * H) / 4
  const gy = H * 0.5 * (gaze.y + fr.bell)
  const gx = W * 0.22 * gaze.x
  el.querySelector(".seal")?.setAttribute("transform", `translate(${f(gx)} ${f(yc + gy)}) scale(${f(dil)})`)
  dress(e, sh, W, H, au, up, lo, fr, N)
  lashes(e, up, activate(au, sh.up.peak, lag, pop).aUp)
}

/* ============ page ============ */
const SPEC = {
  seed: { kind: "seed", hint: "seed for the seal, the lash slots and the whole blink schedule", default: 3 },
  shape: {
    kind: "select",
    hint: "eye outline: lid bulge curves, tilt, iris size; random draws a new one from the seed",
    options: [...Object.keys(SHAPES), "random"],
    default: "human",
    pool: [...Object.keys(SHAPES), "random", "random"],
  },
  expr: {
    kind: "select",
    hint: "FACS expression the muscles hold; auto expressions drift away from it and back",
    options: Object.keys(EXPR),
    default: "neutral",
    label: "expression",
  },
  lash: {
    kind: "select",
    hint: "where lashes root: one per seal ray, one per ray times k, equal arc length, or none",
    options: ["slots", "slots×k", "arclen", "none"],
    default: "slots",
    pool: ["slots", "slots×k", "arclen"],
    label: "lashes",
  },
  segs: {
    kind: "range",
    hint: "polyline samples per lid; low values show facets",
    min: 8,
    max: 160,
    default: 96,
    roll: [24, 160],
    group: "lids",
  },
  lag: {
    kind: "range",
    hint: "how much of the nasal lag reaches the lid margin: 0 = closes as one line, 1 = the full temporal-to-nasal tilt",
    min: 0,
    max: 1,
    step: 0.05,
    default: 1,
    label: "tilt",
    group: "lids",
  },
  pop: {
    kind: "range",
    hint: "settle above rest at the end of an opening, as a fraction of the aperture; capped at 3%",
    min: 0,
    max: 0.03,
    step: 0.001,
    default: 0.03,
    label: "settle",
    group: "lids",
  },
  auto: {
    kind: "bool",
    hint: "the scheduler plays random expressions with per-muscle ease; off holds the chosen one",
    default: true,
    p: 0.8,
    label: "auto expressions",
  },
  dress: { kind: "bool", hint: "crease, lower-lid shadow, brow and crow's feet", default: true, static: true },
  weight: {
    kind: "range",
    hint: "stroke width multiplier for every path in the section",
    min: 0.5,
    max: 2.5,
    step: 0.1,
    default: 1,
    static: true,
  },
  tempo: {
    kind: "range",
    hint: "clock speed multiplier for the whole schedule",
    min: 0.25,
    max: 3,
    step: 0.05,
    default: 1,
    static: true,
  },
  run: { kind: "bool", hint: "advance the clock; off freezes at the scrubbed time", default: true, static: true },
} as const satisfies AnySpec
type V = ValuesOf<typeof SPEC>
const SIZES = [16, 24, 32, 48, 64, 96, 160]

// the scheduler's timing table as a bar; every key of TIMING is a knob, so the section is the module's test rig
const T_SPEC = {
  close: {
    kind: "range",
    hint: "full-amplitude closing time in ms, jittered 20% per blink; peak velocity near 35% of the phase",
    min: 40,
    max: 300,
    step: 5,
    default: TIMING.close,
    group: "blink",
  },
  open: {
    kind: "range",
    hint: "full-amplitude opening time in ms, jittered 25% per blink; peak velocity near 10%",
    min: 60,
    max: 500,
    step: 5,
    default: TIMING.open,
    group: "blink",
  },
  settle: {
    kind: "range",
    hint: "small settle above rest after opening, in ms; 0 = none",
    min: 0,
    max: 400,
    step: 10,
    default: TIMING.settle,
    group: "blink",
  },
  lagMs: {
    kind: "range",
    hint: "temporal-to-nasal closure delay across the lid margin, in ms; 15 is human",
    min: 0,
    max: 40,
    step: 1,
    default: TIMING.lagMs,
    label: "nasal lag",
    group: "blink",
  },
  bellLag: {
    kind: "range",
    hint: "the globe trails the lid on reopening by this many ms (Bell's roll)",
    min: 0,
    max: 150,
    step: 5,
    default: TIMING.bellLag,
    label: "bell lag",
    group: "blink",
  },
  ibiMean: {
    kind: "range",
    hint: "mean onset-to-onset interval between blinks in ms; right-skewed: floor + exponential tail",
    min: 1500,
    max: 10000,
    step: 100,
    default: TIMING.ibiMean,
    label: "ibi",
    group: "rhythm",
  },
  ibiFloor: {
    kind: "range",
    hint: "shortest interval between blinks, in ms",
    min: 500,
    max: 3000,
    step: 50,
    default: TIMING.ibiFloor,
    label: "floor",
    group: "rhythm",
  },
  doubleP: {
    kind: "range",
    hint: "fraction of blinks followed by a smaller second blink",
    min: 0,
    max: 1,
    step: 0.05,
    default: TIMING.doubleP,
    label: "double",
    group: "rhythm",
  },
  doubleGap: {
    kind: "range",
    hint: "gap before the second blink of a double, in ms, jittered 0.4..1x",
    min: 40,
    max: 400,
    step: 10,
    default: TIMING.doubleGap,
    label: "gap",
    group: "rhythm",
  },
  drowsyP: {
    kind: "range",
    hint: "fraction of blinks that become a slow half-close; only when levator tone is already low",
    min: 0,
    max: 1,
    step: 0.02,
    default: TIMING.drowsyP,
    label: "drowsy",
    group: "rhythm",
  },
  coupleP: {
    kind: "range",
    hint: "fraction of blinks that ride a gaze shift",
    min: 0,
    max: 1,
    step: 0.05,
    default: TIMING.coupleP,
    label: "couple",
    group: "gaze",
  },
  saccade: {
    kind: "range",
    hint: "gaze jump duration in ms, jittered 33%",
    min: 15,
    max: 120,
    step: 5,
    default: TIMING.saccade,
    group: "gaze",
  },
  glanceMean: {
    kind: "range",
    hint: "mean interval between free glances, in ms",
    min: 900,
    max: 5000,
    step: 100,
    default: TIMING.glanceMean,
    label: "glance",
    group: "gaze",
  },
  wake: {
    kind: "range",
    hint: "levator wake-up ramp in ms, with two sags the lid catches up from; re-wake replays it",
    min: 300,
    max: 3000,
    step: 50,
    default: TIMING.wake,
  },
} as const satisfies Record<keyof Timing, AnySpec[string]>
type TV = ValuesOf<typeof T_SPEC>
const T_PRESETS = {
  defaults: { ...TIMING },
  nervous: { ibiMean: 2000, doubleP: 0.4, coupleP: 0.6, glanceMean: 1000, saccade: 30 },
  calm: { ibiMean: 7000, doubleP: 0.05, drowsyP: 0.15, glanceMean: 3200 },
  "slow-mo": { close: 300, open: 500, settle: 400, lagMs: 40, bellLag: 150, wake: 3000 },
}
const timingState = () => sectionState("eye", "timing", T_SPEC, T_PRESETS)

// the bar sliders add to the expression's tone (they start at 0 and reset on an expression change)
const withSliders = (au: Au): Au => {
  const out: Au = { ...au }
  for (const e of document.querySelectorAll<HTMLInputElement>("[data-au]")) {
    const k = e.dataset.au as string
    out[k] = Math.min(1, (out[k] ?? 0) + Number(e.value))
  }
  return out
}
const clearSliders = () => {
  for (const e of document.querySelectorAll<HTMLInputElement>("[data-au]")) e.value = "0"
}

type Reg = RefObject<Eye[]>
type CellProps = {
  W: number
  H: number
  seed: number
  sh: Shape
  k: V
  tm: Timing
  caption: string
  fixedAu?: Au | null
  hero?: boolean
  reg: Reg
}

function EyeCell({ W, H, seed, sh, k, tm, caption, fixedAu = null, hero = false, reg }: CellProps) {
  const ref = useRef<HTMLDivElement>(null)
  const tmKey = JSON.stringify(tm)
  // biome-ignore lint/correctness/useExhaustiveDependencies: tm is read through tmKey
  useEffect(() => {
    const host = ref.current
    if (!host) return
    const built = eyeSvg(W, H, seed, sh, k.lash)
    host.innerHTML = `${built.svg}<span>${caption} · ${built.caption}</span>`
    const el = host.querySelector("svg") as SVGSVGElement
    let i = 0
    for (const p of el.querySelectorAll<SVGElement>(".seal path")) p.style.setProperty("--i", String(i++))
    const e: Eye = {
      el,
      slots: built.slots,
      lashLen: built.lashLen,
      k: { sh, N: Math.max(8, Math.round(k.segs * Math.min(1, W / 240))), lag: k.lag, pop: k.pop, dress: k.dress },
      fixedAu,
      hero,
      sch: scheduler(seed, k.tempo, k.auto, tm),
      last: "",
    }
    pose(e, { ...EXPR.neutral, AU45: 1 })
    reg.current.push(e)
    return () => {
      const at = reg.current.indexOf(e)
      if (at >= 0) reg.current.splice(at, 1)
    }
  }, [W, H, seed, sh, k.lash, k.segs, k.lag, k.pop, k.dress, k.tempo, k.auto, tmKey, caption, fixedAu, hero, reg])
  return <div ref={ref} className="cell grid justify-items-center gap-1 text-[10px] text-muted" />
}

type Panels = {
  stats: RefObject<HTMLSpanElement | null>
  scrub: RefObject<HTMLInputElement | null>
  tms: RefObject<HTMLSpanElement | null>
  drives: RefObject<HTMLDivElement | null>
  log: RefObject<HTMLDivElement | null>
  ctl: RefObject<Ctl | null>
}

const bar = (v: number) => "█".repeat(Math.round(Math.min(1, Math.max(0, v)) * 20)).padEnd(20, "·")

function EyeBody({ v, tm, p }: { v: V; tm: Timing; p: Panels }) {
  const reg = useRef<Eye[]>([])
  const lines = useRef<string[]>([])
  const forced = useRef<number | null>(null)
  const sh = v.shape === "random" ? randomShape(mulberry32(v.seed ^ 0x51ed27)) : SHAPES[v.shape]
  const names = Object.keys(EXPR)

  useEffect(() => {
    document.documentElement.style.setProperty("--w", String(v.weight))
  }, [v.weight])
  useEffect(() => {
    lines.current = []
    if (p.log.current) p.log.current.textContent = ""
  }, [p.log])

  const clk = useClock(elapsed => {
    const eyes = reg.current
    if (!eyes.length) return
    const base: Au = withSliders(EXPR[v.expr])
    const hero = eyes.find(e => e.hero)
    if (p.stats.current && hero)
      p.stats.current.textContent = `${eyes.length} eyes · ${hero.k.N} segs/lid · cycle ${Math.round(hero.sch.T / 1000)}s`
    // forced blink rides on top of whatever the schedule says, max-merged per drive
    const fb = forced.current === null ? null : blinkAt(tm, elapsed - forced.current)
    if (forced.current !== null && fb === null && elapsed - forced.current >= 0) forced.current = null
    const layer = (au: Au): Au =>
      fb
        ? {
            ...au,
            AU45: Math.max(au.AU45 ?? 0, fb.AU45),
            AU45n: Math.max(au.AU45n ?? 0, fb.AU45n),
            AU45b: Math.max(au.AU45b ?? 0, fb.AU45b),
          }
        : au
    for (const e of eyes) {
      const q = e.sch.at(elapsed, e.fixedAu ?? base)
      if (e.fixedAu) {
        // held expression: only the closure drives come from the schedule, so tilt and Bell's roll still play
        pose(e, layer({ ...e.fixedAu, AU45: q.au.AU45, AU45n: q.au.AU45n, AU45b: q.au.AU45b }))
        continue
      }
      const au = layer(q.au)
      pose(e, au, q.gaze, q.dil)
      if (!e.hero) continue
      const what = fb ? "forced" : q.what
      if (p.tms.current) p.tms.current.textContent = `${Math.round(q.tt)} ms`
      if (p.drives.current)
        p.drives.current.textContent = [
          `t ${String(Math.round(q.tt)).padStart(6)} ms   ${what}`,
          ...Object.keys(AU).map(
            k => `${k.padEnd(5)} ${AU[k].padEnd(13)} ${bar(au[k] ?? 0)} ${(au[k] ?? 0).toFixed(3)}`,
          ),
          `AU45n nasal         ${bar(au.AU45n ?? 0)} ${(au.AU45n ?? 0).toFixed(3)}   tilt ${((au.AU45 ?? 0) - (au.AU45n ?? 0)).toFixed(3)}`,
          `AU45b bell          ${bar(au.AU45b ?? 0)} ${(au.AU45b ?? 0).toFixed(3)}`,
          `gaze (${q.gaze.x.toFixed(3)}, ${q.gaze.y.toFixed(3)})   pupil ${q.dil.toFixed(3)}`,
        ].join("\n")
      if (what !== e.last) {
        e.last = what
        lines.current.push(
          `${String(Math.round(q.tt)).padStart(6)}  ${what.padEnd(9)} gaze=(${q.gaze.x.toFixed(2)},${q.gaze.y.toFixed(2)}) dil=${q.dil.toFixed(3)}`,
        )
        if (lines.current.length > 200) lines.current.shift()
        if (p.log.current) {
          p.log.current.textContent = lines.current.join("\n")
          p.log.current.scrollTop = 1e9
        }
      }
    }
  })
  useEffect(() => {
    clk.run(v.run)
  }, [clk, v.run])
  useEffect(() => {
    const input = p.scrub.current
    if (!input) return
    clk.bindScrub(input, () => (reg.current.find(e => e.hero)?.sch.T ?? 1000) / v.tempo)
  }, [clk, p.scrub, v.tempo])
  useEffect(() => {
    p.ctl.current = {
      blink: () => {
        forced.current = clk.elapsed()
      },
      rewake: () => clk.reset(),
    }
  }, [clk, p.ctl])

  return (
    <>
      <section>
        <h2 className="mb-2 font-medium text-muted">
          hero: rest anatomy from the shape, muscles deform it; blink = AU45 closure whose margin tilts temporal to
          nasal by the nasal lag; Bell's roll hides the seal under the lid; lashes rotate with the margin
        </h2>
        <div className="row flex flex-wrap items-end gap-5">
          <EyeCell
            W={280}
            H={Math.round(280 * sh.ratio)}
            seed={v.seed}
            sh={sh}
            k={v}
            tm={tm}
            caption={`hero ${v.shape}`}
            hero
            reg={reg}
          />
        </div>
      </section>
      <section>
        <h2 className="mb-2 font-medium text-muted">expressions: same shape, each AU preset held open</h2>
        <div className="row flex flex-wrap items-end gap-5">
          {names.map((n, i) => (
            <EyeCell
              key={n}
              W={120}
              H={Math.round(120 * sh.ratio)}
              seed={v.seed + 31 * i}
              sh={sh}
              k={v}
              tm={tm}
              caption={n}
              fixedAu={EXPR[n]}
              reg={reg}
            />
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-2 font-medium text-muted">sizes 16..160</h2>
        <div className="row flex flex-wrap items-end gap-5">
          {SIZES.map((W, i) => (
            <EyeCell
              key={W}
              W={W}
              H={Math.max(6, Math.round(W * sh.ratio))}
              seed={v.seed + i * 7919}
              sh={sh}
              k={v}
              tm={tm}
              caption={`${W}`}
              reg={reg}
            />
          ))}
        </div>
      </section>
    </>
  )
}

const MONO = "rounded-md bg-well p-2 font-mono text-[11px] text-muted leading-normal whitespace-pre"
const BTN = "rounded-sm border border-edge px-1.5 py-px text-fg hover:border-ink"

function EyePage() {
  const p: Panels = {
    stats: useRef<HTMLSpanElement>(null),
    scrub: useRef<HTMLInputElement>(null),
    tms: useRef<HTMLSpanElement>(null),
    drives: useRef<HTMLDivElement>(null),
    log: useRef<HTMLDivElement>(null),
    ctl: useRef<Ctl>(null),
  }
  const muscles = (
    <>
      <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {Object.keys(AU)
          .filter(k => k !== "AU45")
          .map(k => (
            <label
              key={k}
              className="inline-flex items-center gap-1.5 text-[oklch(75%_0.12_200)]"
              title={`${k} ${AU[k]}: adds to the expression's tone, 0..1; resets when the expression changes; not saved`}
            >
              {k}
              <input
                data-au={k}
                type="range"
                min={0}
                max={1}
                step={0.01}
                defaultValue={0}
                className="w-16 accent-ink"
              />
            </label>
          ))}
      </span>
      <span ref={p.stats} />
    </>
  )
  const transport = (
    <>
      <button
        type="button"
        className={BTN}
        title="layer one full blink on the schedule right now, with the same nasal and Bell's lags"
        onClick={() => p.ctl.current?.blink()}
      >
        blink now
      </button>
      <button
        type="button"
        className={BTN}
        title="reset the clock to 0: the lids replay the wake-up ramp"
        onClick={() => p.ctl.current?.rewake()}
      >
        re-wake
      </button>
      <label
        className="inline-flex items-center gap-1.5"
        title="position in the hero's blink cycle; dragging pauses the clock"
      >
        scrub
        <input ref={p.scrub} className="w-60 accent-ink" type="range" min={0} max={100} step={0.05} defaultValue={0} />
      </label>
      <span ref={p.tms} className="font-mono text-[11px]" />
    </>
  )
  return (
    <>
      <Section page="eye" def={{ id: "eye", title: "eye", spec: SPEC }} extra={muscles}>
        {v => <Body v={v as V} tm={{ ...TIMING, ...(timingState().values.$() as TV) }} p={p} />}
      </Section>
      <Section page="eye" def={{ id: "timing", title: "timing", spec: T_SPEC, presets: T_PRESETS }} extra={transport}>
        {() => (
          <>
            <h2 className="font-medium text-muted">
              drives (hero): closure temporal / nasal / Bell's, muscle tone, gaze, pupil; log of scheduler events
            </h2>
            <div ref={p.drives} className={MONO} />
            <div ref={p.log} className={`${MONO} h-[150px] overflow-auto`} />
          </>
        )}
      </Section>
    </>
  )
}

// the sliders are shared muscle input, so an expression change zeroes them before the next frame reads them
function Body({ v, tm, p }: { v: V; tm: Timing; p: Panels }) {
  const expr = useRef(v.expr)
  if (expr.current !== v.expr) {
    expr.current = v.expr
    clearSliders()
  }
  return <EyeBody v={v} tm={tm} p={p} />
}

export const PAGE: PageSpec = {
  id: "eye",
  title: "gothic: eye, muscle model",
  path: "/eye",
  specs: { eye: SPEC, timing: T_SPEC },
  Component: EyePage,
}
