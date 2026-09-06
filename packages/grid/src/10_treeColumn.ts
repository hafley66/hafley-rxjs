import type { ReactNode } from "react"
import type { ColumnDef, RowData } from "@tanstack/react-table"
import { filter, map, type Observable } from "rxjs"
import type { GridFeatures } from "./0_features"
import type { GridAction, GridEpic, GridEpicCtx } from "./1_types"

export type TreeColumnEpicCtx<TData> = Omit<GridEpicCtx<TData>, "column$"> & {
  id: string
  // grid$ narrowed to actions carrying this column's id.
  column$: Observable<Extract<GridAction<TData>, { column: string }>>
}

export type TreeColumnEpic<TData> = (ctx: TreeColumnEpicCtx<TData>) => Observable<GridAction<TData>>

export type TreeColumn<TData> = {
  id: string
  header: string
  // Optional header renderer; `header` stays the plain label (visibility toolbar, a11y).
  headerCell?: () => ReactNode
  cell: (row: TData) => ReactNode
  cellClass?: (row: TData) => string | undefined
  sortValue?: (row: TData) => string | number | null | undefined
  tree?: boolean
  toggleExpand?: boolean
  noRowClick?: boolean
  // Receives this column's intents; whatever it emits is dispatched back into the grid.
  epic?: TreeColumnEpic<TData>
  size?: number
  minSize?: number
  maxSize?: number
}

export type TreeColumnMeta<TData> = { treeColumn: TreeColumn<TData> }

export function treeColumnMeta<TData>(def: { meta?: unknown } | undefined): TreeColumn<TData> | undefined {
  return (def?.meta as TreeColumnMeta<TData> | undefined)?.treeColumn
}

export function treeColumnDefs<TData extends RowData>(
  columns: readonly TreeColumn<TData>[],
): ColumnDef<GridFeatures, TData>[] {
  return columns.map((c) => ({
    id: c.id,
    header: c.headerCell ? () => c.headerCell!() : c.header,
    accessorFn: c.sortValue ? (row: TData) => c.sortValue!(row) ?? undefined : () => undefined,
    enableSorting: !!c.sortValue,
    sortUndefined: "last",
    size: c.size,
    minSize: c.minSize,
    maxSize: c.maxSize,
    meta: { treeColumn: c } as TreeColumnMeta<TData>,
  }))
}

export function columnEpics<TData>(columns: readonly TreeColumn<TData>[]): GridEpic<TData>[] {
  return columns
    .filter((c) => c.epic)
    .map((c): GridEpic<TData> => (_actions$, _state, ctx) => c.epic!({ ...ctx, id: c.id, column$: ctx.column$(c.id) }))
}

const noMods = (m: { alt: boolean; ctrl: boolean; meta: boolean; shift: boolean; button: number }) =>
  !m.alt && !m.ctrl && !m.meta && !m.shift && m.button === 0

// Plain click on a cell outside a noRowClick column becomes an effect select.
export function selectOnPlainClick<TData>(columns: readonly TreeColumn<TData>[]): GridEpic<TData> {
  const skip = new Set(columns.filter((c) => c.noRowClick).map((c) => c.id))
  return (_actions$, _state, ctx) =>
    ctx.phase$.intent.pipe(
      filter((a): a is Extract<typeof a, { type: "cell.click" }> => a.type === "cell.click"),
      filter((a) => noMods(a.mods) && !skip.has(a.column)),
      map((a) => ({ phase: "effect", type: "select", rowId: a.rowId, row: a.row }) as GridAction<TData>),
    )
}

// Alt-click on this column's cell becomes an effect pivot on `value(row)`.
export function pivotOnAltClick<TData>(value: (row: TData) => unknown): TreeColumnEpic<TData> {
  return ({ column$, id }) =>
    column$.pipe(
      filter((a): a is Extract<typeof a, { type: "cell.click" }> => a.type === "cell.click"),
      filter((a) => a.mods.alt),
      map((a) => ({ phase: "effect", type: "pivot", column: id, value: value(a.row), row: a.row }) as GridAction<TData>),
    )
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
