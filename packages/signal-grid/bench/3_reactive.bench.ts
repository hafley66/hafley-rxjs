import { grid, type Grid } from "../src/8_grid.js"
import type { SortModel } from "../src/0_types.js"
import { register, type Case } from "./_cases.js"
import { ASC, COLUMNS, DESC, rowsOf } from "./_fixtures.js"
import { consume, type Row } from "./0_data.js"

// What is specific to this design: derivation is a chain of computed signals over one state object,
// so the question is which writes reach which memo, not how fast one operator is.

// Every grid starts with an active sort. Without one `buildComparator` answers null and `sortAxis`
// returns its input by reference, which would make the burst cases measure a no-op.
const gridOf = (id: string, n: number): Grid<Row> => {
  const made = grid<Row>({ id, rows: rowsOf(n), columns: COLUMNS, rowId: (row) => row.id })
  made.state.sort.$(ASC)
  made.view.flat.$()
  return made
}

const small = gridOf("reactive-1k", 1000)
const large = gridOf("reactive-100k", 100000)

// A rendering grid has a live subscriber on the plan. Everything else in this file reads on demand
// with nothing subscribed, which is the cheaper of the two and has to be labelled as such.
const smallLive = gridOf("reactive-1k-live", 1000)
const largeLive = gridOf("reactive-100k-live", 100000)
smallLive.view.plan.$.subscribe(() => {})
largeLive.view.plan.$.subscribe(() => {})

let flip = false
const nextSort = (): SortModel => {
  flip = !flip
  return flip ? ASC : DESC
}

let tick = 0
const nextWidth = (): Record<string, number> => {
  tick++
  return { score: 100 + (tick % 64) }
}

const burst = (target: Grid<Row>, writes: number): void => {
  for (let at = 0; at < writes; at++) target.state.colWidth.$(nextWidth())
}

const sizes: readonly { readonly label: string; readonly grid: Grid<Row>; readonly live: Grid<Row> }[] = [
  { label: "1k rows", grid: small, live: smallLive },
  { label: "100k rows", grid: large, live: largeLive },
]

const HOLD_ITERS = [{ iterations: 200, warmup: 50, inner: 200 }, { iterations: 200, warmup: 50, inner: 200 }]
const WRITE_ITERS = [{ iterations: 60, warmup: 15 }, { iterations: 12, warmup: 3 }]
const BURST = [1000, 20]
const BURST_ITERS = [{ iterations: 5, warmup: 2 }, { iterations: 5, warmup: 2 }]

export const CASES: readonly Case[] = sizes.flatMap((size, at): Case[] => [
  // Null hypothesis: the memo does not hold. A repeated read with no intervening write should cost
  // a property load; if it costs a flatten, the computed signal is not memoizing at all.
  {
    group: `reactive, ${size.label}`,
    name: `read view.flat, no write (${size.label})`,
    run: () => consume(size.grid.view.flat.$()),
    means: "the clean-memo floor: one dirty check and a stored array",
    ...(HOLD_ITERS[at] as { iterations: number; warmup: number; inner: number }),
  },

  // Null hypothesis: nothing. This is the reference cost, the work a sort change is supposed to do.
  {
    group: `reactive, ${size.label}`,
    name: `state.sort write then view.flat read (${size.label})`,
    run: () => {
      size.grid.state.sort.$(nextSort())
      consume(size.grid.view.flat.$())
    },
    means: "sortAxis plus flattenAxis, the work a sort change owes",
    ...(WRITE_ITERS[at] as { iterations: number; warmup: number }),
  },

  // Null hypothesis: dependency scoping does not skip work. `colWidth` is read by `view.widths` and
  // by no stage of the row pipeline, so this should be within noise of the no-write read above.
  {
    group: `reactive, ${size.label}`,
    name: `state.colWidth write then view.flat read (${size.label})`,
    run: () => {
      size.grid.state.colWidth.$(nextWidth())
      consume(size.grid.view.flat.$())
    },
    means: "a write no row-pipeline stage reads, then the flat list is read back",
    ...(WRITE_ITERS[at] as { iterations: number; warmup: number }),
  },

  // Null hypothesis: the resize gesture recomputes the row pipeline. One pointermove per write, so
  // anything above a few microseconds per write is a dropped frame during a drag.
  {
    group: `reactive, ${size.label}`,
    name: `${BURST[at]} sequential colWidth writes, nothing subscribed (${size.label})`,
    run: () => burst(size.grid, BURST[at] as number),
    means: `${BURST[at]} pointermove-sized writes with no read between them`,
    ...(BURST_ITERS[at] as { iterations: number; warmup: number }),
  },
  {
    group: `reactive, ${size.label}`,
    name: `${BURST[at]} sequential colWidth writes, view.plan subscribed (${size.label})`,
    run: () => burst(size.live, BURST[at] as number),
    means: `the same burst on a grid that is rendering, so every stage has an observer`,
    ...(BURST_ITERS[at] as { iterations: number; warmup: number }),
  },
])

register(CASES)
