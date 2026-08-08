import { orderBy } from "lodash"
import { Signal } from "@hafley66/signals"
import { z } from "zod"
import type {
  ColumnDef,
  OnChangeFn,
  PaginationState,
  RowData,
  SortingState,
} from "@tanstack/react-table"
import { gridFeatures, type GridFeatures } from "./0_features"
import type { ColumnSpec, Grid, GridConfig, GridEvent, GridState } from "./1_types"

const defaultState = (): GridState => ({
  sorting: [],
  pagination: { pageIndex: 0, pageSize: 20 },
})

function topLevelKeys(schema: z.ZodType): string[] {
  if (schema instanceof z.ZodObject) return Object.keys(schema.shape)
  return []
}

function deriveColumns<TData extends RowData>(
  schema: z.ZodType,
  spec: Partial<Record<string, ColumnSpec>> | undefined,
): ColumnDef<GridFeatures, TData>[] {
  const specMap = spec as Partial<Record<string, ColumnSpec>> | undefined
  const paths =
    specMap && Object.keys(specMap).length ? Object.keys(specMap) : topLevelKeys(schema)
  return paths
    .filter((p) => specMap?.[p]?.visible !== false)
    .map((p) => ({
      id: p,
      accessorKey: p,
      header: specMap?.[p]?.header ?? p.split(".").pop() ?? p,
    })) as ColumnDef<GridFeatures, TData>[]
}

export function createGrid<TData extends RowData>(config: GridConfig<TData>): Grid<TData> {
  const state = config.state ?? Signal<GridState>(defaultState())
  const events = Signal<GridEvent>()
  const columns = deriveColumns<TData>(
    config.schema,
    config.columns as Partial<Record<string, ColumnSpec>> | undefined,
  )

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
    schema: config.schema,
    state,
    events,
    rows,
    columns,
    mode: config.mode,
    getRowId: config.getRowId,
    onSortingChange,
    onPaginationChange,
  }
}
