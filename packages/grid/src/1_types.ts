import type { z } from "zod"
import type { ObjectPathsOf } from "@hafley66/path"
import type {
  ColumnDef,
  ColumnFiltersState,
  ColumnOrderState,
  ColumnPinningState,
  ColumnSizingState,
  ColumnVisibilityState,
  ExpandedState,
  GroupingState,
  OnChangeFn,
  PaginationState,
  RowData,
  RowPinningState,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table"
import type { Signal } from "@hafley66/signals"
import type { GridFeatures } from "./0_features"

export type GridMode = "client" | "server"

export type GridState = {
  sorting: SortingState
  columnFilters: ColumnFiltersState
  globalFilter: unknown
  columnOrder: ColumnOrderState
  columnPinning: ColumnPinningState
  columnVisibility: ColumnVisibilityState
  columnSizing: ColumnSizingState
  rowPinning: RowPinningState
  rowSelection: RowSelectionState
  expanded: ExpandedState
  grouping: GroupingState
  pagination: PaginationState
}

export type GridEvent = { type: keyof GridState } & Partial<GridState>

export type ColumnSpec = {
  header?: string
  visible?: boolean
}

export type GridSync = {
  // Route-local query param key. The grid reads/writes ?<key>=<devalue blob>.
  key: string
}

export type GridConfig<TData extends RowData> = {
  schema: z.ZodType<TData>
  rows: Signal<TData[]>
  columns?: Partial<Record<ObjectPathsOf<TData> & string, ColumnSpec>>
  columnDefs?: ColumnDef<GridFeatures, TData>[]
  getRowId: (row: TData) => string
  getSubRows?: (row: TData, index: number) => TData[] | undefined
  mode: GridMode
  state?: Signal<GridState>
  sync?: GridSync
}

type GridChangeHandlers = {
  onSortingChange: OnChangeFn<SortingState>
  onColumnFiltersChange: OnChangeFn<ColumnFiltersState>
  onGlobalFilterChange: OnChangeFn<unknown>
  onColumnOrderChange: OnChangeFn<ColumnOrderState>
  onColumnPinningChange: OnChangeFn<ColumnPinningState>
  onColumnVisibilityChange: OnChangeFn<ColumnVisibilityState>
  onColumnSizingChange: OnChangeFn<ColumnSizingState>
  onRowPinningChange: OnChangeFn<RowPinningState>
  onRowSelectionChange: OnChangeFn<RowSelectionState>
  onExpandedChange: OnChangeFn<ExpandedState>
  onGroupingChange: OnChangeFn<GroupingState>
  onPaginationChange: OnChangeFn<PaginationState>
}

export type Grid<TData extends RowData> = {
  schema: z.ZodType<TData>
  state: Signal<GridState>
  events: Signal<GridEvent | undefined>
  rows: Signal<TData[]>
  columns: ColumnDef<GridFeatures, TData>[]
  mode: GridMode
  getRowId: (row: TData) => string
  getSubRows?: (row: TData, index: number) => TData[] | undefined
} & GridChangeHandlers
