import { axisOfEntries, flattenAxis, groupAxis, sortAxis } from "../src/1_axis.js"
import { buildComparator } from "../src/2_operators.js"
import { measuredSizer, renderPlan, uniformSizer, windowOf } from "../src/4_slice.js"
import type { Axis, RowId } from "../src/0_types.js"
import { register, type Case } from "./_cases.js"
import {
  ASC,
  COLUMNS,
  INTERNAL_COUNT,
  OPEN_TENTH,
  readField,
  rowsOf,
  THREE_KEYS,
  TREE,
  treeAxis,
  treeStats,
} from "./_fixtures.js"
import { consume, type Row } from "./0_data.js"

const budget = (n: number): { iterations: number; warmup: number } =>
  n <= 1000
    ? { iterations: 200, warmup: 50 }
    : n <= 10000
      ? { iterations: 60, warmup: 15 }
      : n <= 100000
        ? { iterations: 20, warmup: 5 }
        : { iterations: 7, warmup: 2 }

const cmp1 = buildComparator<Row>(ASC, COLUMNS, readField)
const cmp3 = buildComparator<Row>(THREE_KEYS, COLUMNS, readField)

const axisCache = new Map<number, Axis<RowId, Row>>()
const axisOfSize = (n: number): Axis<RowId, Row> => {
  const hit = axisCache.get(n)
  if (hit !== undefined) return hit
  const made = axisOfEntries<RowId, Row>(rowsOf(n).map((row) => [row.id, row] as const))
  axisCache.set(n, made)
  return made
}

const groupValue = (path: readonly unknown[], key: RowId): Row => ({
  id: key,
  name: String(path[path.length - 1] ?? ""),
  dept: "",
  tier: "",
  score: 0,
  active: false,
})

const byDept = [(row: Row): unknown => row.dept]
const byDeptTier = [(row: Row): unknown => row.dept, (row: Row): unknown => row.tier]

const SIZES = [1000, 10000, 100000, 1000000] as const
const CHAIN_SIZES = [500, 1000, 2000, 4000] as const
const MID_SIZES = [1000, 10000, 100000] as const

const allOpen = (): boolean => true
const tenthOpen = (key: RowId): boolean => OPEN_TENTH.has(key)

const RENDER_N = 100000
const renderKeys = rowsOf(RENDER_N).map((row) => row.id)
const noSide = (): undefined => undefined
const page = { index: 0, size: 100 }
const viewport = { start: 400000, extent: 900 }

const heights = new Map<number, number>()
for (let index = 0; index < RENDER_N; index += 3) heights.set(index, 28 + (index % 5) * 4)

const BIG = 1000000
const bigHeights = new Map<number, number>()
for (let index = 0; index < BIG; index += 7) bigHeights.set(index, 24 + (index % 9) * 3)
const bigSizer = measuredSizer(BIG, 36, bigHeights)
const uniformBig = uniformSizer(BIG, 36)
let scrollAt = 0

const nextScroll = (span: number): number => {
  scrollAt = (scrollAt + 1013904223) >>> 0
  return scrollAt % Math.max(1, span)
}

const chainParent = (rows: readonly Row[]) => {
  const up = new Map<RowId, RowId>()
  for (let at = 1; at < rows.length; at++) up.set((rows[at] as Row).id, (rows[at - 1] as Row).id)
  return (key: RowId): RowId | undefined => up.get(key)
}

