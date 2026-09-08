import { mulberry32, pick, type Rng } from "./0_rng.js"
import { arc, circle, f, gcd, line, M, type Pt, polar, poly, TAU } from "./1_geom.js"
import { foilRing } from "./2_foil.js"

export type Part = { d: string; cls: string; z?: number }
export type Scene = {
  parts: Part[]
  raw: string[]
  lod: string[]
  minPx: number
  z: number | undefined
  path(d: string, cls?: string): void
  text(markup: string): void
}
export function scene(minPx = 2): Scene {
  const sc: Scene = {
    parts: [],
    raw: [],
    lod: [],
    minPx,
    z: undefined,
    path: (d, cls = "") => sc.parts.push(sc.z === undefined ? { d, cls } : { d, cls, z: sc.z }),
    text: s => sc.raw.push(s),
  }
  return sc
}

export type BandKind =
  | "ring"
  | "runes"
  | "ticks"
  | "polygon"
  | "chords"
  | "spokes"
  | "nodes"
  | "foils"
  | "dots"
  | "empty"
export type Band = {
  kind: BandKind
  w: number
  double?: boolean
  k?: number
  step?: number
  sides?: number
  lobes?: number
}
export type Ring = Band & { r0: number; r1: number; h: number }
export type SealSpec = { n: number; k: number; rot: number; core: number; gap: number; eye: number; bands: Band[] }

export const starPoly = (sc: Scene, pts: Pt[], st: number): void => {
  const s = pts.length
  for (let start = 0; start < gcd(s, st); start++) {
    const seq: Pt[] = []
    for (let i = start, c = 0; c < s / gcd(s, st); i = (i + st) % s, c++) seq.push(pts[i])
    sc.path(poly(seq))
  }
}
export const coprimes = (n: number): number[] => {
  const o: number[] = []
  for (let k = 2; k <= (n - 1) / 2; k++) if (gcd(n, k) === 1) o.push(k)
  return o
}

// grammar outward->in: ring, [text], (line point)*, line, core. kFirst draws the tick multiplier before the text band (eye/slice order); off = icons order
export function composeSeal(R: number, seed: number, kFirst = false): SealSpec {
  const rng = mulberry32(seed)
  const n = 3 + Math.floor(rng() * 6)
  const ks = coprimes(n)
  let k = kFirst ? pick(rng, [2, 3, 4]) : 0
  const bands: Band[] = [{ kind: "ring", w: 0.35, double: R >= 24 }]
  if (R >= 28) {
    const kind = pick(rng, ["runes", "ticks"] as const)
    if (!kFirst) k = pick(rng, [2, 3, 4])
    bands.push({ kind, w: 0.7, k })
  }
  const budget = Math.floor(R / 9)
  for (let i = 0; i < budget; i++)
    bands.push(
      i % 2 === 0
        ? {
            kind: pick(rng, ["polygon", "chords", "spokes"] as const),
            w: 1,
            step: ks.length ? pick(rng, ks) : 1,
            sides: rng() < 0.3 ? n * 2 : n,
          }
        : {
            kind: pick(rng, ["nodes", "foils", "dots"] as const),
            w: 1,
            lobes: pick(rng, [3, 4, 5]),
            k: pick(rng, [2, 3]),
          },
    )
  if (bands[bands.length - 1].kind !== "polygon")
    bands.push({ kind: "polygon", w: 1, step: ks.length ? ks[0] : 1, sides: n })
  return { n, k, rot: -Math.PI / 2, core: 0.16 + rng() * 0.08, gap: 0.03, eye: pick(rng, [3, 4, 5, 6]), bands }
}

export function layoutRings(R: number, s: SealSpec): Ring[] {
  const core = R * s.core
  const gap = R * s.gap
  const W = s.bands.reduce((a, b) => a + b.w, 0)
  const free = R - core - gap * s.bands.length
  let r = core
  return s.bands.map(b => {
    const h = (free * b.w) / W
    const o = { ...b, r0: r, r1: r + h, h }
    r += h + gap
    return o
  })
}

