// The strip's feed. The server watches the pane and pushes; the strip listens
// and asks for nothing on scroll and nothing per square.
//
//   watchSquares(...)  ->  squares_watch  ->  the server's own pane reader
//   squaresFeed(...)   <-  "squares-update"  <-  one frame per projection
//
// The event channel is the same one `pty-data-batch` and the activity pushes
// ride, so the serve binary and the Tauri window deliver it the same way.
import { concatMap, defer, distinctUntilChanged, filter, finalize, from, map, type Observable } from "rxjs"
import type { SquareKind } from "./0_agentSquareVisual.js"

export type SquaresOptions = { mode: "relative" | "recent"; userKeep: number }

/** The reader's choices ride the watch call; the settings module owns the type
 *  and the values, so a strip and a toolbar cannot disagree about either. */

/** The event the server pushes a projection on. Mirrors `SQUARES_EVENT` in
 *  `src-tauri/src/1_squares.rs` — change both. */
export const SQUARES_EVENT = "squares-update"

export type SquaresWatchInput = { pty: string; session: string; target: string; socket?: string; options: SquaresOptions }

/** The pane owns its frame feed even while the sidebar is hidden. Commands
 * are serialized so an older unwatch cannot stop a rebound session. */
export function squaresWatchEffects(
  pty: string,
  inputs: Observable<SquaresWatchInput | null>,
  send: (command: "squares_watch" | "squares_unwatch", input: SquaresWatchInput | { pty: string }) => Promise<unknown>,
): Observable<void> {
  return defer(() => {
    let pending = Promise.resolve<unknown>(undefined)
    return inputs.pipe(
      distinctUntilChanged((before, after) => JSON.stringify(before) === JSON.stringify(after)),
      concatMap((input) => {
        pending = pending.then(() => input ? send("squares_watch", input) : send("squares_unwatch", { pty }))
        return from(pending).pipe(map(() => void 0))
      }),
      finalize(() => { void pending.catch(() => undefined).then(() => send("squares_unwatch", { pty })).catch(() => undefined) }),
    )
  })
}

/** One turn as the push carries it: the matcher's span plus the turn's text.
 *  `said`'s newline count is the turn's size in the rolling window, so the
 *  strip never reads the store to size a square. */
export type StripTurn = {
  session: string
  harness: string
  turn: number
  ts: number
  role: string
  said: string
  id: string
  bufferStart: number
  bufferEnd: number
  anchorStart: number
  anchorEnd: number
  /** `pinned` is a turn above the capture: it has no rows in the pane at all,
   *  so it says so rather than claiming an anchor, and its four offsets are 0. */
  confidence: "anchored" | "extended" | "pinned"
}

/** One pushed frame. `tags` is keyed by source (`turn:<session>:<turn>`) and
 *  answers for every turn in the frame, empty list included.
 *
 *  `layout` is the server's own placement of those turns, computed by
 *  `boop-turnstrip` from the pane capture plus tmux's `#{pane_height}` (a
 *  scrolled pane is a copy-mode view, so the window is the capture's last
 *  `pane_height` rows and the client reports nothing). `null` means the height
 *  could not be read: the frame still carries spans and marks, and the strip
 *  draws nothing. */
export type Strip = {
  session: string
  at: number
  rows: number
  turns: StripTurn[]
  /** The reader's own turns above the capture, oldest first: the turns the band
   *  squares refer to, which `turns` does not carry because the matcher never
   *  saw them. Their spans are all 0. */
  pinned: StripTurn[]
  tags: Record<string, string[]>
  layout: StripLayout | null
}

/** One square's place in the strip, in the server's own numbers. */
export type SquareLayout = {
  id: string
  kind: SquareKind
  /** Where the square sits on the strip's track, oldest at 0. */
  y: number
  scale: number
  active: boolean
}

/** The strip itself, in whichever space the mode placed its squares.
 *
 *  `squares` is oldest first in both modes, exactly one active. The tag is on
 *  the wire, so a client branches once on which space `y` is in and never has to
 *  guess. */
export type StripLayout =
  | {
      mode: "relative"
      gap?: ToolGap | null
      squares: SquareLayout[]
      /** How many leading squares are the reader's own turns the mode placed
       *  nothing for: `y` counts places in the band rather than rows, and
       *  `active` is always false. `recent` has no band, so it carries none. */
      band: number
      /** The reader's window in rows: what a square's `y` is measured in. */
      rows: number
    }
  | {
      mode: "recent"
      gap?: ToolGap | null
      squares: SquareLayout[]
      /** The reader's window in rows, which is what centred the block. */
      rows: number
    }

export type ToolGap = {
  beforeId: string | null
  afterId: string | null
  startRow: number
  endRow: number
}

export type SquaresWatch = {
  /** The pane's own id: the pty stream wakes the feed on this. */
  pty: string
  /** The boop session the turns are read for. */
  session: string
  /** The tmux target the pane is captured by. */
  target: string
  socket?: string
}

/** The projections for one session. A frame for another session is dropped
 *  here, so a tab never draws a neighbour's strip. */
export function squaresFeed(session: string, frames: Observable<Strip>): Observable<Strip> {
  return frames.pipe(filter((frame) => frame.session === session))
}
