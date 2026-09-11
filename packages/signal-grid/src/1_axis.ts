// The five pure operators over `Axis<K, T>`, plus the two constructors that mint one and the walks
// that read one. Both grid axes run these same functions: a flat relation is the case where every
// key is a root, so list data and tree data never fork into two code paths.
//
// Every function here is total on a malformed axis. A parent cycle arrives from real data (a
// `parentOf` that names a descendant, a nested payload that repeats an id), and a grid has to draw
// a wrong forest rather than hang the tab.
import { GROUP_PREFIX, isGroupKey } from "./0_types.js"
import type { Axis, FilterMode, FlatNode } from "./0_types.js"

// --- Shared walking ---------------------------------------------------------

const kidsOf = <K extends string, T>(axis: Axis<K, T>, key: K): readonly K[] =>
  axis.children.get(key) ?? []

/** Depth-first order needs the last sibling on the bottom of the stack, so pushes run backwards. */
const pushBack = <F>(stack: F[], frames: readonly F[]): void => {
  for (let index = frames.length - 1; index >= 0; index--) {
    const frame = frames[index]
    if (frame !== undefined) stack.push(frame)
  }
}

// --- Constructors -----------------------------------------------------------

/**
 * True when following parent links from `key` arrives back at `key`. Only the nodes standing on the
 * cycle are cut loose: a node hanging below a cycle keeps its edge, because the parent it names
 * becomes a root and the forest is acyclic again.
 */
const returnsToSelf = <K extends string>(key: K, raw: ReadonlyMap<K, K>): boolean => {
  const seen = new Set<K>([key])
  let at = raw.get(key)
  while (at !== undefined) {
    if (at === key) return true
    if (seen.has(at)) return false
    seen.add(at)
    at = raw.get(at)
  }
  return false
}

/**
 * Two passes because a parent may be declared after its child: the first fills `by` and the raw
 * edges, the second resolves them once every key is known.
 *
 * A repeated key is an update, not a second row, so it replaces the value and keeps the seat it
 * already had. The parent is read from the latest value for the same reason.
 */
export function axisOfEntries<K extends string, T>(
  entries: Iterable<readonly [K, T]>,
  parentOf?: (key: K, value: T) => K | undefined,
): Axis<K, T> {
  const by = new Map<K, T>()
  const order: K[] = []
  const raw = new Map<K, K>()
  for (const [key, value] of entries) {
    if (!by.has(key)) order.push(key)
    by.set(key, value)
    const up = parentOf === undefined ? undefined : parentOf(key, value)
    // A node naming itself is the shortest cycle there is, so it never becomes an edge.
    if (up === undefined || up === key) raw.delete(key)
    else raw.set(key, up)
  }
  const roots: K[] = []
  const children = new Map<K, K[]>()
  const parent = new Map<K, K>()
  for (const key of order) {
    const up = raw.get(key)
    // An unknown parent is a root, never a dangling edge: a half-loaded page still has to render.
    if (up === undefined || !by.has(up) || returnsToSelf(key, raw)) {
      roots.push(key)
      continue
    }
    parent.set(key, up)
    const kids = children.get(up)
    if (kids === undefined) children.set(up, [key])
    else kids.push(key)
  }
  return { roots, children, parent, by }
}

/**
 * Depth-first construction for nested source data, which is the shape `subRows` arrives in.
 *
 * A key that has already been placed is an update: the value is replaced and the node is not
 * descended into again, which is what stops a payload whose children loop back.
 * @feature row.tree
 */
