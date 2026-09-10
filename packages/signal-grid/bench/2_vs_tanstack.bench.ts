import { axisOfEntries, flattenAxis, groupAxis, sortAxis } from "../src/1_axis.js"
import { buildComparator } from "../src/2_operators.js"
import { grid } from "../src/8_grid.js"
import type { RowId } from "../src/0_types.js"
import { register, type Case } from "./_cases.js"
import {
  ASC,
  COLUMNS,
  DESC,
  OPEN_TENTH,
  readField,
  rowsOf,
  treeAxis,
  treeSourceRows,
  treeStats,
} from "./_fixtures.js"
import { flatTable, treeTable, type AnyTable } from "./_tanstack.js"
import { consume, type Row } from "./0_data.js"

// Fairness rule for the whole file: both sides get the same rows, the same value comparators, the
// same grouping key, the same expanded set, and both are measured in steady state after warmup.
const N = 100000
const rows = rowsOf(N)

const cmpAsc = buildComparator<Row>(ASC, COLUMNS, readField)
const cmpDesc = buildComparator<Row>(DESC, COLUMNS, readField)

const TS_ASC = [{ id: "score", desc: false }]
const TS_DESC = [{ id: "score", desc: true }]

const flatAxis = axisOfEntries<RowId, Row>(rows.map((row) => [row.id, row] as const))

const groupValue = (path: readonly unknown[], key: RowId): Row => ({
  id: key,
  name: String(path[path.length - 1] ?? ""),
  dept: "",
  tier: "",
  score: 0,
  active: false,
})
const byDept = [(row: Row): unknown => row.dept]

// One flat table serves the sort case and both incremental cases: grouping is never set on it, so
// no case can leak state into another. A second table exists only because grouping is sticky.
const sortTable: AnyTable = flatTable(rows)
const groupTable: AnyTable = flatTable(rows)
const expandTable: AnyTable = treeTable(treeSourceRows)

const expandedState: Record<string, boolean> = {}
for (const key of OPEN_TENTH) expandedState[key] = true
expandTable.baseAtoms.expanded?.set({ ...expandedState })
expandTable.getExpandedRowModel()
groupTable.baseAtoms.grouping?.set(["dept"])
groupTable.getGroupedRowModel()
sortTable.baseAtoms.sorting?.set(TS_ASC)
sortTable.getSortedRowModel()

const openTenth = (key: RowId): boolean => OPEN_TENTH.has(key)

let flip = false
const toggle = (): boolean => {
  flip = !flip
  return flip
}

// Sorted at setup on both sides, so the colWidth case below is not comparing an active pipeline
// against a `sortAxis` that returns its input by reference.
const incrementalGrid = grid<Row>({ id: "bench-incremental", rows, columns: COLUMNS, rowId: (row) => row.id })
incrementalGrid.state.sort.$(ASC)
incrementalGrid.view.flat.$()

const incrementalTable: AnyTable = sortTable
incrementalTable.getRowModel()

let widthTick = 0

