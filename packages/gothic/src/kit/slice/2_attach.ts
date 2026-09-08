import { Signal } from "@hafley66/signals"
import { combineLatest, concat, defer, distinctUntilChanged, filter, finalize, map, NEVER, of, type Observable, shareReplay, switchMap } from "rxjs"
import { f, line } from "../../lib/1_geom.js"
import { schedule } from "../../lib/6_slice.js"
import { slicePaths, type SliceGeometryOptions, type SliceTimeline } from "../../lib/6a_slicePaths.js"
import { paintSlice } from "../../ui/1a_slicePose.js"
import { SLICE_DEFAULTS, type SliceParams } from "./0_spec.js"
import { playback, type PlaybackRuntime } from "../1a_playback.js"
import type { StrokeMotionFrame } from "../../lib/7a_variation.js"

const NS = "http://www.w3.org/2000/svg"
const GEOMETRY = "path,circle,ellipse,line,polyline,polygon,rect"
export type SliceTarget = Element | readonly SVGGeometryElement[]
export type SliceAttachOptions = Partial<SliceParams> & SliceGeometryOptions & { loop?: boolean; reducedMotion?: boolean; params?: Signal<SliceParams>; input?: Signal<SliceParams>; motion?: Signal<StrokeMotionFrame> }
type Source = { element: SVGGeometryElement; group: SVGGElement; visibility: string; priority: string; width: string; widthPriority: string; baseWidth: number; style: string | null; normalizedStyle: string; end: number }

function sourcePath(element: SVGGeometryElement): string {
  if (element.tagName.toLowerCase() === "path") return element.getAttribute("d") ?? ""
  const length = element.getTotalLength()
  if (!(length > 0)) return ""
  const count = Math.max(2, Math.min(2048, Math.ceil(length / 2)))
  return Array.from({ length: count + 1 }, (_, i) => {
    const point = element.getPointAtLength(length * i / count)
    return `${i ? "L" : "M"}${f(point.x)} ${f(point.y)}`
  }).join("")
}

// The native binding is acquired inside a cold observable and released by finalize.
function bindSlice(target: SliceTarget, params: SliceParams, options: SliceAttachOptions) {
  let timeline: SliceTimeline = { strokes: [], T: 0, bursts: 0, size: options.size ?? 240 }
  let sources: Source[] = []
  function restore() {
    for (const s of sources) {
      if (s.width) s.element.style.setProperty("stroke-width", s.width, s.widthPriority)
      else s.element.style.removeProperty("stroke-width")
      if (s.visibility) s.element.style.setProperty("visibility", s.visibility, s.priority)
      else s.element.style.removeProperty("visibility")
      if (s.element.style.cssText === s.normalizedStyle) {
        // Flush SVG's lazily serialized style before removing an originally absent attribute.
        s.element.getAttribute("style")
        if (s.style === null) s.element.removeAttribute("style")
        else s.element.setAttribute("style", s.style)
      }
      s.group.remove()
    }
    sources = []
  }
  function paint(time: number, params: SliceParams, motion?: StrokeMotionFrame) {
    paintSlice(timeline.strokes, time, params, motion)
    for (const source of sources) {
      const done = time >= source.end + Math.max(0, params.aiFade - 120) && !Object.keys(motion?.fields ?? {}).length
      source.group.style.display = done ? "none" : ""
      if (done) {
        source.element.style.setProperty("stroke-width", String(source.baseWidth * params.finalWeight))
        if (source.visibility) source.element.style.setProperty("visibility", source.visibility, source.priority)
        else source.element.style.removeProperty("visibility")
      } else {
        if (source.width) source.element.style.setProperty("stroke-width", source.width, source.widthPriority)
        else source.element.style.removeProperty("stroke-width")
        source.element.style.setProperty("visibility", "hidden", "important")
      }
    }
  }
  function refresh() {
    restore()
    const roots: readonly Element[] = Array.isArray(target) ? target : [target as Element]
    const elements = roots.flatMap(root => [
      ...(root.matches(GEOMETRY) ? [root as SVGGeometryElement] : []),
      ...root.querySelectorAll<SVGGeometryElement>(GEOMETRY),
    ]).filter((el, i, all) => all.indexOf(el) === i && !el.closest("defs,clipPath,mask,marker,pattern,symbol,[data-slice-overlay]"))
      .filter(el => { const css = getComputedStyle(el); return css.display !== "none" && css.visibility !== "hidden" && css.visibility !== "collapse" })
    const originals = elements.map(element => ({ style: element.getAttribute("style"), normalizedStyle: element.style.cssText,
      width: element.style.getPropertyValue("stroke-width"), widthPriority: element.style.getPropertyPriority("stroke-width"),
      visibility: element.style.getPropertyValue("visibility"), priority: element.style.getPropertyPriority("visibility") }))
    const styles = elements.map(el => getComputedStyle(el))
    const size = options.size ?? Math.max(1, ...elements.map(el => el.ownerSVGElement?.viewBox.baseVal.width || 240))
    const compiled = slicePaths(elements.map(sourcePath), params, { ...options, size })
    // Scheduling sees screen-space centers, while each stroke's pose stays in its source's local coordinates.
    const matrices = elements.map(el => el.getScreenCTM())
    const screen = compiled.strokes.map(stroke => {
      const m = matrices[stroke.source]
      return m ? { ...stroke, cx: m.a * stroke.cx + m.c * stroke.cy + m.e, cy: m.b * stroke.cx + m.d * stroke.cy + m.f } : { ...stroke }
    })
    if (screen.length) {
      const cx = (Math.min(...screen.map(s => s.cx)) + Math.max(...screen.map(s => s.cx))) / 2
      const cy = (Math.min(...screen.map(s => s.cy)) + Math.max(...screen.map(s => s.cy))) / 2
      for (const s of screen) { s.cx -= cx; s.cy -= cy }
      const result = schedule(screen, params, params.seed)
      compiled.T = result.T; compiled.bursts = result.bursts
      screen.forEach((s, i) => { compiled.strokes[i].t0 = s.t0; compiled.strokes[i].dur = s.dur; compiled.strokes[i].i = s.i })
    }
    try {
      for (const [i, element] of elements.entries()) {
        const strokes = compiled.strokes.filter(s => s.source === i)
        if (!strokes.length) continue
        const css = styles[i]
        const group = document.createElementNS(NS, "g")
        group.dataset.sliceOverlay = ""
        group.style.pointerEvents = "none"
        group.style.opacity = css.opacity
        group.style.transform = css.transform
        group.style.transformOrigin = css.transformOrigin
        group.style.clipPath = css.clipPath
        group.style.mask = css.mask
        group.style.filter = css.filter
        const source: Source = { element, group, ...originals[i], baseWidth: parseFloat(css.strokeWidth) || 1, end: Math.max(...strokes.map(s => s.t0 + s.dur)) + 120 }
        element.after(group)
        sources.push(source)
        for (const stroke of strokes) {
          const make = (d: string, width: number) => {
            const path = document.createElementNS(NS, "path")
            path.setAttribute("d", d)
            Object.assign(path.style, { fill: "none", stroke: css.stroke === "none" ? css.fill === "none" ? css.color : css.fill : css.stroke,
              strokeWidth: String(width), strokeLinecap: css.strokeLinecap, strokeLinejoin: css.strokeLinejoin, vectorEffect: "none",
              strokeOpacity: css.strokeOpacity, animation: "none", strokeDasharray: "none", strokeDashoffset: "0", opacity: "0" })
            group.append(path)
            return path
          }
          stroke.baseWidth = parseFloat(css.strokeWidth) || 1
          const length = stroke.diag * params.ailen, x = Math.cos(stroke.th) * length, y = Math.sin(stroke.th) * length
          stroke.ai = make(line(stroke.cx - x, stroke.cy - y, stroke.cx + x, stroke.cy + y), 0.75)
          stroke.ai.style.opacity = "1"
          stroke.bl = make("", 1.6); stroke.bl.style.opacity = "1"
          stroke.el = make(stroke.d, stroke.baseWidth); stroke.el.setAttribute("pathLength", "1")
        }
      }
      timeline = compiled
    } catch (error) { restore(); throw error }
  }
  refresh()
  return { timeline, paint, unsubscribe: restore }
}

