import { type AnySpec, type ValuesOf, clock, page, reducedMotion, section } from "../kit/index.js"
import {
  L,
  M,
  type Part,
  type Pt,
  TAU,
  backOut,
  clamp01,
  f,
  line,
  colored,
  gammaV,
  gauss,
  mulberry32,
  pl,
  polar,
  poly,
  seal,
} from "../lib/index.js"
import { hilbertIndex } from "../algos/1_fractal.js"
import { Spring } from "animejs"
import { LINKS, hrefFor } from "./0_nav.js"
import "./slice.css"

export function polyShape(R: number): Part[] {
  const star = Array.from({ length: 5 }, (_, i) => polar(R * 0.92, -Math.PI / 2 + (i * TAU * 2) / 5))
  const out: Part[] = [{ d: poly(star), cls: "" }]
  let zig = ""
  for (let i = 0; i <= 24; i++) zig += (i ? L : M)(-R + (2 * R * i) / 24, R * 0.3 * (i % 2 ? 1 : -1))
  let sp = ""
  for (let i = 0; i <= 200; i++) {
    const [x, y] = polar(R * 0.12 + (R * 0.46 * i) / 200, (i / 200) * TAU * 3)
    sp += (i ? L : M)(x, y)
  }
  return out.concat([
    { d: zig, cls: "" },
    { d: sp, cls: "" },
  ])
}

/* ============ 1. segmentation: subpath split, then equal arc-length cuts sampled into polylines ============ */
const gaugeSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
gaugeSvg.id = "gauge"
gaugeSvg.innerHTML = "<path/>"
document.body.append(gaugeSvg)
const gauge = gaugeSvg.querySelector("path") as SVGPathElement
const subpaths = (d: string) => d.split(/(?=M)/).filter(s => /[LA]/.test(s))
function cut(d: string, maxLen: number): Pt[][] {
  gauge.setAttribute("d", d)
  const Ln = gauge.getTotalLength()
  if (!(Ln > 0)) return []
  const n = Math.max(1, Math.ceil(Ln / maxLen))
  const out: Pt[][] = []
  for (let i = 0; i < n; i++) {
    const a = (Ln * i) / n
    const b = (Ln * (i + 1)) / n
    const m = Math.max(2, Math.min(40, Math.ceil((b - a) / 3)))
    const pts: Pt[] = []
    for (let j = 0; j <= m; j++) {
      const p = gauge.getPointAtLength(a + ((b - a) * j) / m)
      pts.push([p.x, p.y])
    }
    out.push(pts)
  }
  return out
}
type Stroke = {
  d: string
  pts: Pt[]
  th: number
  cx: number
  cy: number
  diag: number
  size: number
  D: number
  noise: number
  sub: number
  rev: boolean
  t0: number
  dur: number
  i: number
  el: SVGPathElement
  ai: SVGPathElement
  bl: SVGPathElement
  _op?: number
  _bd?: string
  _dash?: number | null
  _tr?: string | null
  _w?: number | null
  _ao?: number | null
}
function strokesOf(parts: Part[], k: V, seed: number, size: number): Stroke[] {
  const rng = mulberry32(seed ^ 0x5bf03635)
  const maxLen = Math.max(6, (k.cut * size) / 240)
  const out: Stroke[] = []
  let sub = 0
  for (const p of parts)
    for (const sd of subpaths(p.d)) {
      sub++
      for (const pts of cut(sd, maxLen)) {
        let x0 = 1e9
        let y0 = 1e9
        let x1 = -1e9
        let y1 = -1e9
        let sx = 0
        let sy = 0
        for (const [x, y] of pts) {
          x0 = Math.min(x0, x)
          y0 = Math.min(y0, y)
          x1 = Math.max(x1, x)
          y1 = Math.max(y1, y)
          sx += x
          sy += y
        }
        const [ax, ay] = pts[0]
        const [bx, by] = pts[pts.length - 1]
        const chord = Math.hypot(bx - ax, by - ay) || size * 0.05
        // travel along the stroke's own chord, entering from a seeded end
        const th =
          Math.atan2(by - ay, bx - ax) + (rng() < 0.5 ? Math.PI : 0) + ((rng() * 2 - 1) * k.jit * Math.PI) / 180
        out.push({
          d: pl(pts),
          pts,
          th,
          cx: sx / pts.length,
          cy: sy / pts.length,
          diag: Math.hypot(x1 - x0, y1 - y0) || size * 0.05,
          size,
          D: k.dist * chord,
          noise: rng(),
          sub,
          rev: rng() < 0.5,
          t0: 0,
          dur: 0,
          i: 0,
        } as Stroke)
      }
    }
  return out
}

