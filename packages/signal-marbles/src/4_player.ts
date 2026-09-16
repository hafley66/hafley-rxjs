// The player: one document, one reveal, and the signals a surface reads. Nothing here subscribes or
// schedules — the clock is handed to `Signal(observable)`, which connects it when something watches
// the reveal and releases it when nothing does, so a player nobody mounted does no work.
//
// A diagram in a page is a picture, so the reveal is the whole document until playback or a step
// asks for a column, and it can always go back to being a picture. The column it names is the
// clock's own word for where it stands: how far the reveal has walked is a run in progress, and a
// run that has stopped is the column it stopped on.
import { Signal, type Signal as SignalType } from "@hafley66/signals"
import { map, tap } from "rxjs"
import {
  laneDepth,
  listeningWindows,
  type MarbleDoc,
  type MarbleLane,
  type MarbleNotification,
  marbleColumnCount,
  normalizeMarbleDoc,
} from "./0_types.js"
import { clamp, type MarbleClockOptions, marbleClock } from "./3_clock.js"

/** How long a diagram takes to play when nothing sets a speed. */
export const PLAY_SECONDS = 3

export type MarbleLaneView = {
  lane: MarbleLane
  /** Levels of derivation, for indentation. Derived from `parent`, never stored. */
  depth: number
  /** The columns the lane was listened to during, so a surface can dim what a subscriber missed.
   * Empty means it was listened to throughout. */
  listened: Array<{ from: number; to: number }>
}

export type MarbleHover = { lane: string; notification: MarbleNotification }

export type MarblePlayer = {
  readonly doc: SignalType<MarbleDoc>
  readonly laneViews: SignalType<MarbleLaneView[]>
  /** The number of causal columns. */
  readonly columns: SignalType<number>
  /** Columns per second of wall time before `speed` multiplies it. */
  readonly baseRate: SignalType<number>
  readonly speed: SignalType<number>
  readonly rate: SignalType<number>
  readonly playing: SignalType<boolean>
  readonly loop: SignalType<boolean>
  /** How far the reveal has walked: a column index, or "all" for the finished picture. */
  readonly revealed: SignalType<number | "all">
  readonly selected: SignalType<string | null>
  readonly hovered: SignalType<MarbleHover | null>
  /** Replace the document and show it whole. */
  load: (doc: MarbleDoc) => void
  play: () => void
  pause: () => void
  /** Show the complete picture. */
  revealAll: () => void
  /** Put the reveal on one column; "all" is allowed. */
  revealAt: (column: number | "all") => void
  /** One column back or forward. */
  step: (toward: 1 | -1) => void
}

export function createMarblePlayer(doc: MarbleDoc, options: MarbleClockOptions = {}): MarblePlayer {
  const doc$ = Signal(normalizeMarbleDoc(doc))
  const columns = Signal<number>(() => marbleColumnCount(doc$.$()))
  /** The last column an index can name, which is -1 for a document with no columns at all. */
  const last = Signal<number>(() => columns.$() - 1)
  const laneViews = Signal<MarbleLaneView[]>(() => {
    const current = doc$.$()
    return current.lanes.map(lane => ({
      lane,
      depth: laneDepth(lane, current.lanes),
      listened: listeningWindows(lane),
    }))
  })
  const speed = Signal(1)
  const baseRate = Signal<number>(() => Math.max(columns.$(), 1) / PLAY_SECONDS)
  const rate = Signal<number>(() => speed.$() * baseRate.$())
  const playing = Signal(false)
  const loop = Signal(false)
  /** The whole document rather than a column: what a reveal shows until something walks it. */
  const picture = Signal(true)
  /** The column a run resumes from, and while it is held, the column the reveal names. */
  const position = Signal(0)

  /** A reveal names a whole column, and only one the document has: the clock's own position between
   * two columns is floored, and a column past the last is the last. */
  const columnAt = (at: number): number => clamp(Math.floor(at), 0, Math.max(last.$(), 0))

  const clock$ = marbleClock(
    { playing: playing.$, rate: rate.$, position: position.$, columns: columns.$, loop: loop.$ },
    options,
  ).pipe(
    // Walking onto the last column ends the run there. The resume point is parked first, so the
    // paused branch the `playing` write opens names the end rather than the column the run began
    // on, and the tap stands down for the emissions its own writes cause.
    tap(column => {
      if (!playing.$() || loop.$() || column < last.$()) return
      if (position.$() !== last.$()) position.$(last.$())
      playing.$(false)
    }),
    // Playing names the column it is on. A diagram that is not walking is either the whole picture
    // or the column it was left on, and a picture is not a column.
    map((column): number | "all" => (!playing.$() && picture.$() ? "all" : columnAt(column))),
  )

  const revealed = Signal<number | "all">(clock$, "all")

  const revealAll = () => {
    picture.$(true)
    playing.$(false)
  }

  const revealAt = (column: number | "all") => {
    // A column that does not exist cannot be revealed, and a document with no columns has none:
    // there is nothing to walk, so it stays the picture it is.
    if (column === "all" || last.$() < 0) return revealAll()
    picture.$(false)
    position.$(columnAt(column))
    playing.$(false)
  }

  const step = (toward: 1 | -1) => {
    if (last.$() < 0) return
    const at = revealed.$()
    // The picture is the whole diagram: forward from it is past the end, and back from it is the
    // column before the last.
    const from = at === "all" ? last.$() : columnAt(at)
    if (toward === 1 && from >= last.$()) return
    revealAt(from + toward)
  }

  return {
    doc: doc$,
    laneViews,
    columns,
    baseRate,
    speed,
    rate,
    playing,
    loop,
    revealed,
    selected: Signal<string | null>(null),
    hovered: Signal<MarbleHover | null>(null),
    load: (next: MarbleDoc) => {
      doc$.$(normalizeMarbleDoc(next))
      picture.$(true)
      position.$(0)
      playing.$(false)
    },
    play: () => {
      // A document with no columns has nothing to walk: it stays the picture it is.
      if (last.$() < 0) return
      const at = revealed.$()
      // The picture, and the last column, are both the end of the diagram: playing from either
      // starts at the beginning. Anywhere else carries on from the column the reveal is on.
      const from = at === "all" || at >= last.$() ? 0 : at
      picture.$(false)
      position.$(from)
      playing.$(true)
    },
    // The resume point is saved on the hold, not on every column, so the reveal can walk while it
    // runs and land exactly where it stopped. A picture stays the picture it is.
    pause: () => {
      const at = revealed.$()
      if (at !== "all") {
        picture.$(false)
        position.$(at)
      }
      playing.$(false)
    },
    revealAll,
    revealAt,
    step,
  }
}
