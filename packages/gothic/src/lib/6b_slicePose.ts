import type { SliceParams } from "../kit/slice/0_spec.js"
import { clamp01, f, line } from "./1_geom.js"
import { alongPts, FLY } from "./6_slice.js"
import type { SliceStroke } from "./6a_slicePaths.js"

export type SliceFrame = {
  opacity: number; transform: string; matrix: [number, number, number, number, number, number]
  dash: number | null; blade: string; width: number; afterimage: number
}

// Same pose equations as /slice, independent of a DOM, React, or clock.
export function slicePose(s: Omit<SliceStroke, "source">, t: number, k: SliceParams): SliceFrame {
  const u = clamp01((t - s.t0) / s.dur)
  const age = t - s.t0 - s.dur
  const opacity = f(clamp01(u / 0.25))
  const p = FLY[k.fease](u, k.os)
  const slide = k.reveal === "slide" || k.reveal === "draw+slide"
  const off = !slide ? 0 : t < s.t0 ? s.D : s.D * (k.reveal === "draw+slide" ? 0.35 : 1) * (1 - p)
  const isCut = k.reveal === "cut"
  const hq = isCut ? -0.3 + 1.6 * clamp01(p) : 0
  const drawn = isCut ? clamp01(hq) : clamp01(p)
  let blade = ""
  if (isCut && u > 0 && u < 1) {
    const q = s.rev ? 1 - clamp01(hq) : clamp01(hq)
    const [bx, by, tx, ty] = alongPts(s.pts, q)
    const bw = Math.max(3, s.diag * 0.3)
    blade = line(bx - ty * bw, by + tx * bw, bx + ty * bw, by - tx * bw)
  }
  const dash = k.reveal === "draw" || k.reveal === "draw+slide" || isCut ? f((s.rev ? -1 : 1) * (1 - drawn)) : null
  const st = u >= 1 ? 0 : k.stretch * (u < 0.85 ? u / 0.85 : Math.cos((u - 0.85) / 0.15 * 4.712) * (1 - (u - 0.85) / 0.15))
  const deg = f(s.th * 180 / Math.PI), c = Math.cos(s.th), sn = Math.sin(s.th)
  const transform = `translate(${f(off * c)} ${f(off * sn)}) translate(${f(s.cx)} ${f(s.cy)}) rotate(${deg}) scale(${f(1 + st)} 1) rotate(${-deg}) translate(${f(-s.cx)} ${f(-s.cy)})`
  const a = 1 + st * c * c, b = st * c * sn, d = 1 + st * sn * sn
  return {
    opacity, transform, dash, blade,
    matrix: [a, b, b, d, off * c + s.cx - a * s.cx - b * s.cy, off * sn + s.cy - b * s.cx - d * s.cy],
    width: f((k.weight + (k.finalWeight - k.weight) * clamp01(age / 80)) * (s.baseWidth ?? 1) * (age >= 0 && age < 80 ? 1 + 1.5 * (1 - age / 80) : 1)),
    afterimage: k.ai && age >= 0 && age < 120 ? f(0.85 * (1 - age / 120)) : 0,
  }
}
