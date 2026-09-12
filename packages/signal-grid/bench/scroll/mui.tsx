// MUI X Data Grid 9.13.0 (MIT) over the same rows, the same five columns at the same pixel widths,
// the same 36 px row height and the same heavy cell, driven by the same burst as `main.ts`.
//
// @comment-ok: every deviation from the signal-grid page is an equalisation, and a reader has to be
// able to check each one against the props below rather than trust the table that comes out.
// - `rowBufferPx` is MUI's overscan and is measured in pixels, so `overscan * ROW_PX` puts the same
//   number of buffered rows on each side as the `overscan` factor asks for.
// - `hideFooter` because signal-grid renders no footer, and a footer is a fixed row of nodes.
// - `disableColumnMenu` because signal-grid's header carries no menu button per column.
// - virtualization stays on, sorting stays on, and no `apiRef` is used.
// - `pagination` is forced true on the MIT tier (`DataGrid/useDataGridProps.mjs:14`) and `pageSize`
//   throws above 100 (`hooks/features/pagination/gridPaginationUtils.mjs:26`), so the scroller is
//   100 rows deep whatever `rows` carries. Nothing here can lift that.
import { useLayoutEffect, useMemo, useRef, useState, type ReactElement } from "react"
import { createRoot } from "react-dom/client"
import { DataGrid, type GridColDef, type GridRenderCellParams } from "@mui/x-data-grid"
import { ROW_PX, cfgOf, rowsOf, type BenchRow, type Cfg } from "./0_bench.js"
import { burst, firstRowAt, type Run } from "./1_run.js"
import { Heavy } from "./2_heavy.js"

const found = document.getElementById("mount")
if (found === null) throw new Error("bench page has no #mount")
const mount: HTMLElement = found

const cfg = cfgOf(new URLSearchParams(location.search))

const plain = (params: GridRenderCellParams<BenchRow>): ReactElement => <>{String(params.value)}</>
const heavy = (params: GridRenderCellParams<BenchRow>): ReactElement => (
  <Heavy row={params.row} col={params.field} />
)

const columnsOf = (kind: Cfg["cell"]): readonly GridColDef<BenchRow>[] => {
  const render = kind === "plain" ? plain : heavy
  return [
    { field: "name", headerName: "Name", width: 220, renderCell: render },
    { field: "size", headerName: "Size", type: "number", width: 120, renderCell: render },
    { field: "pct", headerName: "Share", width: 160, renderCell: render },
    { field: "spark", headerName: "Trend", width: 100, renderCell: render },
    { field: "at", headerName: "Index", type: "number", width: 100, renderCell: render },
  ]
}

const RESIZE_SPAN = 0.25
const RESIZE_PERIOD = 40

interface Box {
  readonly width: number
  readonly height: number
}

let stepImpl: (px: number, at: number) => void = () => {}
let scrollerImpl: () => HTMLElement = () => mount

function Bench({ cfg: c }: { readonly cfg: Cfg }): ReactElement {
  const host = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<Box>({ width: c.width, height: c.height })
  const rows = useMemo(() => rowsOf(c) as BenchRow[], [c.rows, c.src])
  const columns = useMemo(() => columnsOf(c.cell) as GridColDef<BenchRow>[], [c.cell])
  const heights = useMemo(
    () =>
      c.extent === "varied"
        ? (at: number): number => ROW_PX + (at % 5) * 6
        : null,
    [c.extent],
  )
  useLayoutEffect(() => {
    const el = host.current
    if (el === null) return
    const scroller = (): HTMLElement => {
      const node = el.querySelector(".MuiDataGrid-virtualScroller")
      if (!(node instanceof HTMLElement)) throw new Error("mui bench has no scroller")
      return node
    }
    scrollerImpl = scroller
    stepImpl = (px, at) => {
      if (c.resize === 1) {
        const wave = 1 + Math.sin((at / RESIZE_PERIOD) * Math.PI * 2) * RESIZE_SPAN
        setBox({ width: Math.round(c.width * wave), height: Math.round(c.height * wave) })
      }
      scroller().scrollTop += px
    }
  }, [c])
  return (
    <div ref={host} style={{ inlineSize: `${box.width}px`, blockSize: `${box.height}px` }}>
      <DataGrid
        rows={rows}
        columns={columns}
        getRowId={(row: BenchRow) => row.id}
        rowHeight={ROW_PX}
        columnHeaderHeight={ROW_PX}
        rowBufferPx={c.overscan * ROW_PX}
        getRowHeight={heights === null ? undefined : (params) => heights((params.model as BenchRow).at)}
        hideFooter
        disableColumnMenu
        disableRowSelectionOnClick
      />
    </div>
  )
}

createRoot(mount).render(<Bench cfg={cfg} />)

const run = (warm: number, frames: number): Promise<Run> =>
  burst({
    warm,
    frames,
    step: (px, at) => stepImpl(px, at),
    scroll: () => scrollerImpl(),
    held: () => mount.getElementsByClassName("MuiDataGrid-row").length,
    styleBytes: () => (mount.querySelector(".MuiDataGrid-root")?.getAttribute("style") ?? "").length,
  })

window.__bench = run
window.__firstRow = firstRowAt(".MuiDataGrid-row")
