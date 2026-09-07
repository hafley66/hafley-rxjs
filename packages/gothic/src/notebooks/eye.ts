import { type AnySpec, type ValuesOf, clock, page, section } from "../kit/index.js"
import {
  type Rng,
  type Scene,
  TAU,
  type Pt,
  type SealSpec,
  clamp,
  ease,
  expo,
  f,
  line,
  mix,
  mulberry32,
  pick,
  pl,
  seal,
  sceneMarkup,
} from "../lib/index.js"
import { LINKS } from "./0_nav.js"
import "./eye.css"

/* ============ 1. Shape: rest anatomy in eye units (x in [-1,1], y in half-heights; -1 = nasal, +1 = temporal) ============
   lid(x) = base line from nasal corner (-1,0) to temporal corner (1,-tilt) plus bulge h*(1-|u|^p), apex at peak. */
type Curve = { h: number; p: number; peak: number }
export type Shape = { ratio: number; up: Curve; lo: Curve; tilt: number; iris: number }
export const SHAPES: Record<string, Shape> = {
  human: {
    ratio: 0.42,
    up: { h: 0.62, p: 1.6, peak: -0.12 },
    lo: { h: 0.4, p: 1.5, peak: 0.08 },
    tilt: 0.1,
    iris: 0.58,
  },
  shoujo: { ratio: 0.5, up: { h: 0.8, p: 1.7, peak: 0.05 }, lo: { h: 0.45, p: 1.5, peak: 0 }, tilt: 0.02, iris: 0.62 },
  shonen: {
    ratio: 0.38,
    up: { h: 0.55, p: 1.15, peak: -0.25 },
    lo: { h: 0.3, p: 1.1, peak: 0.1 },
    tilt: 0.16,
    iris: 0.5,
  },
  tsurime: {
    ratio: 0.42,
    up: { h: 0.6, p: 1.4, peak: -0.15 },
    lo: { h: 0.35, p: 1.3, peak: 0.15 },
    tilt: 0.28,
    iris: 0.55,
  },
  tareme: {
    ratio: 0.45,
    up: { h: 0.62, p: 1.6, peak: 0.1 },
    lo: { h: 0.4, p: 1.4, peak: -0.1 },
    tilt: -0.22,
    iris: 0.58,
  },
  jitome: { ratio: 0.34, up: { h: 0.3, p: 4, peak: 0 }, lo: { h: 0.4, p: 1.4, peak: 0 }, tilt: 0.04, iris: 0.62 },
  cat: { ratio: 0.4, up: { h: 0.6, p: 1, peak: -0.1 }, lo: { h: 0.4, p: 1, peak: 0.1 }, tilt: 0.14, iris: 0.48 },
  sanpaku: { ratio: 0.46, up: { h: 0.55, p: 1.5, peak: 0 }, lo: { h: 0.55, p: 1.3, peak: 0 }, tilt: 0, iris: 0.34 },
  gigantic: { ratio: 0.58, up: { h: 1, p: 2.2, peak: 0 }, lo: { h: 0.75, p: 1.9, peak: 0 }, tilt: 0.02, iris: 0.7 },
}
export function randomShape(rng: Rng): Shape {
  const r = (a: number, b: number) => a + rng() * (b - a)
  return {
    ratio: r(0.32, 0.6),
    up: { h: r(0.3, 1), p: r(1, 3.5), peak: r(-0.3, 0.2) },
    lo: { h: r(0.25, 0.75), p: r(1, 2.2), peak: r(-0.2, 0.2) },
    tilt: r(-0.25, 0.3),
    iris: r(0.34, 0.7),
  }
}
const bulge = (x: number, c: Curve) => {
  const u = (x - c.peak) / (x < c.peak ? 1 + c.peak : 1 - c.peak)
  return 1 - Math.abs(clamp(u, -1, 1)) ** c.p
}

