import type { Algo } from "../kit/5_algo.js"
import { seal, sealCaption } from "../lib/3_seal.js"

export type SealParams = { seed: number; minPx: number; pupil: boolean }

// the seal composer as an Algo: z runs outer ring (0) to core (1), so zDepth sinks the centre
export const sealAlgo: Algo<SealParams> = {
  name: "seal",
  spec: {
    seed: { kind: "seed", default: 1 },
    minPx: { kind: "range", min: 1, max: 6, step: 0.5, default: 2 },
    pupil: { kind: "bool", default: true, static: true },
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
