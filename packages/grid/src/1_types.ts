import type { z } from "zod"
import type { ObjectPathsOf } from "@hafley66/path"
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

export type ColumnSpec = {
  header?: string
  visible?: boolean
}

export type GridConfig<TData extends RowData> = {
  schema: z.ZodType<TData>
  rows: Signal<TData[]>
  columns?: Partial<Record<ObjectPathsOf<TData> & string, ColumnSpec>>
  getRowId: (row: TData) => string
  mode: GridMode
  state?: Signal<GridState>
}

export type Grid<TData extends RowData> = {
  schema: z.ZodType<TData>
  state: Signal<GridState>
  events: Signal<GridEvent | undefined>
  rows: Signal<TData[]>
  columns: ColumnDef<GridFeatures, TData>[]
  mode: GridMode
  getRowId: (row: TData) => string
  onSortingChange: OnChangeFn<SortingState>
  onPaginationChange: OnChangeFn<PaginationState>
}