export function axisOfTree<K extends string, T>(
  items: readonly T[],
  keyOf: (item: T) => K,
  childrenOf: (item: T) => readonly T[] | undefined,
): Axis<K, T> {
  const by = new Map<K, T>()
  const roots: K[] = []
  const children = new Map<K, K[]>()
  const parent = new Map<K, K>()
  interface Frame {
    readonly item: T
    readonly up: K | undefined
  }
  const stack: Frame[] = []
  const descend = (list: readonly T[], up: K | undefined): void => {
    pushBack(
      stack,
      list.map((item) => ({ item, up })),
    )
  }
  descend(items, undefined)
  while (stack.length > 0) {
    const frame = stack.pop()
    if (frame === undefined) break
    const key = keyOf(frame.item)
    const placed = by.has(key)
    by.set(key, frame.item)
    if (placed) continue
    if (frame.up === undefined) roots.push(key)
    else {
      parent.set(key, frame.up)
      const kids = children.get(frame.up)
      if (kids === undefined) children.set(frame.up, [key])
      else kids.push(key)
    }
    const nested = childrenOf(frame.item)
    if (nested !== undefined && nested.length > 0) descend(nested, key)
  }
  return { roots, children, parent, by }
}

// --- Filter -----------------------------------------------------------------

interface Verdict<K extends string> {
  readonly key: K
  /** The ancestor chain's answer so far: `&&` for prune, `||` for subtree. */
  readonly up: boolean
}

const survivorsOf = <K extends string, T>(
  axis: Axis<K, T>,
  pass: ReadonlySet<K>,
  mode: FilterMode,
): ReadonlySet<K> => {
  const alive = new Set<K>()
  if (mode === "ancestors") {
    // Bottom-up, because a match anywhere below has to pull its whole chain back into view.
    for (const key of pass) {
      alive.add(key)
      for (const up of ancestorsOf(axis, key)) alive.add(up)
    }
    return alive
  }
  // prune and subtree are both decided top-down, so one walk carrying the ancestor verdict serves
  // both: prune conjoins with it, subtree disjoins with it.
  const seen = new Set<K>()
  const stack: Verdict<K>[] = []
  const seed = mode === "prune"
  pushBack(
    stack,
    axis.roots.map((key) => ({ key, up: seed })),
  )
  while (stack.length > 0) {
    const frame = stack.pop()
    if (frame === undefined) break
    if (seen.has(frame.key)) continue
    seen.add(frame.key)
    const ok = mode === "prune" ? pass.has(frame.key) && frame.up : pass.has(frame.key) || frame.up
    if (ok && axis.by.has(frame.key)) alive.add(frame.key)
    // Under prune nothing below a rejected node can survive, so the subtree is not even walked.
    if (mode === "prune" && !ok) continue
    pushBack(
      stack,
      kidsOf(axis, frame.key).map((key) => ({ key, up: ok })),
    )
  }
  return alive
}

/**
 * Rebuilds the forest over `alive`, attaching each survivor to its nearest surviving ancestor.
 * Only `subtree` can orphan a survivor, and the same rule covers all three modes without a branch.
 * Sibling order is the original order because the walk is over the original structure.
 */
const restrict = <K extends string, T>(axis: Axis<K, T>, alive: ReadonlySet<K>): Axis<K, T> => {
  const roots: K[] = []
  const children = new Map<K, K[]>()
  const parent = new Map<K, K>()
  const seen = new Set<K>()
  interface Frame {
    readonly key: K
    readonly anchor: K | undefined
  }
  const stack: Frame[] = []
  pushBack(
    stack,
    axis.roots.map((key) => ({ key, anchor: undefined })),
  )
  while (stack.length > 0) {
    const frame = stack.pop()
    if (frame === undefined) break
    if (seen.has(frame.key)) continue
    seen.add(frame.key)
    const kept = alive.has(frame.key)
    if (kept) {
      if (frame.anchor === undefined) roots.push(frame.key)
      else {
        parent.set(frame.key, frame.anchor)
        const kids = children.get(frame.anchor)
        if (kids === undefined) children.set(frame.anchor, [frame.key])
        else kids.push(frame.key)
      }
    }
    const anchor = kept ? frame.key : frame.anchor
    pushBack(
      stack,
      kidsOf(axis, frame.key).map((key) => ({ key, anchor })),
    )
  }
  const by = new Map<K, T>()
  for (const [key, value] of axis.by) if (alive.has(key)) by.set(key, value)
  return { roots, children, parent, by }
}

