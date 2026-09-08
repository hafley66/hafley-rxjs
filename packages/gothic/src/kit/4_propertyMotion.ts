import type { AnySpec, SectionState, ValuesOf } from "@hafley66/report-shell"
import { Signal, storageSignal, localStorageAdapter } from "@hafley66/signals"
import { combineLatest, distinctUntilChanged, map, type Observable, of, shareReplay, switchMap } from "rxjs"
import { DEFAULT_TIMING, type SectionTracks, type Timing } from "../lib/7_propertyTimeline.js"
import { resolveVariation, STROKE_PROPERTIES, type StrokeMotionFrame, type Variation } from "../lib/7a_variation.js"
import { sampleVariedProperties } from "../lib/7b_propertyVariation.js"
import type { PlaybackParams } from "./0_inputs.js"
import { playback } from "./1a_playback.js"

export type PropertyMotionConfig = { transport: PlaybackParams; timing: Timing; sections: Record<string, SectionTracks>; variation?: Partial<Variation> }

export function createPropertyMotion(config: Signal<PropertyMotionConfig>, frames?: Observable<number>) {
  const clock = playback(config.transport, config.timing.$.pipe(map(t => t.duration * (t.direction === "alternate" ? 2 : 1) + t.delay)), { frames, loop: config.timing.loop.$ })
  const projections = new Map<object, Signal<Record<string, unknown>>>()
  const values = <S extends AnySpec>(state: SectionState<S>): Signal<ValuesOf<S>> => {
    let hit = projections.get(state)
    if (!hit) {
      const source = combineLatest([
        state.values.$, config.sections[state.id].$.pipe(distinctUntilChanged()), config.timing.$.pipe(distinctUntilChanged()), config.variation.$.pipe(distinctUntilChanged()),
      ]).pipe(shareReplay({ bufferSize: 1, refCount: true }))
      hit = Signal(source.pipe(
        map(([, section]) => !!section && Object.values(section.fields).some(t => t.enabled && t.variationPolicy !== "none")), distinctUntilChanged(),
        switchMap(active => active ? combineLatest([source, clock.frame.$]).pipe(
          map(([[base, section, timing, global], frame]) => sampleVariedProperties(base, state.spec, section, frame.time, timing, global)),
        ) : source.pipe(map(([base]) => base))),
      ), state.values.$())
      projections.set(state, hit)
    }
    return hit as unknown as Signal<ValuesOf<S>>
  }
  const strokeProjections = new Map<object, Signal<StrokeMotionFrame>>()
  const strokes = <S extends AnySpec>(state: SectionState<S>) => {
    let hit = strokeProjections.get(state)
    if (!hit) {
      const empty: StrokeMotionFrame = { time: 0, fields: {} }
      hit = Signal(combineLatest([config.sections[state.id].$.pipe(distinctUntilChanged()), config.variation.$.pipe(distinctUntilChanged()), state.values.$]).pipe(switchMap(([section, global, base]) => {
        const fields = Object.fromEntries(Object.entries(section?.fields ?? {}).flatMap(([key, track]) => {
          if (!state.spec[key] || !STROKE_PROPERTIES.has(key)) return []
          const variation = resolveVariation(state.spec[key], base[key], track, global, section?.variation)
          return variation?.scope === "stroke" ? [[key, variation]] : []
        }))
        return Object.keys(fields).length ? clock.frame.$.pipe(map(frame => ({ time: frame.time, fields }))) : of(empty)
      })), empty)
      strokeProjections.set(state, hit)
    }
    return hit
  }
  return { config, clock, values, strokes }
}
export type PropertyMotion = ReturnType<typeof createPropertyMotion>

const pages = new Map<string, PropertyMotion>()
export function propertyMotion(page: string): PropertyMotion {
  let hit = pages.get(page)
  if (!hit) {
    const config = storageSignal<PropertyMotionConfig>(localStorageAdapter(`gothic.${page}.timelines`), {
      transport: { time: 0, run: false, speed: 1 }, timing: DEFAULT_TIMING, sections: {},
    })
    hit = createPropertyMotion(config)
    pages.set(page, hit)
  }
  return hit
}