export const CASES: readonly Case[] = [
  // Null hypothesis: axisOfEntries is not linear. If ns per row climbs across the four sizes, the two-pass
  // construction pays a hidden super-linear cost and the header comment is wrong.
  ...SIZES.map((n): Case => {
    const entries = rowsOf(n).map((row) => [row.id, row] as const)
    return {
      group: "axisOf, flat relation",
      name: `axisOf ${n}`,
      run: () => consume(axisOfEntries<RowId, Row>(entries).by),
      means: `build the forest for ${n} flat rows: 2 passes, 4 maps, no parent edges`,
      ...budget(n),
    }
  }),

  // Null hypothesis: axisOfEntries stays linear once parent edges exist. The header comment says two
  // passes; if these four times quadruple with each doubling, the cycle check is a third pass.
  ...CHAIN_SIZES.map((n): Case => {
    const rows = rowsOf(100000).slice(0, n)
    const parentOf = chainParent(rows)
    const entries = rows.map((row) => [row.id, row] as const)
    return {
      group: "axisOf, one chain of depth n",
      name: `axisOf chain ${n}`,
      run: () => consume(axisOfEntries<RowId, Row>(entries, (key) => parentOf(key)).by),
      means: `${n} nodes where every node's parent is the node before it`,
      iterations: 5,
      warmup: 2,
    }
  }),

  // Null hypothesis: the seat-index indirection in sortAxis costs more than the stability it buys.
  // If it is more than 2x a bare Array.prototype.sort of the same keys, the tax is too high.
  ...SIZES.map((n): Case => {
    const axis = axisOfSize(n)
    return {
      group: "sortAxis, one key",
      name: `sortAxis 1 key ${n}`,
      run: () => consume(sortAxis(axis, cmp1).roots),
      means: `re-sort ${n} roots on a numeric key, seats + Map.get per comparison`,
      ...budget(n),
    }
  }),
  ...SIZES.map((n): Case => {
    const axis = axisOfSize(n)
    return {
      group: "sortAxis, three keys",
      name: `sortAxis 3 keys ${n}`,
      run: () => consume(sortAxis(axis, cmp3).roots),
      means: `same ${n} roots, comparator falls through string, number, string`,
      ...budget(n),
    }
  }),

  // Null hypothesis: the second grouping level multiplies the cost. groupAxis walks the units once
  // and appends one level per key function, so level 2 should add a constant, not a factor.
  ...MID_SIZES.map((n): Case => {
    const axis = axisOfSize(n)
    return {
      group: "groupAxis, one level",
      name: `groupAxis dept ${n}`,
      run: () => consume(groupAxis(axis, byDept, groupValue).roots),
      means: `${n} rows into 8 dept groups, forest rebuilt above the data edges`,
      ...budget(n),
    }
  }),
  ...MID_SIZES.map((n): Case => {
    const axis = axisOfSize(n)
    return {
      group: "groupAxis, two levels",
      name: `groupAxis dept+tier ${n}`,
      run: () => consume(groupAxis(axis, byDeptTier, groupValue).roots),
      means: `${n} rows into 8 x 4 groups, two JSON group keys minted per row`,
      ...budget(n),
    }
  }),

  // Null hypothesis: a collapsed branch still costs something. If 10-percent-open is not far
  // cheaper than all-open, the closed-subtree skip is not skipping the subtree.
  {
    group: "flattenAxis, tree",
    name: `flattenAxis all open, ${treeStats.nodes} nodes`,
    run: () => consume(flattenAxis(treeAxis, allOpen)),
    means: `emit every node of a ${treeStats.nodes}-node, depth-${TREE.depth} forest`,
    iterations: 20,
    warmup: 5,
  },
  {
    group: "flattenAxis, tree",
    name: `flattenAxis 10% open, ${treeStats.nodes} nodes`,
    run: () => consume(flattenAxis(treeAxis, tenthOpen)),
    means: `same forest, ${OPEN_TENTH.size} of ${INTERNAL_COUNT} internal nodes open`,
    iterations: 200,
    warmup: 50,
  },

  // Null hypothesis: the two Sizer implementations buy nothing. If uniform and measured land inside
  // each other's noise, the O(n) prefix pass is free and one implementation would have done.
  {
    group: "renderPlan, end to end",
    name: `renderPlan uniform ${RENDER_N}`,
    run: () =>
      consume(
        renderPlan<RowId>({
          flat: renderKeys,
          side: noSide,
          page,
          paginate: false,
          virtualize: true,
          sizer: (keys) => uniformSizer(keys.length, 36),
          viewport,
          overscan: 4,
        }).center,
      ),
    means: `partition + paginate + window over ${RENDER_N} keys, O(1) sizer`,
    iterations: 40,
    warmup: 10,
  },
  {
    group: "renderPlan, end to end",
    name: `renderPlan measured ${RENDER_N}`,
    run: () =>
      consume(
        renderPlan<RowId>({
          flat: renderKeys,
          side: noSide,
          page,
          paginate: false,
          virtualize: true,
          sizer: (keys) => measuredSizer(keys.length, 36, heights),
          viewport,
          overscan: 4,
        }).center,
      ),
    means: `same plan, sizer builds a ${RENDER_N + 1}-entry prefix array every call`,
    iterations: 40,
    warmup: 10,
  },

  // Null hypothesis: indexAt on a measured sizer is not O(log n). 1M rows is 20 probes, so if the
  // measured window is more than ~50x the uniform window the search is walking, not halving.
  {
    group: "windowOf, 1M rows",
    name: "windowOf measuredSizer 1M",
    run: () => consume(windowOf(bigSizer, { start: nextScroll(bigSizer.total), extent: 900 }, 4).end),
    means: "two binary searches over a 1,000,001-entry prefix array, random scroll offset",
    iterations: 200,
    warmup: 50,
    inner: 500,
  },
  {
    group: "windowOf, 1M rows",
    name: "windowOf uniformSizer 1M",
    run: () =>
      consume(windowOf(uniformBig, { start: nextScroll(uniformBig.total), extent: 900 }, 4).end),
    means: "the same window through two divisions, the uniform-sizer control",
    iterations: 200,
    warmup: 50,
    inner: 500,
  },
  {
    group: "windowOf, 1M rows",
    name: "measuredSizer construction 1M",
    run: () => consume(measuredSizer(BIG, 36, bigHeights).total),
    means: "the one-time O(n) prefix pass that the binary search reads",
    iterations: 10,
    warmup: 3,
  },
]

register(CASES)
