// The single-cell bench page. Every factor is on the query string, `0_bench.ts` mounts it, and
// `window.__bench` drives one burst from `1_run.ts`. Opening the page by hand leaves the grid there.
import { setGridLogEmit } from "../../src/index.js"
import { cfgOf, mountBench } from "./0_bench.js"
import { burst, firstRowAt, type Run, type StageTotal } from "./1_run.js"

const found = document.getElementById("mount")
if (found === null) throw new Error("bench page has no #mount")
const mount: HTMLElement = found

const cfg = cfgOf(new URLSearchParams(location.search))
const bench = mountBench(mount, cfg)

export type { Run, StageTotal }

// Stage totals come off the package's LogTape surface, so a row says where the frame went and not
// only how long. No other engine in the head-to-head can report this about itself.
const by = new Map<string, { records: number; ms: number }>()
const stages = {
  start: (): void => {
    setGridLogEmit((category, _message, fields) => {
      const key = category.join(".")
      const held = by.get(key) ?? { records: 0, ms: 0 }
      held.records += 1
      held.ms += typeof fields["durationMs"] === "number" ? fields["durationMs"] : 0
      by.set(key, held)
    })
  },
  reset: (): void => by.clear(),
  stop: (): readonly StageTotal[] => {
    setGridLogEmit(null)
    return [...by].map(([stage, it]) => ({ stage, records: it.records, ms: it.ms }))
  },
}

const run = (warm: number, frames: number): Promise<Run> =>
  burst({
    warm,
    frames,
    step: bench.step,
    scroll: () => bench.scroll,
    held: () => mount.getElementsByClassName("sg-row").length,
    // `render` decorates the element it is handed, so the grid root is the mount and the inline
    // custom properties are on its own style attribute.
    styleBytes: () => (mount.getAttribute("style") ?? "").length,
    stages,
  })

window.__bench = run
window.__firstRow = firstRowAt(".sg-row")
