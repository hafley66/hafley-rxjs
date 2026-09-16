// A module the site suite hands to the docs page. The page's own dev server transforms it, so the
// signal it mounts is the source in this repository — the same module graph the demos on the page
// already run — rather than a bundle built for a test.
import { Signal } from "../../src/index.js"

/** What the suite drives the mounted signal through, and what takes it back out of the page. */
export interface ProbeHandle {
  /** Write the signal the probe rendered; whether the DOM follows is what the suite is testing. */
  readonly write: (next: number) => void
  /** Stop listening to the signal and remove the nodes the probe added. */
  readonly unsubscribe: () => void
}

/** Mount a counter into a host the caller owns, and hand back the write and the teardown. */
export function mountProbe(host: HTMLElement): ProbeHandle {
  const root = document.createElement("div")
  root.dataset.probe = "signal"
  const label = document.createElement("span")
  label.className = "probe-label"
  label.textContent = "count"
  const value = document.createElement("code")
  value.className = "probe-value"
  root.append(label, value)
  host.append(root)

  const count = Signal(0)
  // The first paint is a read, so the number on screen is the signal's own value and not a copy of
  // the seed the probe wrote beside it. The subscription is the reactive half: the examples get it
  // from `runWhenInView`, which needs a host bound by `mountInView`, and this mount has neither.
  value.textContent = String(count.$())
  const sub = count.$.subscribe((it) => {
    value.textContent = String(it)
  })

  return {
    write: (next) => count.$(next),
    unsubscribe: () => {
      sub.unsubscribe()
      root.remove()
    },
  }
}