export function attachSlice(target: SliceTarget | null = null, options: SliceAttachOptions = {}) {
  const params = options.params ?? Signal<SliceParams>({ ...SLICE_DEFAULTS, ...Object.fromEntries(Object.entries(options).filter(([key]) => key in SLICE_DEFAULTS)) })
  const input = options.input ?? params
  const reducedMotion = options.reducedMotion ?? (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches)
  const runtime = Signal<PlaybackRuntime & { target: SliceTarget | null; revision: number }>({ target, enabled: !reducedMotion, seek: null, revision: 0 })
  const empty: SliceTimeline = { strokes: [], T: 0, bursts: 0, size: options.size ?? 240 }
  const fields = ["seed", "cut", "angle", "jit", "dist", "flight", "order", "curve", "ordN", "gain", "silence", "spread", "burst"] as const
  const binding$ = combineLatest([
    runtime.target.$.pipe(distinctUntilChanged()), runtime.revision.$.pipe(distinctUntilChanged()),
    input.$.pipe(map(p => fields.map(field => p[field]).join("|")), distinctUntilChanged()),
  ]).pipe(switchMap(([node]) => node ? defer(() => {
    const binding = bindSlice(node, input.$(), options)
    return concat(of(binding), NEVER).pipe(finalize(binding.unsubscribe))
  }) : of(null)), shareReplay({ bufferSize: 1, refCount: true }))
  // A React ref replacement briefly emits null. Keep the clock's span through that gap.
  const clock = playback(params, binding$.pipe(filter(binding => binding !== null), map(binding => binding.timeline.T)), { ...options, runtime: runtime as unknown as Signal<PlaybackRuntime>, reducedMotion, landOnReduce: true })
  const motion$: Observable<StrokeMotionFrame | undefined> = options.motion ? options.motion.$ : of(undefined)
  const frame = Signal(combineLatest([binding$, clock.frame.$, input.$, motion$]).pipe(map(([binding, clock, params, motion]) => {
    binding?.paint(clock.time, params, motion)
    return { ...clock, timeline: binding?.timeline ?? empty }
  })), { time: 0, active: false, timeline: empty })
  return {
    params, runtime, frame,
    seek(ms: number) {
      const total = frame.timeline.T.$()
      params.$({ ...params.$(), time: total ? Math.max(0, Math.min(1, ms / total)) : 0, run: false })
      clock.seek(ms)
    },
    replay() { params.time.$(0); clock.replay() },
    refresh() { runtime.revision.$(runtime.revision.$() + 1) },
    ref(node: Element | null) { runtime.target.$(node) },
  }
}
export type SliceController = ReturnType<typeof attachSlice>
