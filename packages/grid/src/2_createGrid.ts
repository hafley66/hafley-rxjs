import orderBy from "lodash/orderBy.js"
import { filter, type Observable } from "rxjs"
import { createSlice, Signal, storageSignal, urlAdapter } from "@hafley66/signals"
import { stringify as devalueStringify, parse as devalueParse } from "devalue"
import type { Param } from "@hafley66/path"
import { z } from "zod"
import type {
  ColumnDef,
  OnChangeFn,
  RowData,
} from "@tanstack/react-table"
import { gridFeatures, type GridFeatures } from "./0_features"
import type {
  ColumnSpec,
  Grid,
  GridAction,
  GridChange,
  GridConfig,
  GridEpicCtx,
  GridPhase,
  GridState,
} from "./1_types"
import { pivotGrid } from "./8_pivot"
import { treeColumnGridEpics, treeColumnsOf } from "./10_treeColumn"

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
  // getRowModel() always applies the registered paginated row model; a large default avoids
  // silently truncating a plain tree/list grid that never touches pagination itself.
  pagination: { pageIndex: 0, pageSize: 100_000 },
  tree: { compactChains: false },
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

const reduceGrid = <TData>(state: GridState, action: GridAction<TData>): GridState =>
  action.phase === "change" ? { ...state, [action.type]: (action as unknown as Record<string, unknown>)[action.type] } : state

type ColumnStream<TData> = Observable<Extract<GridAction<TData>, { column: string }>>

const byPhase = <TData, P extends GridPhase>(actions$: Observable<GridAction<TData>>, phase: P) =>
  actions$.pipe(filter((a): a is Extract<GridAction<TData>, { phase: P }> => a.phase === phase))

export function createGrid<TData extends RowData>(config: GridConfig<TData>): Grid<TData> {
  const store = config.sync
    ? storageSignal(urlAdapter(config.sync.key), createDefaultGridState(), {
        serialize: (state) => gridStateParam.print(state),
        parse: (raw) => gridStateParam.parse(raw) ?? createDefaultGridState(),
      })
    : config.state ??
      Signal<GridState>(createDefaultGridState({ tree: { compactChains: config.tree?.compactSingleChildChains ?? false } }))
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

  const columnStreams = new Map<string, ColumnStream<TData>>()
  const epicCtx = {} as GridEpicCtx<TData>
  const slice = createSlice<GridState, GridAction<TData>, GridEpicCtx<TData>>({
    initial: store.$(),
    state: store,
    reduce: reduceGrid,
    epics: [...treeColumnGridEpics(treeColumnsOf<TData>(columns)), ...(config.epics ?? [])],
    ctx: epicCtx,
  })
  const { state, actions$, dispatch } = slice
  Object.assign(epicCtx, {
    grid$: actions$,
    phase$: { intent: byPhase(actions$, "intent"), change: byPhase(actions$, "change"), effect: byPhase(actions$, "effect") },
    column$: (id: string): ColumnStream<TData> => {
      const cached = columnStreams.get(id)
      if (cached) return cached
      const stream: ColumnStream<TData> = actions$.pipe(
        filter((a): a is Extract<GridAction<TData>, { column: string }> => "column" in a && a.column === id),
      )
      columnStreams.set(id, stream)
      return stream
    },
    state,
    rows,
    dispatch,
  } satisfies GridEpicCtx<TData>)

  const on = <K extends keyof GridState>(key: K): OnChangeFn<GridState[K]> => (updater) => {
    const prev = state.$()[key]
    const value = typeof updater === "function"
      ? (updater as (p: GridState[K]) => GridState[K])(prev)
      : updater
    dispatch({ phase: "change", type: key, [key]: value } as unknown as GridChange)
  }

  const grid: Grid<TData> = {
    schema: config.schema,
    state,
    actions$,
    dispatch,
    epics$: slice.epics$,
    epicCtx,
    rows,
    columns,
    mode: config.mode,
    getRowId: config.getRowId,
    getSubRows: config.getSubRows,
    getRowCanExpand: config.getRowCanExpand,
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
    pivot: (columnId, value) => pivotGrid(grid, columnId, value),
  }
  return grid
}
