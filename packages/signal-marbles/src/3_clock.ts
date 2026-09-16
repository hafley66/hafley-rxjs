// The playhead's producer. It is an Observable and not a `setInterval` hidden in a signal node, so
// the boundary that connects it owns the clock, a test can drive it on a virtual scheduler, and
// pause, seek, and rate are inputs rather than flags mirrored into local state.
import {
  combineLatest,
  defer,
  map,
  type Observable,
  of,
  repeat,
  type SchedulerLike,
  switchMap,
  takeWhile,
  timer,
} from "rxjs"

/** One animation frame of wall time. The default tick, so playback is smooth at 60 Hz. */
export const FRAME_MS = 1000 / 60

export type MarbleClockInputs = {
  playing: Observable<boolean>
  /** Virtual frames per second of wall time. */
  rate: Observable<number>
  /** The frame playback resumes from; a seek writes it. */
  position: Observable<number>
  /** The last frame on the diagram. */
  duration: Observable<number>
  loop: Observable<boolean>
}

export type MarbleClockOptions = {
  tickMs?: number
  /** The wall clock. A `TestScheduler` makes playback exact. */
  scheduler?: SchedulerLike
}

export function clamp(frame: number, min: number, max: number): number {
  return frame < min ? min : frame > max ? max : frame
}

/**
 * The frame numbers a playing diagram goes through, from `position` to `duration`, advancing
 * `rate / (1000 / tickMs)` frames per tick. Any write to an input restarts the run from the new
 * position, which is what makes a seek a write rather than a method.
 */
export function marbleClock(inputs: MarbleClockInputs, options: MarbleClockOptions = {}): Observable<number> {
  const tickMs = options.tickMs ?? FRAME_MS
  return combineLatest([inputs.playing, inputs.rate, inputs.position, inputs.duration, inputs.loop]).pipe(
    switchMap(([playing, rate, position, duration, loop]) => {
      const start = clamp(position, 0, duration)
      if (!playing || rate <= 0) return of(start)
      const step = (rate * tickMs) / 1000
      const run$ = defer(() =>
        timer(0, tickMs, options.scheduler).pipe(
          map(index => start + index * step),
          takeWhile(frame => frame < duration, true),
          // The last step overshoots whenever `step` does not divide the extent; the playhead
          // stops on the last frame instead of past the edge.
          map(frame => Math.min(frame, duration)),
        ),
      )
      return loop ? run$.pipe(repeat()) : run$
    }),
  )
}
