// Pattern dispatch over a signal tree. switch$ is the flat, exhaustive consumer for a record
// of event ports; match$ takes dotted paths — including {arg} holes — and hands each handler
// the live child node, so reads, writes, and cascades inside the handler stay plain dot
// access. Both live on the node (`source.match$(...)`) via the `special$` registry in
// 1_SignalCreator.ts, and are `when` under one selector loop: the node's own policy decides
// replay (state runs now, event nodes skip), and the node's selector applies distinct gating.
// Pattern parsing and hole matching are @hafley66/path's (`dots`/`ValuesOf` on DotPathSyntax);
// this module only adds what path cannot know: which node a pattern resolves to and when it
// emits.
import { dots } from "@hafley66/path"
import type { Subscription } from "rxjs"
import { CAT_UNSUBSCRIBE, LOG } from "./0_log.js"
import type { ArgsOf, PatternValue, Signal } from "./0_types.js"
import { signalDispatch, special$ } from "./1_SignalCreator.js"

const CAT_MATCH = ["signals", "match"] as const

/** Handler errors are contained per emission — a throwing matcher must not kill the channel. */
const run = (handler: (...args: unknown[]) => void, args: unknown[]): void => {
  try {
    handler(...args)
  } catch (error) {
    if (LOG.on) LOG.emit(CAT_MATCH, "handler threw {reason}", { reason: String(error) })
  }
}

const done = (subs: Subscription[]): (() => void) => {
  let closed = false
  return () => {
    if (closed) return
    closed = true
    for (const sub of subs) {
      if (LOG.on) LOG.emit(CAT_UNSUBSCRIBE, "match dispose", {})
      sub.unsubscribe()
    }
  }
}

/**
 * Flat, exhaustive dispatch over a record of event ports. Every handler runs for its key's
 * writes; a state source replays each key's current value on subscribe, an event source
 * (`Signal<Record>()`) fires on the next write only.
 */
export function switch$<E extends Record<string, unknown>>(
  source: Signal<E>,
  handlers: { [K in keyof E & string]-?: (value: E[K]) => void },
): () => void {
  const subs: Subscription[] = []
  for (const key of Object.keys(handlers) as (keyof E & string)[]) {
    const node = (source as unknown as Record<string, Signal<E[typeof key]>>)[key]
    subs.push(node.$.subscribe(value => run(handlers[key] as (...args: unknown[]) => void, [value])))
  }
  return done(subs)
}

/**
 * Dotted-path dispatch over a signal tree. Exact patterns subscribe their node directly;
 * `{hole}` patterns subscribe the meta stream and match concrete write paths at dispatch
 * time, so indexes that do not exist yet match as soon as they are written. The handler
 * receives the node at the matched path (writable, proxy-identical to a hand dot-walk) plus
 * the extracted holes.
 */
export function match$<E, const P extends string>(
  source: Signal<E>,
  handlers: { [K in P]: (it: Signal<PatternValue<E, K>>, args: ArgsOf<K>) => void },
): () => void {
  const subs: Subscription[] = []
  const compiled = (Object.entries(handlers) as [P, (...args: unknown[]) => void][]).map(([pattern, handler]) => ({
    segments: pattern.split("."),
    route: pattern.includes("{") ? dots(pattern) : undefined,
    handler,
  }))

  for (const { segments, route, handler } of compiled) {
    if (route !== undefined) continue
    let node: unknown = source
    for (const segment of segments) node = (node as Record<string, unknown>)[segment]
    subs.push((node as Signal<unknown>).$.subscribe(() => run(handler, [node, {}])))
  }

  const holed = compiled.flatMap(({ route, handler }) => (route !== undefined ? [{ route, handler }] : []))
  if (holed.length > 0) {
    subs.push(
      signalDispatch.subscribe(event => {
        if (event.type !== "set") return
        const { path } = event.value
        const text = path.join(".")
        for (const { route, handler } of holed) {
          const attempt = route.match(text)
          if (attempt.matched) run(handler, [event.value.signal, attempt.values])
        }
      }),
    )
  }

  return done(subs)
}
/** Plugs both dispatchers onto every node: `source.switch$(...)`, `source.match$(...)`. */
special$.switch$ = node => handlers => switch$(node as Signal<Record<string, unknown>>, handlers)
special$.match$ = node => handlers => match$(node as Signal<unknown>, handlers)