/** Applies `keep` through the forest under one of the three propagation rules of `FilterMode`. */
export function filterAxis<K extends string, T>(
  axis: Axis<K, T>,
  keep: (key: K, value: T) => boolean,
  mode: FilterMode,
): Axis<K, T> {
  const pass = new Set<K>()
  for (const [key, value] of axis.by) if (keep(key, value)) pass.add(key)
  const alive = survivorsOf(axis, pass, mode)
  // Identity by reference so a downstream stage can compare with === and skip its own work.
  if (alive.size === axis.by.size) return axis
  return restrict(axis, alive)
}

// --- Sort -------------------------------------------------------------------

/**
 * Sorts `roots` and every `children` array. `parent` and `by` are shared by reference because sort
 * moves nothing between parents.
 * @feature row.sort
 */
export function sortAxis<K extends string, T>(
  axis: Axis<K, T>,
  cmp: ((a: T, b: T) => number) | null,
): Axis<K, T> {
  if (cmp === null) return axis
  const order = (keys: readonly K[]): readonly K[] => {
    if (keys.length < 2) return keys
    // Seats carry the source index so equal rows keep source order no matter what the engine's sort
    // does, and so a comparator that hands back NaN cannot scramble a run.
    const seats = keys.map((key, index) => ({ key, index }))
    seats.sort((a, b) => {
      const left = axis.by.get(a.key)
      const right = axis.by.get(b.key)
      // A key with no value keeps its seat rather than sorting to one end.
      const by = left === undefined || right === undefined ? 0 : cmp(left, right)
      return by !== 0 && Number.isFinite(by) ? by : a.index - b.index
    })
    return seats.map((seat) => seat.key)
  }
  const children = new Map<K, readonly K[]>()
  for (const [key, kids] of axis.children) children.set(key, order(kids))
  return { roots: order(axis.roots), children, parent: axis.parent, by: axis.by }
}

// --- Group ------------------------------------------------------------------

/**
 * The key of a group node. JSON of the whole path, so two levels that read the same value still land
 * in different groups, and the `GROUP_PREFIX` namespace keeps a synthesized key off any RowId.
 */
const groupKeyOf = (path: readonly unknown[]): string => GROUP_PREFIX + JSON.stringify(path)

/**
 * Rebuilds the group levels of an axis. The units are the data nodes standing at the top of the
 * forest once the previous pass's group nodes are lifted out, and each unit travels with its own
 * subtree, so grouping tree data does not tear a parent away from its children. Grouping is
 * therefore idempotent: regrouping an already grouped axis yields the same axis.
 * @feature row.group
 */
export function groupAxis<K extends string, T>(
  axis: Axis<K, T>,
  keyOf: readonly ((value: T) => unknown)[],
  makeGroup: (path: readonly unknown[], key: K) => T,
): Axis<K, T> {
  // Identity by reference: no key functions means no group level, not an empty one.
  if (keyOf.length === 0) return axis
  const units: K[] = []
  const seen = new Set<K>()
  const stack: K[] = []
  pushBack(stack, axis.roots)
  while (stack.length > 0) {
    const key = stack.pop()
    if (key === undefined) break
    if (seen.has(key)) continue
    seen.add(key)
    if (isGroupKey(key)) {
      pushBack(stack, kidsOf(axis, key))
      continue
    }
    units.push(key)
  }
  const by = new Map<K, T>()
  for (const [key, value] of axis.by) if (!isGroupKey(key)) by.set(key, value)
  const roots: K[] = []
  const children = new Map<K, K[]>()
  const parent = new Map<K, K>()
  // Data edges below a unit are carried over untouched; only the top of the forest is rebuilt.
  for (const [key, up] of axis.parent) if (!isGroupKey(key) && !isGroupKey(up)) parent.set(key, up)
  for (const [key, kids] of axis.children) {
    if (isGroupKey(key)) continue
    const data = kids.filter((child) => !isGroupKey(child))
    if (data.length > 0) children.set(key, [...data])
  }
  const attach = (key: K, up: K | undefined): void => {
    if (up === undefined) {
      roots.push(key)
      return
    }
    parent.set(key, up)
    const kids = children.get(up)
    if (kids === undefined) children.set(up, [key])
    else kids.push(key)
  }
  for (const unit of units) {
    const value = by.get(unit)
    // A key with no value is not a row and has nothing to read a group key from.
    if (value === undefined) continue
    const path: unknown[] = []
    let up: K | undefined = undefined
    for (const read of keyOf) {
      path.push(read(value))
      const key = groupKeyOf(path) as K
      if (!by.has(key)) {
        by.set(key, makeGroup([...path], key))
        attach(key, up)
      }
      up = key
    }
    attach(unit, up)
  }
  return { roots, children, parent, by }
}

