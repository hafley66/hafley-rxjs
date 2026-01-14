import { Observable, of, repeat, switchMap, isObservable } from "rxjs"

/**
 * Re-emit the current value whenever the trigger observable emits.
 *
 * "renext" = re-emit next. Like a manual refetch trigger.
 *
 * The cursed but correct pattern: wraps each value in `of()` then
 * uses `repeat({ delay })` to re-emit on trigger.
 *
 * @example
 * ```ts
 * // Simple notifier form
 * const trigger$ = merge(interval(30000), windowFocus$, manualRefetch$)
 * userId$.pipe(renext(trigger$))
 *
 * // Factory form - conditional repeat based on value
 * userId$.pipe(
 *   renext((id) => id > 0 ? interval(30000) : NEVER)
 * )
 * ```
 *
 * @param notifier - Observable or factory that triggers re-emission
 */
export function renext<T>(
  notifier: Observable<unknown> | ((value: T) => Observable<unknown>)
) {
  return (source$: Observable<T>): Observable<T> => {
    const isFactory = !isObservable(notifier)

    return source$.pipe(
      switchMap((val) =>
        of(val).pipe(
          repeat({
            delay: isFactory ? () => (notifier as (value: T) => Observable<unknown>)(val) : () => notifier
          })
        )
      )
    )
  }
}
