import type { AnySpec, Field } from "@hafley66/report-shell"
import { eases } from "animejs"
import type { Variation, VariationPolicy } from "./7a_variation.js"

export type TimelineValue = string | number | boolean
export type Timing = { duration: number; delay: number; easing: "linear" | "inOutSine" | "inOutQuad"; direction: "normal" | "reverse" | "alternate"; loop: boolean }
export type PropertyTrack = { enabled: boolean; timing: Partial<Timing>; frames: { at: number; value: TimelineValue }[]; variationPolicy?: VariationPolicy; variation?: Partial<Variation> }
export type SectionTracks = { timing: Partial<Timing>; fields: Record<string, PropertyTrack>; variation?: Partial<Variation> }
export const DEFAULT_TIMING: Timing = { duration: 4000, delay: 0, easing: "linear", direction: "normal", loop: true }

export function sampleProperty(base: TimelineValue, field: Field, track: PropertyTrack, ms: number, timing: Timing): TimelineValue {
  if (!track.enabled || !track.frames.length || ms < timing.delay) return base
  const duration = Math.max(1, timing.duration), elapsed = Math.max(0, ms - timing.delay)
  const frames = track.frames.filter(f => Number.isFinite(f.at)).slice().sort((a, b) => a.at - b.at)
  if (!frames.length) return base
  const cycle = Math.floor(elapsed / duration)
  let t = timing.loop ? elapsed / duration - cycle : Math.min(1, elapsed / duration)
  if (timing.direction === "reverse" || timing.direction === "alternate" && cycle % 2 && timing.loop) t = 1 - t
  let a = frames[0], b = frames[frames.length - 1]
  if (t < a.at) b = a
  else {
    for (let i = 1; i < frames.length; i++) {
      if (t < frames[i].at) { b = frames[i]; break }
      a = frames[i]
    }
  }
  if (field.kind !== "range" && field.kind !== "number") return a.value
  if (typeof a.value !== "number" || typeof b.value !== "number") return base
  const fraction = b.at > a.at ? Math.max(0, Math.min(1, (t - a.at) / (b.at - a.at))) : 0
  const eased = timing.easing === "linear" ? fraction : eases[timing.easing](fraction)
  const raw = a.value + (b.value - a.value) * eased
  const min = field.min ?? -Number.MAX_VALUE, max = field.max ?? Number.MAX_VALUE
  const step = field.step ?? 1, origin = field.min ?? 0
  return Math.max(min, Math.min(max, Number((origin + Math.round((raw - origin) / step) * step).toFixed(8))))
}

export function sampleProperties(base: Record<string, unknown>, spec: AnySpec, section: SectionTracks | undefined, ms: number, inherited: Timing): Record<string, unknown> {
  if (!section) return base
  const patches = Object.entries(section.fields).filter(([key, track]) => spec[key] && track.enabled).map(([key, track]) => [
    key, sampleProperty(base[key] as TimelineValue, spec[key], track, ms, { ...inherited, ...section.timing, ...track.timing }),
  ])
  return patches.length ? { ...base, ...Object.fromEntries(patches) } : base
}
