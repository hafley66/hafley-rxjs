import svgpath from "svgpath"
import { svgPathProperties } from "svg-path-properties"
import { SLICE_DEFAULTS, type SliceParams } from "../kit/slice/0_spec.js"
import { mulberry32 } from "./0_rng.js"
import { pl, type Pt } from "./1_geom.js"
import { schedule, type Stroke } from "./6_slice.js"

export type PathInput = string | readonly Pt[] | { d: string; transform?: string }
export type SliceStroke = Stroke & { source: number; baseWidth?: number }
export type SliceTimeline = { strokes: SliceStroke[]; T: number; bursts: number; size: number }
export type SliceGeometryOptions = { size?: number; maxStrokes?: number }

export function splitPath(d: string, transform?: string): string[] {
  const path = svgpath(d)
  // svgpath reports a parse error without throwing.
  const error = (path as typeof path & { err?: string }).err
  if (error) throw new Error(`Invalid SVG path: ${error}`)
  if (transform) path.transform(transform)
  const out: string[] = []
  path.abs().unshort().iterate(segment => {
    const command = segment[0].toUpperCase()
    const text = `${command}${segment.slice(1).join(" ")}`
    if (command === "M") out.push(text)
    else if (out.length) out[out.length - 1] += text
  })
  return out
}

export function slicePaths(paths: readonly PathInput[], options: Partial<SliceParams> = {}, geometry: SliceGeometryOptions = {}): SliceTimeline {
  const k = { ...SLICE_DEFAULTS, ...options }
  const size = geometry.size ?? 240
  const maxStrokes = geometry.maxStrokes ?? 12000
  if (!(size > 0) || !Number.isFinite(size) || !(k.cut > 0) || !Number.isFinite(k.cut)) throw new Error("Slice size and cut must be finite and positive")
  const random = mulberry32(k.seed ^ 0x5bf03635)
  const strokes: SliceStroke[] = []
  let sub = 0
  for (const [source, input] of paths.entries()) {
    const shape = typeof input === "string" ? { d: input } : Array.isArray(input) ? { d: input.length ? pl(input as Pt[]) : "" } : input as { d: string; transform?: string }
    if (!shape.d.trim()) continue
    for (const d of splitPath(shape.d, shape.transform)) {
      sub++
      let path = new svgPathProperties(d)
      // Some exact semicircles hit a floating-point edge in the arc length evaluator.
      // Convert those arcs to cubic segments with svgpath for measurement.
      if (!Number.isFinite(path.getTotalLength())) path = new svgPathProperties(svgpath(d).unarc().toString())
      const length = path.getTotalLength()
      if (!Number.isFinite(length)) throw new Error("SVG path length must be finite")
      if (!(length > 0)) continue
      const count = Math.max(1, Math.ceil(length / Math.max(6, k.cut * size / 240)))
      if (strokes.length + count > maxStrokes) throw new Error(`Slice exceeds maxStrokes=${maxStrokes}; increase cut or the explicit budget`)
      for (let i = 0; i < count; i++) {
        const a = length * i / count, b = length * (i + 1) / count
        const samples = Math.max(2, Math.min(40, Math.ceil((b - a) / 3)))
        const pts: Pt[] = Array.from({ length: samples + 1 }, (_, j) => {
          const p = path.getPointAtLength(a + (b - a) * j / samples)
          if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) throw new Error("SVG path coordinates must be finite")
          return [p.x, p.y]
        })
        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
        const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1]
        const chord = Math.hypot(bx - ax, by - ay) || size * 0.05
        const th = Math.atan2(by - ay, bx - ax) + (random() < 0.5 ? Math.PI : 0) + (random() * 2 - 1) * k.jit * Math.PI / 180
        strokes.push({
          d: pl(pts), pts, source, sub, size, th,
          cx: xs.reduce((a, b) => a + b, 0) / pts.length, cy: ys.reduce((a, b) => a + b, 0) / pts.length,
          diag: Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) || size * 0.05,
          D: k.dist * chord, noise: random(), rev: random() < 0.5,
          t0: 0, dur: 0, i: 0, el: null, ai: null, bl: null,
        })
      }
    }
  }
  if (!strokes.length) return { strokes, T: 0, bursts: 0, size }
  return { strokes, ...schedule(strokes, k, k.seed), size }
}
