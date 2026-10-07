// Ten library flows rebuilt on the signal primitives: input chording, gesture timing,
// Solid-style memo equality and granular stores, effect deferral, async queries, slice
// reducers, router patterns, editor history, and debounced persistence. Each test names
// the flow it recreates and stays on the public surface: Signal(), Signal(() => ...),
// Signal(observable, seed), pipe$, leaf writes, match$, switch$.

import { buffer, debounceTime, distinctUntilChanged, filter, map, Observable, Subject, scan, skip } from "rxjs"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Signal } from "./2_Signal.js"
import { Endpoint, type EndpointResponse } from "./3_Endpoint.js"
import "./12_match.js"

afterEach(() => {
  vi.useRealTimers()
})

describe("library flows on signals", () => {
  it("chording: simultaneous key bursts resolve to sorted chord names (keyboard lib)", () => {
    vi.useFakeTimers()
    const keys = Signal<string>()
    const chords = keys.$.pipe$(
      buffer(keys.$.pipe(debounceTime(40))),
      map(group => [...group].sort().join("+")),
      filter(name => name.includes("+")),
    )
    const fired: string[] = []
    const sub = chords.$.subscribe(name => fired.push(name))

    keys.$("f")
    keys.$("d")
    vi.advanceTimersByTime(41)
    expect(fired).toEqual(["d+f"])

    keys.$("j")
    vi.advanceTimersByTime(41)
    expect(fired).toEqual(["d+f"])

    sub.unsubscribe()
  })

  it("double-tap: exactly two taps in one burst is a gesture, three is not (gesture lib)", () => {
    vi.useFakeTimers()
    const taps = Signal<string>()
    const doubleTaps = taps.$.pipe$(
      buffer(taps.$.pipe(debounceTime(250))),
      map(burst => burst.length),
      filter(count => count === 2),
    )
    const fired: number[] = []
    const sub = doubleTaps.$.subscribe(count => fired.push(count))

    taps.$("zoom")
    taps.$("zoom")
    vi.advanceTimersByTime(251)
    expect(fired).toEqual([2])

    taps.$("pinch")
    taps.$("pinch")
    taps.$("pinch")
    vi.advanceTimersByTime(251)
    expect(fired).toEqual([2])

    sub.unsubscribe()
  })

  it("createMemo equality: equal recompute stays silent through the distinct gate (Solid 2.0)", () => {
    const state = Signal<{ items: string[] }>({ items: ["a"] })
    let runs = 0
    const length = Signal(() => {
      runs += 1
      return state.items.$().length
    })
    const seen: number[] = []
    const sub = length.$.pipe$(distinctUntilChanged()).$.subscribe(value => seen.push(value))

    state.items.$(["b"])
    expect(seen).toEqual([1])

    state.items.$(["b", "c"])
    expect(seen).toEqual([1, 2])
    expect(runs).toBeGreaterThanOrEqual(3)

    sub.unsubscribe()
  })
  it("createStore granularity: leaf writes notify only the touched branch (Solid store)", () => {
    const state = Signal({ a: { x: 1 }, b: { y: 2 } })
    const fires: Record<"a" | "b", number> = { a: 0, b: 0 }
    const subA = state.a.$.subscribe(() => {
      fires.a += 1
    })
    const subB = state.b.$.subscribe(() => {
      fires.b += 1
    })
    fires.a = 0
    fires.b = 0

    state.a.x.$(5)
    expect(fires).toEqual({ a: 1, b: 0 })

    state.b.y.$(9)
    expect(fires).toEqual({ a: 1, b: 1 })

    subA.unsubscribe()
    subB.unsubscribe()
  })

  it("createEffect on(deps, {defer}): skip first run, cleanup before re-run (Solid effects)", () => {
    const name = Signal("ada")
    const log: string[] = []
    let teardown: (() => void) | undefined
    const sub = name.$.pipe$(skip(1)).$.subscribe(() => {
      teardown?.()
      teardown = () => log.push("cleanup")
      log.push(`saw ${name.$()}`)
    })

    expect(log).toEqual([])
    name.$("grace")
    expect(log).toEqual(["saw grace"])
    name.$("linus")
    expect(log).toEqual(["saw grace", "cleanup", "saw linus"])

    sub.unsubscribe()
    teardown?.()
    expect(log).toEqual(["saw grace", "cleanup", "saw linus", "cleanup"])
  })

  it("createQuery: loading, success, key switch cancels, cache hit on return (react-query)", () => {
    vi.useFakeTimers()
    const requests: Array<{
      input: { id: string }
      response: Subject<EndpointResponse>
    }> = []
    const endpoint = new Endpoint<{ id: string }, { id: string; name: string }>(
      {
        key: input => input.id,
        request: input => ({ url: `/users/${input.id}`, method: "GET", body: input }),
        decode: raw => raw.body as { id: string; name: string },
      },
      request =>
        new Observable<EndpointResponse>(subscriber => {
          const response = new Subject<EndpointResponse>()
          let cancelled = false
          requests.push({
            input: request.body as { id: string },
            response,
            cancelled: () => cancelled,
          })
          const sub = response.subscribe(subscriber)
          return () => {
            cancelled = true
            sub.unsubscribe()
          }
        }),
    )
    const input = Signal<{ id: string } | undefined>(undefined)
    const query = endpoint.createQuery(input, { staleTime: Number.POSITIVE_INFINITY })
    const states: Array<{ status: string; data?: { id: string; name: string } }> = []
    const sub = query.$.subscribe(state => states.push({ status: state.status, data: state.data }))

    input.$({ id: "1" })
    expect(requests).toHaveLength(1)
    requests[0].response.next({ status: 200, body: { id: "1", name: "ada" } })
    const latest = () => states[states.length - 1]
    expect(latest()).toEqual({ status: "success", data: { id: "1", name: "ada" } })

    input.$({ id: "2" })
    expect(requests).toHaveLength(2)
    expect(requests[0].cancelled()).toBe(true)
    requests[1].response.next({ status: 200, body: { id: "2", name: "grace" } })
    expect(latest().data).toEqual({ id: "2", name: "grace" })

    input.$({ id: "1" })
    expect(requests).toHaveLength(2)
    expect(latest().data).toEqual({ id: "1", name: "ada" })

    sub.unsubscribe()
  })

  it("createSlice: actions in, reducer scan, memoized selectors out (redux toolkit)", () => {
    const actions = Signal<{ add?: { n: number }; reset?: true }>()
    const cart = Signal(
      actions.$.pipe(
        scan(
          (items: number[], action: { add?: { n: number }; reset?: true }) =>
            action.reset ? [] : action.add ? [...items, action.add.n] : items,
          [] as number[],
        ),
      ),
      [] as number[],
    )
    const total = Signal(() => cart.$().reduce((sum, n) => sum + n, 0))
    const seen: number[] = []
    const sub = total.$.subscribe(value => seen.push(value))

    actions.$({ add: { n: 3 } })
    actions.$({ add: { n: 4 } })
    expect(total.$()).toBe(7)
    expect(seen).toEqual([0, 3, 7])

    actions.$({ reset: true })
    expect(cart.$()).toEqual([])
    expect(total.$()).toBe(0)

    sub.unsubscribe()
  })

  it("router: route state is a tree, navigation is a write, match$ dispatches holes (router)", () => {
    type Route = { users?: Record<string, { posts?: Record<string, boolean> }>; settings?: boolean }
    const route = Signal<Route>({ settings: true })
    const seen: Array<{ id: string; post: string }> = []
    const dispose = route.match$({
      "users.{id}.posts.{postId}": (_it, args) => seen.push({ id: args.id, post: args.postId }),
    })

    expect(seen).toEqual([])
    route.users[9].posts[4].$(true)
    expect(seen).toEqual([{ id: "9", post: "4" }])

    route.settings.$(false)
    expect(seen).toEqual([{ id: "9", post: "4" }])

    route.users[2].posts[8].$(true)
    expect(seen).toEqual([
      { id: "9", post: "4" },
      { id: "2", post: "8" },
    ])

    dispose()
  })

  it("editor history: undo/redo as one scan over a union of intents (editor lib)", () => {
    type History = { past: string[]; text: string; future: string[] }
    type Intent = { type: "type"; ch: string } | { type: "undo" } | { type: "redo" }
    const intents = Signal<Intent>()
    const history = Signal(
      intents.$.pipe(
        scan(
          (state: History, intent: Intent): History => {
            if (intent.type === "type") {
              return { past: [...state.past, state.text], text: state.text + intent.ch, future: [] }
            }
            if (intent.type === "undo") {
              const previous = state.past[state.past.length - 1]
              return previous === undefined
                ? state
                : { past: state.past.slice(0, -1), text: previous, future: [state.text, ...state.future] }
            }
            const next = state.future[0]
            return next === undefined
              ? state
              : { past: [...state.past, state.text], text: next, future: state.future.slice(1) }
          },
          { past: [], text: "", future: [] },
        ),
      ),
      { past: [], text: "", future: [] } as History,
    )
    const texts: string[] = []
    const sub = history.$.subscribe(state => texts.push(state.text))

    intents.$({ type: "type", ch: "a" })
    intents.$({ type: "type", ch: "b" })
    expect(history.$().text).toBe("ab")
    expect(texts).toEqual(["", "a", "ab"])

    intents.$({ type: "undo" })
    expect(history.$().text).toBe("a")

    intents.$({ type: "redo" })
    expect(history.$().text).toBe("ab")

    intents.$({ type: "type", ch: "c" })
    expect(history.$().text).toBe("abc")
    expect(history.$()).toEqual({ past: ["", "a", "ab"], text: "abc", future: [] })
    expect(texts).toEqual(["", "a", "ab", "a", "ab", "abc"])

    sub.unsubscribe()
  })

  it("autosave: debounced distinct persistence woven with rxjs inside a signal (persistence)", () => {
    vi.useFakeTimers()
    const editor = Signal({ text: "" })
    const saves: string[] = []
    const sub = editor.text.$.pipe$(debounceTime(300)).$.subscribe(() => saves.push(editor.text.$()))

    editor.text.$("h")
    editor.text.$("he")
    editor.text.$("hel")
    vi.advanceTimersByTime(299)
    expect(saves).toEqual([])
    vi.advanceTimersByTime(1)
    expect(saves).toEqual(["hel"])

    editor.text.$("hello")
    vi.advanceTimersByTime(300)
    expect(saves).toEqual(["hel", "hello"])

    sub.unsubscribe()
  })
})
