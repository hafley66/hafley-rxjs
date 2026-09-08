import { DETAIL_INPUTS } from "../kit/0_inputs.js"
import type { Algo, AlgoPath } from "../kit/2_algo.js"
import {
  band,
  circle,
  coprimes,
  eyeCore,
  f,
  foilRing,
  line,
  mulberry32,
  type Pt,
  pick,
  polar,
  poly,
  type Ring,
  type Scene,
  scene,
  starPoly,
  TAU,
} from "../lib/index.js"

/* ---- fullmetal 2: a transmutation circle where one symmetry n drives every element ----
   outer ring · script band (runes, ticks under LOD) · polygon {n} + star {n/k} · n satellites tangent to each other
   on the star's vertices, each a nested circle of the same family · chords {n/k} between satellite centres ·
   dual polygon tangent to the satellites · core = nested circle or the eye. Children inherit n (or n's smallest
   divisor >= 3 past 6), their seed from the parent's seed and vertex index, and point outward. */

export type Fma = {
  seed: number
  n: number
  step: number
  depth: number
  sat: number
  minPx: number
  script: boolean
  pupil: boolean
}

// M/L/A/Z path data rotated by rot about the origin then moved to (cx, cy); circular arcs keep their radii
export function xform(d: string, cx: number, cy: number, rot: number): string {
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  const tp = (x: number, y: number): string => `${f(cx + x * c - y * s)} ${f(cy + x * s + y * c)}`
  const toks = d.match(/[MLAZ]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? []
  let out = ""
  let i = 0
  while (i < toks.length) {
    const t = toks[i++]
    if (t === "Z") out += "Z"
    else if (t === "M" || t === "L") {
      out += t + tp(Number(toks[i]), Number(toks[i + 1]))
      i += 2
    } else if (t === "A") {
      out += `A${toks[i]} ${toks[i + 1]} ${toks[i + 2]} ${toks[i + 3]} ${toks[i + 4]} ${tp(Number(toks[i + 5]), Number(toks[i + 6]))}`
      i += 7
    }
  }
  return out
}

const childN = (n: number): number => {
  if (n <= 6) return n
  for (let d = 3; d <= n / 2; d++) if (n % d === 0) return d
  return n
}
const childSeed = (seed: number, i: number): number =>
  (Math.imul(seed, 0x9e3779b1) + Math.imul(i + 1, 0x85ebca6b)) >>> 0
const nearestCoprime = (n: number, want: number): number => {
  const ks = coprimes(n)
  if (!ks.length) return 1
  return ks.reduce((a, b) => (Math.abs(b - want) < Math.abs(a - want) ? b : a))
}

type Frame = { cx: number; cy: number; rot: number }
type Level = { R: number; seed: number; n: number; step: number; lvl: number; frame: Frame }

const TOP = -Math.PI / 2

export type FmaSpec = { n: number; step: number; sats: string; depthUsed: number }

// one circle at one level; writes into sc with z = (level + radial fraction) / depth; recurses into satellites and core
function compose(sc: Scene, L: Level, p: Fma, depth: number, uid: string, info: FmaSpec): void {
  const { R, n, step, lvl, frame } = L
  const minPx = sc.minPx
  const rng = mulberry32(L.seed)
  const level = depth - lvl
  info.depthUsed = Math.max(info.depthUsed, level + 1)
  const put = (d: string, r: number, cls?: string) => {
    sc.z = f(Math.min(1, (level + (1 - r / R)) / depth))
    sc.path(xform(d, frame.cx, frame.cy, frame.rot), cls)
  }
  const at = (r: number, i: number, off = 0): Pt => polar(r, TOP + off + (i * TAU) / n)

  // outer ring, double when the gap survives
  put(circle(0, 0, R), R)
  const r1 = R * 0.955
  if (R - r1 >= minPx) put(circle(0, 0, r1), r1)

  // script band: runes on the root only (textPath markup), ticks below; ticks count n·2 keeps the symmetry
  const r0 = R * 0.86
  const h = r1 - r0
  if (h >= minPx * 2) {
    const ring: Ring = { kind: lvl === depth && p.script ? "runes" : "ticks", w: 1, k: 2, r0, r1, h }
    if (ring.kind === "runes" && (frame.cx !== 0 || frame.cy !== 0 || frame.rot !== 0)) ring.kind = "ticks"
    const tmp = scene(minPx)
    band(tmp, ring, n, TOP, rng, uid)
    for (const part of tmp.parts) put(part.d, r0, part.cls || undefined)
    for (const t of tmp.raw) sc.text(t)
    sc.lod.push(...tmp.lod)
  }

  // polygon {n} and star {n/step} on the same vertices
  const rp = R * 0.84
  const V = Array.from({ length: n }, (_, i) => at(rp, i))
  if (2 * rp * Math.sin(Math.PI / n) >= minPx * 1.5) {
    put(poly(V), rp)
    if (step > 1) {
      const tmp = scene(minPx)
      starPoly(tmp, V, step)
      for (const part of tmp.parts) put(part.d, rp)
    }
  } else sc.lod.push("polygon→ring")

  // n satellites tangent to their neighbours, centred on the star's vertices, scaled by sat
  const rs = ((rp * Math.sin(Math.PI / n)) / (1 + Math.sin(Math.PI / n))) * p.sat
  const rc = rp - rs
  const C = Array.from({ length: n }, (_, i) => at(rc, i))
  let sats = "ring"
  if (rs >= minPx) {
    for (let i = 0; i < n; i++) {
      const [x, y] = C[i]
      put(circle(x, y, rs), rc)
      const inner = rs * 0.86
      if (lvl > 1 && inner * 2 >= minPx * 10) {
        sats = "seal"
        // the child's frame: its top points outward along the vertex ray
        const a = TOP + (i * TAU) / n
        const [gx, gy] = polar(rc, a)
        const cs = Math.cos(frame.rot)
        const sn = Math.sin(frame.rot)
        compose(
          sc,
          {
            R: inner,
            seed: childSeed(L.seed, i),
            n: childN(n),
            step: nearestCoprime(childN(n), step),
            lvl: lvl - 1,
            frame: { cx: frame.cx + gx * cs - gy * sn, cy: frame.cy + gx * sn + gy * cs, rot: frame.rot + a - TOP },
          },
          p,
          depth,
          uid,
          info,
        )
      } else if ((TAU * rs * 0.6) / n >= minPx * 1.5) {
        sats = sats === "seal" ? sats : "foil"
        if (lvl > 1) sc.lod.push("seal→foil")
        put(foilRing(x, y, rs * 0.6, n), rc)
      } else if (lvl > 1) sc.lod.push("seal→circle")
    }
  } else sc.lod.push("satellites→empty")
  if (lvl === depth) info.sats = sats

  // chords {n/step} between satellite centres: the star again, one ring in
  if (step > 1 && 2 * rc * Math.sin((Math.PI * step) / n) >= minPx * 2)
    for (let i = 0; i < n; i++) {
      const [x0, y0] = C[i]
      const [x1, y1] = C[(i + step) % n]
      put(line(x0, y0, x1, y1), rc)
    }

  // dual polygon: rotated half a step, tangent to the satellites
  const ri = rc - rs
  if (ri > 0 && 2 * ri * Math.sin(Math.PI / n) >= minPx * 1.5)
    put(poly(Array.from({ length: n }, (_, i) => at(ri, i, Math.PI / n))), ri)

  // core: a nested circle of the same family, else the eye (lobes = n capped at 6)
  const rk = ri * Math.cos(Math.PI / n) * 0.92
  if (rk <= 0) return
  if (lvl > 1 && rk * 2 >= minPx * 10) {
    compose(
      sc,
      {
        R: rk,
        seed: childSeed(L.seed, n),
        n: childN(n),
        step: nearestCoprime(childN(n), step),
        lvl: lvl - 1,
        frame: { ...frame, rot: frame.rot + Math.PI / n },
      },
      p,
      depth,
      uid,
      info,
    )
  } else if (rk >= minPx * 2) {
    const tmp = scene(minPx)
    eyeCore(tmp, rk, Math.min(n, 6), p.pupil)
    // r = 0: the eye is the far end of its level, z = (level + 1) / depth
    for (const part of tmp.parts) put(part.d, 0, part.cls || undefined)
    if (lvl > 1) sc.lod.push("core seal→eye")
  }
}

export function fma2Scene(R: number, p: Fma, uid = ""): { sc: Scene; spec: FmaSpec } {
  const rng = mulberry32(p.seed)
  const n = p.n >= 3 ? p.n : 3 + Math.floor(rng() * 6)
  const ks = coprimes(n)
  const step = p.step >= 1 ? nearestCoprime(n, p.step) : ks.length ? pick(rng, ks) : 1
  const sc = scene(p.minPx)
  const spec: FmaSpec = { n, step, sats: "ring", depthUsed: 1 }
  compose(sc, { R, seed: p.seed, n, step, lvl: p.depth, frame: { cx: 0, cy: 0, rot: 0 } }, p, p.depth, uid, spec)
  return { sc, spec }
}

export const fma2: Algo<Fma> = {
  name: "fma2",
  spec: {
    seed: { kind: "seed", hint: "seed: picks n and the star step when they are 0, and every child seed", default: 7 },
    n: {
      kind: "range",
      hint: "symmetry n: sides of the polygon, satellites, chords, ticks (n·2) and the eye's lobes; 0 = from the seed",
      label: "symmetry",
      min: 0,
      max: 9,
      step: 1,
      default: 0,
    },
    step: {
      kind: "range",
      hint: "star step k for {n/k}: the polygon's star and the chords between satellites; snapped to the nearest coprime of n; 0 = from the seed",
      label: "star step",
      min: 0,
      max: 4,
      step: 1,
      default: 0,
    },
    depth: {
      kind: "range",
      hint: "nesting depth: satellites and the core become circles of the same family down to this many levels; a level under 10·minPx across drops to a foil, then a plain circle",
      min: 1,
      max: 3,
      step: 1,
      default: 2,
    },
    sat: {
      kind: "range",
      hint: "satellite size as a fraction of the tangent radius (1 = neighbours touch)",
      label: "satellite",
      min: 0.5,
      max: 1,
      step: 0.05,
      default: 0.9,
    },
    minPx: { ...DETAIL_INPUTS.minPx, hint: "smallest feature drawn, in px; everything under it degrades one kind down (LOD)", },
    script: {
      kind: "bool",
      hint: "rune script on the root's outer band; off draws ticks",
      default: false,
      p: 0.08,
    },
    pupil: { kind: "bool", hint: "fill the pupil of every eye core", default: true },
  },
  presets: {
    penta: { n: 5, step: 2, depth: 2 },
    seven: { n: 7, step: 3, depth: 2 },
    octagon: { n: 8, step: 3, depth: 3 },
    deep: { depth: 3, sat: 1 },
    flat: { depth: 1, sat: 0.8 },
  },
  run(p, ctx) {
    const { sc, spec } = fma2Scene(ctx.size / 2 - 1, { ...p, minPx: ctx.minPx, seed: ctx.seed }, `f${ctx.size}`)
    const paths: AlgoPath[] = sc.parts.map(({ d, cls, z }) => ({ d, z, cls: cls || undefined }))
    return {
      paths,
      raw: sc.raw,
      caption: `n${spec.n}/${spec.step} · depth ${spec.depthUsed} · sats ${spec.sats}`,
      lod: [...new Set(sc.lod)],
    }
  },
}
