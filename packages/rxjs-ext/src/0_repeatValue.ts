import { Observable, of, repeat, switchMap } from "rxjs"

/**
 * Re-emit the current value whenever the delay observable emits.
 *
 * The cursed but correct pattern: wraps each value in `of()` then
 * uses `repeat({ delay })` to re-emit on trigger.
 *
 * @example
 * ```ts
 * // Re-fetch on interval, window focus, or manual trigger
 * userId$.pipe(
 *   repeatValue(() => merge(
 *     interval(30000),
 *     windowFocus$,
 *     manualRefetch$
 *   ))
 * )
 * ```
 *
 * @param delay - Factory returning observable that triggers re-emission
 */
export function repeatValue<T>(delay: () => Observable<unknown>) {
  return (source$: Observable<T>): Observable<T> =>
    source$.pipe(
      switchMap((val) =>
        of(val).pipe(
          repeat({ delay })
        )
      )
    )
}
