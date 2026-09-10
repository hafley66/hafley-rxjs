import { Observable, share } from "rxjs"
import { slash } from "@hafley66/path"
import type { PathPart, ValuesOf } from "@hafley66/path"
import type { HtmlEventIndex$ } from "./0_domEvents.js"

// Parsing lives in @hafley66/path, which already reads `:name`, `{name}`, `{name?}` and
// `{name*}`. A second parser here read `:name` only, so brace templates typed `params` as an
// empty record while matching correctly at runtime. One parser, one answer.
export type Params<Path extends string> = keyof ValuesOf<Path> & string

export type Values<Path extends string> = { [K in keyof ValuesOf<Path>]: string | number }
export type EventWithParams<E, Path extends string> = E & {
  delegateElement: HTMLElement
  params: ValuesOf<Path>
}
export type Events<Path extends string> = {
  [K in keyof HtmlEventIndex$]: HtmlEventIndex$[K] extends Observable<infer E>
    ? Observable<EventWithParams<E, Path>>
    : never
}

export type DomTemplate<Path extends string> = {
  readonly template: Path
  id(values: Values<Path>): string
  with(values: Values<Path>): { readonly id: string }
  readonly $: Events<Path>
  // Relative mode: composes data-route segments up the ancestor chain and fills
  // params from inherited data-* attrs (closest ancestor wins).
  readonly route: Events<Path>
  // Attrs bag for a container that participates in relative routing: the route
  // skeleton as data-route plus each param as data-<kebab>.
  boxAttrs(values: Values<Path>): Record<string, string>
}

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()

// Param names + literal skeleton derived from the typed path parts:
// /grid/:gridId/row/:rowId -> keys=[gridId,rowId], skeleton="grid/row".
function analyze(template: string) {
  const parts = slash(template).parts as readonly PathPart[]
  const keys: string[] = []
  const literals: string[] = []
  for (const part of parts) {
    if (part.kind === "literal") literals.push(part.value)
    else keys.push(part.name)
  }
  return { keys, skeleton: literals.join("/") }
}

export function fromDelegatedEvent<Path extends string, K extends keyof HTMLElementEventMap>(
  template: Path,
  eventName: K,
  root: EventTarget = document,
): Observable<EventWithParams<HTMLElementEventMap[K], Path>> {
  const p = slash(template)
  return new Observable<EventWithParams<HTMLElementEventMap[K], Path>>(subscriber => {
    const listener = (event: Event) => {
      let element = event.target instanceof HTMLElement ? event.target : null
      while (element) {
        const result = p.match(element.id)
        if (result.matched) {
          const params = result.values as unknown as Record<Params<Path>, string>
          subscriber.next(Object.assign(event, { delegateElement: element, params }) as EventWithParams<HTMLElementEventMap[K], Path>)
          return
        }
        element = element.parentElement
      }
    }
    root.addEventListener(eventName, listener)
    return () => root.removeEventListener(eventName, listener)
  })
}

// Where a relative walk stops climbing. Any component that can contain itself stamps this on its
// own root, so an inner instance composes its own chain and not the outer one's plus its own.
export const ROUTE_BOUNDARY_ATTR = "data-route-boundary"

/** The same name as `dataset` spells it. */
const ROUTE_BOUNDARY_KEY = "routeBoundary"

// Relative mode: data-route segments compose up the parent chain, params inherit
// from ancestor data-* attrs (closest wins). Emits on skeleton + param match.
export function fromDelegatedRoute<Path extends string, K extends keyof HTMLElementEventMap>(
  template: Path,
  eventName: K,
  root: EventTarget = document,
): Observable<EventWithParams<HTMLElementEventMap[K], Path>> {
  const { keys, skeleton } = analyze(template)
  return new Observable<EventWithParams<HTMLElementEventMap[K], Path>>((subscriber) => {
    const listener = (event: Event) => {
      const segments: string[] = []
      const params: Record<string, string> = {}
      let delegate: HTMLElement | undefined
      let el = event.target instanceof HTMLElement ? event.target : null
      while (el) {
        const ds = el.dataset as Record<string, string | undefined>
        if (ds.route !== undefined) {
          if (!delegate) delegate = el
          segments.unshift(ds.route)
        }
        for (const key of keys) {
          const v = ds[key]
          if (v !== undefined && params[key] === undefined) params[key] = v
        }
        // The boundary element is the outermost one this walk owns, so it contributes its own
        // segment and params first and only then ends the climb.
        if (ds[ROUTE_BOUNDARY_KEY] !== undefined) break
        el = el.parentElement
      }
      if (delegate && segments.join("/") === skeleton && keys.every((k) => k in params)) {
        subscriber.next(
          Object.assign(event, {
            delegateElement: delegate,
            params: params as Record<Params<Path>, string>,
          }) as EventWithParams<HTMLElementEventMap[K], Path>,
        )
      }
    }
    root.addEventListener(eventName, listener)
    return () => root.removeEventListener(eventName, listener)
  })
}

const cache = new Map<string, DomTemplate<string>>()

export function Dom<const Path extends string>(template: Path): DomTemplate<Path> {
  const cached = cache.get(template)
  if (cached) return cached as DomTemplate<Path>

  const p = slash(template)
  const { skeleton } = analyze(template)
  const print = p.print as unknown as (values: Record<string, string | number>) => string
  const streams: Partial<Record<keyof HTMLElementEventMap, Observable<unknown>>> = {}
  const routeStreams: Partial<Record<keyof HTMLElementEventMap, Observable<unknown>>> = {}
  const result: DomTemplate<Path> = {
    template,
    id: values => print(values),
    with: values => ({ id: print(values) }),
    $: new Proxy({}, {
      get: (_, eventName: string) =>
        streams[eventName as keyof HTMLElementEventMap] ??=
          fromDelegatedEvent(template, eventName as keyof HTMLElementEventMap).pipe(share()),
    }) as Events<Path>,
    route: new Proxy({}, {
      get: (_, eventName: string) =>
        routeStreams[eventName as keyof HTMLElementEventMap] ??=
          fromDelegatedRoute(template, eventName as keyof HTMLElementEventMap).pipe(share()),
    }) as Events<Path>,
    boxAttrs: (values) => {
      const attrs: Record<string, string> = { "data-route": skeleton }
      for (const key of Object.keys(values)) {
        attrs[`data-${kebab(key)}`] = String(values[key as keyof typeof values])
      }
      return attrs
    },
  }
  cache.set(template, result as DomTemplate<string>)
  return result
}
