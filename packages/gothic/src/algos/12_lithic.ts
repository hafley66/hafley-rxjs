import { type AnySpec, type ValuesOf } from "@hafley66/report-shell"
import { SEED_INPUTS } from "../kit/0_inputs.js"
import type { Algo, AlgoCtx, AlgoOut } from "../kit/2_algo.js"
import { MOTION } from "../kit/3_motion.js"
import { mulberry32 } from "../lib/0_rng.js"
import { clamp, f, pl, type Pt } from "../lib/1_geom.js"
import { ink, plate, roundel } from "../lib/2b_plate.js"

export const SPEC = {
  seed: { ...SEED_INPUTS.seed, hint: "repeatable branching and filament variation", default: 17 },
  petals: { kind: "range", hint: "pointed openings around the rose", min: 6, max: 14, step: 1, default: 10 },
  stone: { kind: "range", hint: "width of the new calcified members", min: 3, max: 9, step: 0.5, default: 6 },
  filaments: { kind: "range", hint: "fine pioneer branches growing ahead of the stone", min: 2, max: 14, step: 1, default: 9 },
  focus: { kind: "range", hint: "petal receiving the first growth pulse; click the rose to choose", min: 0, max: 13, step: 1, default: 0 },
  ...MOTION,
  time: { ...MOTION.time, default: 0.58 },
  // scaffold:inputs
} as const satisfies AnySpec
export type Params = ValuesOf<typeof SPEC>

export type Branch = { points: Pt[]; start: number; width: number }
export const PETAL = "M0 0C-82 -65 -83 -207 0 -300C83 -207 82 -65 0 0Z"

export function cubic(a: Pt, b: Pt, c: Pt, d: Pt, t: number): Pt {
  const s = 1 - t
  return [0, 1].map(k => s ** 3 * a[k] + 3 * s * s * t * b[k] + 3 * s * t * t * c[k] + t ** 3 * d[k]) as Pt
}

// Boundary anchors make the new ribs split an existing aperture into closed sub-openings.
// Seeded offsets perturb the interior controls, leaving every shared joint and anchor exact.
export function growPetal(seed: number): Branch[] {
  const random = mulberry32(seed)
  const fork: Pt = [(random() - 0.5) * 16, -102]
  const left = cubic([0, 0], [-82, -65], [-83, -207], [0, -300], 0.63)
  const right: Pt = [-left[0], left[1]]
  const curves: [Pt, Pt, Pt, Pt, number, number][] = [
    [[0, 0], [-18, -34], [fork[0] + 16, -74], fork, 0, 1.25],
    [fork, [fork[0] - 24, -109], [-52, -118], left, 0.16, 1],
    [fork, [fork[0] + 28, -108], [54, -119], right, 0.2, 1],
    [fork, [fork[0] + 24, -182], [-28, -225], [0, -300], 0.23, 0.8],
  ]
  return curves.map(([a, b, c, d, start, width]) => {
    const bend = (random() - 0.5) * 9
    b = [b[0] + bend, b[1]]
    return { points: Array.from({ length: 49 }, (_, i) => cubic(a, b, c, d, i / 48)), start, width }
  })
}

export function partial(points: Pt[], progress: number): Pt[] {
  const at = clamp(progress) * (points.length - 1)
  const index = Math.floor(at)
  const out = points.slice(0, index + 1)
  if (index < points.length - 1) out.push([
    points[index][0] + (points[index + 1][0] - points[index][0]) * (at - index),
    points[index][1] + (points[index + 1][1] - points[index][1]) * (at - index),
  ])
  return out
}

