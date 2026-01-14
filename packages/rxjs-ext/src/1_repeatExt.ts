import { Observable, defer, EMPTY } from "rxjs"
import { repeat } from "rxjs/operators"

/**
 * Like `repeat` but the delay factory receives the last emitted value.
 *
 * RxJS's built-in `repeat` doesn't pass values to avoid memory leaks,
 * but this is essential for react-query-style refetch logic where you
 * need to decide repeat interval based on the data itself.
 *
 * @example
 * ```ts
 * fetchUser(id).pipe(
 *   repeatExt((user) =>
 *     user.isActive ? timer(5000) : NEVER
 *   )
 * )
 *
 * // Exponential backoff based on error count in response
 * api.getData().pipe(
 *   repeatExt((data) =>
 *     timer(data.errorCount ? Math.min(30000, 1000 * 2 ** data.errorCount) : 10000)
 *   )
 * )
 * ```
 *
 * @param delay - Factory receiving last value, returns trigger observable
 */
export function repeatExt<T>(
  delay: (value: T) => Observable<unknown>
) {
  return (source$: Observable<T>): Observable<T> => {
    return defer(() => {
      let lastValue: T | undefined

      return source$.pipe(
        // Capture last emitted value
        (obs$) => new Observable<T>((subscriber) => {
          return obs$.subscribe({
            next: (value) => {
              lastValue = value
              subscriber.next(value)
            },
            error: (err) => subscriber.error(err),
            complete: () => subscriber.complete(),
          })
        }),
        // Repeat with delay based on last value
        repeat({
          delay: () => lastValue !== undefined ? delay(lastValue) : EMPTY
        })
      )
    })
  }
}

/**
 * Like `retry` but the delay factory receives the last emitted value AND the error.
 *
 * Allows retry logic based on both the error and the last successful emission.
 *
 * @example
 * ```ts
 * fetchUser(id).pipe(
 *   retryExt((error, lastUser) => {
 *     // Don't retry 404s
 *     if (error.status === 404) return EMPTY
 *     // Retry with exponential backoff
 *     return timer(1000 * 2 ** error.attempt)
 *   })
 * )
 * ```
 *
 * @param delay - Factory receiving error and last value, returns trigger observable
 */
export function retryExt<T>(
  delay: (error: any, lastValue: T | undefined) => Observable<unknown>
) {
  return (source$: Observable<T>): Observable<T> => {
    return defer(() => {
      let lastValue: T | undefined
      let attempt = 0

      const attempt$ = (): Observable<T> => {
        return new Observable<T>((subscriber) => {
          const sub = source$.subscribe({
            next: (value) => {
              lastValue = value
              attempt = 0 // Reset on success
              subscriber.next(value)
            },
            error: (err) => {
              attempt++
              const enrichedError = { ...err, attempt }
              const delayObs$ = delay(enrichedError, lastValue)

              const delaySub = delayObs$.subscribe({
                next: () => {
                  // Retry on trigger
                  subscriber.add(attempt$().subscribe(subscriber))
                },
                error: (delayErr) => subscriber.error(delayErr),
                complete: () => {
                  // Delay completed without emission = no more retries
                  subscriber.error(enrichedError)
                },
              })

              return () => delaySub.unsubscribe()
            },
            complete: () => subscriber.complete(),
          })

          return () => sub.unsubscribe()
        })
      }

      return attempt$()
    })
  }
}
