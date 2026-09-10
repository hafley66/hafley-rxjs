// A range is two addresses and a mode, never a set of cells, so a drag across a million-cell
// rectangle costs what a drag across nine costs. Addresses are neutral: `cellId(vertical, horizontal)`.
import { cellId, cellParts } from "./0_types.js"
import type { CellId, RangeSelection } from "./0_types.js"

// --- The model --------------------------------------------------------------

/** `row` covers every horizontal key of its vertical span, `column` the mirror. */
export type SelectionMode = "cell" | "row" | "column"

export interface Block {
  readonly anchor: CellId
  readonly head: CellId
  readonly mode: SelectionMode
}

export interface GridSelection {
  readonly anchor: CellId | null
  readonly head: CellId | null
  readonly mode: SelectionMode
  /** Ranges already committed, so ctrl-drag adds a second block rather than replacing the first. */
  readonly blocks: readonly Block[]
}

/** The two ordered key lists a block covers. Empty in both when the block covers nothing. */
export interface Rect {
  readonly vertical: readonly string[]
  readonly horizontal: readonly string[]
}

const EMPTY_KEYS: readonly string[] = []
const EMPTY_BLOCKS: readonly Block[] = []

export const EMPTY_RECT: Rect = { vertical: EMPTY_KEYS, horizontal: EMPTY_KEYS }

export const EMPTY_RANGE: GridSelection = {
  anchor: null,
  head: null,
  mode: "cell",
  blocks: EMPTY_BLOCKS,
}

/** A header names a horizontal entry only, and `rectOf` reads no vertical half for that mode. */
export const columnAnchor = (horizontal: string): CellId => cellId("", horizontal)

/** The mirror, for a gutter that names a vertical entry and no column. */
export const rowAnchor = (vertical: string): CellId => cellId(vertical, "")

/** Widens the narrow `{ anchor, head }` the state declares until the `0_types.ts` patch lands. */
/** A rectangular range over two ordered axes, with edges for the border. @feature cell.select */
export function rangeOf(value: RangeSelection): GridSelection {
  const wide = value as RangeSelection & Partial<GridSelection>
  // Identity is kept when the state already holds the richer shape, so two reads compare equal.
  if (wide.mode !== undefined && wide.blocks !== undefined) return wide as GridSelection
  return { anchor: value.anchor, head: value.head, mode: "cell", blocks: EMPTY_BLOCKS }
}

/** The pair being dragged. Opened and never extended is one cell, never empty. */
export function liveBlock(range: GridSelection): Block | null {
  const anchor = range.anchor
  if (anchor === null) return null
  return { anchor, head: range.head ?? anchor, mode: range.mode }
}

/** Everything the range covers: the live pair first, then what earlier gestures committed. */
export function blocksOf(range: GridSelection): readonly Block[] {
  const live = liveBlock(range)
  if (live === null) return range.blocks
  return range.blocks.length === 0 ? [live] : [live, ...range.blocks]
}

export const isRangeEmpty = (range: GridSelection): boolean =>
  range.anchor === null && range.blocks.length === 0

// --- Geometry ---------------------------------------------------------------

/** Position of a key in its axis, or -1 when a sort or a filter has taken the key off it. */
type Lookup = (key: string) => number

interface Bounds {
  readonly fromVertical: number
  readonly toVertical: number
  readonly fromHorizontal: number
  readonly toHorizontal: number
}

const ordered = (first: number, second: number): readonly [number, number] =>
  first <= second ? [first, second] : [second, first]

/** Null covers nothing. Only the dimensions the mode uses are looked up, so a row block needs no column. */
function boundsOf(
  block: Block,
  verticalAt: Lookup,
  verticalCount: number,
  horizontalAt: Lookup,
  horizontalCount: number,
): Bounds | null {
  const from = cellParts(block.anchor)
  const to = cellParts(block.head)
  let fromVertical = 0
  let toVertical = verticalCount - 1
  if (block.mode !== "column") {
    const span = ordered(verticalAt(from[0]), verticalAt(to[0]))
    // A key that left the axis mid-drag drops the block rather than throwing.
    if (span[0] === -1) return null
    fromVertical = span[0]
    toVertical = span[1]
  }
  let fromHorizontal = 0
  let toHorizontal = horizontalCount - 1
  if (block.mode !== "row") {
    const span = ordered(horizontalAt(from[1]), horizontalAt(to[1]))
    if (span[0] === -1) return null
    fromHorizontal = span[0]
    toHorizontal = span[1]
  }
  if (toVertical < fromVertical || toHorizontal < fromHorizontal) return null
  return { fromVertical, toVertical, fromHorizontal, toHorizontal }
}

