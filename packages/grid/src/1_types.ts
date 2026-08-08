import type {
  ColumnDef,
  OnChangeFn,
  PaginationState,
  RowData,
  SortingState,
} from "@tanstack/react-table"
import type { Signal } from "@hafley66/signals"
import type { GridFeatures } from "./0_features"

export type GridMode = "client" | "server"

export type GridState = {
  sorting: SortingState
  pagination: PaginationState
}

export type GridEvent =
  | { type: "sort"; sorting: SortingState }
  | { type: "page"; pagination: PaginationState }

export type GridConfig<TData extends RowData> = {
  rows: Signal<TData[]>
  columns: ColumnDef<GridFeatures, TData>[]
  getRowId: (row: TData) => string
  mode: GridMode
  state?: Signal<GridState>
}

export type Grid<TData extends RowData> = {
  state: Signal<GridState>
  events: Signal<GridEvent | undefined>
  rows: Signal<TData[]>
  columns: ColumnDef<GridFeatures, TData>[]
  mode: GridMode
  getRowId: (row: TData) => string
  onSortingChange: OnChangeFn<SortingState>
  onPaginationChange: OnChangeFn<PaginationState>
}
