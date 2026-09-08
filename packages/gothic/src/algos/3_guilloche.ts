import { type AnySpec, type ValuesOf } from "@hafley66/report-shell"
import type { Algo, AlgoCtx, AlgoOut } from "../kit/2_algo.js"
import { mulberry32 } from "../lib/0_rng.js"
import { circle, f, gcd, TAU } from "../lib/1_geom.js"

export const SPEC = {
  seed: { kind: "seed", hint: "phase and rotation of each nested rosette", default: 7 },
  lobes: { kind: "range", hint: "rotational symmetry of the woven rosette", min: 3, max: 24, step: 1, default: 11, group: "curve" },
  winding: { kind: "range", hint: "turns before the curve closes; adjusted to be coprime with lobes", min: 1, max: 12, step: 1, default: 4, group: "curve" },
  bulge: { kind: "range", hint: "reach toward the centre; larger values open deeper petals", min: 0.08, max: 0.48, step: 0.01, default: 0.3, group: "curve" },
  lace: { kind: "range", hint: "third harmonic that curls each petal into finer loops", min: 0, max: 0.2, step: 0.005, default: 0.045, group: "curve" },
  strands: { kind: "range", hint: "interlaced copies of each curve; reduced at small cell sizes", min: 1, max: 8, step: 1, default: 3, group: "weave" },
  braid: { kind: "range", hint: "angular spread between strands, as a fraction of a lobe", min: 0.01, max: 0.8, step: 0.01, default: 0.22, group: "weave" },
  bands: { kind: "range", hint: "concentric generations of the rosette", min: 1, max: 5, step: 1, default: 3, group: "nesting" },
  shrink: { kind: "range", hint: "radius of each generation relative to the previous one", min: 0.25, max: 0.8, step: 0.01, default: 0.46, group: "nesting" },
  twist: { kind: "range", hint: "rotation between generations in degrees", min: -45, max: 45, step: 1, default: 13, group: "nesting" },
  ink: { kind: "select", hint: "ink colours across the woven strands", options: ["amber", "ice", "copper", "mono"], default: "amber" },
  rings: { kind: "bool", hint: "engraved guide rings around each generation", default: true },
  minPx: { kind: "range", hint: "smallest visible feature in pixels; controls detail reduction", min: 0.5, max: 3, step: 0.25, default: 1 },
  // scaffold:inputs
} as const satisfies AnySpec
export type Params = ValuesOf<typeof SPEC>

const INKS = {
  amber: ["text-[#edca87]", "text-[#bd9265]", "text-[#769c9d]"],
  ice: ["text-[#b8e8ee]", "text-[#729ab6]", "text-[#afa1db]"],
  copper: ["text-[#efa794]", "text-[#b76f83]", "text-[#d7ba89]"],
  mono: ["text-[#d9dbe3]"],
}

// Three integer-frequency wheels. Cubic Hermite segments use the exact velocity at each endpoint.
export function guillochePath(R: number, p: Params, winding: number, phase: number, rotation: number): string {
  const wheels = [[winding, 1 - p.bulge, 0], [winding - p.lobes, p.bulge, phase], [winding + p.lobes, p.lace, -phase]]
  const scale = R / (1 + p.lace)
  const point = (t: number) => {
    let x = 0, y = 0, dx = 0, dy = 0
    for (const [freq, amplitude, offset] of wheels) {
      const a = freq * t + offset + rotation
      const c = Math.cos(a) * amplitude * scale
      const s = Math.sin(a) * amplitude * scale
      x += c; y += s; dx -= freq * s; dy += freq * c
    }
    return { x, y, dx, dy }
  }
  const count = (winding + p.lobes) * 18
  const dt = TAU / count
  let from = point(0)
  let d = `M${f(from.x)} ${f(from.y)}`
  for (let i = 1; i <= count; i++) {
    const to = point(i * dt)
    d += `C${f(from.x + from.dx * dt / 3)} ${f(from.y + from.dy * dt / 3)} ${f(to.x - to.dx * dt / 3)} ${f(to.y - to.dy * dt / 3)} ${f(to.x)} ${f(to.y)}`
    from = to
  }
  return `${d}Z`
}

export function generate(p: Params, ctx: AlgoCtx): AlgoOut {
  p = { ...p, lobes: Math.max(3, Math.min(24, Math.round(p.lobes))) }
  const rng = mulberry32(ctx.seed)
  const paths: AlgoOut["paths"] = []
  const lod: string[] = []
  const R = ctx.size * 0.47
  let winding = Math.max(1, Math.round(p.winding))
  while (gcd(winding, p.lobes) !== 1) winding++
  const strands = Math.max(1, Math.min(p.strands, Math.floor(ctx.size / (p.lobes * ctx.minPx * 5))))
  if (strands < p.strands) lod.push(`${p.strands}→${strands} strands`)
  const inks = INKS[p.ink]
  const rotation = rng() * TAU
  let drawn = 0
  for (let band = 0; band < p.bands; band++) {
    const r = R * p.shrink ** band
    if (r < ctx.minPx * 7) { lod.push(`${p.bands}→${band} bands`); break }
    const phase = rng() * TAU
    const angle = rotation + band * p.twist * Math.PI / 180
    const z = band / Math.max(1, p.bands - 1)
    if (p.rings) {
      paths.push({ d: circle(0, 0, r * 1.035), z, cls: `${inks[band % inks.length]} opacity-45 [--w:0.6]` })
      if (band === 0) paths.push({ d: circle(0, 0, r * 1.055), z, cls: `${inks[0]} opacity-65 [--w:0.6]` })
    }
    for (let thread = 0; thread < strands; thread++) {
      const offset = strands === 1 ? 0 : (thread / (strands - 1) - 0.5) * p.braid * TAU
      paths.push({
        d: guillochePath(r, p, winding, phase + offset, angle), z,
        cls: `${inks[(band + thread) % inks.length]} [--w:0.7]`,
      })
    }
    drawn++
  }
  return { paths, caption: `${p.lobes} lobes · winding ${winding} · ${drawn} bands`, lod }
}

export const ALGO: Algo<Params> = {
  name: "guilloche",
  spec: SPEC,
  presets: {
    engraving: { lobes: 11, winding: 4, bulge: 0.3, lace: 0.045, strands: 3, braid: 0.22, bands: 3, shrink: 0.46, twist: 13, ink: "amber" },
    cathedral: { lobes: 8, winding: 3, bulge: 0.42, lace: 0.065, strands: 3, braid: 0.18, bands: 3, shrink: 0.34, twist: 22, ink: "ice" },
    solar: { lobes: 17, winding: 7, bulge: 0.19, lace: 0.025, strands: 2, braid: 0.28, bands: 3, shrink: 0.65, twist: 7, ink: "amber" },
    lacework: { lobes: 5, winding: 2, bulge: 0.38, lace: 0.12, strands: 6, braid: 0.6, bands: 2, shrink: 0.4, twist: 36, ink: "copper" },
  },
  run: generate,
}
