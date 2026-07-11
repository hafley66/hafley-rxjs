import { Observable, share } from "rxjs"
import type { HtmlEventIndex$ } from "./8_domEvents.js"

type Params<Path extends string> =
  Path extends `${string}:${infer Param}/${infer Rest}`
    ? Param | Params<`/${Rest}`>
    : Path extends `${string}:${infer Param}`
      ? Param
      : never

type Values<Path extends string> = Record<Params<Path>, string | number>
type EventWithParams<E, Path extends string> = E & {
  delegateElement: HTMLElement
  params: Record<Params<Path>, string>
}
type Events<Path extends string> = {
  [K in keyof HtmlEventIndex$]: HtmlEventIndex$[K] extends Observable<infer E>
    ? Observable<EventWithParams<E, Path>>
    : never
}

export type DomTemplate<Path extends string> = {
  readonly template: Path
  id(values: Values<Path>): string
  with(values: Values<Path>): { readonly id: string }
  readonly $: Events<Path>
}

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

function compile(path: string) {
  const keys: string[] = []
  const pattern = path
    .split("/")
    .map(segment => {
      if (!segment.startsWith(":")) return escapeRegex(segment)
      keys.push(segment.slice(1))
      return "([^/]+)"
    })
    .join("/")
  return { keys, regex: new RegExp(`^${pattern}$`) }
}

function fill(path: string, values: Record<string, string | number>) {
  return path.split("/").map(segment => {
    if (!segment.startsWith(":")) return segment
    const key = segment.slice(1)
    return encodeURIComponent(String(values[key]))
  }).join("/")
}

export function fromDelegatedEvent<Path extends string, K extends keyof HTMLElementEventMap>(
  template: Path,
  eventName: K,
  root: EventTarget = document,
): Observable<EventWithParams<HTMLElementEventMap[K], Path>> {
  const { keys, regex } = compile(template)
  return new Observable<EventWithParams<HTMLElementEventMap[K], Path>>(subscriber => {
    const listener = (event: Event) => {
      let element = event.target instanceof HTMLElement ? event.target : null
      while (element) {
        const match = regex.exec(element.id)
        if (match) {
          const params = Object.fromEntries(keys.map((key, i) => [
            key,
            decodeURIComponent(match[i + 1]),
          ])) as Record<Params<Path>, string>
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

const cache = new Map<string, DomTemplate<string>>()

export function Dom<const Path extends string>(template: Path): DomTemplate<Path> {
  const cached = cache.get(template)
  if (cached) return cached as DomTemplate<Path>

  const streams: Partial<Record<keyof HTMLElementEventMap, Observable<unknown>>> = {}
  const result: DomTemplate<Path> = {
    template,
    id: values => fill(template, values),
    with: values => ({ id: fill(template, values) }),
    $: new Proxy({}, {
      get: (_, eventName: string) =>
        streams[eventName as keyof HTMLElementEventMap] ??=
          fromDelegatedEvent(template, eventName as keyof HTMLElementEventMap).pipe(share()),
    }) as Events<Path>,
  }
  cache.set(template, result as DomTemplate<string>)
  return result
}
