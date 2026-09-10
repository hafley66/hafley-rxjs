// The one place the two-axis design stopped being two-axis. `plan` used to name the row axis, so
// the axis that scrolls was decided when the file was written rather than when the grid is
// configured.
//
// Two vocabularies meet here and nowhere else. Above this file everything is conventional: rows,
// columns, `rowPinning`, `colWidth`, a `ColumnDef.span` that hands back `{ rows, cols }`. Below it
// everything is neutral: a vertical seat and a horizontal seat. Orientation is the seating chart.
// No function below the boundary may ask which seat holds a row, because the moment it can ask,
// the transpose is a second code path again.
import { cellId, cellParts } from "./0_types.js"
import type { Axis, CellId, ColId, FlatNode, Orientation, RowId, Side } from "./0_types.js"

// --- The seating chart ------------------------------------------------------

/** Seat 0 always holds the row axis, seat 1 the column axis. Fixed, so a pair is built inline. */
export type AxisPair<T> = readonly [T, T]

// Declared in `0_types.ts` because `GridState` carries it, re-exported here because this is the
// file that gives it meaning.
export type { Orientation } from "./0_types.js"

/**
 * The only statement in the package that knows what a transpose is. Every other decision is an
 * index read off this table, which is why no `if` on orientation exists anywhere: a third
 * orientation would be a third row here and no other edit.
 */
const SEATS: Record<Orientation, AxisPair<0 | 1>> = {
  rows: [0, 1],
  columns: [1, 0],
}

const FLIPPED: Record<Orientation, Orientation> = { rows: "columns", columns: "rows" }

/** Its own inverse, which is what a round trip rests on. */
export const transpose = (orientation: Orientation): Orientation => FLIPPED[orientation]

/** Picks the seat standing on the y dimension. The vertical run is the one that scrolls and pages. */
export const verticalOf = <T>(pair: AxisPair<T>, orientation: Orientation): T =>
  pair[SEATS[orientation][0]]

/** Picks the other seat. Always the complement, so the two can never name the same axis. */
export const horizontalOf = <T>(pair: AxisPair<T>, orientation: Orientation): T =>
  pair[SEATS[orientation][1]]

// --- One axis and the state keyed by it -------------------------------------

/**
 * Everything a run needs off one axis, gathered so the pipeline can be handed either seat.
 *
 * `extent` is the entry's declared size along whichever direction it lands in: `rowHeight` for the
 * row seat, `colWidth` for the column seat. The direction supplies the fallback rather than the
 * axis, so a column standing on the y dimension is one row height tall and a row lying on the x
 * dimension is one column wide.
 */
export interface AxisFacet<K extends string, T> {
  readonly axis: Axis<K, T>
  readonly nodes: readonly FlatNode<K>[]
  readonly pinning: Readonly<Record<K, Side>>
  readonly extent: Readonly<Record<K, number>>
}

/**
 * Each seat is a thunk, so only the chosen one is ever evaluated. Reading both would put the
 * column state on the row plan's dependency list, and a column resize drag would then rebuild the
 * row window on every pointermove for a value it did not use.
 */
export type FacetPair<K extends string, T> = AxisPair<() => AxisFacet<K, T>>

export const verticalFacet = <K extends string, T>(
  pair: FacetPair<K, T>,
  orientation: Orientation,
): AxisFacet<K, T> => verticalOf(pair, orientation)()

export const horizontalFacet = <K extends string, T>(
  pair: FacetPair<K, T>,
  orientation: Orientation,
): AxisFacet<K, T> => horizontalOf(pair, orientation)()

// --- List view --------------------------------------------------------------

/**
 * List view is the degenerate transpose: the horizontal axis keeps one entry, so every vertical
 * entry renders as a single cell. Same lever one notch further, not a second rendering mode.
 *
 * The survivor is the first leaf. A header group is a band over its leaves, and a band of one leaf
 * is the leaf, so keeping the group node instead would leave a run whose only entry has no cell.
 */
export function collapseToOneEntry<K extends string>(
  nodes: readonly FlatNode<K>[],
  on: boolean,
): readonly FlatNode<K>[] {
  // Identity by reference so the common case costs a comparison, matching the rest of the kernel.
  if (!on) return nodes
  const first = nodes.find((it) => !it.hasChildren)
  if (first === undefined) return []
  return [{ key: first.key, depth: 0, index: 0, parent: null, hasChildren: false }]
}

// --- Spanning as a relation over the cross ----------------------------------

