import { DETAIL_INPUTS } from "../kit/0_inputs.js"
import type { Algo } from "../kit/2_algo.js"
import { seal, sealCaption } from "../lib/3_seal.js"

export type SealParams = { seed: number; minPx: number; pupil: boolean }

// the seal composer as an Algo: z runs outer ring (0) to core (1), so zDepth sinks the centre
export const sealAlgo: Algo<SealParams> = {
  name: "seal",
  spec: {
    seed: { kind: "seed", hint: "seed for the seal composition", default: 1 },
    minPx: { ...DETAIL_INPUTS.minPx, hint: "smallest feature drawn, in px; bands and lobes under it are dropped (LOD)", },
    pupil: { kind: "bool", hint: "draw the pupil inside the eye band", default: true },
  },
  presets: { fine: { minPx: 1 }, coarse: { minPx: 4 } },
  run(p, ctx) {
    const sl = seal(ctx.size / 2 - 1, ctx.seed, { minPx: ctx.minPx, pupil: p.pupil, depth: true })
    return {
      paths: sl.sc.parts.map(({ d, cls, z }) => ({ d, z, cls: cls || undefined })),
      caption: sealCaption(sl, false),
      lod: sl.sc.lod,
    }
  },
}
