// Fixtures every bench file shares. They live here rather than in one bench file so importing them
// cannot re-register another file's cases with vitest.
import { axisOfTree } from "../src/1_axis.js"
import type { ColumnDef, RowId, SortModel } from "../src/0_types.js"
import { checksum, EXPECTED, flatRows, treeRows, treeShape, type Row, type TreeRow } from "./0_data.js"

/** Byte-for-byte the comparators handed to TanStack column defs in `_tanstack.ts`. */
export const cmpNumber = (a: unknown, b: unknown): number => (a as number) - (b as number)
export const cmpString = (a: unknown, b: unknown): number => {
  const left = a as string
  const right = b as string
  return left < right ? -1 : left > right ? 1 : 0
}

export const COLUMNS: readonly ColumnDef<Row>[] = [
  { id: "id", type: "string", sortComparator: cmpString },
  { id: "name", type: "string", sortComparator: cmpString },
  { id: "dept", type: "string", sortComparator: cmpString },
  { id: "tier", type: "string", sortComparator: cmpString },
  { id: "score", type: "number", sortComparator: cmpNumber },
  { id: "active", type: "boolean", sortComparator: cmpNumber },
]

export const readField = (row: Row, field: string): unknown =>
  (row as unknown as Record<string, unknown>)[field]

export const ASC: SortModel = [{ field: "score", sort: "asc" }]
export const DESC: SortModel = [{ field: "score", sort: "desc" }]
export const THREE_KEYS: SortModel = [
  { field: "dept", sort: "asc" },
  { field: "score", sort: "desc" },
  { field: "name", sort: "asc" },
]

const rowCache = new Map<number, readonly Row[]>()

/** Checked against the recorded FNV-1a, so generator drift fails the run instead of the numbers. */
export const rowsOf = (n: number): readonly Row[] => {
  const hit = rowCache.get(n)
  if (hit !== undefined) return hit
  const made = flatRows(n)
  const want = EXPECTED["flat/" + n]
  const got = checksum(made)
  if (want !== undefined && want !== got) throw new Error(`flat/${n} checksum ${got}, want ${want}`)
  rowCache.set(n, made)
  return made
}

export const TREE = { leaves: 100000, depth: 4, fanout: 5 } as const
export const treeStats = treeShape(TREE.leaves, TREE.depth, TREE.fanout)
export const treeSourceRows = treeRows(TREE.leaves, TREE.depth, TREE.fanout)
export const treeAxis = axisOfTree<RowId, TreeRow>(
  treeSourceRows,
  (item) => item.id,
  (item) => item.children,
)

const internal: RowId[] = []
for (const [key, kids] of treeAxis.children) if (kids.length > 0) internal.push(key)
internal.sort()

/** Every tenth internal node by sorted id. TanStack expands exactly this set, verified equal output. */
export const OPEN_TENTH = new Set<RowId>(internal.filter((_key, index) => index % 10 === 0))
export const INTERNAL_COUNT = internal.length