/* ============ 2. Muscles: FACS action units 0..1 -> lid activations. AU5 levator raises the upper lid; AU45 closes with a temporal->nasal zip;
   AU7 tightens both lids; AU6 lifts the lower lid + lateral canthus; AU1/2 frontalis lifts + raises the crease; AU4 drops the medial lid; AU5L shows sclera below */
export const AU: Record<string, string> = {
  AU5: "levator",
  AU45: "blink",
  AU7: "tighten",
  AU6: "squint",
  AU2: "brow raise",
  AU4: "brow lower",
  AU5L: "lower retract",
}
export type Au = {
  AU5: number
  AU7: number
  AU6: number
  AU2: number
  AU4: number
  AU5L: number
  AU45?: number
} & Record<string, number | undefined>
export const EXPR: Record<string, Au> = {
  neutral: { AU5: 0.78, AU7: 0, AU6: 0, AU2: 0, AU4: 0, AU5L: 0 },
  alert: { AU5: 0.92, AU7: 0, AU6: 0, AU2: 0.35, AU4: 0, AU5L: 0.1 },
  surprise: { AU5: 1, AU7: 0, AU6: 0, AU2: 1, AU4: 0, AU5L: 0.7 },
  squint: { AU5: 0.7, AU7: 0.45, AU6: 0.85, AU2: 0, AU4: 0.2, AU5L: 0 },
  smile: { AU5: 0.75, AU7: 0.1, AU6: 0.6, AU2: 0.1, AU4: 0, AU5L: 0 },
  sleepy: { AU5: 0.22, AU7: 0.05, AU6: 0, AU2: 0, AU4: 0, AU5L: 0 },
  angry: { AU5: 0.82, AU7: 0.5, AU6: 0.2, AU2: 0, AU4: 0.9, AU5L: 0.1 },
  fear: { AU5: 1, AU7: 0.3, AU6: 0, AU2: 0.8, AU4: 0.4, AU5L: 0.5 },
  glare: { AU5: 0.6, AU7: 0.7, AU6: 0.3, AU2: 0, AU4: 0.6, AU5L: 0 },
}
// closure drive with the zip: AU45 reaches x at temporal side first. lag = zip width in x units
const zip = (au45: number, x: number, lag: number) => clamp(au45 * (1 + lag) - (lag * (1 - x)) / 2)
export function activate(au: Au, x: number, lag: number, pop: number) {
  const c = Math.max(zip(au.AU45 ?? 0, x, lag), au.AU7 * 0.25)
  const medial = (1 - x) / 2
  const lev = 0.35 + 0.8 * au.AU5 + 0.15 * au.AU2 - 0.3 * au.AU4 * medial - 0.15 * au.AU6
  const aUp = ease.back(clamp(lev - c, 0, 1.3) / 1.3, pop * (1 - c)) * 1.3
  const aLo = clamp(1 - c * 0.9 - 0.55 * au.AU6 - 0.2 * au.AU7 + 0.45 * au.AU5L, 0, 1.4)
  return { aUp, aLo, c }
}
// global deformations: width, canthus lift, apex nasal drift, Bell's roll
export function frame(au: Au) {
  const sq = au.AU6
  const bl = au.AU45 ?? 0
  return {
    wScale: 1 - 0.06 * sq - 0.03 * au.AU7,
    canthusLift: 0.06 * sq + 0.03 * au.AU2,
    apexShift: -0.06 * bl - 0.03 * au.AU7,
    bell: -0.35 * bl,
    browY: -0.35 * au.AU2 + 0.18 * au.AU4,
    browPinch: 0.25 * au.AU4,
  }
}
type Frame = ReturnType<typeof frame>