/**
 * How far one cell reaches past its own seat, counted in entries rather than pixels. Both counts
 * are at least 1, and `{ vertical: 1, horizontal: 1 }` is a cell that spans nothing.
 */
export interface CellSpan {
  readonly vertical: number
  readonly horizontal: number
}

/**
 * Spanning as a relation over the cross rather than a per-column callback. The key is
 * `cellId(verticalKey, horizontalKey)`, so a transpose is a swap of both halves and nothing else,
 * and no consumer has to know a column ever had an opinion about it.
 */
export type SpanRelation = ReadonlyMap<CellId, CellSpan>

export const NO_SPANS: SpanRelation = new Map<CellId, CellSpan>()
export const NO_COVER: ReadonlySet<CellId> = new Set<CellId>()

const countOf = (value: number | undefined): number => Math.max(1, Math.trunc(value ?? 1))

/**
 * The boundary, crossed once. A `ColumnDef.span` speaks rows and columns because that is what a
 * table config has always spelled; the seating chart turns the pair into a neutral one and the
 * kernel never sees the conventional names again.
 */
export function neutralSpan(
  span: { readonly rows?: number; readonly cols?: number },
  orientation: Orientation,
): CellSpan {
  const seats: AxisPair<number> = [countOf(span.rows), countOf(span.cols)]
  return { vertical: verticalOf(seats, orientation), horizontal: horizontalOf(seats, orientation) }
}

/** The same crossing for the address. `cellId` is already a tuple, so only the seat order moves. */
export function neutralCell(row: RowId, col: ColId, orientation: Orientation): CellId {
  const seats: AxisPair<string> = [row, col]
  return cellId(verticalOf(seats, orientation), horizontalOf(seats, orientation))
}

/**
 * The crossing read back the other way, for a renderer holding a vertical and a horizontal key and
 * needing the row and the column behind them.
 *
 * The same body as `neutralCell` because the map is an involution: seat 0 is the row axis, and
 * asking the seat table which seat stands vertical returns the pair to conventional order exactly
 * as sending it the other way took it out of one.
 */
export function conventionalParts(
  vertical: string,
  horizontal: string,
  orientation: Orientation,
): readonly [RowId, ColId] {
  const seats: AxisPair<string> = [vertical, horizontal]
  return [verticalOf(seats, orientation), horizontalOf(seats, orientation)]
}

/** Swaps both halves of every entry. Applied twice it is the identity, which is the proof. */
export function transposeSpans(spans: SpanRelation): SpanRelation {
  const out = new Map<CellId, CellSpan>()
  for (const [anchor, extent] of spans) {
    const parts = cellParts(anchor)
    out.set(cellId(parts[1], parts[0]), {
      vertical: extent.horizontal,
      horizontal: extent.vertical,
    })
  }
  return out
}

/**
 * Every cell a span reaches that is not the anchor itself. A covered cell renders nothing: the
 * neighbour already occupies the space, and two elements in one seat is how a spanning grid tears.
 *
 * Both key lists arrive in run order, because a span reaches the next entries along each dimension
 * and "next" is only defined by that order. Nothing here knows which list holds rows.
 */
export function coveredBy(
  spans: SpanRelation,
  vertical: readonly string[],
  horizontal: readonly string[],
): ReadonlySet<CellId> {
  if (spans.size === 0) return NO_COVER
  const verticalAt = new Map(vertical.map((key, index) => [key, index] as const))
  const horizontalAt = new Map(horizontal.map((key, index) => [key, index] as const))
  const covered = new Set<CellId>()
  for (const [anchor, extent] of spans) {
    const parts = cellParts(anchor)
    const fromVertical = verticalAt.get(parts[0])
    const fromHorizontal = horizontalAt.get(parts[1])
    // An anchor outside the current runs spans nothing visible. A hidden column and a filtered row
    // both land here, and neither is an error.
    if (fromVertical === undefined || fromHorizontal === undefined) continue
    for (let stepVertical = 0; stepVertical < extent.vertical; stepVertical++) {
      for (let stepHorizontal = 0; stepHorizontal < extent.horizontal; stepHorizontal++) {
        if (stepVertical === 0 && stepHorizontal === 0) continue
        const overVertical = vertical[fromVertical + stepVertical]
        const overHorizontal = horizontal[fromHorizontal + stepHorizontal]
        // A span running off the end of a run is clamped by the run, not by an error: the last
        // page of a paginated grid is shorter than the one before it.
        if (overVertical === undefined || overHorizontal === undefined) continue
        covered.add(cellId(overVertical, overHorizontal))
      }
    }
  }
  return covered
}
