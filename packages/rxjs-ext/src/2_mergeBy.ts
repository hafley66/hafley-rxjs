import { Observable, merge, map, scan, startWith } from "rxjs"

/**
 * Merge observables while preserving key-value structure.
 * Emits `{ key, value }` for each emission from any source.
 *
 * ```
 * a$: --1-------3-->
 * b$: ----"x"------->
 *
 * mergeByKey({ a: a$, b: b$ }):
 *     --{a,1}-{b,"x"}-{a,3}-->
 * ```
 */
export function mergeByKey<T extends Record<string, Observable<unknown>>>(
  rec: T
): Observable<
  {
    [K in keyof T]: {
      key: K
      value: T[K] extends Observable<infer U> ? U : never
    }
  }[keyof T]
> {
  return merge(
    ...Object.keys(rec).map((key) =>
      rec[key].pipe(map((value) => ({ key, value })))
    )
  ) as Observable<
    {
      [K in keyof T]: {
        key: K
        value: T[K] extends Observable<infer U> ? U : never
      }
    }[keyof T]
  >
}

/**
 * Merge observables into tuple emissions `[key, value]`.
 *
 * ```
 * a$: --1-------3-->
 * b$: ----"x"------->
 *
 * mergeByTup({ a: a$, b: b$ }):
 *     --["a",1]-["b","x"]-["a",3]-->
 * ```
 */
export function mergeByTup<T extends Record<string, Observable<unknown>>>(
  rec: T
): Observable<
  {
    readonly [K in keyof T]: [K, T[K] extends Observable<infer U> ? U : never]
  }[keyof T]
> {
  return merge(
    ...Object.keys(rec).map((key) =>
      rec[key].pipe(map((value) => [key, value] as const))
    )
  ) as Observable<
    {
      readonly [K in keyof T]: [K, T[K] extends Observable<infer U> ? U : never]
    }[keyof T]
  >
}

/**
 * Merge observables and accumulate into a complete object via scan.
 * Like combineLatest but emits on first emission from ANY source,
 * not waiting for all sources.
 *
 * ```
 * a$: --1-------3-->
 * b$: ----"x"------->
 *
 * mergeByKeyScan({ a: a$, b: b$ }, { a: 0, b: "" }):
 *     {a:0,b:""}--{a:1,b:""}-{a:1,b:"x"}-{a:3,b:"x"}-->
 * ```
 */
export function mergeByKeyScan<T extends Record<string, Observable<unknown>>>(
  rec: T,
  defaultVal: {
    [K in keyof T]: T[K] extends Observable<infer U> ? U : never
  }
): Observable<{
  [K in keyof T]: T[K] extends Observable<infer U> ? U : never
}> {
  return mergeByKey(rec).pipe(
    scan(
      (state, next) => ({
        ...state,
        [next.key]: next.value,
      }),
      defaultVal
    ),
    startWith(defaultVal)
  )
}
