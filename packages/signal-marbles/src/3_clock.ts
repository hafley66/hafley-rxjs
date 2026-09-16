// The reveal's producer. It is an Observable and not a `setInterval` hidden in a signal node, so the
// boundary that connects it owns the clock, a test can drive it on a virtual scheduler, and play,
// reveal, and rate are inputs rather than flags mirrored into local state.
//
// Its unit is the causal column and not the millisecond: a diagram is revealed one authored turn at
// a time, so a rate counts columns per second of wall time and a run ends on the last column rather
// than on the extent of the time axis. Two events in one column are one moment by construction, and
// the reveal has no way to stand between them.
import {
  combineLatest,
  concat,
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

/** One animation frame of wall time. The default tick, so a reveal steps smoothly at 60 Hz. */
export const TICK_MS = 1000 / 60

export type MarbleClockInputs = {
  playing: Observable<boolean>
  /** Columns per second of wall time. */
  rate: Observable<number>
  /** The column the run resumes from; a reveal writes it. */
  position: Observable<number>
  /** The number of causal columns. */
  columns: Observable<number>
  loop: Observable<boolean>
}

export type MarbleClockOptions = {
  tickMs?: number
  /** The wall clock. A `TestScheduler` makes playback exact. */
  scheduler?: SchedulerLike
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

/**
 * The column numbers a playing diagram goes through, from `position` to `columns - 1`, advancing
 * `rate * tickMs / 1000` columns per tick. Any write to an input restarts the run from the new
 * position, which is what makes a reveal a write rather than a method.
 */
export function marbleClock(inputs: MarbleClockInputs, options: MarbleClockOptions = {}): Observable<number> {
  const tickMs = options.tickMs ?? TICK_MS
  return combineLatest([inputs.playing, inputs.rate, inputs.position, inputs.columns, inputs.loop]).pipe(
    switchMap(([playing, rate, position, columns, loop]) => {
      // A document with no columns has no turn to stand on, so 0 is the only column it can name.
      const last = Math.max(columns - 1, 0)
      const start = clamp(position, 0, last)
      if (columns <= 0 || !playing || rate <= 0) return of(start)
      const step = (rate * tickMs) / 1000
      const run$ = defer(() =>
        concat(
          // The run opens on the resume point rather than a tick later, so a reveal names its
          // column the moment it is asked for.
          of(start),
          timer(tickMs, tickMs, options.scheduler).pipe(map(index => start + (index + 1) * step)),
        ).pipe(
          takeWhile(column => column < last, true),
          // The last step overshoots whenever `step` does not divide the extent; the reveal stops on
          // the last column instead of past the edge.
          map(column => Math.min(column, last)),
        ),
      )
      return loop ? run$.pipe(repeat()) : run$
    }),
  )
}
