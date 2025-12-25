import { Observable, ReplaySubject, share, timer } from "rxjs"

export type SwitchMapCachedOptions<T> = {
  /** Cache key function. Default: JSON.stringify */
  keyFn?: (value: T) => string
  /** Keep cached results for this many ms after last unsub. Default: 0 (immediate reset) */
  ttl?: number
}

export type SwitchMapCachedOperator<T, R> = {
  (project: (value: T) => Observable<R>): (source$: Observable<T>) => Observable<R>
  cache: Map<string, Observable<unknown>>
}

/**
 * Create a cached switchMap operator.
 * Returns an operator factory that works like switchMap but caches results by key.
 *
 * @example
 * ```ts
 * const switchMapCached = makeSwitchMapCached("users", { ttl: 60000 })
 *
 * userId$.pipe(
 *   switchMapCached(id => fetchUser(id))
 * ).subscribe(...)
 *
 * // Access cache
 * switchMapCached.cache.delete("users:123")
 * switchMapCached.cache.clear()
 * ```
 */
export function makeSwitchMapCached<T>(
  prefix: string,
  options: SwitchMapCachedOptions<T> = {}
): SwitchMapCachedOperator<T, unknown> {
  const { keyFn = (v) => JSON.stringify(v), ttl = 0 } = options
  const cache = new Map<string, Observable<unknown>>()

  const operatorFactory = <R>(project: (value: T) => Observable<R>) => {
    return (source$: Observable<T>): Observable<R> => {
      return new Observable<R>((subscriber) => {
        let currentSub: { unsubscribe: () => void } | null = null

        const sourceSub = source$.subscribe({
          next: (value) => {
            currentSub?.unsubscribe()

            const key = `${prefix}:${keyFn(value)}`
            let cached = cache.get(key) as Observable<R> | undefined

            if (!cached) {
              cached = project(value).pipe(
                share({
                  connector: () => new ReplaySubject<R>(1),
                  resetOnRefCountZero: ttl > 0 ? () => timer(ttl) : true,
                  resetOnError: true,
                  resetOnComplete: false,
                })
              )
              cache.set(key, cached)
            }

            currentSub = cached.subscribe({
              next: (v) => subscriber.next(v),
              error: (e) => subscriber.error(e),
            })
          },
          error: (e) => subscriber.error(e),
          complete: () => subscriber.complete(),
        })

        return () => {
          currentSub?.unsubscribe()
          sourceSub.unsubscribe()
        }
      })
    }
  }

  operatorFactory.cache = cache

  return operatorFactory as SwitchMapCachedOperator<T, unknown>
}