/* ============ 2. schedule: rank strokes by an order rule, then start_i = spread * curve(rank / (n-1)) ============
   spread 0 = all at once. steps quantizes the curve into k.burst landings. every rule is a pure function of stroke geometry + seed. */
type Rng = () => number
const zscore = (a: number[]) => {
  const m = a.reduce((x, y) => x + y, 0) / a.length
  const sd = Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length) || 1
  return a.map(v => (v - m) / sd)
}
// stochastic curves yield n positive gaps; the curve is their normalised cumulative sum, so it is monotone by construction
type Gap = (n: number, rng: Rng, N: number, g: number) => number[]
const GAPS: Record<string, Gap> = {
  white: (n, rng) => Array.from({ length: n }, () => rng() + 0.02),
  "smooth-N": (n, rng, N, g) => {
    let z = Array.from({ length: n }, () => gauss(rng))
    for (let o = 0; o < Math.round(N); o++) {
      let acc = 0
      z = zscore(
        z.map(v => {
          acc += v
          return acc
        }),
      )
    }
    return z.map(v => Math.exp(g * v))
  },
  fourier: (n, rng, beta, g) => {
    const K = 24
    const ph = Array.from({ length: K }, () => rng() * TAU)
    return zscore(
      Array.from({ length: n }, (_, i) => {
        let v = 0
        for (let k = 1; k <= K; k++) v += Math.cos((TAU * k * i) / n + ph[k - 1]) / k ** (beta / 2)
        return v
      }),
    ).map(v => Math.exp(g * v))
  },
  logistic: (n, rng, _N, g) => {
    const r = 3.57 + 0.43 * clamp01(g / 4)
    let x = 0.1 + rng() * 0.8
    const out: number[] = []
    for (let i = 0; i < n + 50; i++) {
      x = r * x * (1 - x)
      if (i >= 50) out.push(x + 0.02)
    }
    return out
  },
  lorenz: (n, rng, N, g) => {
    let x = 1 + rng()
    let y = 1
    let z = 20
    const out: number[] = []
    const dt = 0.01 * (0.5 + N / 4)
    for (let i = 0; i < n * 4 + 400; i++) {
      const dx = 10 * (y - x)
      const dy = x * (28 - z) - y
      const dz = x * y - (8 / 3) * z
      x += dx * dt
      y += dy * dt
      z += dz * dt
      if (i >= 400 && i % 4 === 0) out.push(x)
    }
    return zscore(out).map(v => Math.exp((g * v) / 2))
  },
  poisson: (n, rng) => Array.from({ length: n }, () => -Math.log(1 - rng())),
  pink: (n, rng, N, g) => zscore(colored("pink", n, rng, Math.round(N) + 2)).map(v => Math.exp(g * v)),
  red: (n, rng, N, g) => zscore(colored("red", n, rng, Math.round(N) + 2)).map(v => Math.exp(g * v)),
  blue: (n, rng, N, g) => zscore(colored("blue", n, rng, Math.round(N) + 2)).map(v => Math.exp(g * v)),
  violet: (n, rng, N, g) => zscore(colored("violet", n, rng, Math.round(N) + 2)).map(v => Math.exp(g * v)),
  gamma: (n, rng, k) => Array.from({ length: n }, () => gammaV(rng, k)),
  levy: (n, rng, N) => Array.from({ length: n }, () => (1 - rng()) ** (-1 / (0.6 + N / 4)) - 1 + 0.05),
}
function gapCurve(name: string, n: number, seed: number, N: number, g: number, silence: number) {
  const raw = GAPS[name](n, mulberry32(seed ^ 0x1f123bb5), N, g)
  const med = raw.slice().sort((a, b) => a - b)[n >> 1] || 1
  const gaps = raw.map(v => Math.min(v, med * silence))
  const tot = gaps.reduce((a, b) => a + b, 0)
  let acc = 0
  const cdf = gaps.map(v => {
    acc += v
    return acc / tot
  })
  return (u: number) => cdf[Math.min(n - 1, Math.round(u * (n - 1)))] - cdf[0]
}
const CURVES: Record<string, (t: number, k: number) => number> = {
  linear: t => t,
  "ease-in": t => t * t,
  "ease-out": t => 1 - (1 - t) ** 2,
  "ease-in-out": t => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  expo: t => (t === 0 ? 0 : 2 ** (10 * t - 10)),
  sine: t => 1 - Math.cos((t * Math.PI) / 2),
  steps: (t, k) => Math.floor(t * k * 0.999) / Math.max(1, k - 1),
}
// low-discrepancy orders: golden = frac(i*phi) over path index, golden-angle = frac(phi * rank by polar angle), vdc = van der Corput base 2
const PHI = (Math.sqrt(5) - 1) / 2
const frac = (x: number) => x - Math.floor(x)
const vdc = (i: number) => {
  let r = 0
  let d = 0.5
  for (; i > 0; i >>= 1, d /= 2) if (i & 1) r += d
  return r
}
// spectral order: a seeded low-frequency 2D Fourier field, so strokes land in smooth spatial blobs
function field(seed: number, m: number, freq: number) {
  const rng = mulberry32(seed ^ 0x7f4a7c15)
  const ws = Array.from({ length: m }, () => {
    const a = rng() * TAU
    const kk = freq * (0.5 + rng())
    return [Math.cos(a) * kk, Math.sin(a) * kk, rng() * TAU]
  })
  return (x: number, y: number) => ws.reduce((acc, [kx, ky, ph]) => acc + Math.cos(kx * x + ky * y + ph), 0)
}
function rankKey(st: Stroke, k: V, i: number, angRank: number, fld: (x: number, y: number) => number): number {
  const th0 = (k.angle * Math.PI) / 180
  const r = Math.hypot(st.cx, st.cy)
  const keys: Record<string, number> = {
    sweep: -st.cx * Math.sin(th0) + st.cy * Math.cos(th0) + st.noise * 24,
    radial: r + st.noise * 8,
    "radial-in": -r - st.noise * 8,
    path: i,
    subpath: st.sub * 1000 + st.noise,
    golden: frac(i * PHI),
    "golden-angle": frac(angRank * PHI) + r / 1e6,
    vdc: vdc(i),
    spectral: fld(st.cx, st.cy),
    hilbert: hilbertIndex(
      Math.floor(clamp01(st.cx / st.size + 0.5) * 63),
      Math.floor(clamp01(st.cy / st.size + 0.5) * 63),
      6,
    ),
    random: st.noise,
  }
  return keys[k.order]
}
function schedule(strokes: Stroke[], k: V, seed: number) {
  const n = strokes.length
  const fld = field(seed, 3, 2 / 240)
  const byAng = strokes.map((st, i) => [Math.atan2(st.cy, st.cx), i]).sort((a, b) => a[0] - b[0])
  const angRank: number[] = []
  byAng.forEach(([, i], r) => {
    angRank[i] = r
  })
  const order = strokes
    .map((_, i) => i)
    .sort((a, b) => rankKey(strokes[a], k, a, angRank[a], fld) - rankKey(strokes[b], k, b, angRank[b], fld))
  const g = CURVES[k.curve] ?? gapCurve(k.curve, n, seed, k.ordN, k.gain, k.silence)
  const starts = new Set<number>()
  order.forEach((idx, rank) => {
    const u = n > 1 ? rank / (n - 1) : 0
    const t = 60 + k.spread * g(u, k.burst)
    const st = strokes[idx]
    st.t0 = t
    st.dur = k.flight
    st.i = rank
    starts.add(Math.round(t))
  })
  return { T: Math.round(60 + k.spread + k.flight + 350), bursts: starts.size }
}
const springs = new Map<number, Spring>()
const springFor = (os: number): Spring => {
  const key = Math.round(os * 20)
  let sp = springs.get(key)
  if (!sp) {
    sp = new Spring({ mass: 1, stiffness: 120, damping: Math.max(2, 16 - os * 10), velocity: 0 })
    springs.set(key, sp)
  }
  return sp
}
const FLY: Record<string, (u: number, os: number) => number> = {
  back: (u, os) => backOut(u, os),
  spring: (u, os) => (u >= 1 ? 1 : springFor(os).ease(u)),
  "cubic-out": u => 1 - (1 - u) ** 3,
  "expo-out": u => (u >= 1 ? 1 : 1 - 2 ** (-10 * u)),
  elastic: u => (u >= 1 ? 1 : 2 ** (-10 * u) * Math.sin(((u * 10 - 0.75) * TAU) / 3) + 1),
  linear: u => u,
  cut: u => (u > 0 ? 1 : 0),
}

