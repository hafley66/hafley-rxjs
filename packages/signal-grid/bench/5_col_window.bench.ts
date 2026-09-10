// One horizontal scroll frame of a wide schema, column window off and then on. The timed body
// replans both axes off the moved viewport and addresses every cell of every rendered row.
import { cellId, grid, type ColumnDef, type Grid, type RowId } from "../src/index.js"
import { consume } from "./0_data.js"
import { register, type Case } from "./_cases.js"

const COL_COUNT = 240
const ROW_COUNT = 100_000
const COL_WIDTH = 100
const VIEWPORT = { top: 0, left: 0, width: 1200, height: 800 } as const

type WideRow = { readonly id: RowId }

// A reader per column rather than 24 million materialised fields: the per-cell work is the same
// call the renderer makes, and the fixture stays inside a normal heap.
const COLUMNS: readonly ColumnDef<WideRow>[] = Array.from({ length: COL_COUNT }, (_value, index) => ({
  id: `c${String(index).padStart(3, "0")}`,
  width: COL_WIDTH,
  value: (row: WideRow): string => `${row.id}:${index}`,
}))

const ROWS: readonly WideRow[] = Array.from({ length: ROW_COUNT }, (_value, index) => ({
  id: `r${index}`,
}))

const gridOf = (virtualizeCol: boolean): Grid<WideRow> =>
  grid<WideRow>({
    id: `wide-${String(virtualizeCol)}`,
    rows: ROWS,
    columns: COLUMNS,
    rowId: (it) => it.id,
    viewport: { ...VIEWPORT },
    state: { virtualize: true, virtualizeCol },
  })

const defsById = new Map(COLUMNS.map((it) => [it.id, it] as const))

/** Every cell the renderer would build this frame, addressed and read the way `cellFor` does. */
function drawFrame(gauge: Grid<WideRow>): number {
  const plan = gauge.view.plan.$()
  const run = gauge.view.colPlan.$()
  const by = gauge.view.detailed.$().by
  let drawn = 0
  for (const rowKey of plan.center) {
    const row = by.get(rowKey)
    if (row === undefined) continue
    for (const side of [run.start, run.center, run.end]) {
      for (const colKey of side) {
        consume(cellId(rowKey, colKey))
        consume(defsById.get(colKey)?.value?.(row))
        drawn++
      }
    }
  }
  return drawn
}

// The scroll steps by a whole column, so every frame in the timed loop crosses a window boundary.
// Holding still would measure the memo returning the previous answer, which is not a scroll.
const SCROLL_STEP = COL_WIDTH
const SCROLL_SPAN = COL_COUNT * COL_WIDTH - VIEWPORT.width

const scrollOnce = (gauge: Grid<WideRow>, at: number): void => {
  const port = gauge.viewport.$()
  gauge.viewport.$({ ...port, left: (at * SCROLL_STEP) % SCROLL_SPAN })
}

const frameCase = (gauge: Grid<WideRow>): (() => void) => {
  let at = 0
  return () => {
    at++
    scrollOnce(gauge, at)
    consume(drawFrame(gauge))
  }
}

const off = gridOf(false)
const on = gridOf(true)

/** The number this feature is about, taken once per mode outside the timed loop. Same viewport and
 * same schema on both, so the ratio is the DOM the renderer stops building. */
export const CELLS_PER_FRAME: Readonly<Record<"off" | "on", number>> = {
  off: (scrollOnce(off, 40), drawFrame(off)),
  on: (scrollOnce(on, 40), drawFrame(on)),
}

export const COLUMNS_PER_ROW: Readonly<Record<"off" | "on", number>> = {
  off: off.view.colPlan.$().center.length,
  on: on.view.colPlan.$().center.length,
}

const CASES: readonly Case[] = [
  {
    group: `column window, ${COL_COUNT} columns x ${ROW_COUNT} rows`,
    name: "scroll frame, column window off",
    run: frameCase(off),
    iterations: 60,
    warmup: 15,
    means: `one horizontal scroll frame addressing ${CELLS_PER_FRAME.off} cells`,
  },
  {
    group: `column window, ${COL_COUNT} columns x ${ROW_COUNT} rows`,
    name: "scroll frame, column window on",
    run: frameCase(on),
    iterations: 60,
    warmup: 15,
    means: `one horizontal scroll frame addressing ${CELLS_PER_FRAME.on} cells`,
  },
]

register(CASES)

// The cell counts beside the timings, because the ratio the timings show is the ratio of these two
// and a reader should not have to take that on trust.
process.stdout.write(
  `cells per frame: off ${CELLS_PER_FRAME.off}, on ${CELLS_PER_FRAME.on}` +
    ` (columns in the center run: off ${COLUMNS_PER_ROW.off}, on ${COLUMNS_PER_ROW.on})\n`,
)
