// The TanStack side of `2_vs_tanstack.bench.ts`, isolated so the fairness decisions sit in one file.
// `@tanstack/table-core` is aliased by `bench/vitest.bench.config.ts`; nothing here is in `src/`.
import {
  columnGroupingFeature,
  columnSizingFeature,
  constructTable,
  createExpandedRowModel,
  createGroupedRowModel,
  createSortedRowModel,
  rowExpandingFeature,
  rowSortingFeature,
  tableFeatures,
} from "@tanstack/table-core"
import { storeReactivityBindings } from "@tanstack/table-core/store-reactivity-bindings"
import { cmpNumber, cmpString } from "./_fixtures.js"
import type { Row, TreeRow } from "./0_data.js"

// v9 table-core is generic over its feature map; the bench only reaches for row models and base
// atoms. One alias holds every escape hatch so no `any` leaks into a benchmark body.
export interface AnyTable {
  getCoreRowModel(): { rows: readonly unknown[]; flatRows: readonly unknown[] }
  getSortedRowModel(): { rows: readonly unknown[] }
  getGroupedRowModel(): { rows: readonly unknown[] }
  getExpandedRowModel(): { rows: readonly unknown[] }
  getRowModel(): { rows: readonly unknown[] }
  readonly baseAtoms: Record<string, { set(value: unknown): void }>
}

interface TanStackRow {
  getValue(columnId: string): unknown
}

const sortBy =
  (cmp: (a: unknown, b: unknown) => number) =>
  (rowA: TanStackRow, rowB: TanStackRow, columnId: string): number =>
    cmp(rowA.getValue(columnId), rowB.getValue(columnId))

// Sorting, grouping, expanding, column sizing, each with its real row-model factory. Filtering and
// pagination are absent because neither side is asked to filter or paginate in this file.
const FEATURES = tableFeatures({
  coreReactivityFeature: storeReactivityBindings(),
  rowSortingFeature,
  columnGroupingFeature,
  rowExpandingFeature,
  columnSizingFeature,
  sortedRowModel: createSortedRowModel(),
  groupedRowModel: createGroupedRowModel(),
  expandedRowModel: createExpandedRowModel(),
})

const COLUMNS = [
  { id: "id", accessorKey: "id", sortFn: sortBy(cmpString) },
  { id: "name", accessorKey: "name", sortFn: sortBy(cmpString) },
  { id: "dept", accessorKey: "dept", sortFn: sortBy(cmpString) },
  { id: "tier", accessorKey: "tier", sortFn: sortBy(cmpString) },
  { id: "score", accessorKey: "score", sortFn: sortBy(cmpNumber) },
  { id: "active", accessorKey: "active", sortFn: sortBy(cmpNumber) },
]

type Options = Parameters<typeof constructTable>[0]

/** Core row model realized before return, so no benchmark pays the one-time row construction. */
export function flatTable(rows: readonly Row[]): AnyTable {
  const table = constructTable({
    features: FEATURES,
    data: rows as Row[],
    columns: COLUMNS,
    getRowId: (row: Row) => row.id,
  } as unknown as Options) as unknown as AnyTable
  table.getCoreRowModel()
  return table
}

// `paginateExpandedRows: true` is required: without it `_createExpandedRowModel` returns the
// pre-expanded model untouched and the expansion benchmark would measure nothing.
export function treeTable(rows: readonly TreeRow[]): AnyTable {
  const table = constructTable({
    features: FEATURES,
    data: rows as TreeRow[],
    columns: COLUMNS,
    getRowId: (row: TreeRow) => row.id,
    getSubRows: (row: TreeRow) => row.children as TreeRow[] | undefined,
    paginateExpandedRows: true,
  } as unknown as Options) as unknown as AnyTable
  table.getCoreRowModel()
  return table
}

