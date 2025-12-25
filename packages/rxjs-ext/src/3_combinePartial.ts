import { Observable, merge, map, scan } from "rxjs"

/**
 * Like combineLatest for arrays, but emits on FIRST emission from ANY source,
 * not waiting for all sources. Missing values are undefined.
 *
 * ```
 * a$: --1-------3-->
 * b$: ------"x"---->
 *
 * combineLatest([a$, b$]):
 *     ------[1,"x"]-[3,"x"]-->  (waits for both)
 *
 * combinePartialArray([a$, b$]):
 *     --[1,undefined]-[1,"x"]-[3,"x"]-->  (emits immediately)
 * ```
 */
export function combinePartialArray<T extends Observable<unknown>[]>(
  sources: T
): Observable<{
  [K in keyof T]: T[K] extends Observable<infer U> ? U | undefined : never
}> {
  return merge(
    ...sources.map((source, index) =>
      source.pipe(map((value) => ({ index, value })))
    )
  ).pipe(
    scan((acc, { index, value }) => {
      const newAcc = [...acc]
      newAcc[index] = value
      return newAcc
    }, Array(sources.length).fill(undefined))
  ) as Observable<{
    [K in keyof T]: T[K] extends Observable<infer U> ? U | undefined : never
  }>
}

/**
 * Like combineLatest for records, but emits on FIRST emission from ANY source,
 * not waiting for all sources. Missing values are undefined.
 *
 * ```
 * a$: --1-------3-->
 * b$: ------"x"---->
 *
 * combineLatest({ a: a$, b: b$ }):
 *     ------{a:1,b:"x"}-{a:3,b:"x"}-->  (waits for both)
 *
 * combinePartialRecord({ a: a$, b: b$ }):
 *     --{a:1}-{a:1,b:"x"}-{a:3,b:"x"}-->  (emits immediately)
 * ```
 */
export function combinePartialRecord<
  T extends Record<string, Observable<unknown>>
>(
  sources: T
): Observable<{
  [K in keyof T]?: T[K] extends Observable<infer U> ? U : never
}> {
  const keys = Object.keys(sources)
  return merge(
    ...keys.map((key) =>
      sources[key].pipe(map((value) => ({ key, value })))
    )
  ).pipe(
    scan(
      (acc, { key, value }) => ({ ...acc, [key]: value }),
      {} as Record<string, unknown>
    )
  ) as Observable<{
    [K in keyof T]?: T[K] extends Observable<infer U> ? U : never
  }>
}
