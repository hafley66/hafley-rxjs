import { useSignal } from "@hafley66/signals/react"
import { useTable, type RowData } from "@tanstack/react-table"
import { gridFeatures } from "./0_features"
import type { Grid } from "./1_types"

export function useGrid<TData extends RowData>(grid: Grid<TData>) {
  const state = useSignal(grid.state.$)
  const rows = useSignal(grid.rows.$)

  return useTable({
    features: gridFeatures,
    data: rows,
    columns: grid.columns,
    getRowId: grid.getRowId,
    getSubRows: grid.getSubRows,
    state,
    onSortingChange: grid.onSortingChange,
    onColumnFiltersChange: grid.onColumnFiltersChange,
    onGlobalFilterChange: grid.onGlobalFilterChange,
    onColumnOrderChange: grid.onColumnOrderChange,
    onColumnPinningChange: grid.onColumnPinningChange,
    onColumnVisibilityChange: grid.onColumnVisibilityChange,
    onColumnSizingChange: grid.onColumnSizingChange,
    onRowPinningChange: grid.onRowPinningChange,
    onRowSelectionChange: grid.onRowSelectionChange,
    onExpandedChange: grid.onExpandedChange,
    onGroupingChange: grid.onGroupingChange,
    onPaginationChange: grid.onPaginationChange,
    manualSorting: true,
    manualFiltering: grid.mode === "server",
    manualPagination: grid.mode === "server",
    // Signal-backed rows commonly emit new arrays while preserving row ids.
    // TanStack's default reset collapses the tree after every such emission.
    autoResetExpanded: false,
  })
}

export * from "./1_types"
export * from "./2_createGrid"
export { GridTable, type RowDensity, type Align } from "./4_grid"
export { GridTree } from "./6_tree"
