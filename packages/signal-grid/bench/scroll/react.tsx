// The same grid as `index.html`, with every cell handed to React through `reactSlot`. The
// difference between this page and that one is the price of the opt-in, and nothing else.
import { createElement, type ReactNode } from "react"
import { reactSlot } from "../../src/react/index.js"
import { cfgOf, mountBench, type BenchRow } from "./0_bench.js"
import { burst, firstRowAt, type Run } from "./1_run.js"
import { Heavy } from "./2_heavy.js"

const found = document.getElementById("mount")
if (found === null) throw new Error("bench page has no #mount")
const mount: HTMLElement = found

const cfg = cfgOf(new URLSearchParams(location.search))

interface CellProps {
  readonly data: BenchRow
  readonly col: string
  readonly value: unknown
}

const view = (ctx: CellProps): ReactNode =>
  cfg.cell === "plain"
    ? String(ctx.value)
    : createElement(Heavy, { row: ctx.data, col: ctx.col })

const slot = reactSlot<CellProps>(view)
const bench = mountBench(mount, cfg, undefined, (ctx) =>
  slot({ data: ctx.data, col: ctx.col, value: ctx.value }),
)

const run = (warm: number, frames: number): Promise<Run> =>
  burst({
    warm,
    frames,
    step: bench.step,
    scroll: () => bench.scroll,
    held: () => mount.getElementsByClassName("sg-row").length,
    styleBytes: () => (mount.getAttribute("style") ?? "").length,
  })

window.__bench = run
window.__firstRow = firstRowAt(".sg-row")