/** Both axis orders are handed in, so one call answers for either seating. `ordered` normalises. */
export function rectOf(
  block: Block,
  vertical: readonly string[],
  horizontal: readonly string[],
): Rect {
  const bounds = boundsOf(
    block,
    (key) => vertical.indexOf(key),
    vertical.length,
    (key) => horizontal.indexOf(key),
    horizontal.length,
  )
  if (bounds === null) return EMPTY_RECT
  return {
    vertical: vertical.slice(bounds.fromVertical, bounds.toVertical + 1),
    horizontal: horizontal.slice(bounds.fromHorizontal, bounds.toHorizontal + 1),
  }
}

const indexIn = (order: readonly string[]): Lookup => {
  const at = new Map(order.map((key, index) => [key, index] as const))
  return (key) => at.get(key) ?? -1
}

/** Both axes indexed once, so a renderer pays two map lookups and one comparison per block per cell. */
export function selectionTest(
  range: GridSelection,
  vertical: readonly string[],
  horizontal: readonly string[],
): (address: CellId) => boolean {
  const blocks = blocksOf(range)
  if (blocks.length === 0) return () => false
  const verticalAt = indexIn(vertical)
  const horizontalAt = indexIn(horizontal)
  const bounds: Bounds[] = []
  for (const block of blocks) {
    const extent = boundsOf(block, verticalAt, vertical.length, horizontalAt, horizontal.length)
    if (extent !== null) bounds.push(extent)
  }
  if (bounds.length === 0) return () => false
  return (address) => {
    const parts = cellParts(address)
    const down = verticalAt(parts[0])
    if (down === -1) return false
    const across = horizontalAt(parts[1])
    if (across === -1) return false
    for (const extent of bounds) {
      if (down < extent.fromVertical || down > extent.toVertical) continue
      if (across < extent.fromHorizontal || across > extent.toHorizontal) continue
      return true
    }
    return false
  }
}

/** The live drag plus every committed block, for one address. */
export function isSelected(
  range: GridSelection,
  vertical: readonly string[],
  horizontal: readonly string[],
  address: CellId,
): boolean {
  return selectionTest(range, vertical, horizontal)(address)
}

/** Keys covered along their whole run, which is what a row or a column highlight needs. */
export function selectedKeys(
  range: GridSelection,
  vertical: readonly string[],
  horizontal: readonly string[],
): Rect {
  if (isRangeEmpty(range) || vertical.length === 0 || horizontal.length === 0) return EMPTY_RECT
  const covers = selectionTest(range, vertical, horizontal)
  const down: string[] = []
  for (const key of vertical) {
    if (horizontal.every((it) => covers(cellId(key, it)))) down.push(key)
  }
  const across: string[] = []
  for (const key of horizontal) {
    if (vertical.every((it) => covers(cellId(it, key)))) across.push(key)
  }
  return { vertical: down, horizontal: across }
}

// --- Transitions ------------------------------------------------------------

/** Additive keeps the earlier blocks. Anchor equal to head is one cell, never an empty range. */
export function beginAt(
  range: GridSelection,
  cell: CellId,
  mode: SelectionMode,
  additive: boolean,
): GridSelection {
  return { anchor: cell, head: cell, mode, blocks: additive ? commitBlock(range).blocks : EMPTY_BLOCKS }
}

/** A range with no anchor takes the head as both, so an extend can open a block. */
export function extendTo(range: GridSelection, head: CellId): GridSelection {
  return range.anchor === null ? { ...range, anchor: head, head } : { ...range, head }
}

/** The pair stays live for a following shift-click and joins `blocks` for a following ctrl-drag. */
export function commitBlock(range: GridSelection): GridSelection {
  const live = liveBlock(range)
  if (live === null) return range
  const kept = range.blocks.filter((it) => it.anchor !== live.anchor || it.mode !== live.mode)
  return { anchor: live.anchor, head: live.head, mode: live.mode, blocks: [...kept, live] }
}

/** Identity when there was nothing to clear, so a repeated Escape writes no new state. */
export function clearSelection(range: GridSelection): GridSelection {
  return isRangeEmpty(range) ? range : EMPTY_RANGE
}
