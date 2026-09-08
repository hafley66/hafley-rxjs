import type { SliceParams } from "../kit/slice/0_spec.js"
import type { Stroke } from "../lib/6_slice.js"
import { slicePose } from "../lib/6b_slicePose.js"

export function paintSlice(strokes: Stroke[], time: number, params: SliceParams): void {
  for (const s of strokes) {
    if (!s.el) continue
    const pose = slicePose(s, time, params)
    if (s._op !== pose.opacity) { s.el.style.opacity = String(pose.opacity); s._op = pose.opacity }
    if (s._dash !== pose.dash) {
      s.el.style.strokeDasharray = pose.dash === null ? "none" : "1"
      s.el.style.strokeDashoffset = pose.dash === null ? "0" : String(pose.dash)
      s._dash = pose.dash
    }
    if (s._tr !== pose.transform) { s.el.setAttribute("transform", pose.transform); s._tr = pose.transform }
    if (s._w !== pose.width) { s.el.style.strokeWidth = String(pose.width); s._w = pose.width }
    if (s.bl) s.bl.style.strokeWidth = String(1.6 * params.weight)
    if (s.ai) s.ai.style.strokeWidth = String(0.75 * params.weight)
    if (s.bl && s._bd !== pose.blade) { s.bl.setAttribute("d", pose.blade); s.bl.style.strokeOpacity = pose.blade ? "1" : "0"; s._bd = pose.blade }
    if (s.ai && s._ao !== pose.afterimage) { s.ai.style.strokeOpacity = String(pose.afterimage); s._ao = pose.afterimage }
  }
}
