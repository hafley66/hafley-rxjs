// The state form. `Signal(0)` holds a current value, `.$()` reads it, `.$(next)` writes it, and the
// same object is both halves: nothing here takes a value and an onChange beside it.
import { fromEvent, merge, tap } from "rxjs"
import { mountInView, runWhenInView } from "@hafley66/docs-kit"
import { Signal } from "../src/index.js"
import { button, panel, readout, row } from "./0_dom.js"
import source from "./1_state.ts?raw"
import type { Example } from "./0_types.js"

export const state: Example = {
  id: "state-counter",
  title: "A signal that holds a value",
  summary: "One BehaviorSubject behind `.$()` and `.$(next)`, with the readout driven by the same signal the buttons write.",
  form: "state",
  source,
  mount: (host) =>
    mountInView(host, () => {
      const root = panel(host)
      const controls = row(root)
      const up = button("increment", controls)
      const down = button("decrement", controls)
      const reset = button("reset", controls)
      const count = readout("count", root)
      const parity = readout("parity", root)

      const clicks = Signal(0)

      const pressed$ = merge(
        fromEvent(up, "click").pipe(tap(() => clicks.$(clicks.$() + 1))),
        fromEvent(down, "click").pipe(tap(() => clicks.$(clicks.$() - 1))),
        fromEvent(reset, "click").pipe(tap(() => clicks.$(0))),
      )

      const shown$ = clicks.$.pipe(
        tap((it) => {
          count.write(String(it))
          parity.write(it % 2 === 0 ? "even" : "odd")
        }),
      )

      const stopPressed = runWhenInView(pressed$)
      const stopShown = runWhenInView(shown$)
      return () => {
        stopPressed()
        stopShown()
        root.remove()
      }
    }),
}
