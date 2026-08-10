import { orderBy } from "lodash"
import { Signal, storageSignal, urlAdapter } from "@hafley66/signals"
import { stringify as devalueStringify, parse as devalueParse } from "devalue"
import type { Param } from "@hafley66/path"
import { z } from "zod"
import type {
  ColumnDef,
  OnChangeFn,
  RowData,
} from "@tanstack/react-table"
import { gridFeatures, type GridFeatures } from "./0_features"
import type { ColumnSpec, Grid, GridConfig, GridEvent, GridState } from "./1_types"

export const createDefaultGridState = (overrides: Partial<GridState> = {}): GridState => ({
  sorting: [],
  columnFilters: [],
  globalFilter: undefined,
  columnOrder: [],
  columnPinning: { start: [], end: [] },
  columnVisibility: {},
  columnSizing: {},
  rowPinning: { top: [], bottom: [] },
  rowSelection: {},
  expanded: {},
  grouping: [],
  pagination: { pageIndex: 0, pageSize: 20 },
  ...overrides,
})

// Baked default: whole-GridState <-> one devalue string. The assumed serializer
// for createGrid sync, and reusable to mount grids on route templates via {params}.
export const gridStateParam: Param<GridState> = {
  parse: (raw) => (raw ? (devalueParse(raw) as GridState) : undefined),
  print: (state) => devalueStringify(state),
}

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
  const state = config.sync
    ? storageSignal(urlAdapter(config.sync.key), createDefaultGridState(), {
        serialize: (state) => gridStateParam.print(state),
        parse: (raw) => gridStateParam.parse(raw) ?? createDefaultGridState(),
      })
    : config.state ?? Signal<GridState>(createDefaultGridState())
  const events = Signal<GridEvent>()
  const columns = config.columnDefs ?? deriveColumns<TData>(
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

  // Writes the slice then emits a typed event; accepts updater fn or value.
  const on = <K extends keyof GridState>(key: K): OnChangeFn<GridState[K]> => (updater) => {
    const prev = state.$()[key]
    const value = typeof updater === "function"
      ? (updater as (p: GridState[K]) => GridState[K])(prev)
      : updater
    state.$({ ...state.$(), [key]: value })
    events.$({ type: key, [key]: value } as GridEvent)
  }

  return {
    schema: config.schema,
    state,
    events,
    rows,
    columns,
    mode: config.mode,
    getRowId: config.getRowId,
    getSubRows: config.getSubRows,
    onSortingChange: on("sorting"),
    onColumnFiltersChange: on("columnFilters"),
    onGlobalFilterChange: on("globalFilter"),
    onColumnOrderChange: on("columnOrder"),
    onColumnPinningChange: on("columnPinning"),
    onColumnVisibilityChange: on("columnVisibility"),
    onColumnSizingChange: on("columnSizing"),
    onRowPinningChange: on("rowPinning"),
    onRowSelectionChange: on("rowSelection"),
    onExpandedChange: on("expanded"),
    onGroupingChange: on("grouping"),
    onPaginationChange: on("pagination"),
  }
}
