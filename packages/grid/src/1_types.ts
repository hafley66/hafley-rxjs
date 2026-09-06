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
import type { Observable } from "rxjs"
import type { Epic, Signal } from "@hafley66/signals"
import type { GridFeatures } from "./0_features"

export type GridMode = "client" | "server"

export type GridTreeState = {
  // JetBrains-style compact-middle-packages: a run of single-child, non-payload rows renders
  // as one row. Toggleable at runtime; ignored when the grid has no getSubRows.
  compactChains: boolean
}

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
  tree: GridTreeState
}

export type Modifiers = { alt: boolean; ctrl: boolean; meta: boolean; shift: boolean; button: number }

// intent: the DOM saw something, nothing changed yet. change: one GridState slice was written.
// effect: leaves the grid for the consumer (selection, pivot, custom).
export type GridIntent<TData> =
  | { phase: "intent"; type: "cell.click"; column: string; rowId: string; row: TData; mods: Modifiers }
  | { phase: "intent"; type: "cell.dblclick"; column: string; rowId: string; row: TData; mods: Modifiers }
  | { phase: "intent"; type: "header.click"; column: string; mods: Modifiers }
  | { phase: "intent"; type: "row.hover"; rowId: string | null }

export type GridChange = { phase: "change"; type: keyof GridState } & Partial<GridState>

export type GridEffect<TData> =
  | { phase: "effect"; type: "select"; rowId: string; row: TData }
  | { phase: "effect"; type: "pivot"; column: string; value: unknown; row: TData }
  | { phase: "effect"; type: "custom"; name: string; payload: unknown }

export type GridAction<TData> = GridIntent<TData> | GridChange | GridEffect<TData>

export type GridPhase = GridAction<never>["phase"]

export type GridEpicCtx<TData> = {
  grid$: Observable<GridAction<TData>>
  phase$: { [P in GridPhase]: Observable<Extract<GridAction<TData>, { phase: P }>> }
  column$: (id: string) => Observable<Extract<GridAction<TData>, { column: string }>>
  state: Signal<GridState>
  rows: Signal<TData[]>
  dispatch: (action: GridAction<TData>) => void
}

export type GridEpic<TData> = Epic<GridAction<TData>, GridState, GridEpicCtx<TData>>

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
  getRowCanExpand?: (row: TData) => boolean
  mode: GridMode
  state?: Signal<GridState>
  sync?: GridSync
  // Seeds state.tree.compactChains; applying the compaction is the caller's job (7_compactChains.ts).
  tree?: { compactSingleChildChains?: boolean }
  epics?: readonly GridEpic<TData>[]
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
  actions$: Observable<GridAction<TData>>
  dispatch: (action: GridAction<TData>) => void
  // Never emits; subscribe to run the grid's epics (useGrid does), unsubscribe to stop them.
  epics$: Observable<never>
  epicCtx: GridEpicCtx<TData>
  rows: Signal<TData[]>
  columns: ColumnDef<GridFeatures, TData>[]
  mode: GridMode
  getRowId: (row: TData) => string
  getSubRows?: (row: TData, index: number) => TData[] | undefined
  getRowCanExpand?: (row: TData) => boolean
  // A derived grid over the rows where row[columnId] === value, with that column dropped.
  pivot: (columnId: string, value: unknown) => Grid<TData>
} & GridChangeHandlers
