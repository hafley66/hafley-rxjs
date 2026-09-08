import type { AnySpec } from "@hafley66/report-shell"
import { eases } from "animejs"
import { sampleProperty, type SectionTracks, type Timing, type TimelineValue } from "./7_propertyTimeline.js"
import { resolveVariation, STROKE_PROPERTIES, variedField, type Variation } from "./7a_variation.js"

export function variationTime(ms: number, timing: Timing): number | undefined {
  if (ms < timing.delay) return undefined
  const duration = Math.max(1, timing.duration)
  let time = Math.max(0, ms - timing.delay)
  if (!timing.loop) time = Math.min(time, duration)
  if (timing.easing !== "linear") {
    const cycle = Math.floor(time / duration)
    time = (cycle + eases[timing.easing](time / duration - cycle)) * duration
  }
  if (timing.direction === "reverse") time = duration - time
  if (timing.direction === "alternate") {
    const cycle = Math.floor(time / duration), fraction = time / duration - cycle
    time = (cycle % 2 ? 1 - fraction : fraction) * duration
  }
  return time
}

export function sampleVariedProperties(base: Record<string, unknown>, spec: AnySpec, section: SectionTracks | undefined, ms: number, inherited: Timing, global: Partial<Variation> = {}, strokeScope = true): Record<string, unknown> {
  if (!section) return base
  const patches = Object.entries(section.fields).filter(([key, track]) => spec[key] && track.enabled && track.variationPolicy !== "none").flatMap(([key, track]) => {
    const timing = { ...inherited, ...section.timing, ...track.timing }
    const variation = resolveVariation(spec[key], base[key], track, { period: timing.duration, ...global }, section.variation)
    if (variation?.scope === "stroke" && strokeScope && STROKE_PROPERTIES.has(key)) return []
    const time = variationTime(ms, timing)
    return [[key, variation && time !== undefined
      ? variedField(spec[key], variation, time, key)
      : sampleProperty(base[key] as TimelineValue, spec[key], track, ms, timing)]]
  })
  return patches.length ? { ...base, ...Object.fromEntries(patches) } : base
}
