import { useEffect } from "react"
import { filter } from "rxjs"
import { useSignal } from "@hafley66/signals/react"
import { useTable, type ColumnDef, type RowData } from "@tanstack/react-table"
import { gridFeatures, type GridFeatures } from "./0_features"
import type { Grid, GridEffect } from "./1_types"

// Subscribe `handler` to one effect type for the component's lifetime.
export function useGridEffect<TData extends RowData, T extends GridEffect<TData>["type"]>(
  grid: Grid<TData>,
  type: T,
  handler: (effect: Extract<GridEffect<TData>, { type: T }>) => void,
): void {
  useEffect(() => {
    const sub = grid.epicCtx.phase$.effect
      .pipe(filter((a): a is Extract<GridEffect<TData>, { type: T }> => a.type === type))
      .subscribe(handler)
    return () => sub.unsubscribe()
  }, [grid, type, handler])
}

// `columns` defaults to the grid's own columns; TreeTable passes TreeColumn-derived defs instead.
export function useGrid<TData extends RowData>(
  grid: Grid<TData>,
  columns: ColumnDef<GridFeatures, TData>[] = grid.columns,
) {
  const state = useSignal(grid.state.$)
  const rows = useSignal(grid.rows.$)
  useEffect(() => {
    const sub = grid.epics$.subscribe()
    return () => sub.unsubscribe()
  }, [grid])

  return useTable({
    features: gridFeatures,
    data: rows,
    columns,
    getRowId: grid.getRowId,
    getSubRows: grid.getSubRows,
    getRowCanExpand: grid.getRowCanExpand ? (row) => grid.getRowCanExpand?.(row.original) ?? false : undefined,
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
    // Flat client grids arrive pre-sorted from the rows memo; trees need TanStack to sort subRows.
    manualSorting: grid.mode === "server" || !grid.getSubRows,
    manualFiltering: grid.mode === "server",
    manualPagination: grid.mode === "server",
    // Signal-backed rows commonly emit new arrays while preserving row ids.
    // TanStack's default reset collapses the tree after every such emission.
    autoResetExpanded: false,
  })
}

export * from "./1_types"
export * from "./2_createGrid"
export { GridTable, type RowDensity, type Align, type GridScrollMode, type ScrollMode } from "./4_grid"
export { GridTree } from "./6_tree"
export { TreeTable, type TreeTableProps, type TreeTableDensity } from "./12_treeTable"
export { ColumnVisibilityToolbar } from "./13_columnVisibilityToolbar"
export {
  type TreeColumn,
  type TreeColumnEpic,
  type TreeColumnEpicCtx,
  type ColumnVisibilityEntry,
  treeColumnDefs,
  treeColumnsOf,
  columnValue,
  columnEpics,
  treeColumnGridEpics,
  selectOnPlainClick,
  pivotOnAltClick,
  noMods,
  visibilityEntries,
  toggleColumnVisibility,
} from "./10_treeColumn"
export { hasWidthSignal, anyWidthSignal } from "./9_treeSize"
