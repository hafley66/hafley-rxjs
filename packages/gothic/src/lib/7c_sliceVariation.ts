import { SLICE_SPEC, type SliceParams } from "../kit/slice/0_spec.js"
import { hash } from "./0_rng.js"
import { f, line } from "./1_geom.js"
import type { Stroke } from "./6_slice.js"
import { slicePose } from "./6b_slicePose.js"
import { STROKE_PROPERTIES, variedField, type StrokeMotionFrame } from "./7a_variation.js"

const identities = new WeakMap<Stroke, number>()

// Preserve the original pose. Independent appearance sampling happens at the paint boundary.
export function variedSlicePose(s: Stroke, time: number, params: SliceParams, motion?: StrokeMotionFrame) {
  let k = params
  if (motion && motion.fields) {
    const fields = Object.entries(motion.fields)
    let patches: [string, unknown][] | null = null
    for (const [name, v] of fields) {
      if (!STROKE_PROPERTIES.has(name)) continue
      let key = identities.get(s)
      if (key === undefined) { key = hash(`${s.d}|${s.sub}|${s.cx}|${s.cy}`); identities.set(s, key) }
      const patch = [name, variedField(SLICE_SPEC[name as keyof typeof SLICE_SPEC], v, motion.times?.[name] ?? motion.time, key ^ hash(name))] as [string, unknown]
      ;(patches ??= []).push(patch)
    }
    if (patches) k = { ...params, ...Object.fromEntries(patches) }
  }
  const pose = slicePose(s, time, k)
  const age = time - s.t0 - s.dur
  const afterimage = k.ai && age >= 0 && age < k.aiFade ? f(k.aiOpacity * (1 - age / k.aiFade)) : 0
  return { ...pose,
    afterimage,
    bladeWidth: 1.6 * k.weight, afterimageWidth: 0.75 * k.weight,
    afterimagePath: afterimage > 0 ? line(s.cx - Math.cos(s.th) * s.diag * k.ailen, s.cy - Math.sin(s.th) * s.diag * k.ailen, s.cx + Math.cos(s.th) * s.diag * k.ailen, s.cy + Math.sin(s.th) * s.diag * k.ailen) : "",
  }
}
