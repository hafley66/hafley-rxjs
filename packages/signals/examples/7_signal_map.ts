// `signalMap` is the computed form as a pipe operator: the projection's signal reads are tracked,
// so the output re-emits on a signal change as well as on a source emission.
import { fromEvent, merge, of, tap } from "rxjs"
import { mountInView, runWhenInView } from "@hafley66/docs-kit"
import { Signal, signalMap } from "../src/index.js"
import { button, panel, readout, row } from "./0_dom.js"
import source from "./7_signal_map.ts?raw"
import type { Example } from "./0_types.js"

export const mapped: Example = {
  id: "signal-map",
  title: "signalMap re-emits on a signal read",
  summary: "A source that emits once, and a projection that keeps producing because the rate it reads is a signal.",
  form: "operator",
  source,
  mount: (host) =>
    mountInView(host, () => {
      const root = panel(host)
      const controls = row(root)
      const raise = button("rate + 1", controls)
      const priceOut = readout("amount times rate", root)
      const emits = readout("emissions from one `of(1)`", root)

      const rate = Signal(2)
      const amount$ = of(10)

      let count = 0
      const converted$ = amount$.pipe(
        signalMap((it) => it * rate.$()),
        tap((it) => {
          count += 1
          priceOut.write(String(it))
          emits.write(String(count))
        }),
      )

      const raised$ = fromEvent(raise, "click").pipe(tap(() => rate.$(rate.$() + 1)))

      const stop = runWhenInView(merge(converted$, raised$))
      return () => {
        stop()
        root.remove()
      }
    }),
}
