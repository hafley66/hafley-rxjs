import { Spring } from "animejs"
import { hilbertIndex } from "../algos/1_fractal.js"
import { mulberry32 } from "./0_rng.js"
import { backOut, clamp01, L, M, type Pt, pl, polar, poly, TAU } from "./1_geom.js"
import type { Part } from "./3_seal.js"
import { colored, gammaV, gauss } from "./4_dist.js"

type Rng = () => number

// the knobs the segmentation and the schedule read; the page's spec values satisfy it structurally
export type SliceKnobs = {
  cut: number
  jit: number
  dist: number
  angle: number
  order: string
  curve: string
  ordN: number
  gain: number
  silence: number
  spread: number
  burst: number
  flight: number
}

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
let gaugeEl: SVGPathElement | null = null
function gaugePath(): SVGPathElement {
  if (gaugeEl) return gaugeEl
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  svg.setAttribute("style", "position:absolute;left:-9999px;width:0;height:0")
  svg.innerHTML = "<path/>"
  document.body.append(svg)
  gaugeEl = svg.querySelector("path") as SVGPathElement
  return gaugeEl
}
const subpaths = (d: string) => d.split(/(?=M)/).filter(s => /[LA]/.test(s))
export function cut(d: string, maxLen: number): Pt[][] {
  const gauge = gaugePath()
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
export type Stroke = {
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
  el: SVGPathElement | null
  ai: SVGPathElement | null
  bl: SVGPathElement | null
  _op?: number
  _bd?: string
  _dash?: number | null
  _tr?: string | null
  _w?: number | null
  _ao?: number | null
  _bw?: number | null
}
export function strokesOf(parts: Part[], k: SliceKnobs, seed: number, size: number): Stroke[] {
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
          el: null,
          ai: null,
          bl: null,
        })
      }
    }
  return out
}

/* ============ 2. schedule: rank strokes by an order rule, then start_i = spread * curve(rank / (n-1)) ============
   spread 0 = all at once. steps quantizes the curve into k.burst landings. every rule is a pure function of stroke geometry + seed. */
const zscore = (a: number[]) => {
  const m = a.reduce((x, y) => x + y, 0) / a.length
  const sd = Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length) || 1
  return a.map(v => (v - m) / sd)
}
// stochastic curves yield n positive gaps; the curve is their normalised cumulative sum, so it is monotone by construction
type Gap = (n: number, rng: Rng, N: number, g: number) => number[]
export const GAPS: Record<string, Gap> = {
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
export const CURVES: Record<string, (t: number, k: number) => number> = {
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
function rankKey(st: Stroke, k: SliceKnobs, i: number, angRank: number, fld: (x: number, y: number) => number): number {
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
export function schedule(strokes: Stroke[], k: SliceKnobs, seed: number) {
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
export const FLY: Record<string, (u: number, os: number) => number> = {
  back: (u, os) => backOut(u, os),
  spring: (u, os) => (u >= 1 ? 1 : springFor(os).ease(u)),
  "cubic-out": u => 1 - (1 - u) ** 3,
  "expo-out": u => (u >= 1 ? 1 : 1 - 2 ** (-10 * u)),
  elastic: u => (u >= 1 ? 1 : 2 ** (-10 * u) * Math.sin(((u * 10 - 0.75) * TAU) / 3) + 1),
  linear: u => u,
  cut: u => (u > 0 ? 1 : 0),
}

// point + unit tangent at fraction q of a polyline's arc length
export function alongPts(pts: Pt[], q: number): [number, number, number, number] {
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
