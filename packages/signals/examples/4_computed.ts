// The computed form. `Signal(() => ...)` tracks whichever signals the body read on its last run, so
// the dependency set is a consequence of the code rather than a list kept beside it.
import { fromEvent, merge, tap } from "rxjs"
import { mountInView, runWhenInView } from "@hafley66/docs-kit"
import { Signal } from "../src/index.js"
import { button, panel, readout, row } from "./0_dom.js"
import source from "./4_computed.ts?raw"
import type { Example } from "./0_types.js"

export const computed: Example = {
  id: "computed-thunk",
  title: "Derivation is a thunk",
  summary: "The body picks its own branch, so the toggle changes which signal the total depends on and the run count proves it.",
  form: "computed",
  source,
  mount: (host) =>
    mountInView(host, () => {
      const root = panel(host)
      const controls = row(root)
      const bumpLeft = button("left + 1", controls)
      const bumpRight = button("right + 1", controls)
      const swap = button("read the other one", controls)
      const total = readout("the derived value", root)
      const runs = readout("times the body ran", root)

      const left = Signal(1)
      const right = Signal(100)
      const reading = Signal<"left" | "right">("left")

      let ran = 0
      const chosen = Signal(() => {
        ran += 1
        return reading.$() === "left" ? left.$() : right.$()
      })

      const pressed$ = merge(
        fromEvent(bumpLeft, "click").pipe(tap(() => left.$(left.$() + 1))),
        fromEvent(bumpRight, "click").pipe(tap(() => right.$(right.$() + 1))),
        fromEvent(swap, "click").pipe(tap(() => reading.$(reading.$() === "left" ? "right" : "left"))),
      )

      const shown$ = chosen.$.pipe(
        tap((it) => {
          total.write(`${reading.$()} is ${it}`)
          runs.write(String(ran))
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
