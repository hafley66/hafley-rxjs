import { Observable, shareReplay } from "rxjs"
import { slash } from "@hafley66/path"
import type { PathPart } from "@hafley66/path"
import { Signal } from "./2_Signal.js"
import type { Signal as SignalType } from "./0_types.js"

type PathKeys<S extends string> =
  S extends `${string}:${infer K}/${infer R}` ? K | PathKeys<`/${R}`> :
  S extends `${string}:${infer K}` ? K : never

type PathValues<S extends string> = Record<PathKeys<S>, string>
export type RouteValue<S extends string> = PathValues<S> & {
  path: string
  matched: boolean
  [query: string]: string | boolean
}
export type RouteNavigation<S extends string> =
  Record<PathKeys<S>, string | number> & Record<string, string | number | boolean | null | undefined>

export type RouteSignal<S extends string> = SignalType<RouteValue<S>> & {
  template: S
  href(values: RouteNavigation<S>): string
  navigate(values: RouteNavigation<S>, options?: { replace?: boolean }): void
  back(): void
  forward(): void
}

// Param names of the template, derived from the typed path parts.
function paramKeys(template: string): string[] {
  return (slash(template).parts as readonly PathPart[])
    .flatMap(part => part.kind === "literal" ? [] : [part.name])
}

export function Route<const S extends string>(template: S): RouteSignal<S> {
  const p = slash(template)
  const keys = paramKeys(template)
  const print = p.print as unknown as (values: Record<string, unknown>) => string
  const read = (): RouteValue<S> => {
    const result = p.match(location.pathname)
    const query = Object.fromEntries(new URLSearchParams(location.search))
    const path = result.matched ? result.values : {}
    return { ...query, ...path, path: location.pathname, matched: result.matched } as RouteValue<S>
  }
  const changes = new Observable<RouteValue<S>>(subscriber => {
    const emit = () => subscriber.next(read())
    addEventListener("popstate", emit)
    addEventListener("instant:navigate", emit)
    emit()
    return () => {
      removeEventListener("popstate", emit)
      removeEventListener("instant:navigate", emit)
    }
  }).pipe(shareReplay({ bufferSize: 1, refCount: true }))
  const signal = Signal(changes, read()) as RouteSignal<S>
  const href = (values: RouteNavigation<S>) => {
    const used = new Set(keys)
    const pathname = print(values)
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(values)) {
      if (!used.has(key) && value != null) query.set(key, String(value))
    }
    const search = query.toString()
    return search ? `${pathname}?${search}` : pathname
  }
  return Object.assign(signal, {
    template,
    href,
    navigate(values: RouteNavigation<S>, options?: { replace?: boolean }) {
      history[options?.replace ? "replaceState" : "pushState"](null, "", href(values))
      dispatchEvent(new Event("instant:navigate"))
    },
    back: () => history.back(),
    forward: () => history.forward(),
  })
}