const RUNES = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ"
export function band(sc: Scene, b: Ring, n: number, rot: number, rng: Rng, uid: string): void {
  const { r0, r1, h } = b
  const rm = (r0 + r1) / 2
  const minPx = sc.minPx
  const at = (r: number, i: number) => polar(r, rot + (i * TAU) / n)
  const down = (to: BandKind) => {
    sc.lod.push(`${b.kind}→${to}`)
    return band(sc, { ...b, kind: to }, n, rot, rng, uid)
  }
  switch (b.kind) {
    case "ring":
      sc.path(circle(0, 0, r1))
      if (b.double && h >= minPx) sc.path(circle(0, 0, r0))
      break
    case "runes": {
      const fs = h * 0.8
      if (fs < minPx * 3) {
        down("ticks")
        break
      }
      const pid = `tp${uid}_${f(rm)}`
      const glyphs = Array.from(
        { length: Math.ceil((TAU * rm) / (fs * 0.8)) },
        () => RUNES[Math.floor(rng() * RUNES.length)],
      ).join("")
      sc.text(
        `<defs><path id="${pid}" d="${M(-rm, 0) + arc(rm, rm, 0, 1, 1) + arc(rm, -rm, 0, 1, 1)}"/></defs><text font-size="${f(fs)}" dominant-baseline="middle"><textPath href="#${pid}">${glyphs}</textPath></text>`,
      )
      break
    }
    case "ticks": {
      const k = n * (b.k ?? 2)
      if ((TAU * rm) / k < minPx) {
        down("ring")
        break
      }
      for (let i = 0; i < k; i++) {
        const a = rot + (i * TAU) / k
        const [x0, y0] = polar(i % (b.k ?? 2) ? r0 + h * 0.5 : r0, a)
        const [x1, y1] = polar(r1, a)
        sc.path(line(x0, y0, x1, y1))
      }
      break
    }
    case "polygon": {
      const s = b.sides ?? n
      const pts = Array.from({ length: s }, (_, i) => polar(r1, rot + (i * TAU) / s))
      if (2 * r1 * Math.sin(Math.PI / s) < minPx * 1.5) {
        down("ring")
        break
      }
      starPoly(sc, pts, b.step ?? 1)
      break
    }
    case "chords": {
      if (2 * r1 * Math.sin((Math.PI * (b.step ?? 1)) / n) < minPx * 2) {
        down("polygon")
        break
      }
      for (let i = 0; i < n; i++) {
        const [x0, y0] = at(r1, i)
        const [x1, y1] = at(r1, i + (b.step ?? 1))
        sc.path(line(x0, y0, x1, y1))
      }
      break
    }
    case "spokes": {
      if (h < minPx) {
        down("ring")
        break
      }
      for (let i = 0; i < n; i++) {
        const [x0, y0] = at(r0, i)
        const [x1, y1] = at(r1, i)
        sc.path(line(x0, y0, x1, y1))
      }
      sc.path(circle(0, 0, r1))
      break
    }
    case "nodes": {
      const rr = Math.min(h * 0.46, rm * Math.sin(Math.PI / n) * 0.9)
      if (rr < minPx * 0.75) {
        down("dots")
        break
      }
      for (let i = 0; i < n; i++) {
        const [x, y] = at(rm, i)
        sc.path(circle(x, y, rr))
      }
      break
    }
    case "foils": {
      const rr = Math.min(h * 0.46, rm * Math.sin(Math.PI / n) * 0.9)
      if ((TAU * rr) / (b.lobes ?? 3) < minPx * 1.5) {
        down("nodes")
        break
      }
      for (let i = 0; i < n; i++) {
        const [x, y] = at(rm, i)
        sc.path(foilRing(x, y, rr, b.lobes ?? 3))
      }
      break
    }
    case "dots": {
      const k = n * (b.k ?? 2)
      const rr = Math.max(0.6, h * 0.14)
      if ((TAU * rm) / k < rr * 3) {
        down("empty")
        break
      }
      for (let i = 0; i < k; i++) {
        const [x, y] = polar(rm, rot + (i * TAU) / k)
        sc.path(circle(x, y, rr), "dark")
      }
      break
    }
    case "empty":
      break
  }
}

// lids as a circle, iris = foil ring, pupil filled; degrades foil->circle->dot
export function eyeCore(sc: Scene, R: number, lobes: number, pupil = true): void {
  sc.path(circle(0, 0, R))
  const ir = R * 0.62
  if ((TAU * ir) / lobes >= sc.minPx * 1.5) sc.path(foilRing(0, 0, ir, lobes))
  else if (ir >= sc.minPx) sc.path(circle(0, 0, ir))
  if (pupil && R * 0.2 >= 0.6) sc.path(circle(0, 0, R * 0.2), "dark")
}

export type SealOpts = { uid?: string; pupil?: boolean; minPx?: number; kFirst?: boolean; depth?: boolean }
export type Seal = { sc: Scene; s: SealSpec }

// depth: tag every part with z = band index / band count (outer ring near, core far)
export function seal(R: number, seed: number, o: SealOpts = {}): Seal {
  const sc = scene(o.minPx ?? 2)
  const s = composeSeal(R, seed, o.kFirst ?? false)
  const rng = mulberry32(seed ^ 0x9e3779b9)
  const rings = layoutRings(R, s)
  rings.forEach((b, i) => {
    if (o.depth) sc.z = f(i / rings.length)
    band(sc, b, s.n, s.rot, rng, o.uid ?? "")
  })
  if (o.depth) sc.z = 1
  eyeCore(sc, R * s.core * 0.9, s.eye, o.pupil ?? true)
  return { sc, s }
}

export const partMarkup = (p: Part): string =>
  `<path d="${p.d}" pathLength="1"${p.cls ? ` class="${p.cls}"` : ""}${p.z === undefined ? "" : ` data-z="${p.z}"`}/>`
export const sceneMarkup = (sc: Scene): string => sc.parts.map(partMarkup).join("") + sc.raw.join("")
export const sealCaption = (sl: Seal, withLod = true): string =>
  `n${sl.s.n} · ${sl.s.bands.map(b => b.kind).join(" ")} · eye${sl.s.eye}${withLod && sl.sc.lod.length ? ` · ${sl.sc.lod.join(" ")}` : ""}`

export function sealSvg(S: number, seed: number, minPx = 2): Seal & { svg: string } {
  const R = S / 2 - 1
  const sl = seal(R, seed, { minPx })
  return {
    ...sl,
    svg: `<svg viewBox="${f(-R - 1)} ${f(-R - 1)} ${f(S)} ${f(S)}" width="${S}" height="${S}">${sceneMarkup(sl.sc)}</svg>`,
  }
}
