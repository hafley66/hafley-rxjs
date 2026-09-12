import { Observable, shareReplay } from "rxjs"
import { slash } from "@hafley66/path"
import type { PathPart, ValuesOf } from "@hafley66/path"
import { Signal } from "./2_Signal.js"
import type { Signal as SignalType } from "./0_types.js"

// The key set comes from `path`, so every syntax it parses types the same: `:id` and `{id}` both
// bind, and `{id?}` / `{rest*}` carry their modifier into the value type.
type PathKeys<S extends string> = keyof ValuesOf<S> & string

export type RouteValue<S extends string> = ValuesOf<S> & {
  path: string
  matched: boolean
  [query: string]: string | boolean
}
export type RouteNavigation<S extends string> =
  Record<PathKeys<S>, string | number> & Record<string, string | number | boolean | null | undefined>

/** Where the application is mounted. `Route("/:demo", { base: "/hafley-rxjs/signal-grid/demo" })`
 * matches that prefix off before the template runs and prints it back on in `href`. */
export interface RouteOptions {
  readonly base?: string
}

export type RouteSignal<S extends string> = SignalType<RouteValue<S>> & {
  template: S
  base: string
  href(values: RouteNavigation<S>): string
  navigate(values: RouteNavigation<S>, options?: { replace?: boolean }): void
  back(): void
  forward(): void
  /** A longer route under this one, carrying the same base. Templates concatenate, so the child's
   * params join the parent's in the value type. */
  child<const T extends string>(sub: T): RouteSignal<`${S}${T}`>
  /** The same read the signal does, against a pathname you hand it rather than `location`. Named
   * `matchPath` because `match` collides with the value proxy's own key. */
  matchPath(pathname: string, search?: string): RouteValue<S>
}

// Param names of the template, derived from the typed path parts.
function paramKeys(template: string): string[] {
  return (slash(template).parts as readonly PathPart[])
    .flatMap(part => part.kind === "literal" ? [] : [part.name])
}

// "/x/" and "x" both mean "/x"; the root is "" so concatenation never doubles a slash.
const normalizeBase = (base: string | undefined): string => {
  const trimmed = (base ?? "").replace(/\/+$/, "")
  if (trimmed === "") return ""
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`
}

export function Route<const S extends string>(template: S, options?: RouteOptions): RouteSignal<S> {
  const p = slash(template)
  const base = normalizeBase(options?.base)
  const keys = paramKeys(template)
  const print = p.print as unknown as (values: Record<string, unknown>) => string
  // A pathname outside the base is a miss, not a prefix to slice blindly: `/other` under base
  // `/app` must report `matched: false` rather than hand the template a mangled remainder.
  const withoutBase = (pathname: string): string | null => {
    if (base === "") return pathname
    if (pathname === base) return "/"
    return pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : null
  }
  const match = (pathname: string, search = ""): RouteValue<S> => {
    const rest = withoutBase(pathname)
    const result = rest === null ? { matched: false as const } : p.match(rest)
    const query = Object.fromEntries(new URLSearchParams(search))
    const path = result.matched ? result.values : {}
    return { ...query, ...path, path: pathname, matched: result.matched } as RouteValue<S>
  }
  const read = (): RouteValue<S> => match(location.pathname, location.search)
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
    const pathname = base + print(values)
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(values)) {
      if (!used.has(key) && value != null) query.set(key, String(value))
    }
    const search = query.toString()
    return search ? `${pathname}?${search}` : pathname
  }
  return Object.assign(signal, {
    template,
    base,
    href,
    matchPath: match,
    child: <const T extends string>(sub: T) => Route(`${template}${sub}` as `${S}${T}`, { base }),
    navigate(values: RouteNavigation<S>, options?: { replace?: boolean }) {
      history[options?.replace ? "replaceState" : "pushState"](null, "", href(values))
      dispatchEvent(new Event("instant:navigate"))
    },
    back: () => history.back(),
    forward: () => history.forward(),
  })
}
