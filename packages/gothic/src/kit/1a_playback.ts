import { Signal } from "@hafley66/signals"
import { animationFrames, combineLatest, defer, distinctUntilChanged, map, type Observable, of, pairwise, startWith, switchMap, takeWhile } from "rxjs"
import type { PlaybackParams } from "./0_inputs.js"
import { documentVisible$ } from "./1_browser.js"

export type PlaybackFrame = { time: number; active: boolean }
export type PlaybackRuntime = { enabled: boolean; seek: { time: number } | null }
export const frameDeltas = animationFrames().pipe(pairwise(), map(([a, b]) => Math.min(100, b.timestamp - a.timestamp)))

// One grouped runtime and one source signal. Reading frame in JSX owns the entire connection.
export function playback<P extends PlaybackParams>(input: Signal<P>, duration: Observable<number> | number, options: {
  loop?: boolean | Observable<boolean>; visible?: Observable<boolean>; reducedMotion?: boolean; landOnReduce?: boolean
  input?: Signal<P>
  frames?: Observable<number>; runtime?: Signal<PlaybackRuntime>
} = {}) {
  const values = input as unknown as Signal<PlaybackParams>
  const sampled = (options.input ?? input) as unknown as Signal<PlaybackParams>
  const runtime = options.runtime ?? Signal<PlaybackRuntime>({ enabled: !options.reducedMotion, seek: null })
  const frame = Signal(defer(() => {
    let elapsed = 0, position = NaN, total = NaN, intent: PlaybackRuntime["seek"] = null
    return combineLatest([
      sampled.$.pipe(map(p => [p.time, p.speed, p.run] as const), distinctUntilChanged((a, b) => a.every((v, i) => v === b[i]))),
      typeof duration === "number" ? of(duration) : duration.pipe(distinctUntilChanged()),
      options.visible ?? documentVisible$, runtime.$.pipe(map(r => [r.enabled, r.seek] as const), distinctUntilChanged((a, b) => a[0] === b[0] && a[1] === b[1])),
      typeof options.loop === "boolean" ? of(options.loop) : options.loop ?? of(true),
    ]).pipe(switchMap(([[saved, speed, run], span, shown, [allowed, seek], loop]) => {
      if (saved !== position || span !== total) elapsed = !allowed && options.landOnReduce ? span : Math.max(0, Math.min(1, saved)) * span
      if (seek !== intent && seek !== null) elapsed = Math.max(0, Math.min(span, seek.time))
      position = saved; total = span; intent = seek
      const active = run && shown && allowed && span > 0 && (loop || elapsed < span)
      const start = { time: elapsed, active }
      return active ? (options.frames ?? frameDeltas).pipe(map(dt => {
        const next = elapsed + dt * speed
        elapsed = !loop ? Math.min(span, next) : next % span
        return { time: elapsed, active: loop || next < span }
      }), takeWhile(frame => frame.active, true), startWith(start)) : of(start)
    }))
  }), { time: 0, active: false })
  return {
    frame, runtime,
    seek(ms: number) {
      const next = Math.max(0, ms)
      values.run.$(false)
      runtime.seek.$({ time: next })
    },
    replay() { runtime.$({ ...runtime.$(), enabled: true, seek: { time: 0 } }); values.run.$(true) },
  }
}
