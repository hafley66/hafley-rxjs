import { orderBy } from "lodash"
import { Signal } from "@hafley66/signals"
import type {
  OnChangeFn,
  PaginationState,
  RowData,
  SortingState,
} from "@tanstack/react-table"
import type { Grid, GridConfig, GridEvent, GridState } from "./1_types"

const defaultState = (): GridState => ({
  sorting: [],
  pagination: { pageIndex: 0, pageSize: 20 },
})

export function createGrid<TData extends RowData>(config: GridConfig<TData>): Grid<TData> {
  const state = config.state ?? Signal<GridState>(defaultState())
  const events = Signal<GridEvent>()

  const rows = Signal<TData[]>(() => {
    const data = config.rows.$()
    if (config.mode !== "client") return data
    const sort = state.sorting.$()
    if (!sort.length) return data
    return orderBy(
      data,
      sort.map((s) => s.id),
      sort.map((s) => (s.desc ? "desc" : "asc")),
    )
  })

  const onSortingChange: OnChangeFn<SortingState> = (next) => {
    const value = typeof next === "function" ? next(state.sorting.$()) : next
    state.sorting.$(value)
    events.$({ type: "sort", sorting: value })
  }

  const onPaginationChange: OnChangeFn<PaginationState> = (next) => {
    const value = typeof next === "function" ? next(state.pagination.$()) : next
    state.pagination.$(value)
    events.$({ type: "page", pagination: value })
  }

  return {
    state,
    events,
    rows,
    columns: config.columns,
    mode: config.mode,
    getRowId: config.getRowId,
    onSortingChange,
    onPaginationChange,
  }
}
