// The source form. `Signal(observable)` is undefined until the first emission; the second argument
// is the value to hold until then, which is what makes a loading state a value rather than a flag.
import { interval, map, merge, tap } from "rxjs"
import { mountInView, runWhenInView } from "@hafley66/docs-kit"
import { Signal } from "../src/index.js"
import { panel, readout } from "./0_dom.js"
import source from "./3_source.ts?raw"
import type { Example } from "./0_types.js"

const TICK_MS = 700

export const sourced: Example = {
  id: "source-observable",
  title: "A signal fed by an observable",
  summary: "The same interval behind two signals: one starts undefined, one starts at the default it was given.",
  form: "source",
  source,
  mount: (host) =>
    mountInView(host, () => {
      const root = panel(host)
      const bare = readout("Signal(ticks$)", root)
      const withDefault = readout("Signal(ticks$, 0)", root)

      const ticks$ = interval(TICK_MS).pipe(map((it) => it + 1))

      const late = Signal(ticks$)
      const early = Signal(ticks$, 0)

      // Read before either has emitted, so the difference the second argument makes is on screen.
      bare.write(String(late.$()))
      withDefault.write(String(early.$()))

      const shown$ = merge(
        late.$.pipe(tap((it) => bare.write(String(it)))),
        early.$.pipe(tap((it) => withDefault.write(String(it)))),
      )

      const stop = runWhenInView(shown$)
      return () => {
        stop()
        root.remove()
      }
    }),
}
