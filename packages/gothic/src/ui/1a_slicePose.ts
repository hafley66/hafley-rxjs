import type { SliceParams } from "../kit/slice/0_spec.js"
import type { Stroke } from "../lib/6_slice.js"
import { variedSlicePose } from "../lib/7c_sliceVariation.js"
import type { StrokeMotionFrame } from "../lib/7a_variation.js"

export function paintSlice(strokes: Stroke[], time: number, params: SliceParams, motion?: StrokeMotionFrame): void {
  for (const s of strokes) {
    if (!s.el) continue
    const pose = variedSlicePose(s, time, params, motion)
    if (s._op !== pose.opacity) { s.el.style.opacity = String(pose.opacity); s._op = pose.opacity }
    if (s._dash !== pose.dash) {
      s.el.style.strokeDasharray = pose.dash === null ? "none" : "1"
      s.el.style.strokeDashoffset = pose.dash === null ? "0" : String(pose.dash)
      s._dash = pose.dash
    }
    if (s._tr !== pose.transform) { s.el.setAttribute("transform", pose.transform); s._tr = pose.transform }
    if (s._w !== pose.width) { s.el.style.strokeWidth = String(pose.width); s._w = pose.width }
    if (s.bl && s._bw !== pose.bladeWidth) { s.bl.style.strokeWidth = String(pose.bladeWidth); s._bw = pose.bladeWidth }
    if (s.ai) {
      s.ai.style.strokeWidth = String(pose.afterimageWidth)
      if (s.ai.getAttribute("d") !== pose.afterimagePath) s.ai.setAttribute("d", pose.afterimagePath)
    }
    if (s.bl && s._bd !== pose.blade) { s.bl.setAttribute("d", pose.blade); s.bl.style.strokeOpacity = pose.blade ? "1" : "0"; s._bd = pose.blade }
    if (s.ai && s._ao !== pose.afterimage) { s.ai.style.strokeOpacity = String(pose.afterimage); s._ao = pose.afterimage }
  }
}
