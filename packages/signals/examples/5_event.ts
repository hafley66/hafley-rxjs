// The event form. `Signal<T>()` with no argument is a bare Subject: no current value, no replay.
// A late reader sees what happens next and nothing that already happened, which is the whole point.
import { fromEvent, merge, tap } from "rxjs"
import { mountInView, runWhenInView } from "@hafley66/docs-kit"
import { Signal } from "../src/index.js"
import { button, panel, readout, row } from "./0_dom.js"
import source from "./5_event.ts?raw"
import type { Example } from "./0_types.js"

export const event: Example = {
  id: "event-bus",
  title: "A signal with no current value",
  summary: "One bare Subject and two listeners, the second attached late, so the missing replay is on screen.",
  form: "event",
  source,
  mount: (host) =>
    mountInView(host, () => {
      const root = panel(host)
      const controls = row(root)
      const fire = button("fire", controls)
      const join = button("attach the late listener", controls)
      const early = readout("listening from the start", root)
      const late = readout("attached later", root)
      const held = readout("value held between fires", root)

      const fired = Signal<number>()
      let count = 0
      const seenEarly: number[] = []
      const seenLate: number[] = []
      let listening = false

      const fired$ = fromEvent(fire, "click").pipe(
        tap(() => {
          count += 1
          fired.$(count)
        }),
      )

      const heard$ = fired.$.pipe(
        tap((it) => {
          if (it === undefined) return
          seenEarly.push(it)
          if (listening) seenLate.push(it)
          early.write(seenEarly.join(", "))
          late.write(listening ? seenLate.join(", ") : "not attached yet")
          held.write(String(fired.$()))
        }),
      )

      const joined$ = fromEvent(join, "click").pipe(
        tap(() => {
          listening = true
          // A replaying signal would hand the newcomer the last value here. This one hands it nothing.
          late.write(seenLate.join(", ") || "attached, and heard nothing yet")
        }),
      )

      early.write("nothing yet")
      late.write("not attached yet")
      held.write(String(fired.$()))

      const stop = runWhenInView(merge(fired$, heard$, joined$))
      return () => {
        stop()
        root.remove()
      }
    }),
}
