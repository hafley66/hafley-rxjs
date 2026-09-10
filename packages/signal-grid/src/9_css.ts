// Changing a grid track triggers one full layout, so the cost of a resize is how often the track
// list is written, not how it is built. No width is computed here.
// @no-features: writes the custom properties the theme reads; the features that decide those numbers are tagged in 8_grid.ts and 4_slice.ts
import { Signal } from "@hafley66/signals"
import type { ColId, ColumnDef } from "./0_types.js"
import { rowHeightVar } from "./3_paths.js"
import { trackList, type RenderPlan, type Spacers, type TrackColumn } from "./4_slice.js"
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
      tracks: trackList(
        tracksOf(grid.view.colPlan.$(), grid.view.colSpacers.$(), across.extent, grid.columns.$()),
      ),
      rowHeight: ROW_HEIGHT[grid.state.density.$()],
      extent: down.extent,
      totalHeight: plan.centerTotal,
      offsetY: plan.offsetTop,
    }
  })
  // An entry that leaves the axis must lose its property, or a stale height keeps answering the
  // fallback chain of a row that comes back later under the same id.
  let written = new Set<string>()
  // The last value each property was set to. Every stage above reads the viewport, so a scroll
  // recomputes this frame each time, and a property set to what it already holds still costs style.
  const held = new Map<string, string>()
  const sub = frame.$.subscribe((next) => {
    written = writeFrame(root, next, written, held)
  })
  return () => sub.unsubscribe()
}

/** A skipped run as one fixed track. No column can be placed in it, so it carries no def. */
const spacerTrack = (id: string, width: number): TrackColumn => ({ id, width })

const SPACER_LEAD = "sg-lead"
const SPACER_TRAIL = "sg-trail"

/**
 * @comment-ok: the column-window layout decision, weighed against a measured lab result that lives
 * outside this repo and has no runtime home here
 *
 * One track per rendered entry, in run order, so track N and cell N are the same entry and every
 * row inherits the one list through `subgrid` rather than carrying a width. The columns the window
 * skipped keep their place as one leading and one trailing track.
 *
 * Spacer tracks rather than an absolute offset per cell. `subgrid`, `grid-column: span` for a
 * spanning cell, and the two sticky pinned runs all read this list, so moving rendered cells out of
 * it would need a second implementation of each, gated on one toggle. What that costs is one
 * `grid-template-columns` write per window shift, and the measured price of that write scales with
 * the rows in the document rather than with the relation: 1461 ms over 90 writes at 1000 rows
 * against 8005 ms at 5000 (`~/projects/claude-research/labs/grid-resize-perf/RESULTS.md`). Row
 * virtualization already holds the document at one viewport of rows, and `writeFrame` skips the
 * write on every frame the string did not move, so a horizontal scroll reflows the rendered rows
 * once per column crossed and never once per frame.
 */
function tracksOf<TRow>(
  plan: RenderPlan<ColId>,
  spacers: Spacers,
  extent: Readonly<Record<string, number>>,
  schema: readonly ColumnDef<TRow>[],
): readonly TrackColumn[] {
  const defs = new Map(schema.map((col) => [col.id, col] as const))
  const track = (key: string): TrackColumn => trackFor(key, extent[key], defs.get(key))
  const windowed = plan.center.map(track)
  const center = spacers.tracked
    ? [spacerTrack(SPACER_LEAD, spacers.lead), ...windowed, spacerTrack(SPACER_TRAIL, spacers.trail)]
    : windowed
  return [...plan.start.map(track), ...center, ...plan.end.map(track)]
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

/** Writes only on the edge. A repeat of the value already there is one style invalidation for a
 * frame that moved nothing, and the track list is the property that then reflows every row. */
function setVar(
  style: CSSStyleDeclaration,
  held: Map<string, string>,
  name: string,
  value: string,
): void {
  if (held.get(name) === value) return
  held.set(name, value)
  style.setProperty(name, value)
}

function writeFrame(
  root: HTMLElement,
  frame: VarFrame,
  previous: ReadonlySet<string>,
  held: Map<string, string>,
): Set<string> {
  const style = root.style
  setVar(style, held, SG_ROW_H, px(frame.rowHeight))
  setVar(style, held, SG_TOTAL_H, px(frame.totalHeight))
  setVar(style, held, SG_OFFSET_Y, px(frame.offsetY))
  // The single column write of the pass. Every header row and body row reads it through `subgrid`.
  setVar(style, held, SG_INLINE_TRACKS, frame.tracks)

  const names = new Set<string>()
  writeExtents(root, frame.extent, names, held)
  for (const name of previous) {
    if (names.has(name)) continue
    held.delete(name)
    style.removeProperty(name)
  }
  return names
}

// The per-row alias is written by the renderer alongside SG_DEPTH, which already holds the element
// for every row in the plan. Sweeping the DOM from here would re-query every row every frame.
function writeExtents(
  root: HTMLElement,
  extent: Readonly<Record<string, number>>,
  names: Set<string>,
  held: Map<string, string>,
): void {
  for (const [key, height] of Object.entries(extent)) {
    const name = rowHeightVar(key)
    setVar(root.style, held, name, px(height))
    names.add(name)
  }
}

const px = (value: number): string => `${Math.round(value * 100) / 100}px`
