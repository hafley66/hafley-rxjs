import { type AnySpec, type ValuesOf } from "@hafley66/report-shell"
import type { Algo, AlgoCtx, AlgoOut } from "../kit/2_algo.js"
import { circle, f, M, polar, TAU } from "../lib/1_geom.js"
import { foilRing } from "../lib/2_foil.js"

export const SPEC = {
  lights: { kind: "range", hint: "radial lancet lights in each wheel", min: 5, max: 24, step: 1, default: 12 },
  wheels: { kind: "range", hint: "nested generations of the wheel window", min: 1, max: 4, step: 1, default: 3 },
  inner: { kind: "range", hint: "inner foot radius of the radial lancets", min: 0.22, max: 0.65, step: 0.01, default: 0.4 },
  width: { kind: "range", hint: "angular width of each lancet within its sector", min: 0.4, max: 0.98, step: 0.02, default: 0.88 },
  stagger: { kind: "range", hint: "rotation between successive wheels as a fraction of a sector", min: 0, max: 1, step: 0.05, default: 0.5 },
  foils: { kind: "range", hint: "lobes inside the outer crown lights", min: 3, max: 6, step: 1, default: 4 },
  mouldings: { kind: "range", hint: "stone outlines around each radial lancet", min: 1, max: 3, step: 1, default: 2 },
  minPx: { kind: "range", hint: "smallest tracery light in pixels", min: 1, max: 4, step: 0.5, default: 2 },
  // scaffold:inputs
} as const satisfies AnySpec
export type Params = ValuesOf<typeof SPEC>

export function generate(p: Params, ctx: AlgoCtx): AlgoOut {
  const paths: AlgoOut["paths"] = []
  const R = ctx.size * 0.46, sector = TAU / p.lights
  let wheels = 0
  for (let band = 0; band < p.wheels; band++) {
    const r = R * (p.inner * 0.92) ** band
    if (r < ctx.minPx * 6) break
    const z = band / Math.max(1, p.wheels - 1)
    paths.push({ d: circle(0, 0, r), z }, { d: circle(0, 0, r * 1.04), z, cls: "opacity-65" }, { d: circle(0, 0, r * p.inner), z })
    for (let light = 0; light < p.lights; light++) {
      const a = light * sector + band * sector * p.stagger - Math.PI / 2
      for (let mould = 0; mould < p.mouldings; mould++) {
        const half = sector * p.width * 0.5 * (1 - mould * 0.12)
        const tip = r * (0.97 - mould * 0.055), foot = r * (p.inner + mould * 0.015)
        const left = polar(foot, a - half), right = polar(foot, a + half), top = polar(tip, a)
        const c1 = polar(r * 0.72, a - half), c2 = polar(tip, a - half * 0.38)
        const c3 = polar(tip, a + half * 0.38), c4 = polar(r * 0.72, a + half)
        paths.push({ d: `${M(...left)}C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(top[0])} ${f(top[1])}C${f(c3[0])} ${f(c3[1])} ${f(c4[0])} ${f(c4[1])} ${f(right[0])} ${f(right[1])}`, z, cls: "[--w:0.8]" })
      }
      const q = polar(r * 0.73, a), fr = r * Math.sin(sector / 2) * 0.48
      if (fr > ctx.minPx * 1.6) paths.push({ d: foilRing(q[0], q[1], fr, p.foils), z: Math.min(1, z + 0.2), cls: "[--w:0.7]" })
    }
    wheels++
  }
  paths.push({ d: foilRing(0, 0, R * (p.inner * 0.92) ** wheels * 0.95, Math.min(6, p.foils)), z: 1 })
  return { paths, caption: `${p.lights} lights · ${wheels} wheels`, lod: wheels < p.wheels ? ["inner wheels omitted"] : [] }
}

export const ALGO: Algo<Params> = {
  name: "wheel", spec: SPEC,
  presets: { rayonnant: { lights: 12, wheels: 3, inner: 0.4, width: 0.88, stagger: 0.5, foils: 4 }, sunflower: { lights: 20, wheels: 2, inner: 0.58, width: 0.96, stagger: 0.5, foils: 3 }, compass: { lights: 8, wheels: 4, inner: 0.5, width: 0.72, stagger: 0, foils: 5 } },
  run: generate,
}