/* ============ 3. Lids: polylines from shape + activations ============ */
function lidPts(sh: Shape, W: number, H: number, au: Au, N: number, lag: number, pop: number) {
  const fr = frame(au)
  const up: Pt[] = []
  const lo: Pt[] = []
  const hh = H / 2
  const w = (W / 2) * fr.wScale
  for (let i = 0; i <= N; i++) {
    const x = -1 + (2 * i) / N
    const a = activate(au, x, lag, pop)
    const base = (-(sh.tilt + fr.canthusLift) * hh * (x + 1)) / 2
    const rest = base + 0.3 * sh.lo.h * hh * bulge(x, sh.lo)
    const openUp = base - sh.up.h * hh * bulge(x, { ...sh.up, peak: sh.up.peak + fr.apexShift })
    const openLo = base + sh.lo.h * hh * bulge(x, sh.lo)
    up.push([x * w, mix(rest, openUp, a.aUp)])
    lo.push([x * w, mix(rest, openLo, a.aLo)])
  }
  return { up, lo, fr }
}

/* ============ 4. Dress: crease, lower shadow, brow, crow's feet, lashes ============ */
type Slot = { a: number; long: boolean }
function lashSlots(mode: string, s: SealSpec): Slot[] {
  if (mode === "none") return []
  const k = mode === "slots" ? s.n : mode === "slots×k" ? s.n * s.k : 9
  const out: Slot[] = []
  for (let i = 0; i < k; i++) {
    const a = mode === "arclen" ? (-Math.PI * (i + 1)) / (k + 1) : s.rot + (i * TAU) / k
    const m = ((a % TAU) + TAU) % TAU
    if (m > Math.PI + 0.12 && m < TAU - 0.12) out.push({ a: m - TAU, long: mode !== "slots×k" || i % s.k === 0 })
  }
  return out.sort((p, q) => p.a - q.a)
}
type Knobs = { sh: Shape; N: number; lag: number; pop: number; dress: boolean }
type Eye = {
  el: SVGSVGElement
  k: Knobs
  slots: Slot[]
  lashLen: number
  fixedAu: Au | null
  sch: Scheduler
  last: string
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
function lashes(e: Eye, up: Pt[], N: number, yc: number, aUpMean: number) {
  const ps = e.el.querySelectorAll(".lashes path")
  e.slots.forEach(({ a, long }, i) => {
    let best = 0
    let bd = 9
    for (let j = 0; j < up.length; j++) {
      const da = Math.abs(Math.atan2(up[j][1] - yc, up[j][0]) - a)
      if (da < bd) {
        bd = da
        best = j
      }
    }
    const [x0, y0] = up[best]
    const len = e.lashLen * (long ? 1 : 0.55) * (0.2 + 0.8 * aUpMean)
    const j1 = Math.min(best + 1, N)
    const j0 = Math.max(best - 1, 0)
    const nx = -(up[j1][1] - up[j0][1])
    const ny = up[j1][0] - up[j0][0]
    const nl = Math.hypot(nx, ny) || 1
    ps[i].setAttribute(
      "d",
      line(
        x0,
        y0,
        x0 + ((nx / nl) * 0.5 + Math.cos(a) * 0.5) * len,
        y0 + ((ny / nl) * 0.5 + Math.sin(a) * 0.5 * aUpMean + (1 - aUpMean) * 0.4) * len,
      ),
    )
  })
}

/* ============ 5. Eye: markup once, pose per frame ============ */
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
  const aUpMean = activate(au, 0, lag, pop).aUp
  dress(e, sh, W, H, au, up, lo, fr, N)
  lashes(e, up, N, yc, aUpMean)
}

/* ============ 6. Scheduler: blink close 70..110ms ease-in, open 160..260ms ease-out, interblink 1.5s + exp(2.5s), 18% doubles at +120ms, 6% drowsy 900ms.
   glances every .8..2.5s, saccade 220ms. expressions every 4..9s, 600ms in, hold, 900ms out. */
