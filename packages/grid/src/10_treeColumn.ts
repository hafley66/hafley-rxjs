import type { ReactNode } from "react"
import type { ColumnDef, RowData } from "@tanstack/react-table"
import type { Observable } from "rxjs"
import type { GridFeatures } from "./0_features"
import type { GridAction, GridEpicCtx } from "./1_types"

export type TreeColumnEpicCtx<TData> = Omit<GridEpicCtx<TData>, "column$"> & {
  id: string
  column: TreeColumn<TData>
  column$: Observable<Extract<GridAction<TData>, { column: string }>>
}

export type TreeColumnEpic<TData> = (ctx: TreeColumnEpicCtx<TData>) => Observable<GridAction<TData>>

export type TreeColumn<TData> = {
  id: string
  header: string
  headerCell?: () => ReactNode
  cell: (row: TData) => ReactNode
  cellClass?: (row: TData) => string | undefined
  // The column's value (pivot equality, default sort key); defaults to row[id].
  value?: (row: TData) => unknown
  // Ordering key when it differs from `value` (e.g. a status rank).
  sortValue?: (row: TData) => string | number | null | undefined
  tree?: boolean
  toggleExpand?: boolean
  noRowClick?: boolean
  epic?: TreeColumnEpic<TData>
  size?: number
  minSize?: number
  maxSize?: number
}

export type TreeColumnMeta<TData> = { treeColumn: TreeColumn<TData> }

export function treeColumnMeta<TData>(def: { meta?: unknown } | undefined): TreeColumn<TData> | undefined {
  return (def?.meta as TreeColumnMeta<TData> | undefined)?.treeColumn
}

export function columnValue<TData>(column: TreeColumn<TData>, row: TData): unknown {
  return column.value ? column.value(row) : (row as Record<string, unknown>)[column.id]
}

const compareKeys = (a: unknown, b: unknown): number => {
  if (a == null) return b == null ? 0 : 1
  if (b == null) return -1
  return a < b ? -1 : a > b ? 1 : 0
}

export function treeColumnDefs<TData extends RowData>(
  columns: readonly TreeColumn<TData>[],
): ColumnDef<GridFeatures, TData>[] {
  return columns.map((c) => ({
    id: c.id,
    header: c.headerCell ? () => c.headerCell!() : c.header,
    accessorFn: (row: TData) => columnValue(c, row),
    enableSorting: !!(c.sortValue ?? c.value),
    sortFn: c.sortValue
      ? (a: { original: TData }, b: { original: TData }) => compareKeys(c.sortValue!(a.original), c.sortValue!(b.original))
      : "auto",
    sortUndefined: "last",
    size: c.size,
    minSize: c.minSize,
    maxSize: c.maxSize,
    meta: { treeColumn: c } as TreeColumnMeta<TData>,
  }))
}

export function treeColumnsOf<TData>(defs: readonly { meta?: unknown }[]): TreeColumn<TData>[] {
  return defs.map((d) => treeColumnMeta<TData>(d)).filter((c): c is TreeColumn<TData> => !!c)
}

export type ColumnVisibilityEntry = { id: string; header: string; visible: boolean; canHide: boolean }

export function visibilityEntries<TData>(
  columns: readonly TreeColumn<TData>[],
  visibility: Record<string, boolean>,
): ColumnVisibilityEntry[] {
  return columns.map((c) => ({
    id: c.id,
    header: c.header || c.id,
    visible: visibility[c.id] !== false,
    canHide: !c.tree,
  }))
}

export function toggleColumnVisibility(
  visibility: Record<string, boolean>,
  columnId: string,
  next?: boolean,
): Record<string, boolean> {
  const current = visibility[columnId] !== false
  return { ...visibility, [columnId]: next ?? !current }
}