export function generate(p: Params, ctx: AlgoCtx): AlgoOut {
  const id = `lithic-${ctx.size}`
  const bone = `url(#${id}-bone)`
  const gold = `url(#${id}-gold)`
  let body = roundel(466, "#080f16", "#777c6c", 1)
  body += roundel(449, bone, "#b9b49a", 1) + roundel(428, "#101b24", "#262e2e", 3)
  for (let i = 0; i < p.petals * 3; i++) {
    body += `<g transform="rotate(${i * 360 / (p.petals * 3)})">${ink("M-8 -437Q-13 -449 0 -460Q13 -449 8 -437Z", "#1b2b30", "#9b9e89", 1)}</g>`
  }
  const squeeze = Math.min(1, 10 / p.petals)
  for (let i = 0; i < p.petals; i++) {
    const random = mulberry32(p.seed + i * 7919)
    const rank = (i - p.focus % p.petals + p.petals) % p.petals
    const time = clamp(p.time * 1.35 - rank / p.petals * 0.28)
    const solid = clamp((time - 0.63) / 0.26)
    const veins = growPetal(p.seed + i * 67)
    const clip = `${id}-petal-${i}`
    let petal = `<defs><clipPath id="${clip}">${ink(PETAL, "white")}</clipPath></defs>`
    petal += ink(PETAL, `url(#${id}-glass)`, "#050e15", 22)
    petal += ink(PETAL, "none", bone, 13) + ink(PETAL, "none", "#e0d7b6", 1)
    petal += `<g clip-path="url(#${clip})">`
    // Fine glass fractures and seed flecks stay behind the growing organism.
    for (let j = 0; j < 16; j++) {
      const x = (random() - 0.5) * 110
      const y = -random() * 280
      petal += ink(`M${f(x)} ${f(y)}l${f(random() * 12 - 6)} -15l${f(random() * 8)} -9`, "none", "#527477", 0.5, 'opacity=".32"')
    }
    for (const [j, branch] of veins.entries()) {
      const growth = clamp((time - branch.start) / 0.4)
      if (!growth) continue
      const points = partial(branch.points, growth)
      const d = pl(points)
      const width = 0.8 + solid * p.stone * branch.width
      const end = points[points.length - 1]
      petal += ink(d, "none", "#020d15", width + solid * 2.5 + 0.8)
      petal += ink(d, "none", solid > 0.85 ? bone : "#c0d0aa", width, `data-branch="${j}"`)
      if (solid > 0) petal += ink(d, "none", "#ece5c4", 0.7, `opacity="${f(solid)}" transform="translate(-.8 -.5)"`)
      if (growth < 1) {
        petal += `<circle cx="${f(end[0])}" cy="${f(end[1])}" r="2" style="fill:#e1eebd;stroke:none"/>`
      }
      for (let k = 0; k < p.filaments; k++) {
        const idx = 5 + Math.floor(random() * 38)
        const base = branch.points[idx]
        const reach = clamp((growth - idx / 48) * 5) * (1 - solid)
        const side = k % 2 ? 1 : -1
        const length = (6 + random() * 14) * reach
        if (length < 0.1) continue
        petal += ink(`M${f(base[0])} ${f(base[1])}q${f(side * length)} ${f(-length * 0.2)} ${f(side * length * 0.7)} ${f(-length)}m${f(-side * length * 0.2)} ${f(length * 0.5)}l${f(side * length * 0.4)} ${f(-length * 0.4)}`, "none", "#b2c8a1", 0.65, `opacity="${f(1 - solid * 0.85)}"`)
      }
    }
    petal += "</g>"
    body += `<g data-petal="${i}" data-solid="${f(solid)}" transform="rotate(${i * 360 / p.petals}) translate(0 -108) scale(${squeeze} 1)">${petal}</g>`
    body += `<g transform="rotate(${(i + 0.5) * 360 / p.petals})">${ink("M0 -168Q-25 -235 0 -310Q25 -235 0 -168Z", "#0a1720", "#8b9685", 1.5)}${ink("M0 -190V-288", "none", "#8b9685", 0.65)}</g>`
  }
  body += roundel(109, "#19282c", bone, 10) + roundel(98, "#0b1720", "#b9b592", 1)
  for (let i = 0; i < 8; i++) {
    body += `<g transform="rotate(${i * 45})">${ink("M0 -88Q28 -44 0 -16Q-28 -44 0 -88Z", `url(#${id}-glass)`, gold, 2)}</g>`
  }
  body += roundel(17, "#c4caa7", "#4b5b56", 3)
  return { paths: [], raw: [plate(ctx.size, id, body)], caption: "Mycelial Rose Window", lod: [] }
}

export const ALGO: Algo<Params> = {
  name: "lithic", spec: SPEC,
  presets: {
    "pioneer": { seed: 17, petals: 10, stone: 6, filaments: 12, time: 0.28, run: false },
    "petrified": { seed: 17, petals: 10, stone: 7, filaments: 9, time: 1, run: false },
    "cloister": { seed: 51, petals: 8, stone: 4.5, filaments: 7, time: 0.52, run: false },
  },
  run: generate,
}
