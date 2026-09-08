import { defaultsOf, type AnySpec, type ValuesOf } from "@hafley66/report-shell"
import { ALGO as braid } from "./14_braid.js"
import { ALGO as cloister } from "./9_cloister.js"
import { fma2 } from "./2_fma.js"
import { hilbert } from "./1_fractal.js"
import { ALGO as guilloche } from "./3_guilloche.js"
import { ALGO as resonance } from "./17_resonance.js"
import type { Algo, AlgoCtx, AlgoOut } from "../kit/2_algo.js"

// the scenes the vello tab can stroke on GPU; each entry is an existing Algo run at its defaults
export const SCENES: Record<string, Algo<any>> = {
  fma2,
  braid,
  guilloche,
  hilbert,
  cloister,
  resonance,
}

export const SPEC = {
  scene: {
    kind: "select",
    hint: "which generator feeds vello's GPU strokes",
    options: Object.keys(SCENES),
    default: "braid",
  },
  seed: { kind: "seed", hint: "seed for the chosen scene", default: 7 },
  width: {
    kind: "range",
    hint: "stroke width in canvas px before zoom",
    min: 0.5,
    max: 6,
    step: 0.25,
    default: 1.5,
    label: "pen px",
  },
  zoom: {
    kind: "range",
    hint: "scene scale; the canvas centers the viewBox origin",
    min: 0.2,
    max: 2,
    step: 0.05,
    default: 1,
  },
} as const satisfies AnySpec
export type Params = ValuesOf<typeof SPEC>

export function generate(p: Params, ctx: AlgoCtx): AlgoOut {
  const algo = SCENES[p.scene] ?? fma2
  const values = { ...(defaultsOf(algo.spec as never) as object), seed: p.seed } as Record<string, unknown>
  const out = algo.run(values, { ...ctx, seed: p.seed })
  return { ...out, caption: `vello · ${out.caption}` }
}

export const ALGO: Algo<Params> = {
  name: "vello",
  spec: SPEC,
  presets: {
    "braid ribbon": { scene: "braid", width: 2.5, zoom: 1 },
    "cloister ink": { scene: "cloister", width: 1, zoom: 0.9 },
    resonance: { scene: "resonance", width: 1.25, zoom: 1 },
  },
  run: generate,
}
