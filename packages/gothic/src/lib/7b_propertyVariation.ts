import type { AnySpec } from "@hafley66/report-shell"
import { sampleProperty, type SectionTracks, type Timing, type TimelineValue } from "./7_propertyTimeline.js"
import { resolveVariation, variedField, type Variation } from "./7a_variation.js"

export function sampleVariedProperties(base: Record<string, unknown>, spec: AnySpec, section: SectionTracks | undefined, ms: number, inherited: Timing, global: Partial<Variation> = {}): Record<string, unknown> {
  if (!section) return base
  const patches = Object.entries(section.fields).filter(([key, track]) => spec[key] && track.enabled && track.variationPolicy !== "none").flatMap(([key, track]) => {
    const variation = resolveVariation(spec[key], base[key], track, global, section.variation)
    if (variation?.scope === "stroke") return []
    const timing = { ...inherited, ...section.timing, ...track.timing }
    let time = Math.max(0, ms - timing.delay)
    if (!timing.loop) time = Math.min(time, timing.duration)
    if (timing.direction === "reverse") time = timing.duration - time
    if (timing.direction === "alternate") {
      const cycle = Math.floor(time / timing.duration)
      time = (cycle % 2 ? 1 - time / timing.duration + cycle : time / timing.duration - cycle) * timing.duration
    }
    return [[key, variation && ms >= timing.delay
      ? variedField(spec[key], variation, time, key)
      : sampleProperty(base[key] as TimelineValue, spec[key], track, ms, timing)]]
  })
  return patches.length ? { ...base, ...Object.fromEntries(patches) } : base
}
