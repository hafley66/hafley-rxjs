import {
  Observable,
  ObservableInput,
  combineLatest,
  defer,
  from,
  isObservable,
  of,
  shareReplay,
} from "rxjs"

/**
 * Shorthand for shareReplay({ bufferSize: 1, refCount: true })
 */
export function shareLatest<T>() {
  return (source: Observable<T>): Observable<T> =>
    shareReplay<T>({ bufferSize: 1, refCount: true })(source)
}

/**
 * Defer + from in one. Lazily evaluates the factory on subscribe.
 *
 * @example
 * ```ts
 * deferFrom(() => fetch("/api"))  // fetch only happens on subscribe
 * ```
 */
export function deferFrom<T>(factory: () => ObservableInput<T>): Observable<T> {
  return defer(() => from(factory()))
}

/**
 * combineLatest that accepts a mix of observables and static values.
 * Static values are wrapped in of(). Also exposes the original input as `._`
 *
 * @example
 * ```ts
 * AND_THEN({
 *   user: user$,           // observable
 *   config: { debug: true } // static value
 * }).subscribe(({ user, config }) => ...)
 * ```
 */
export function AND_THEN<
  T extends Record<string | number, Observable<unknown> | unknown>
>(
  combo: T
): Observable<{
  [K in keyof T]: T[K] extends Observable<infer U> ? U : T[K]
}> & { _: T } {
  const normalized = Object.fromEntries(
    Object.entries(combo).map(([k, v]) => [k, isObservable(v) ? v : of(v)])
  )
  return Object.assign(combineLatest(normalized), { _: combo }) as Observable<{
    [K in keyof T]: T[K] extends Observable<infer U> ? U : T[K]
  }> & { _: T }
}