type Seg = { t0: number; t1: number; from: number; to: number; e: "in" | "out"; what: string }
type Scheduler = {
  T: number
  at(ms: number, base: Au): { au: Au; what: string; gaze: { x: number; y: number }; dil: number; tt: number }
}
function scheduler(seed: number, tempo: number, auto: boolean): Scheduler {
  const rng = mulberry32(seed)
  const exp = (mean: number) => expo(rng, mean)
  const blinks: Seg[] = [{ t0: 0, t1: 900, from: 1, to: 0, e: "out", what: "open" }]
  const glances = [{ t: 0, x: 0, y: 0 }]
  const exprs: { t0: number; t1: number; hold: number; name: string }[] = []
  let t = 900
  let tg = 600
  let te = 2500
  while (t < 120000) {
    t += 1500 + exp(2500)
    const drowsy = rng() < 0.06
    const close = drowsy ? 900 : 70 + rng() * 40
    const open = drowsy ? 700 : 160 + rng() * 100
    const depth = drowsy ? 0.6 : 1
    blinks.push(
      { t0: t, t1: t + close, from: 0, to: depth, e: "in", what: drowsy ? "drowsy" : "blink" },
      { t0: t + close, t1: t + close + open, from: depth, to: 0, e: "out", what: "reopen" },
    )
    t += close + open
    if (!drowsy && rng() < 0.18) {
      const c2 = 60 + rng() * 30
      const o2 = 140 + rng() * 80
      blinks.push(
        { t0: t + 120, t1: t + 120 + c2, from: 0, to: 1, e: "in", what: "double" },
        { t0: t + 120 + c2, t1: t + 120 + c2 + o2, from: 1, to: 0, e: "out", what: "reopen" },
      )
      t += 120 + c2 + o2
    }
  }
  while (tg < 120000) {
    tg += 800 + exp(1200)
    glances.push({ t: tg, x: (rng() * 2 - 1) * 0.8, y: (rng() * 2 - 1) * 0.35 })
  }
  while (te < 120000) {
    const name = pick(
      rng,
      Object.keys(EXPR).filter(n => n !== "neutral"),
    )
    const hold = 1200 + exp(1500)
    exprs.push({ t0: te, t1: te + 600 + hold + 900, hold, name })
    te += 600 + hold + 900 + 4000 + exp(5000)
  }
  const T = blinks[blinks.length - 1].t1
  const seg = (list: Seg[], tt: number) => {
    let v = 0
    let what = "open"
    for (const s of list) {
      if (tt >= s.t0 && tt < s.t1) {
        v = s.from + (s.to - s.from) * ease[s.e]((tt - s.t0) / (s.t1 - s.t0))
        what = s.what
        break
      }
      if (tt >= s.t1) v = s.to
    }
    return { v, what }
  }
  return {
    T,
    at(ms, base) {
      const tt = (ms * tempo) % T
      const b = seg(blinks, tt)
      let gi = 0
      while (gi + 1 < glances.length && glances[gi + 1].t <= tt) gi++
      const g0 = glances[gi]
      const gp = glances[gi - 1] ?? g0
      const k = ease.io(clamp((tt - g0.t) / 220))
      const au: Au = { ...base, AU45: b.v }
      const what = b.what
      let expr = "neutral"
      if (auto)
        for (const e of exprs)
          if (tt >= e.t0 && tt < e.t1) {
            const w =
              tt < e.t0 + 600
                ? ease.io((tt - e.t0) / 600)
                : tt < e.t0 + 600 + e.hold
                  ? 1
                  : 1 - ease.io((tt - e.t0 - 600 - e.hold) / 900)
            for (const key in EXPR[e.name]) au[key] = mix(base[key] ?? 0, EXPR[e.name][key] ?? 0, w)
            expr = e.name
            break
          }
      return {
        au,
        what: what === "open" ? expr : what,
        gaze: { x: mix(gp.x, g0.x, k), y: mix(gp.y, g0.y, k) },
        dil: 0.96 + 0.06 * Math.sin(tt / 1900) + 0.03 * Math.sin(tt / 610),
        tt,
      }
    },
  }
}

