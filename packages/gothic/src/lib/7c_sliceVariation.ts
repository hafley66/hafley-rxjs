import { SLICE_SPEC, type SliceParams } from "../kit/slice/0_spec.js"
import { hash } from "./0_rng.js"
import { f, line } from "./1_geom.js"
import type { Stroke } from "./6_slice.js"
import { slicePose } from "./6b_slicePose.js"
import { STROKE_PROPERTIES, variedField, type StrokeMotionFrame } from "./7a_variation.js"

const identities = new WeakMap<Stroke, number>()

// Preserve the original pose. Independent appearance sampling happens at the paint boundary.
export function variedSlicePose(s: Stroke, time: number, params: SliceParams, motion?: StrokeMotionFrame) {
  let key = identities.get(s)
  if (key === undefined) { key = hash(`${s.d}|${s.sub}|${s.cx}|${s.cy}`); identities.set(s, key) }
  const patches = Object.entries(motion?.fields ?? {}).filter(([name]) => STROKE_PROPERTIES.has(name)).map(([name, v]) =>
    [name, variedField(SLICE_SPEC[name as keyof typeof SLICE_SPEC], v, motion!.time, key! ^ hash(name))])
  const k = patches.length ? { ...params, ...Object.fromEntries(patches) } : params
  const pose = slicePose(s, time, k), age = time - s.t0 - s.dur
  const length = s.diag * k.ailen, x = Math.cos(s.th) * length, y = Math.sin(s.th) * length
  return { ...pose,
    afterimage: k.ai && age >= 0 && age < k.aiFade ? f(k.aiOpacity * (1 - age / k.aiFade)) : 0,
    bladeWidth: 1.6 * k.weight, afterimageWidth: 0.75 * k.weight,
    afterimagePath: line(s.cx - x, s.cy - y, s.cx + x, s.cy + y),
  }
}
