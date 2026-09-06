import { Signal } from "@hafley66/signals"
import type { RowData } from "@tanstack/react-table"
import { createGrid } from "./2_createGrid.js"
import type { Grid } from "./1_types.js"

// Same value the column's accessor produces (TreeColumn.value or accessorKey); row[columnId] otherwise.
function cellValue<TData extends RowData>(grid: Grid<TData>, row: TData, columnId: string): unknown {
  const def = grid.columns.find((c) => c.id === columnId) as { accessorFn?: (row: TData, index: number) => unknown; accessorKey?: string } | undefined
  if (def?.accessorFn) return def.accessorFn(row, 0)
  return (row as Record<string, unknown>)[def?.accessorKey ?? columnId]
}

export function pivotGrid<TData extends RowData>(grid: Grid<TData>, columnId: string, value: unknown): Grid<TData> {
  const rows = Signal<TData[]>(() => grid.rows.$().filter((row) => cellValue(grid, row, columnId) === value))
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
