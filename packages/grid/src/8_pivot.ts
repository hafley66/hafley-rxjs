import { Signal } from "@hafley66/signals"
import type { RowData } from "@tanstack/react-table"
import { createGrid } from "./2_createGrid.js"
import type { Grid } from "./1_types.js"

// Row values are read by property access: TData[columnId] must equal the pivot value. Grids over
// plain objects (report-app's tree rows, marbler's MarbleEvent) satisfy this without extra config.
function cellValue<TData>(row: TData, columnId: string): unknown {
  return (row as Record<string, unknown>)[columnId]
}

export function pivotGrid<TData extends RowData>(grid: Grid<TData>, columnId: string, value: unknown): Grid<TData> {
  const rows = Signal<TData[]>(() => grid.rows.$().filter((row) => cellValue(row, columnId) === value))
  const columnDefs = grid.columns.filter((column) => column.id !== columnId)
  return createGrid<TData>({
    schema: grid.schema,
    rows,
    columnDefs,
    getRowId: grid.getRowId,
    getSubRows: grid.getSubRows,
    getRowCanExpand: grid.getRowCanExpand,
    mode: grid.mode,
  })
}
