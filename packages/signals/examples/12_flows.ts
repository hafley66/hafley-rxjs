// The flow clinic: keyboard bursts become chords through pipe$, a scan-form memo keeps the log,
// and match$ holes announce every new log seat. One pad, zero manual subscriptions, every wire
// expressed in the graph.
import { buffer, debounceTime, filter, fromEvent, map, merge, tap } from "rxjs"
import { mountInView, runWhenInView } from "@hafley66/docs-kit"
import { Signal } from "../src/index.js"
import { button, panel, readout, row } from "./0_dom.js"
import source from "./12_flows.ts?raw"
import type { Example } from "./0_types.js"

export const flows: Example = {
  id: "flow-clinic",
  title: "A chord pad, wired end to end",
  summary:
    "Key bursts become chords through pipe$ + buffer, a scan-form memo keeps the log, and match$ holes announce each new log seat as it lands.",
  form: "operator",
  source,
  mount: (host) =>
    mountInView(host, () => {
      const root = panel(host)
      const controls = row(root)
      const keys = ["f", "d", "j", "k"]
      const pad = keys.map((key) => button(key, controls))
      const burst = button("burst f+d", controls)
      const wipe = button("clear log", controls)

      const windowRead = readout("chord window", root)
      const logRead = readout("log", root)
      const countRead = readout("chords so far", root)
      const seatRead = readout("newest log seat (match$ hole)", root)

      const disposers: Array<() => void> = []

      // The event form: a bare Subject for the thing that happened — a key went down.
      const keyTap = Signal<string>()

      // The chord pipeline: everything pressed inside one 40ms window becomes one sorted chord.
      // pipe$ composes and never subscribes; the log memo below is the observer that runs it.
      const chords = keyTap.$.pipe$(
        buffer(keyTap.$.pipe(debounceTime(40))),
        map((group) => [...group].sort().join("+")),
        filter((name) => name.includes("+")),
      )

      // The scan form: the body is handed its own previous value. Each chord emission reruns it,
      // and the log grows by one seat. This memo's dependency subscription runs the pipeline.
      // The source window is T | undefined — chords.$() is undefined before the first emission —
      // so the first run keeps the seed instead of appending it.
      const log = Signal((prev: string[]) => (chords.$() === undefined ? prev : [...prev, chords.$()]), [] as string[])

      // The durable half of the pad: a state tree whose seats the match$ holes watch.
      const tree = Signal({ log: [] as string[] })
      disposers.push(
        tree.match$({
          "log.{i}": (it, args) => seatRead.write(`log[${String(args.i)}] = ${String(it.$())}`),
        }),
      )

      // A new log publishes its seats one write at a time, so each hole dispatch is one seat.
      const logSub = log.$.subscribe((entries) => {
        entries.forEach((entry, i) => {
          if (tree.log[i].$() !== entry) tree.log[i].$(entry)
        })
        logRead.write(entries.join("  ") || "empty")
        countRead.write(String(entries.length))
      })
      disposers.push(() => logSub.unsubscribe())

      // The chord window readout rides the piped signal itself.
      const chordsSub = chords.$.subscribe((name) => windowRead.write(name))
      disposers.push(() => chordsSub.unsubscribe())

      // Clear: the writable-memo slot. The override holds until the next chord appends.
      const wipes = fromEvent(wipe, "click").pipe(
        tap(() => {
          log.$([])
          windowRead.write("cleared")
        }),
      )

      // The pad: one producer for every press, burst included.
      const presses = merge(
        ...pad.map((key, i) => fromEvent(key, "click").pipe(map(() => keyTap.$(keys[i])))),
        fromEvent(burst, "click").pipe(
          map(() => {
            keyTap.$("f")
            keyTap.$("d")
          }),
        ),
      )

      const direct = merge(log.$, chords.$, wipes).subscribe()
      disposers.push(() => direct.unsubscribe())
      const stop = runWhenInView(presses)
      return () => {
        disposers.forEach((dispose) => dispose())
        root.remove()
      }
    }),
}
