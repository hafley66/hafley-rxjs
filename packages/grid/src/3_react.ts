import { useSignal } from "@hafley66/signals/react"
import { useTable, type RowData } from "@tanstack/react-table"
import { gridFeatures } from "./0_features"
import type { Grid } from "./1_types"

export function useGrid<TData extends RowData>(grid: Grid<TData>) {
  const sorting = useSignal(grid.state.sorting.$)
  const pagination = useSignal(grid.state.pagination.$)
  const rows = useSignal(grid.rows.$)

  return useTable({
    features: gridFeatures,
    data: rows,
    columns: grid.columns,
    getRowId: grid.getRowId,
    state: { sorting, pagination },
    onSortingChange: grid.onSortingChange,
    onPaginationChange: grid.onPaginationChange,
    manualSorting: true,
    manualPagination: grid.mode === "server",
  })
}

export * from "./1_types"
export * from "./2_createGrid"
