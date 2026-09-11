// @comment-ok: the four cuts this feature takes, and the model decision behind the marker, have no
// runtime home and are the questions a reviewer opens this file with
// The header band: the rows above the leaves, each cell covering the leaves of one group.
//
// A header group is an interior node of the column forest, which `Axis` already carries, so nothing
// here builds a second structure. What the forest alone could not answer is which interior nodes
// are groups: `axisOfEntries` gives a value to every node it places, so the test the pipeline used
// to run ("the axis holds no value for this key") was one no node ever failed, and a group took a
// track and rendered a data cell in every row while the track list counted leaves.
//
// The marker is a field on `ColumnDef` rather than a second def type. `GridConfig.columns`,
// `Grid.columns`, `colAxis`, `byId`, and every `defs.get(...)` in the renderer are typed
// `ColumnDef<TRow>`; a union widens that one type across six files for a field three predicates
// read. `BuiltInColumnDef` in `5_columns.ts` discriminates the same way.
import { ancestorsOf } from "./1_axis.js"
import type { Axis, ColId, ColumnDef } from "./0_types.js"

// --- Identity ---------------------------------------------------------------

/** A band over its children. It holds no seat on either axis, and its label is `ColumnDef.header`,
 * the field a leaf labels itself with, so the one string a band owns needs no second vocabulary. */
export interface ColumnGroupDef<TRow> extends ColumnDef<TRow> {
  readonly band: true
}

/** One predicate under both seatings: the horizontal axis holds rows under the transpose, and a row
 * carries no marker, so nothing below has to ask which axis it is looking at. */
export const isHeaderGroup = (value: unknown): boolean =>
  typeof value === "object" && value !== null && (value as { band?: unknown }).band === true

export interface HeaderGroupOptions {
  readonly id: ColId
  readonly header?: string
  /** A band nests by naming its own parent, through the field a leaf names one with. */
  readonly group?: ColId
}

/**
 * @comment-ok: four decisions taken at this factory, none of which has a runtime home
 *
 * Sorting. A sort item names a field and the comparator reads it off a value. A band reads nothing
 * off a row, so `sortable` stays false and `10_render.ts` gives a band cell no route: a click
 * raises no intent rather than a sort for a field no row carries.
 *
 * Pinning. Pinning cuts the horizontal run into three sticky containers and the band is rebuilt per
 * container over the leaves that landed in it, so pinning a band is already spelled by pinning its
 * leaves, and a `colPinning` entry keyed by a band names a key no run holds.
 *
 * Resizing. A band's width is the sum of its leaves' tracks. One drag would spread a single delta
 * over N leaves under N pairs of caps, which is the solver `docs/why-no-solver.md` cut. A user drags
 * a leaf edge and the band above it follows.
 *
 * Collapsing. MUI X folds a group to one column. Cut by decision: folding is a second expansion
 * state whose whole effect is dropping leaves from the run, the track list, `widths`, and the
 * selection index at once, and `colHidden` already does that. A consumer folds a band by writing
 * its leaves' hidden flags from a click on it.
 */
export function headerGroup<TRow>(opts: HeaderGroupOptions): ColumnGroupDef<TRow> {
  return {
    id: opts.id,
    band: true,
    header: opts.header ?? opts.id,
    group: opts.group,
    sortable: false,
    filterable: false,
    groupable: false,
    resizable: false,
    movable: false,
    editable: false,
    pinnable: false,
  }
}

/** A band that forgot its marker takes a track and renders a cell in every entry while the track
 * list counts leaves, so it is rejected beside the `field` and `value` check in `8_grid.ts`. */
export function checkBands<TRow>(columns: readonly ColumnDef<TRow>[]): void {
  const named = new Set<ColId>()
  for (const col of columns) {
    if (col.group !== undefined) named.add(col.group)
  }
  // A `group` naming an id no column carries stays legal and becomes a root, which is what
  // `axisOfEntries` already decided for an unknown parent.
  for (const col of columns) {
    if (!named.has(col.id) || isHeaderGroup(col)) continue
    throw new Error(
      `signal-grid: column "${col.id}" is named as a header group and carries no band marker. ` +
        `Mint it with headerGroup({ id: "${col.id}" }).`,
    )
  }
}

// --- The band over a run ----------------------------------------------------

/** The band rows the header built. The sticky offsets under the header read it, because that height
 * is the schema's band depth and no stylesheet selector can count elements. */
export const SG_HEAD_ROWS = "--sg-head-rows"

/** One cell of one band row. A null key is a filler: a track no band covers at this level. */
export interface BandCell {
  readonly key: ColId | null
  /** Leaf tracks the cell covers. Always at least one. */
  readonly span: number
}

/** The bands over one entry, outermost first. The marker filter decides the depth and
 * `FlatNode.depth` never does, so a transposed tree of rows grows no header row. */
export function bandAncestors(axis: Axis<string, unknown>, key: string): readonly string[] {
  const out: string[] = []
  for (const up of ancestorsOf(axis, key)) {
    if (isHeaderGroup(axis.by.get(up))) out.push(up)
  }
  return out.reverse()
}

/** One row per band level, plus the row the leaves sit on. Counted over the whole run rather than
 * the window, so a horizontal scroll cannot change the header's height under the reader. */
export function bandDepth(axis: Axis<string, unknown>, leaves: readonly string[]): number {
  let deepest = 0
  for (const leaf of leaves) deepest = Math.max(deepest, bandAncestors(axis, leaf).length)
  return deepest + 1
}

/** Row `rows - 1` holds the leaves, each row above the band covering every leaf at that level and a
 * filler where none does. Adjacent cells naming one key collapse into one span. @feature col.group */
export function bandRow(
  axis: Axis<string, unknown>,
  leaves: readonly string[],
  depth: number,
  rows: number,
): readonly BandCell[] {
  const last = depth >= rows - 1
  const out: BandCell[] = []
  for (const leaf of leaves) {
    const key = last ? leaf : (bandAncestors(axis, leaf)[depth] ?? null)
    const held = out[out.length - 1]
    // Leaf keys are unique within an axis, so the bottom row can never collapse two of them.
    if (held !== undefined && held.key === key) {
      out[out.length - 1] = { key, span: held.span + 1 }
      continue
    }
    out.push({ key, span: 1 })
  }
  return out
}
