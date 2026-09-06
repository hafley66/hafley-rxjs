import { bench, describe } from "vitest"
import { filter, map } from "rxjs"
import { createSlice, type Epic } from "./10_slice.js"

type Action = { type: "tick" } | { type: "echo"; n: number }
type State = { n: number }

const reduce = (s: State, a: Action): State => (a.type === "echo" ? { n: s.n + a.n } : s)
const echo: Epic<Action, State> = (actions$) =>
  actions$.pipe(
    filter((a) => a.type === "tick"),
    map((): Action => ({ type: "echo", n: 1 })),
  )

// One tick = 1 dispatch + 1 epic-derived dispatch through the queue-scheduled shared bus.
describe("createSlice dispatch", () => {
  const cold = createSlice<State, Action>({ initial: { n: 0 }, reduce })
  bench("dispatch, no subscribers", () => {
    cold.dispatch({ type: "tick" })
  })

  const hot = createSlice<State, Action>({ initial: { n: 0 }, reduce, epics: [echo, echo, echo] })
  hot.epics$.subscribe()
  hot.actions$.subscribe()
  bench("dispatch, 3 epics + 1 observer", () => {
    hot.dispatch({ type: "tick" })
  })
})
