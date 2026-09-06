import { describe, expect, it } from "vitest"
import { filter, map } from "rxjs"
import { createEpic, createSlice } from "./10_slice.js"
import { Signal } from "./2_Signal.js"

type Action = { type: "inc" } | { type: "add"; by: number } | { type: "double-please" }
type State = { n: number }

const reduce = (s: State, a: Action): State => {
  if (a.type === "inc") return { n: s.n + 1 }
  if (a.type === "add") return { n: s.n + a.by }
  return s
}

describe("createSlice", () => {
  it("dispatch reduces synchronously with no subscriber", () => {
    const slice = createSlice<State, Action>({ initial: { n: 0 }, reduce })
    slice.dispatch({ type: "inc" })
    expect(slice.state.$()).toEqual({ n: 1 })
  })

  it("an action the reducer ignores keeps the state reference", () => {
    const slice = createSlice<State, Action>({ initial: { n: 0 }, reduce })
    const before = slice.state.$()
    slice.dispatch({ type: "double-please" })
    expect(slice.state.$()).toBe(before)
  })

  it("actions$ re-emits every dispatched action after the reduce", () => {
    const slice = createSlice<State, Action>({ initial: { n: 0 }, reduce })
    const seen: Array<[string, number]> = []
    slice.actions$.subscribe((a) => seen.push([a.type, slice.state.$().n]))
    slice.dispatch({ type: "inc" })
    slice.dispatch({ type: "add", by: 2 })
    expect(seen).toEqual([["inc", 1], ["add", 3]])
  })

  it("epics run only while epics$ is subscribed, and their output is dispatched", () => {
    const doubler = createEpic<Action, State, { by: number }>((actions$, state, ctx) =>
      actions$.pipe(
        filter((a) => a.type === "double-please"),
        map(() => ({ type: "add", by: state.$().n * (ctx.by - 1) }) as Action),
      ),
    )
    const slice = createSlice<State, Action, { by: number }>({ initial: { n: 3 }, reduce, epics: [doubler], ctx: { by: 2 } })

    slice.dispatch({ type: "double-please" })
    expect(slice.state.$().n).toBe(3)

    const sub = slice.epics$.subscribe()
    slice.dispatch({ type: "double-please" })
    expect(slice.state.$().n).toBe(6)

    sub.unsubscribe()
    slice.dispatch({ type: "double-please" })
    expect(slice.state.$().n).toBe(6)
  })

  it("two subscribers share one epic run", () => {
    let runs = 0
    const counter = createEpic<Action, State>((actions$) =>
      actions$.pipe(
        filter((a) => a.type === "double-please"),
        map(() => {
          runs++
          return { type: "inc" } as Action
        }),
      ),
    )
    const slice = createSlice<State, Action>({ initial: { n: 0 }, reduce, epics: [counter] })
    const a = slice.epics$.subscribe()
    const b = slice.epics$.subscribe()
    slice.dispatch({ type: "double-please" })
    expect(runs).toBe(1)
    expect(slice.state.$().n).toBe(1)
    a.unsubscribe()
    b.unsubscribe()
  })

  it("delivers an intent to every observer before the effect an epic derived from it", () => {
    const derive = createEpic<Action, State>((actions$) =>
      actions$.pipe(
        filter((a) => a.type === "double-please"),
        map(() => ({ type: "inc" }) as Action),
      ),
    )
    const slice = createSlice<State, Action>({ initial: { n: 0 }, reduce, epics: [derive] })
    const sub = slice.epics$.subscribe()
    const late: string[] = []
    slice.actions$.subscribe((a) => late.push(a.type))
    slice.dispatch({ type: "double-please" })
    expect(late).toEqual(["double-please", "inc"])
    expect(slice.state.$().n).toBe(1)
    sub.unsubscribe()
  })

  it("accepts an external state signal as the store", () => {
    const store = Signal<State>({ n: 10 })
    const slice = createSlice<State, Action>({ initial: { n: 0 }, reduce, state: store })
    slice.dispatch({ type: "inc" })
    expect(store.$()).toEqual({ n: 11 })
    expect(slice.state).toBe(store)
  })
})
