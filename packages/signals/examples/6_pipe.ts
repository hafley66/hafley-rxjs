// `pipe` hands back an Observable, which is a thing to compose. `pipe$` runs the same operators and
// hands back a Signal, which is a thing to store, read with `.$()`, and read a path into.
import { debounceTime, fromEvent, map, merge, tap } from "rxjs"
import { mountInView, runWhenInView } from "@hafley66/docs-kit"
import { Signal } from "../src/index.js"
import { field, panel, readout, row } from "./0_dom.js"
import source from "./6_pipe.ts?raw"
import type { Example } from "./0_types.js"

const QUIET_MS = 300

// Module scope rather than inside `mount`, because a `pipe$` signal is hot for its lifetime:
// `signalFromObservable` holds one subscription so an unobserved piped signal still answers `.$()`.
// One per page is right; one per mount would be one more every time a reader scrolls past.
const typed = Signal("")

const settledText = typed.$.pipe$(
  debounceTime(QUIET_MS),
  map((it) => it.trim().toLowerCase()),
)

export const piped: Example = {
  id: "pipe-signal",
  title: "pipe$ keeps the read surface",
  summary: "Typing feeds a signal, `pipe$` debounces and trims it, and the result is still something `.$()` reads.",
  form: "operator",
  source,
  mount: (host) =>
    mountInView(host, () => {
      const root = panel(host)
      const controls = row(root)
      const input = field("type something", controls)
      const raw = readout("what you typed", root)
      const settled = readout("after pipe$", root)
      const readBack = readout("settled.$() right now", root)

      input.value = typed.$()

      const typing$ = fromEvent(input, "input").pipe(tap(() => typed.$(input.value)))

      const shown$ = merge(
        typed.$.pipe(
          tap((it) => {
            raw.write(JSON.stringify(it))
            // A signal reads synchronously, so the settled value is available without a subscription.
            readBack.write(JSON.stringify(settledText.$()))
          }),
        ),
        settledText.$.pipe(tap((it) => settled.write(JSON.stringify(it)))),
      )

      const stop = runWhenInView(merge(typing$, shown$))
      return () => {
        stop()
        root.remove()
      }
    }),
}
