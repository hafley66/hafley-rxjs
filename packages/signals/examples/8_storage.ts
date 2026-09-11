// A producer: external state enters as a signal rather than being mirrored into a component. The
// browser's own store is behind the same `.$()` and `.$(next)` a plain state signal has.
import { fromEvent, merge, tap } from "rxjs"
import { mountInView, runWhenInView } from "@hafley66/docs-kit"
import { StorageSignal } from "../src/index.js"
import { button, field, panel, readout, row } from "./0_dom.js"
import source from "./8_storage.ts?raw"
import type { Example } from "./0_types.js"

const KEY = "signals-docs-note"

export const stored: Example = {
  id: "storage-signal",
  title: "A signal backed by localStorage",
  summary: "Write it, reload the page, and it is still there. The fallback is what it holds before anything was written.",
  form: "producer",
  source,
  mount: (host) =>
    mountInView(host, () => {
      const root = panel(host)
      const controls = row(root)
      const input = field("a note that survives a reload", controls)
      const save = button("save", controls)
      const clear = button("clear", controls)
      const held = readout("what the signal holds", root)
      const where = readout("the key it reads", root)

      const note = StorageSignal(KEY, "nothing saved yet")

      input.value = note.$()
      where.write(KEY)

      const pressed$ = merge(
        fromEvent(save, "click").pipe(tap(() => note.$(input.value))),
        fromEvent(clear, "click").pipe(
          tap(() => {
            input.value = ""
            note.$("nothing saved yet")
          }),
        ),
      )

      const shown$ = note.$.pipe(tap((it) => held.write(JSON.stringify(it))))

      const stop = runWhenInView(merge(pressed$, shown$))
      return () => {
        stop()
        root.remove()
      }
    }),
}
