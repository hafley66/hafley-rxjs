// @comment-ok: list view is one composite plus one collapsed axis, and that identity has no runtime home
// One cell, several source columns. Nothing downstream learns a new concept: a composite is a
// column whose cell reads other columns' accessors.
//
// `compositeColumn({ parts })` plus `listView: true` is MUI's `listViewColumn`, expressed from
// parts already present rather than as a second rendering mode. A composite also has no fixed
// height, which is why `14_measure.ts` exists.
import type { CellCtx, ColId, ColumnDef, Side, Slot } from "./0_types.js"

// --- Parts ------------------------------------------------------------------

/** Presentation weight, not order: reordering `parts` carries the ranks with them. */
export type CompositeRank = "primary" | "secondary" | "tertiary"

export interface CompositePart {
  readonly col: ColId
  readonly rank: CompositeRank
}

/** Position stands in for rank when a caller spells a bare id, which is the common case. */
const RANK_BY_POSITION: readonly CompositeRank[] = ["primary", "secondary"]

const rankAt = (index: number): CompositeRank => RANK_BY_POSITION[index] ?? "tertiary"

const partOf = (entry: ColId | CompositePart, index: number): CompositePart =>
  typeof entry === "string" ? { col: entry, rank: rankAt(index) } : entry

/** A thunk too, because a composite is usually built in the same expression as its own schema. */
export type ColumnSource<TRow> =
  | readonly ColumnDef<TRow>[]
  | (() => readonly ColumnDef<TRow>[] | undefined)

const sourceMap = <TRow>(
  source: ColumnSource<TRow> | undefined,
): ReadonlyMap<ColId, ColumnDef<TRow>> | undefined => {
  const list = typeof source === "function" ? source() : source
  if (list === undefined) return undefined
  return new Map(list.map((col) => [col.id, col] as const))
}

// --- The def ----------------------------------------------------------------

/** Ids are user strings, so the generated one is namespaced the way the built-ins are. */
export const COMPOSITE_PREFIX = "__composite:"

export interface CompositeColumnDef<TRow> extends ColumnDef<TRow> {
  readonly composite: readonly CompositePart[]
}

export const isComposite = <TRow>(col: ColumnDef<TRow>): col is CompositeColumnDef<TRow> =>
  Array.isArray((col as { composite?: unknown }).composite)

/** Resolved parts. With `columns`, parts naming a column the schema dropped are dropped too. */
export function compositeParts<TRow>(
  def: ColumnDef<TRow>,
  columns?: ColumnSource<TRow>,
): readonly CompositePart[] {
  if (!isComposite(def)) return []
  const known = sourceMap(columns)
  if (known === undefined) return def.composite
  return def.composite.filter((part) => known.has(part.col))
}

export interface CompositeColumnOptions<TRow> {
  readonly id?: ColId
  readonly header?: string
  readonly parts: readonly (ColId | CompositePart)[]
  /** Where each part's `value` accessor is read from. Absent means every part reads `row[col]`. */
  readonly columns?: ColumnSource<TRow>
  /** Replaces the default stack entirely. The ranks stay on the def for `compositeParts`. */
  readonly cell?: Slot<CellCtx<TRow>>
  readonly width?: number
  readonly minWidth?: number
  readonly flex?: number
  readonly pin?: Side
  /** Default true, sorting by the primary part. False makes the composite unsortable. */
  readonly sortable?: boolean
}

/** The composite's id names no field, so `value` points at the primary part and sorting is
 * the ordinary path with no special case. The primary's comparator comes along too. */
export function compositeColumn<TRow>(opts: CompositeColumnOptions<TRow>): CompositeColumnDef<TRow> {
  const parts = opts.parts.map(partOf)
  const primary = parts.find((part) => part.rank === "primary") ?? parts[0]
  // Resolved per read rather than captured: `columns` may be a thunk over a schema still being
  // built, and a part's column can be removed while the composite outlives it.
  const readPart = (part: CompositePart, row: TRow): unknown => {
    const col = sourceMap(opts.columns)?.get(part.col)
    const read = col?.value
    return read === undefined ? (row as Record<string, unknown>)[part.col] : read(row)
  }
  const sortable = opts.sortable !== false && primary !== undefined
  const primaryCol = (): ColumnDef<TRow> | undefined =>
    primary === undefined ? undefined : sourceMap(opts.columns)?.get(primary.col)
  return {
    id: opts.id ?? COMPOSITE_PREFIX + parts.map((part) => part.col).join("+"),
    header: opts.header ?? "",
    type: "custom",
    composite: parts,
    width: opts.width,
    minWidth: opts.minWidth,
    flex: opts.flex,
    pin: opts.pin,
    sortable,
    // Each part filters and groups on its own seat, so the panels offer those and not this column.
    filterable: false,
    groupable: false,
    editable: false,
    value: primary === undefined ? undefined : (row) => readPart(primary, row),
    sortComparator: sortable
      ? (left, right) => {
          const compare = primaryCol()?.sortComparator
          return compare === undefined ? defaultCompare(left, right) : compare(left, right)
        }
      : undefined,
    cell: opts.cell ?? defaultStack(parts, readPart, opts.columns),
  }
}

// --- The default cell -------------------------------------------------------

const textOf = (value: unknown): string =>
  value === null || value === undefined
    ? ""
    : typeof value === "symbol"
      ? value.toString()
      : String(value)

// Absent sorts last in both directions, which is what a composite over a removed column produces.
function defaultCompare(left: unknown, right: unknown): number {
  if (left === right) return 0
  if (left === undefined || left === null) return 1
  if (right === undefined || right === null) return -1
  return left < right ? -1 : left > right ? 1 : 0
}

/** One element per part carrying `data-rank` and no styles, so `theme.css` owns the stacking
 * and a consumer restyles a composite without replacing the slot. */
function defaultStack<TRow>(
  parts: readonly CompositePart[],
  readPart: (part: CompositePart, row: TRow) => unknown,
  columns: ColumnSource<TRow> | undefined,
): Slot<CellCtx<TRow>> {
  return (ctx) => {
    // `document` is touched only inside a slot call, so this module imports clean into a node test.
    const host = document.createElement("div")
    host.className = "sg-composite"
    const known = sourceMap(columns)
    for (const part of parts) {
      // A composite outliving a column removal degrades to the parts left rather than throwing.
      if (known !== undefined && !known.has(part.col)) continue
      const line = document.createElement("span")
      line.className = "sg-composite-part"
      line.setAttribute("data-rank", part.rank)
      line.setAttribute("data-col", part.col)
      line.append(textOf(readPart(part, ctx.data)))
      host.append(line)
    }
    return host
  }
}
