// Every path into a signal's value is itself a signal. `state.user.name` is not a selector helper:
// it is a Signal, it reads with `.$()`, it writes through to the root, and it emits on its own.
import { fromEvent, merge, tap } from "rxjs"
import { mountInView, runWhenInView } from "@hafley66/docs-kit"
import { Signal } from "../src/index.js"
import { button, panel, readout, row } from "./0_dom.js"
import source from "./2_nested.ts?raw"
import type { Example } from "./0_types.js"

// A type alias rather than an interface: the path proxy's type gates on an index signature, and an
// interface never carries one, so `state.user.name` would stop being a signal at the first step.
type Profile = {
  user: { name: string; city: string }
  visits: number
}

const NAMES = ["chris", "sam", "robin", "alex"] as const
const CITIES = ["lisbon", "osaka", "denver"] as const

export const nested: Example = {
  id: "nested-paths",
  title: "A path is a signal",
  summary: "`state.user.name` reads, writes through to the root, and emits without the root being rebuilt.",
  form: "state",
  source,
  mount: (host) =>
    mountInView(host, () => {
      const root = panel(host)
      const controls = row(root)
      const rename = button("rename", controls)
      const move = button("move", controls)
      const visit = button("visit", controls)
      const name = readout("user.name", root)
      const city = readout("user.city", root)
      const whole = readout("the whole value", root)
      const path = readout("the path it writes", root)

      const state = Signal<Profile>({ user: { name: "chris", city: "lisbon" }, visits: 0 })
      let step = 0

      const pressed$ = merge(
        fromEvent(rename, "click").pipe(
          tap(() => {
            step += 1
            state.user.name.$(NAMES[step % NAMES.length] ?? "chris")
          }),
        ),
        fromEvent(move, "click").pipe(
          tap(() => {
            step += 1
            state.user.city.$(CITIES[step % CITIES.length] ?? "lisbon")
          }),
        ),
        fromEvent(visit, "click").pipe(tap(() => state.visits.$(state.visits.$() + 1))),
      )

      // Three readouts on three different paths. Only the one whose branch moved writes.
      const shown$ = merge(
        state.user.name.$.pipe(tap((it) => name.write(it))),
        state.user.city.$.pipe(tap((it) => city.write(it))),
        state.$.pipe(tap((it) => whole.write(JSON.stringify(it)))),
      )

      path.write(state.user.name.$.path.join(" then "))

      const stopPressed = runWhenInView(pressed$)
      const stopShown = runWhenInView(shown$)
      return () => {
        stopPressed()
        stopShown()
        root.remove()
      }
    }),
}