export const CASES: readonly Case[] = [
  // Ours re-sorts a key array and copies the children map; TanStack re-sorts a Row array and
  // rebuilds flatRows. Both end at a stable order over the same 100k rows with the same comparator.
  {
    group: "sort 100k, one numeric key",
    name: "ours: sortAxis",
    run: () => consume(sortAxis(flatAxis, toggle() ? cmpAsc : cmpDesc).roots),
    means: "sort 100k RowIds, seat index for stability, Map.get per value read",
    iterations: 20,
    warmup: 5,
  },
  {
    group: "sort 100k, one numeric key",
    name: "tanstack: getSortedRowModel",
    run: () => {
      sortTable.baseAtoms.sorting?.set(toggle() ? TS_ASC : TS_DESC)
      consume(sortTable.getSortedRowModel().rows)
    },
    means: "sort 100k Row instances, row.index for stability, values already cached",
    iterations: 20,
    warmup: 5,
  },

  // Ours mints 8 group nodes and rebuilds the top of the forest, keeping data edges by reference.
  // TanStack builds 8 group Rows with subRows arrays. Neither side aggregates, so neither pays for it.
  {
    group: "group 100k, one level on dept",
    name: "ours: groupAxis",
    run: () => consume(groupAxis(flatAxis, byDept, groupValue).roots),
    means: "8 synthetic group keys, forest rebuilt, 100k rows re-parented",
    iterations: 20,
    warmup: 5,
  },
  {
    group: "group 100k, one level on dept",
    name: "tanstack: getGroupedRowModel",
    run: () => {
      groupTable.baseAtoms.grouping?.set(["dept"])
      consume(groupTable.getGroupedRowModel().rows)
    },
    means: "8 group Rows constructed, 100k leaf rows distributed into subRows",
    iterations: 20,
    warmup: 5,
  },

  // Verified identical: both emit 1360 visible nodes from the same forest and open set. Ours
  // allocates a FlatNode per visible row, TanStack pushes existing Row refs, so ours allocates more.
  {
    group: `expand ${treeStats.nodes}-node tree, 10% of internal nodes open`,
    name: "ours: flattenAxis",
    run: () => consume(flattenAxis(treeAxis, openTenth)),
    means: "walk the open frontier, allocate one FlatNode per visible row",
    iterations: 100,
    warmup: 25,
  },
  {
    group: `expand ${treeStats.nodes}-node tree, 10% of internal nodes open`,
    name: "tanstack: getExpandedRowModel",
    run: () => {
      expandTable.baseAtoms.expanded?.set({ ...expandedState })
      consume(expandTable.getExpandedRowModel().rows)
    },
    means: "same frontier, push existing Row references into a new array",
    iterations: 100,
    warmup: 25,
  },

  // Ours invalidates grouped, sorted and flat, so a full re-sort plus a full flatten runs. TanStack
  // reruns only the sorted stage; expanded and paginated find their dep tuples unmoved.
  {
    group: "incremental, change the sort key and re-derive",
    name: "ours: state.sort write + view.flat read",
    run: () => {
      incrementalGrid.state.sort.$(toggle() ? ASC : DESC)
      consume(incrementalGrid.view.flat.$())
    },
    means: "sortAxis over 100k plus flattenAxis allocating 100k FlatNodes",
    iterations: 15,
    warmup: 4,
  },
  {
    group: "incremental, change the sort key and re-derive",
    name: "tanstack: sorting set + getRowModel",
    run: () => {
      incrementalTable.baseAtoms.sorting?.set(toggle() ? TS_ASC : TS_DESC)
      consume(incrementalTable.getRowModel().rows)
    },
    means: "sorted stage reruns over 100k Rows, expanded and paginated stages hit cache",
    iterations: 15,
    warmup: 4,
  },

  // `colWidth` is read by `view.widths` and by nothing in the row pipeline. Null hypothesis: the
  // memo does not hold, and a signal chain is no better than a dep-tuple row model here.
  {
    group: "incremental, change a key the row pipeline does not read",
    name: "ours: state.colWidth write + view.flat read",
    run: () => {
      widthTick++
      incrementalGrid.state.colWidth.$({ score: 100 + (widthTick % 40) })
      consume(incrementalGrid.view.flat.$())
    },
    means: "one column width changes, then the flat row list is read back",
    iterations: 15,
    warmup: 4,
  },
  {
    group: "incremental, change a key the row pipeline does not read",
    name: "tanstack: columnSizing set + getRowModel",
    run: () => {
      widthTick++
      incrementalTable.baseAtoms.columnSizing?.set({ score: 100 + (widthTick % 40) })
      consume(incrementalTable.getRowModel().rows)
    },
    means: "same edit, no row-model memo dep moved, so every stage answers from cache",
    iterations: 15,
    warmup: 4,
    inner: 20,
  },

  // The memo-holds control for both sides: no write at all, read the derived list back.
  {
    group: "incremental, no write, read the derived list",
    name: "ours: view.flat read",
    run: () => consume(incrementalGrid.view.flat.$()),
    means: "a clean memo answers from its stored value",
    iterations: 200,
    warmup: 50,
    inner: 200,
  },
  {
    group: "incremental, no write, read the derived list",
    name: "tanstack: getRowModel",
    run: () => consume(incrementalTable.getRowModel().rows),
    means: "the dep tuple is unchanged at every stage, so the cached model is returned",
    iterations: 200,
    warmup: 50,
    inner: 200,
  },
]

// Stated rather than faked. Each entry is an operation only one library performs, so any number
// printed for it would compare nothing.
export const NOT_COMPARABLE: readonly string[] = [
  "renderPlan: TanStack leaves pinning geometry and virtualization to the adapter (@tanstack/react-virtual), so there is no core-side pipeline to time against it.",
  "axisOf vs constructTable: TanStack builds a Row instance with per-cell value caches; axisOf builds four maps over the caller's own objects. The one-time costs are reported side by side in the allocation table and labelled, not ranked.",
  "windowOf: no table-core equivalent. The nearest thing lives in a different package with a different data model.",
]

register(CASES)
