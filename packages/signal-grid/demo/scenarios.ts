// Named states, as plain data. No DOM, no grid instance, nothing to mock: a test can import this
// list and feed `state` straight into `defaultState()`, and the demo's buttons do exactly that.
//
// `shape` is not part of `GridState` because the kernel takes rows as an input rather than a mode:
// "flat" hands it the 50,000 leaves, "tree" hands it the six roots and lets `subRows` do the work.
import { GROUP_PREFIX, type GridState } from "../src/index.js"
import { KINDS, leaves, leftmostPath } from "./data.js"

export type DataShape = "tree" | "flat"

export interface Scenario {
  readonly name: string
  readonly description: string
  readonly shape?: DataShape
  readonly state: Partial<GridState>
}

/** The key `groupAxis` mints for one path of group values. JSON, so two levels never collide. */
export const groupKey = (path: readonly unknown[]): string => GROUP_PREFIX + JSON.stringify(path)

const openAll = (keys: readonly string[]): Record<string, boolean> => {
  const out: Record<string, boolean> = {}
  for (const key of keys) out[key] = true
  return out
}

/** Three levels of the leftmost branch: root, its first child, its first grandchild. */
const DEEP_BRANCH = openAll(leftmostPath(3))

/** Every first-level group node of a `group: ["kind"]` model, open. */
const OPEN_KINDS = openAll(KINDS.map((kind) => groupKey([kind])))

/** Two leaf ids taken off the front of the flat relation, for the pinned-rows preset. */
const firstLeaves = (count: number): readonly string[] =>
  leaves().slice(0, count).map((row) => row.id)

export const SCENARIOS: readonly Scenario[] = [
  {
    name: "Flat sorted",
    description: "50,000 leaves, no edges, sorted by size descending.",
    shape: "flat",
    state: {
      sort: [{ field: "size", sort: "desc" }],
      page: { mode: "all", index: 0, size: 100, total: null },
    },
  },
  {
    name: "Deep tree",
    description: "Three levels of one branch open, the rest collapsed.",
    shape: "tree",
    state: { expanded: { ...DEEP_BRANCH } },
  },
  {
    name: "Grouped",
    description: "Grouped by kind then owner, every kind open.",
    shape: "flat",
    state: { group: ["kind", "owner"], expanded: { ...OPEN_KINDS }, sort: [{ field: "name", sort: "asc" }] },
  },
  {
    name: "Paged 25",
    description: "One page of 25 rows at a time, virtualization idle.",
    shape: "flat",
    state: { page: { mode: "pages", index: 0, size: 25, total: null }, sort: [{ field: "modified", sort: "desc" }] },
  },
  {
    name: "Infinite",
    description: "Pages accumulate as the scroll nears the end. Starts at 500 rows.",
    shape: "flat",
    state: { page: { mode: "infinite", index: 0, size: 500, total: null } },
  },
  {
    name: "Pinned edges",
    description: "Name and kind pinned start, owner and modified pinned end.",
    shape: "flat",
    state: {
      colPinning: { name: "start", kind: "start", modified: "end", owner: "end" },
      colWidth: { name: 260, kind: 120 },
    },
  },
  {
    name: "List view",
    description: "One line per row, header hidden, compact density.",
    shape: "flat",
    state: { listView: true, density: "compact", sort: [{ field: "modified", sort: "desc" }] },
  },
  {
    name: "Everything",
    description: "Grouped, multi-sorted, pinned on both axes, infinite paging, compact.",
    shape: "flat",
    state: {
      group: ["kind"],
      expanded: { ...OPEN_KINDS },
      sort: [{ field: "owner", sort: "asc" }, { field: "size", sort: "desc" }],
      colPinning: { name: "start", size: "end" },
      colWidth: { name: 300, size: 110 },
      colOrder: ["name", "owner", "kind", "modified", "size"],
      rowPinning: Object.fromEntries(firstLeaves(2).map((id) => [id, "start" as const])),
      page: { mode: "infinite", index: 0, size: 500, total: null },
      density: "compact",
      virtualize: true,
    },
  },
]
