import { Observable, tap } from "rxjs"

/**
 * Debug operator that logs all observable lifecycle events.
 *
 * @example
 * ```ts
 * source$.pipe(
 *   DEBUG_TAG("mySource")
 * )
 * // Logs: mySource/subscribe, mySource/next 123, mySource/complete, etc.
 * ```
 */
export function DEBUG_TAG<T>(tag: string | number) {
  return (source: Observable<T>): Observable<T> =>
    tap<T>({
      subscribe: () => console.log(`${tag}/subscribe`),
      next: (n) => console.log(`${tag}/next`, n),
      error: (e) => console.log(`${tag}/error`, e),
      complete: () => console.log(`${tag}/complete`),
      unsubscribe: () => console.log(`${tag}/unsubscribe`),
      finalize: () => console.log(`${tag}/finalize`),
    })(source)
}

/**
 * Debug operator with unique IDs per subscription.
 * Useful when debugging multiple concurrent subscriptions.
 *
 * @example
 * ```ts
 * source$.pipe(
 *   CONSOLE_TAG("fetch")
 * )
 * // First sub:  (fetch 0)/subscribe, (fetch 0)/next ...
 * // Second sub: (fetch 1)/subscribe, (fetch 1)/next ...
 * ```
 */
export function CONSOLE_TAG<T>(prefix: string | number) {
  let id = 0
  return (source: Observable<T>): Observable<T> => {
    return new Observable<T>((sub) => {
      const thisId = `${prefix} ${id++}`
      const inner = tap<T>({
        subscribe: () => console.log(`(${thisId})/subscribe`),
        next: (n) => console.log(`(${thisId})/next`, n),
        error: (e) => console.log(`(${thisId})/error`, e),
        complete: () => console.log(`(${thisId})/complete`),
        unsubscribe: () => console.log(`(${thisId})/unsubscribe`),
        finalize: () => console.log(`(${thisId})/finalize`),
      })(source).subscribe(sub)
      return () => inner.unsubscribe()
    })
  }
}
