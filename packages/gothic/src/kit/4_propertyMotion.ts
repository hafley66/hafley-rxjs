import type { AnySpec, SectionState, ValuesOf } from "@hafley66/report-shell"
import { Signal, storageSignal, localStorageAdapter } from "@hafley66/signals"
import { combineLatest, distinctUntilChanged, map, type Observable, shareReplay, switchMap } from "rxjs"
import { DEFAULT_TIMING, sampleProperties, type SectionTracks, type Timing } from "../lib/7_propertyTimeline.js"
import type { PlaybackParams } from "./0_inputs.js"
import { playback } from "./1a_playback.js"

export type PropertyMotionConfig = { transport: PlaybackParams; timing: Timing; sections: Record<string, SectionTracks> }

export function createPropertyMotion(config: Signal<PropertyMotionConfig>, frames?: Observable<number>) {
  const clock = playback(config.transport, config.timing.$.pipe(map(t => t.duration * (t.direction === "alternate" ? 2 : 1) + t.delay)), { frames, loop: config.timing.loop.$ })
  const projections = new Map<object, Signal<Record<string, unknown>>>()
  const values = <S extends AnySpec>(state: SectionState<S>): Signal<ValuesOf<S>> => {
    let hit = projections.get(state)
    if (!hit) {
      const source = combineLatest([
        state.values.$, config.sections[state.id].$.pipe(distinctUntilChanged()), config.timing.$.pipe(distinctUntilChanged()),
      ]).pipe(shareReplay({ bufferSize: 1, refCount: true }))
      hit = Signal(source.pipe(
        map(([, section]) => !!section && Object.values(section.fields).some(t => t.enabled)), distinctUntilChanged(),
        switchMap(active => active ? combineLatest([source, clock.frame.$]).pipe(
          map(([[base, section, timing], frame]) => sampleProperties(base, state.spec, section, frame.time, timing)),
        ) : source.pipe(map(([base]) => base))),
      ), state.values.$())
      projections.set(state, hit)
    }
    return hit as unknown as Signal<ValuesOf<S>>
  }
  return { config, clock, values }
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