// point + unit tangent at fraction q of a polyline's arc length
function alongPts(pts: Pt[], q: number): [number, number, number, number] {
  let Ln = 0
  const seg: number[] = []
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    seg.push(d)
    Ln += d
  }
  let t = q * Ln
  for (let i = 0; i < seg.length; i++) {
    if (t <= seg[i] || i === seg.length - 1) {
      const a = pts[i]
      const b = pts[i + 1]
      const r = seg[i] ? clamp01(t / seg[i]) : 0
      const tx = (b[0] - a[0]) / (seg[i] || 1)
      const ty = (b[1] - a[1]) / (seg[i] || 1)
      return [a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r, tx, ty]
    }
    t -= seg[i]
  }
  return [pts[0][0], pts[0][1], 1, 0]
}

/* ============ 3. pose(t): pure per-frame transform, so the scrub slider and the clock share one path ============ */
type Inst = { strokes: Stroke[]; T: number; bursts: number }
function pose(inst: Inst, t: number, k: V) {
  for (const s of inst.strokes) {
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
    if (isCut) {
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

/* ============ 4. page ============ */
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
const LIGHT = new Set<string>(["stretch", "os", "ai", "weight", "fease", "run"])
const insts: Inst[] = []
const SIZES = [32, 48, 64, 96, 160]
let K: V
let statsEl: HTMLElement
function mount(host: HTMLElement, size: number, parts: Part[], k: V, seed: number, label: string): Inst {
  const strokes = strokesOf(parts, k, seed, size)
  const sch = schedule(strokes, k, seed)
  const S = size + 4
  const slash = strokes
    .map(s => {
      const Ln = s.diag * k.ailen
      const c = Math.cos(s.th) * Ln
      const sn = Math.sin(s.th) * Ln
      return `<path d="${line(s.cx - c, s.cy - sn, s.cx + c, s.cy + sn)}"/>`
    })
    .join("")
  host.innerHTML = `<svg viewBox="${f(-S / 2)} ${f(-S / 2)} ${S} ${S}" width="${S}" height="${S}"><g class="slash">${slash}</g><g class="blade">${strokes.map(() => '<path d=""/>').join("")}</g><g class="ink">${strokes.map(s => `<path d="${s.d}" pathLength="1"/>`).join("")}</g></svg><span>${label} · ${strokes.length} strokes · ${sch.bursts} starts · cycle ${sch.T}ms</span>`
  const ink = host.querySelectorAll<SVGPathElement>(".ink path")
  const ai = host.querySelectorAll<SVGPathElement>(".slash path")
  const bl = host.querySelectorAll<SVGPathElement>(".blade path")
  strokes.forEach((s, i) => {
    s.el = ink[i]
    s.ai = ai[i]
    s.bl = bl[i]
  })
  const inst = { strokes, T: sch.T, bursts: sch.bursts }
  insts.push(inst)
  return inst
}
const withD = (parts: Part[]) => parts.filter(p => p.d)
function render(k: V, host: HTMLElement) {
  insts.length = 0
  host.innerHTML = `<section><h2>hero: every subpath cut into equal arc-length strokes; each slides in along its own chord by dist chord-lengths, fading up over the first quarter of flight; angle only orders the sweep</h2><div class="row hero"></div></section>
<section><h2>same seal at 32 / 48 / 64 / 96 / 160, each on its own cycle</h2><div class="row sizes"></div></section>
<section><h2>polyline test shape: star, zigzag, spiral</h2><div class="row test"></div></section>
<section><h2>timing plot (hero): x = time, one row per stroke in landing order; bar = flight window, dot = land; the curve is the start-time distribution</h2><div class="plot"></div></section>
<section><h2>step trace (hero): stroke · theta · start · land</h2><div class="mono trace"></div></section>`
  const $ = (s: string) => host.querySelector(s) as HTMLElement
  $(".hero").innerHTML = '<div class="cell"></div>'
  const hero = mount(
    $(".hero .cell"),
    240,
    withD(seal(118, k.seed, { kFirst: true, pupil: false }).sc.parts),
    k,
    k.seed,
    "hero",
  )
  $(".sizes").innerHTML = SIZES.map(() => '<div class="cell"></div>').join("")
  SIZES.forEach((S, i) => {
    mount(
      $(".sizes").children[i] as HTMLElement,
      S,
      withD(seal(S / 2 - 2, k.seed, { kFirst: true, pupil: false }).sc.parts),
      k,
      k.seed + i * 7919,
      `${S}`,
    )
  })
  $(".test").innerHTML = '<div class="cell"></div>'
  mount($(".test .cell"), 240, polyShape(112), k, k.seed ^ 0x1d3, "polyline")
  statsEl.textContent = `${hero.strokes.length} strokes · ${hero.bursts} bursts · cycle ${hero.T}ms`
  {
    const st = hero.strokes.slice().sort((a, b) => a.i - b.i)
    const n = st.length
    const W = 640
    const Hh = Math.min(260, Math.max(60, n * 2))
    const T = hero.T
    const X = (t: number) => f((t / T) * W)
    const Y = (i: number) => f(((i + 0.5) / n) * Hh)
    $(".plot").innerHTML =
      `<svg viewBox="0 0 ${W} ${Hh}" width="${W}" height="${Hh}"><path stroke-opacity=".35" d="${st.map(s => `M${X(s.t0)} ${Y(s.i)}H${X(s.t0 + s.dur)}`).join("")}"/><path stroke-width="2" d="${st.map(s => `M${X(s.t0 + s.dur)} ${Y(s.i)}h.01`).join("")}"/><path stroke-opacity=".25" stroke-dasharray="3 3" d="${st.map((s, j) => `${j ? "L" : "M"}${X(s.t0)} ${Y(s.i)}`).join("")}"/></svg>`
  }
  $(".trace").textContent = hero.strokes
    .slice()
    .sort((a, b) => a.i - b.i)
    .slice(0, 400)
    .map(
      s =>
        `${String(s.i).padStart(4)}  θ ${((s.th * 180) / Math.PI).toFixed(1).padStart(7)}°  start ${String(Math.round(s.t0)).padStart(6)}ms  land ${String(Math.round(s.t0 + s.dur)).padStart(6)}ms  D ${Math.round(s.D)}`,
    )
    .join("\n")
  clk.reset()
}
const clk = clock(elapsed => {
  if (!insts.length) return
  const base = insts[0].T || 1000
  const t = elapsed % base
  for (const inst of insts) pose(inst, t % inst.T, K)
})

page({ id: "slice", title: "gothic: judgement cut", links: LINKS, href: hrefFor })
section({
  id: "slice",
  title: "slice",
  spec: SPEC,
  render(v, host, ctx) {
    K = v
    if (ctx.first) {
      ctx.extra.innerHTML = `<label>scrub <input class="o" type="range" min="0" max="100" step=".2" value="0"></label><span class="stats"></span>`
      statsEl = ctx.extra.querySelector(".stats") as HTMLElement
      const scrub = ctx.extra.querySelector("input") as HTMLInputElement
      clk.bindScrub(scrub, () => insts[0]?.T || 1000)
      if (reducedMotion) {
        scrub.value = "100"
        clk.seek(insts[0]?.T || 1000)
        setTimeout(() => ctx.values.$({ ...ctx.values.$(), run: false }))
      }
    }
    clk.run(v.run)
    if (!ctx.first && [...ctx.changed].every(k => LIGHT.has(k))) {
      for (const inst of insts) for (const s of inst.strokes) s._tr = s._w = s._ao = null
      return
    }
    render(v, host)
  },
})
Object.assign(window, { seal, polyShape, strokesOf, schedule, pose, insts, render })
