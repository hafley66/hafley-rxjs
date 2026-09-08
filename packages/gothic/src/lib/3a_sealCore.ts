import { mulberry32 } from "./0_rng.js"
import { circle, line, pl, polar, poly, type Pt, TAU } from "./1_geom.js"
import { band, composeSeal, layoutRings, scene, seal, type Seal, type Scene } from "./3_seal.js"

export type CoreParams = {
  core: "original" | "iris" | "blades" | "lattice"
  coreSides: number; coreSize: number; coreTurn: number
  coreFrame: "open" | "circle" | "polygon"
}

export function angularCore(sc: Scene, radius: number, p: CoreParams): void {
  const n = Math.max(2, Math.round(p.coreSides)), turn = p.coreTurn * Math.PI / 180
  const at = (r: number, i: number, phase = 0): Pt => polar(r, -Math.PI / 2 + i * TAU / n + phase)
  const frame = n === 2
    ? [[-radius, -radius * 0.2], [radius, -radius * 0.2], [radius, radius * 0.2], [-radius, radius * 0.2]] as Pt[]
    : Array.from({ length: n }, (_, i) => at(radius, i))
  if (p.coreFrame === "circle") sc.path(circle(0, 0, radius))
  if (p.coreFrame === "polygon") sc.path(poly(frame))
  if (radius < sc.minPx * 2) { sc.path(line(-radius, 0, radius, 0)); return }
  if (p.core === "iris") {
    for (let i = 0; i < n; i++) {
      sc.path(poly([at(radius * 0.92, i, -0.2), at(radius * 0.87, i + 0.64), at(radius * 0.25, i + 0.7, turn), at(radius * 0.39, i, turn)]))
      sc.path(pl([at(radius * 0.81, i), at(radius * 0.52, i + 0.26, turn), at(radius * 0.4, i + 0.45, turn)]))
    }
  } else if (p.core === "blades") {
    for (let i = 0; i < n; i++) {
      sc.path(poly([at(radius * 0.94, i, turn), at(radius * 0.28, i + 0.19), at(radius * 0.16, i + 0.54), at(radius * 0.68, i + 0.28, turn)]))
      sc.path(pl([at(radius * 0.85, i + 0.12, turn), at(radius * 0.49, i + 0.38, turn), at(radius * 0.32, i + 0.44)]))
    }
  } else {
    const count = Math.max(3, n), phase = TAU / count
    const outer = Array.from({ length: count }, (_, i) => polar(radius * 0.9, -Math.PI / 2 + i * phase))
    const inner = outer.map((_, i) => polar(radius * 0.37, -Math.PI / 2 + i * phase + turn))
    sc.path(poly(outer)); sc.path(poly(inner))
    for (let i = 0; i < count; i++) {
      const a = outer[i], b = inner[i], c = outer[(i + 1) % count], d = inner[(i + 1) % count]
      sc.path(pl([a, b]))
      for (const t of [0.25, 0.5, 0.75]) {
        const left: Pt = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
        const right: Pt = [c[0] + (d[0] - c[0]) * t, c[1] + (d[1] - c[1]) * t]
        sc.path(pl([left, [left[0] + (right[0] - left[0]) * 0.28, left[1] + (right[1] - left[1]) * 0.28]]))
      }
    }
  }
}

// The original branch calls the unchanged seal generator with the original notebook options.
export function sliceSeal(radius: number, seed: number, p: CoreParams): Seal {
  if (p.core === "original") return seal(radius, seed, { kFirst: true, pupil: false })
  const s = { ...composeSeal(radius, seed, true), core: p.coreSize }
  const sc = scene(2), rng = mulberry32(seed ^ 0x9e3779b9)
  for (const ring of layoutRings(radius, s)) band(sc, ring.kind === "runes" ? { ...ring, kind: "ticks" } : ring, s.n, s.rot, rng, "")
  angularCore(sc, radius * s.core * 0.9, p)
  return { sc, s }
}