/* ============ 7. Page ============ */
const SPEC = {
  seed: { kind: "seed", default: 3 },
  shape: {
    kind: "select",
    options: [...Object.keys(SHAPES), "random"],
    default: "human",
    pool: [...Object.keys(SHAPES), "random", "random"],
  },
  expr: { kind: "select", options: Object.keys(EXPR), default: "neutral", label: "expression" },
  lash: {
    kind: "select",
    options: ["slots", "slots×k", "arclen", "none"],
    default: "slots",
    pool: ["slots", "slots×k", "arclen"],
    label: "lashes",
  },
  segs: { kind: "range", min: 8, max: 160, default: 96, roll: [24, 160], group: "lids" },
  lag: { kind: "range", min: 0, max: 1.5, step: 0.05, default: 0.5, label: "zip", group: "lids" },
  pop: { kind: "range", min: 0, max: 1, step: 0.05, default: 0.15, roll: [0, 0.6], group: "lids" },
  auto: { kind: "bool", default: true, p: 0.8, label: "auto expressions" },
  dress: { kind: "bool", default: true, static: true },
  weight: { kind: "range", min: 0.5, max: 2.5, step: 0.1, default: 1, static: true },
  tempo: { kind: "range", min: 0.25, max: 3, step: 0.05, default: 1, static: true },
  run: { kind: "bool", default: true, static: true },
} as const satisfies AnySpec
type V = ValuesOf<typeof SPEC>
const SIZES = [16, 24, 32, 48, 64, 96, 160]
const eyes: Eye[] = []
let lines: string[] = []
let auEl: HTMLElement
let logEl: HTMLElement
let statsEl: HTMLElement

const auSliders = (): Record<string, number> =>
  Object.fromEntries(
    [...document.querySelectorAll<HTMLInputElement>("[data-au]")].map(e => [e.dataset.au as string, Number(e.value)]),
  )
