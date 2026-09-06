import { filter, map } from "rxjs"
import type { GridAction, GridEpic, Modifiers } from "./1_types"
import { columnValue, type TreeColumn, type TreeColumnEpic } from "./10_treeColumn"

export function columnEpics<TData>(columns: readonly TreeColumn<TData>[]): GridEpic<TData>[] {
  return columns
    .filter((c) => c.epic)
    .map((c): GridEpic<TData> => (_actions$, _state, ctx) => c.epic!({ ...ctx, id: c.id, column: c, column$: ctx.column$(c.id) }))
}

// Grid-owned receivers for a TreeColumn set: plain click selects, plus each column's own epic.
export function treeColumnGridEpics<TData>(columns: readonly TreeColumn<TData>[]): GridEpic<TData>[] {
  return columns.length ? [selectOnPlainClick(columns), ...columnEpics(columns)] : []
}

export const noMods = (m: Modifiers): boolean => !m.alt && !m.ctrl && !m.meta && !m.shift && m.button === 0

// Plain click on a cell outside a noRowClick column becomes an effect select.
export function selectOnPlainClick<TData>(columns: readonly TreeColumn<TData>[]): GridEpic<TData> {
  const skip = new Set(columns.filter((c) => c.noRowClick).map((c) => c.id))
  return (_actions$, _state, ctx) =>
    ctx.phase$.intent.pipe(
      filter((a): a is Extract<typeof a, { type: "cell.click" }> => a.type === "cell.click"),
      filter((a) => noMods(a.mods) && !skip.has(a.column)),
      map((a): GridAction<TData> => ({ phase: "effect", type: "select", rowId: a.rowId, row: a.row })),
    )
}

// Alt-click on this column's cell becomes an effect pivot on the column's value.
export function pivotOnAltClick<TData>(value?: (row: TData) => unknown): TreeColumnEpic<TData> {
  return ({ column$, id, column }) =>
    column$.pipe(
      filter((a): a is Extract<typeof a, { type: "cell.click" }> => a.type === "cell.click"),
      filter((a) => a.mods.alt),
      map((a): GridAction<TData> => ({ phase: "effect", type: "pivot", column: id, value: value ? value(a.row) : columnValue(column, a.row), row: a.row })),
    )
}
