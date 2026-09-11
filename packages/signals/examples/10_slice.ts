// A reducer over a state signal, one action bus, and epics that turn actions into more actions.
// `dispatch` reduces synchronously; epics run only while `epics$` is being observed.
import { filter, fromEvent, map, merge, tap } from "rxjs"
import { mountInView, runWhenInView } from "@hafley66/docs-kit"
import { createSlice, type Epic } from "../src/index.js"
import { button, panel, readout, row } from "./0_dom.js"
import source from "./10_slice.ts?raw"
import type { Example } from "./0_types.js"

type Basket = {
  items: number
  log: readonly string[]
}

type Action = { type: "add"; by: number } | { type: "double-please" } | { type: "clear" }

const reduce = (state: Basket, action: Action): Basket => {
  if (action.type === "add") return { items: state.items + action.by, log: [...state.log, `add ${action.by}`] }
  if (action.type === "clear") return { items: 0, log: [] }
  return { ...state, log: [...state.log, "double-please"] }
}

// One action in, another action out. The epic never touches the state; it asks for a change.
const doubler: Epic<Action, Basket, unknown> = (actions$, state) =>
  actions$.pipe(
    filter((it) => it.type === "double-please"),
    map(() => ({ type: "add", by: state.items.$() }) as Action),
  )

export const sliced: Example = {
  id: "slice-epics",
  title: "createSlice, and an epic that is cold until observed",
  summary: "The same button does nothing and then doubles, depending on whether `epics$` is being observed.",
  form: "slice",
  source,
  mount: (host) =>
    mountInView(host, () => {
      const root = panel(host)
      const controls = row(root)
      const add = button("add 3", controls)
      const double = button("double-please", controls)
      const clear = button("clear", controls)
      const items = readout("items", root)
      const log = readout("actions that reduced", root)
      const running = readout("epics running", root)

      const slice = createSlice<Basket, Action>({
        initial: { items: 3, log: [] },
        reduce,
        epics: [doubler],
      })

      const pressed$ = merge(
        fromEvent(add, "click").pipe(tap(() => slice.dispatch({ type: "add", by: 3 }))),
        fromEvent(double, "click").pipe(tap(() => slice.dispatch({ type: "double-please" }))),
        fromEvent(clear, "click").pipe(tap(() => slice.dispatch({ type: "clear" }))),
      )

      const shown$ = slice.state.$.pipe(
        tap((it) => {
          items.write(String(it.items))
          log.write(it.log.length === 0 ? "none yet" : it.log.join(" then "))
        }),
      )

      // `epics$` never emits. Observing it is what makes the epic live, and `runWhenInView` is what
      // decides when: scroll this demo out of view and `double-please` stops doubling.
      const running$ = slice.epics$.pipe(tap(() => {}))
      running.write("while this demo is on screen")

      const stop = runWhenInView(merge(pressed$, shown$, running$))
      return () => {
        stop()
        root.remove()
      }
    }),
}