const setSliders = (au: Record<string, number>) => {
  for (const e of document.querySelectorAll<HTMLInputElement>("[data-au]"))
    e.value = String(au[e.dataset.au as string] ?? 0)
}
function mountEye(
  host: HTMLElement,
  W: number,
  H: number,
  seed: number,
  sh: Shape,
  k: V,
  caption: string,
  fixedAu: Au | null = null,
): Eye {
  const e = eyeSvg(W, H, seed, sh, k.lash)
  host.innerHTML = `${e.svg}<span>${caption} · ${e.caption}</span>`
  const el = host.querySelector("svg") as SVGSVGElement
  let i = 0
  for (const p of el.querySelectorAll<SVGElement>(".seal path")) p.style.setProperty("--i", String(i++))
  const eye: Eye = {
    el,
    slots: e.slots,
    lashLen: e.lashLen,
    k: { sh, N: Math.max(8, Math.round(k.segs * Math.min(1, W / 240))), lag: k.lag, pop: k.pop, dress: k.dress },
    fixedAu,
    sch: scheduler(seed, k.tempo, k.auto),
    last: "",
  }
  pose(eye, { ...EXPR.neutral, AU45: 1 })
  return eye
}
const clk = clock(now => tick(now))
function render(k: V, host: HTMLElement) {
  document.documentElement.style.setProperty("--w", String(k.weight))
  const sh = k.shape === "random" ? randomShape(mulberry32(k.seed ^ 0x51ed27)) : SHAPES[k.shape]
  eyes.length = 0
  host.innerHTML = `<section><h2>hero: rest anatomy from the shape, muscles deform it; blink = AU45 drive with a temporal→nasal zip; Bell's roll hides the seal under the lid</h2><div class="row hero"></div></section>
<section><h2>expressions: same shape, each AU preset held open</h2><div class="row exprs"></div></section>
<section><h2>sizes 16..160</h2><div class="row sizes"></div></section>
<section><h2>muscle state (hero) and scheduler log: t ms · event · AUs</h2><div class="mono au"></div><div class="mono log"></div></section>`
  auEl = host.querySelector(".au") as HTMLElement
  logEl = host.querySelector(".log") as HTMLElement
  const $ = (s: string) => host.querySelector(s) as HTMLElement
  $(".hero").innerHTML = '<div class="cell"></div>'
  eyes.push(mountEye($(".hero .cell"), 280, Math.round(280 * sh.ratio), k.seed, sh, k, `hero ${k.shape}`))
  const names = Object.keys(EXPR)
  $(".exprs").innerHTML = names.map(() => '<div class="cell"></div>').join("")
  names.forEach((n, i) => {
    eyes.push(
      mountEye(
        $(".exprs").children[i] as HTMLElement,
        120,
        Math.round(120 * sh.ratio),
        k.seed + 31 * i,
        sh,
        k,
        n,
        EXPR[n],
      ),
    )
  })
  $(".sizes").innerHTML = SIZES.map(() => '<div class="cell"></div>').join("")
  SIZES.forEach((W, i) => {
    eyes.push(
      mountEye(
        $(".sizes").children[i] as HTMLElement,
        W,
        Math.max(6, Math.round(W * sh.ratio)),
        k.seed + i * 7919,
        sh,
        k,
        `${W}`,
      ),
    )
  })
  logEl.textContent = ""
  lines = []
  clk.reset()
  statsEl.textContent = `${eyes.length} eyes · ${eyes[0].k.N} segs/lid · cycle ${Math.round(eyes[0].sch.T / 1000)}s`
}
function tick(elapsed: number) {
  if (!eyes.length) return
  const v = sec.values.$()
  const run = v.run
  const base: Au = { ...EXPR[v.expr], ...auSliders() }
  eyes.forEach((e, i) => {
    if (e.fixedAu) {
      pose(e, { ...e.fixedAu, AU45: run ? e.sch.at(elapsed, e.fixedAu).au.AU45 : 0 })
      return
    }
    if (!run) {
      pose(e, { ...base, AU45: 0 })
      return
    }
    const p = e.sch.at(elapsed, base)
    pose(e, p.au, p.gaze, p.dil)
    if (i === 0) {
      auEl.textContent = Object.keys(AU)
        .map(
          k =>
            `${k} ${AU[k].padEnd(13)} ${"█".repeat(Math.round((p.au[k] ?? 0) * 20)).padEnd(20, "·")} ${(p.au[k] ?? 0).toFixed(2)}`,
        )
        .join("\n")
      if (p.what !== e.last) {
        e.last = p.what
        lines.push(
          `${String(Math.round(p.tt)).padStart(6)}  ${p.what.padEnd(9)} gaze=(${p.gaze.x.toFixed(2)},${p.gaze.y.toFixed(2)}) dil=${p.dil.toFixed(3)}`,
        )
        if (lines.length > 200) lines.shift()
        logEl.textContent = lines.join("\n")
        logEl.scrollTop = 1e9
      }
    }
  })
}

page({ id: "eye", title: "gothic: eye, muscle model", links: LINKS })
const sec = section({
  id: "eye",
  title: "eye",
  spec: SPEC,
  render(v, host, ctx) {
    if (ctx.first) {
      ctx.extra.innerHTML = `<span class="aus">${Object.keys(AU)
        .filter(k => k !== "AU45")
        .map(
          k =>
            `<label class="au" title="${AU[k]}">${k} <input data-au="${k}" type="range" min="0" max="1" step=".01" value="0"></label>`,
        )
        .join("")}</span><span class="stats"></span>`
      statsEl = ctx.extra.querySelector(".stats") as HTMLElement
    }
    if (ctx.changed.has("expr")) setSliders({})
    const light = [...ctx.changed].every(k => k === "expr" || k === "run")
    if (!ctx.first && light) return
    render(v, host)
  },
})
Object.assign(window, { eyeSvg, seal, scheduler, pose, eyes, SHAPES, EXPR, AU, activate, frame, randomShape })
