// @comment-ok: what this renderer deliberately does not cover is the claim the file is evidence for, and a reader comparing it to 10_render.ts has nowhere else to read it
// The same grid drawn by React instead of by `src/10_render.ts`. Nothing is created here: no
// `Signal`, no state hook, no copy of a row. Every value on screen is read off the grid's own
// signals while the component runs, and `signalsJsx()` is what turns each of those reads into the
// subscription that runs it again.
//
// Scope is what the three examples offering the choice need, which is why it is a fifth of
// `10_render.ts`. Not drawn: header bands, cell spans, group headings, detail panels, every slot,
// the editing seat, links, selection stamping, per-row heights, the pinned row runs, and the
// spacer tracks a column window leaves behind.
import { useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from "react"
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"
import {
  cellAttrs,
  columnReader,
  expandAttrs,
  gridAttrs,
  headerAttrs,
  resizeAttrs,
  rowAttrs,
  SG_DEPTH,
  writeGridVars,
  type ColId,
  type ColumnDef,
  type Grid,
  type RowId,
  type Side,
  type SortDirection,
  type SortModel,
  type Viewport,
} from "../src/index.js"

const SIDES: readonly Side[] = ["start", "center", "end"]

const directionOf = (model: SortModel, col: ColId): SortDirection | null =>
  model.find((it) => it.field === col)?.sort ?? null

const textOf = (value: unknown): string => (value === null || value === undefined ? "" : String(value))

/** The three `10_render.ts:781` opens, all of them the kernel's: the intent door, the one track-list
 * write, and the viewport feed `view.plan` windows against. Without the last, no row is in range. */
function useGridWiring<TRow>(
  grid: Grid<TRow>,
  root: RefObject<HTMLDivElement | null>,
  scroll: RefObject<HTMLDivElement | null>,
): void {
  useEffect(() => {
    const host = root.current
    const box = scroll.current
    if (host === null || box === null) return
    const write = (next: Partial<Viewport>): void => {
      grid.viewport.$({ ...grid.viewport.$(), ...next })
    }
    const onScroll = (): void => write({ top: box.scrollTop, left: box.scrollLeft })
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect !== undefined) write({ width: rect.width, height: rect.height })
    })
    observer.observe(box)
    box.addEventListener("scroll", onScroll, { passive: true })
    const unbind = grid.bind(host)
    const unwrite = writeGridVars(grid, host)
    return () => {
      unbind()
      unwrite()
      observer.disconnect()
      box.removeEventListener("scroll", onScroll)
    }
  }, [grid, root, scroll])
}

function HeadCell<TRow>({ col, def, sort }: {
  readonly col: ColId
  readonly def: ColumnDef<TRow> | undefined
  readonly sort: SortDirection | null
}): ReactNode {
  // The theme draws the arrow off `data-sort` and a reader hears the column off `aria-sort`, so a
  // column with no key in the model carries neither rather than carrying an empty one.
  const sorted = sort === null
    ? {}
    : { "data-sort": sort, "aria-sort": sort === "asc" ? ("ascending" as const) : ("descending" as const) }
  return (
    <div className="sg-head-cell" {...headerAttrs(col)} {...sorted}>
      <div className="sg-head-label">{def?.header ?? col}</div>
      {def?.resizable === true ? <div className="sg-resize" {...resizeAttrs()} /> : null}
    </div>
  )
}

export function SignalGrid<TRow>({ grid }: { readonly grid: Grid<TRow> }): ReactNode {
  const root = useRef<HTMLDivElement | null>(null)
  const scroll = useRef<HTMLDivElement | null>(null)
  useGridWiring(grid, root, scroll)

  const defs = new Map(grid.columns.$().map((col) => [col.id, col] as const))
  const cols = grid.view.colPlan.$()
  const plan = grid.view.plan.$()
  const sort = grid.state.sort.$()
  const data = grid.view.detailed.$().by
  const down = grid.view.vertical.$()
  const expanded = grid.state.expanded.$()
  const nodes = new Map(down.nodes.map((node) => [node.key, node] as const))

  // `subgrid` inherits the row's track list, so a run declares how many tracks it covers. An empty
  // run would still claim one, which is why it is dropped rather than drawn.
  const runs = (cell: (col: ColId) => ReactNode): ReactNode =>
    SIDES.filter((side) => cols[side].length > 0).map((side) => (
      <div key={side} className="sg-run" data-side={side} style={{ gridColumn: `span ${cols[side].length}` }}>
        {cols[side].map(cell)}
      </div>
    ))

  // A flat grid grew a glyph that could never open, so the expander is drawn only where the axis
  // actually nests, and inside the first cell, where the indent it draws already lives.
  const opens = down.nodes.some((it) => it.hasChildren)
  const first = cols.start[0] ?? cols.center[0] ?? cols.end[0]

  return (
    <div ref={root} className="sg" tabIndex={0} {...gridAttrs(grid.id.$())}>
      <div ref={scroll} className="sg-scroll">
        <div className="sg-head">
          <div className="sg-head-row">
            {runs((col) => (
              <HeadCell key={col} col={col} def={defs.get(col)} sort={directionOf(sort, col)} />
            ))}
          </div>
        </div>
        <div className="sg-canvas">
          <div className="sg-rows sg-center">
            {plan.center.map((key: RowId) => {
              const node = nodes.get(key)
              const row = data.get(key)
              const open = expanded[key] === true
              return (
                <div
                  key={key}
                  className="sg-row"
                  {...rowAttrs(key)}
                  data-open={String(open)}
                  aria-expanded={node?.hasChildren === true ? open : undefined}
                  style={{ [SG_DEPTH]: String(node?.depth ?? 0) } as CSSProperties}
                >
                  {runs((col) => (
                    <div key={col} className="sg-cell" {...cellAttrs(col)}>
                      {opens && col === first
                        ? <div className="sg-expander" {...expandAttrs()} data-leaf={String(node?.hasChildren !== true)} />
                        : null}
                      {row === undefined ? "" : textOf(columnReader(defs.get(col), col)(row))}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

/** The `Example.alternate` half. Same host and same teardown contract as the DOM `mount` beside it,
 * and the grid comes from the example's own factory so neither side writes the config a second time. */
export const reactMount = <TRow,>(open: () => Grid<TRow>, height: number) =>
  (host: HTMLElement): (() => void) => {
    const stage = document.createElement("div")
    stage.style.blockSize = `${height}px`
    host.append(stage)
    const grid = open()
    const root = createRoot(stage)
    // The observer in `useGridWiring` first reports a size after the frame that mounted, and a
    // zero-height viewport windows no rows, so the box is measured once before anything renders.
    const rect = stage.getBoundingClientRect()
    grid.viewport.$({ ...grid.viewport.$(), width: rect.width, height: rect.height })
    // Synchronous, so the example check reads a painted tree on the frame after mount rather than on
    // whichever frame React's own scheduler picked.
    flushSync(() => root.render(<SignalGrid grid={grid} />))
    return () => {
      root.unmount()
      grid.close()
      stage.remove()
    }
  }
