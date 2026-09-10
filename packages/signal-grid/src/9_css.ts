// Changing a grid track triggers one full layout, so the cost of a resize is how often the track
// list is written, not how it is built. No width is computed here.
// @no-features: writes the custom properties the theme reads; the features that decide those numbers are tagged in 8_grid.ts and 4_slice.ts
import { Signal } from "@hafley66/signals"
import type { ColumnDef, Side } from "./0_types.js"
import { rowHeightVar } from "./3_paths.js"
import { partition, trackList, type TrackColumn } from "./4_slice.js"
import { ROW_HEIGHT, type Grid } from "./8_grid.js"

/** Density in pixels. The row box reads it, and so does the sticky top of the pinned row run. */
export const SG_ROW_H = "--sg-row-h"
/** Scroll spacer height. Measures the paginated center run, not the whole relation. */
export const SG_TOTAL_H = "--sg-total-h"
/** Pixels above the first rendered row, applied as a translate on the rendered run. */
export const SG_OFFSET_Y = "--sg-offset-y"
/** `grid-template-columns` for the horizontal run. Named for the direction because under
 * `orientation: "columns"` that run holds rows and the tracks still describe the inline axis. */
export const SG_INLINE_TRACKS = "--sg-inline-tracks"
/** The height one row box reads. Its own property is named after its id, which no selector can
 * spell, so the row carries this alias and one generic rule serves every row. */
export const SG_ROW_HEIGHT_SELF = "--sg-h"

/** One emission is one write pass, so a frame can never show two columns from different plans. */
interface VarFrame {
  /** Already a `grid-template-columns` value. Nothing downstream does arithmetic on it. */
  readonly tracks: string
  readonly rowHeight: number
  /** Per-entry overrides on the vertical axis. An entry with no value falls to `--sg-row-h`. */
  readonly extent: Readonly<Record<string, number>>
  readonly totalHeight: number
  readonly offsetY: number
}

/** Writes every geometry property onto `root` from one derived node, so two sources changing in
 * the same tick cannot paint two different frames. */
export function writeGridVars<TRow>(grid: Grid<TRow>, root: HTMLElement): () => void {
  const frame = Signal<VarFrame>(() => {
    const plan = grid.view.plan.$()
    // Both seats by direction, never by name: under the transpose the horizontal run holds rows.
    const across = grid.view.horizontal.$()
    const down = grid.view.vertical.$()
    return {
      tracks: trackList(tracksOf(grid.view.cols.$(), across.pinning, across.extent, grid.columns.$())),
      rowHeight: ROW_HEIGHT[grid.state.density.$()],
      extent: down.extent,
      totalHeight: plan.centerTotal,
      offsetY: plan.offsetTop,
    }
  })
  // An entry that leaves the axis must lose its property, or a stale height keeps answering the
  // fallback chain of a row that comes back later under the same id.
  let written = new Set<string>()
  const sub = frame.$.subscribe((next) => {
    written = writeFrame(root, next, written)
  })
  return () => sub.unsubscribe()
}

/** One track per rendered entry, in run order, so track N and cell N are the same entry and every
 * row inherits the one list through `subgrid` rather than carrying a width. */
function tracksOf<TRow>(
  nodes: readonly { readonly key: string; readonly parent: string | null }[],
  pinning: Readonly<Record<string, Side>>,
  extent: Readonly<Record<string, number>>,
  schema: readonly ColumnDef<TRow>[],
): readonly TrackColumn[] {
  // A node the run itself calls parent is a band over its entries, not an entry: a header group
  // draws across its leaves and occupies no track. Read off the run, so a transpose reads the same.
  const bands = new Set<string>()
  for (const node of nodes) {
    if (node.parent !== null) bands.add(node.parent)
  }
  const defs = new Map(schema.map((col) => [col.id, col] as const))
  const entries = nodes.filter((node) => !bands.has(node.key)).map((node) => node.key)
  const runs = partition<string>(entries, (key) => pinning[key])
  return [...runs.start, ...runs.center, ...runs.end].map((key) =>
    trackFor(key, extent[key], defs.get(key)),
  )
}

/** A declared extent is a resize the user performed, so it takes the flex with it: a dragged
 * column stays put rather than resuming the competition for leftover space. */
function trackFor<TRow>(
  key: string,
  declared: number | undefined,
  def: ColumnDef<TRow> | undefined,
): TrackColumn {
  return {
    id: key,
    width: declared ?? def?.width,
    minWidth: def?.minWidth,
    maxWidth: def?.maxWidth,
    flex: declared === undefined ? def?.flex : undefined,
  }
}

function writeFrame(
  root: HTMLElement,
  frame: VarFrame,
  previous: ReadonlySet<string>,
): Set<string> {
  const style = root.style
  style.setProperty(SG_ROW_H, px(frame.rowHeight))
  style.setProperty(SG_TOTAL_H, px(frame.totalHeight))
  style.setProperty(SG_OFFSET_Y, px(frame.offsetY))
  // The single column write of the pass. Every header row and body row reads it through `subgrid`.
  style.setProperty(SG_INLINE_TRACKS, frame.tracks)

  const names = new Set<string>()
  writeExtents(root, frame.extent, names)
  for (const name of previous) {
    if (!names.has(name)) style.removeProperty(name)
  }
  return names
}

// The per-row alias is written by the renderer alongside SG_DEPTH, which already holds the element
// for every row in the plan. Sweeping the DOM from here would re-query every row every frame.
function writeExtents(
  root: HTMLElement,
  extent: Readonly<Record<string, number>>,
  names: Set<string>,
): void {
  for (const [key, height] of Object.entries(extent)) {
    const name = rowHeightVar(key)
    root.style.setProperty(name, px(height))
    names.add(name)
  }
}

const px = (value: number): string => `${Math.round(value * 100) / 100}px`