/** Data rows under each group key, whole subtree. Walked upward from each row, so every node is
 * visited once and a non-group key never lands in the result. @feature row.group */
export function groupCounts<K extends string, T>(axis: Axis<K, T>): ReadonlyMap<K, number> {
  const counts = new Map<K, number>()
  for (const key of axis.by.keys()) {
    if (isGroupKey(key)) continue
    let up = axis.parent.get(key)
    while (up !== undefined) {
      if (isGroupKey(up)) counts.set(up, (counts.get(up) ?? 0) + 1)
      up = axis.parent.get(up)
    }
  }
  return counts
}

// --- Flatten ----------------------------------------------------------------

interface Step<K extends string> {
  readonly key: K
  readonly depth: number
  readonly up: K | null
}

/**
 * Depth-first from the roots, skipping the subtree of a closed node. That skip is what keeps a
 * collapsed branch out of the virtualizer's row count entirely.
 * @feature row.expand
 */
export function flattenAxis<K extends string, T>(
  axis: Axis<K, T>,
  isOpen: (key: K) => boolean,
): readonly FlatNode<K>[] {
  const out: FlatNode<K>[] = []
  const seen = new Set<K>()
  const stack: Step<K>[] = []
  pushBack(
    stack,
    axis.roots.map((key) => ({ key, depth: 0, up: null })),
  )
  while (stack.length > 0) {
    const frame = stack.pop()
    if (frame === undefined) break
    if (seen.has(frame.key)) continue
    seen.add(frame.key)
    const kids = kidsOf(axis, frame.key)
    const hasChildren = kids.length > 0
    out.push({
      key: frame.key,
      depth: frame.depth,
      index: out.length,
      parent: frame.up,
      hasChildren,
    })
    if (!hasChildren || !isOpen(frame.key)) continue
    pushBack(
      stack,
      kids.map((key) => ({ key, depth: frame.depth + 1, up: frame.key })),
    )
  }
  return out
}

// --- Walks ------------------------------------------------------------------

/** Nearest first, so an indent guide or a breadcrumb reads the array straight off. */
export function ancestorsOf<K extends string, T>(axis: Axis<K, T>, key: K): readonly K[] {
  const out: K[] = []
  const seen = new Set<K>([key])
  let at = axis.parent.get(key)
  while (at !== undefined && !seen.has(at)) {
    seen.add(at)
    out.push(at)
    at = axis.parent.get(at)
  }
  return out
}

/** Depth-first, excluding `key` itself. The visited set is what makes a cyclic axis terminate. */
export function descendantsOf<K extends string, T>(axis: Axis<K, T>, key: K): readonly K[] {
  const out: K[] = []
  const seen = new Set<K>([key])
  const stack: K[] = []
  pushBack(stack, kidsOf(axis, key))
  while (stack.length > 0) {
    const at = stack.pop()
    if (at === undefined) break
    if (seen.has(at)) continue
    seen.add(at)
    out.push(at)
    pushBack(stack, kidsOf(axis, at))
  }
  return out
}

// --- Map --------------------------------------------------------------------

/** Values change, structure does not, so the three structural maps are shared by reference. */
export function mapAxis<K extends string, T, U>(
  axis: Axis<K, T>,
  f: (value: T, key: K) => U,
): Axis<K, U> {
  const by = new Map<K, U>()
  for (const [key, value] of axis.by) by.set(key, f(value, key))
  return { roots: axis.roots, children: axis.children, parent: axis.parent, by }
}
