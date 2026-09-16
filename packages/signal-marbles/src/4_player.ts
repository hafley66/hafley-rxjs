// The player: one document, one playhead, and the signals a surface reads. Nothing here subscribes
// or schedules — the clock is handed to `Signal(observable)`, which connects it when something
// reads the playhead and releases it when nothing does.
import { Signal, type Signal as SignalType } from "@hafley66/signals"
import {
  laneDepth,
  listeningWindows,
  type MarbleDoc,
  type MarbleLane,
  type MarbleNotification,
  normalizeMarbleDoc,
} from "./0_types.js"
import { clamp, type MarbleClockOptions, marbleClock } from "./3_clock.js"

/** How long a diagram takes to play when nothing sets a speed. */
export const PLAY_SECONDS = 3

export type MarbleLaneView = {
  lane: MarbleLane
  /** Levels of derivation, for indentation. Derived from `parent`, never stored. */
  depth: number
  /** When the lane was listened to, so a surface can dim what a subscriber missed. Empty: always. */
  listened: Array<{ from: number; to: number }>
}

export type MarbleHover = { lane: string; notification: MarbleNotification }

export type MarblePlayerOptions = MarbleClockOptions

export type MarblePlayer = {
  readonly doc: SignalType<MarbleDoc>
  readonly laneViews: SignalType<MarbleLaneView[]>
  /** The last frame on the diagram. */
  readonly duration: SignalType<number>
  /** Frames per second before `speed` multiplies it. */
  readonly baseRate: SignalType<number>
  readonly speed: SignalType<number>
  /** The frames per second the clock is running at. */
  readonly rate: SignalType<number>
  readonly playing: SignalType<boolean>
  readonly loop: SignalType<boolean>
  /** Where playback resumes from. A seek writes this. */
  readonly position: SignalType<number>
  /** The playhead, in frames. Fractional while playing. */
  readonly frame: SignalType<number>
  readonly selected: SignalType<string | null>
  readonly hovered: SignalType<MarbleHover | null>
  /** Replace the document and rewind. */
  load: (doc: MarbleDoc) => void
  play: () => void
  pause: () => void
  seek: (frame: number) => void
  /** Jump the playhead to the neighbouring frame that has something on it. */
  step: (toward: 1 | -1) => void
}

export function createMarblePlayer(doc: MarbleDoc, options: MarblePlayerOptions = {}): MarblePlayer {
  const doc$ = Signal(normalizeMarbleDoc(doc))
  const duration = Signal<number>(() => doc$.$().frames)
  const laneViews = Signal<MarbleLaneView[]>(() => {
    const current = doc$.$()
    return current.lanes.map(lane => ({
      lane,
      depth: laneDepth(lane, current.lanes),
      listened: listeningWindows(lane),
    }))
  })
  const speed = Signal(1)
  const baseRate = Signal<number>(() => Math.max(duration.$(), 1) / PLAY_SECONDS)
  const rate = Signal<number>(() => speed.$() * baseRate.$())
  const playing = Signal(false)
  const loop = Signal(false)
  const position = Signal(0)
  const frame = Signal(
    marbleClock(
      { playing: playing.$, rate: rate.$, position: position.$, duration: duration.$, loop: loop.$ },
      options,
    ),
    0,
  )
  const selected = Signal<string | null>(null)
  const hovered = Signal<MarbleHover | null>(null)

  const seek = (target: number) => {
    position.$(clamp(target, 0, duration.$()))
  }

  return {
    doc: doc$,
    laneViews,
    duration,
    baseRate,
    speed,
    rate,
    playing,
    loop,
    position,
    frame,
    selected,
    hovered,
    load: (next: MarbleDoc) => {
      doc$.$(normalizeMarbleDoc(next))
      position.$(0)
      playing.$(false)
    },
    play: () => {
      playing.$(true)
    },
    // The resume point is saved on the hold, not on every frame, so the playhead can be
    // fractional while it runs and exact the moment it stops.
    pause: () => {
      position.$(frame.$())
      playing.$(false)
    },
    seek,
    step: (toward: 1 | -1) => {
      const current = frame.$()
      const frames = doc$
        .$()
        .lanes.flatMap(lane => lane.notifications.map(notification => notification.frame))
        .filter((value, index, all) => all.indexOf(value) === index)
        .sort((a, b) => a - b)
      const next =
        toward === 1
          ? (frames.find(value => value > current) ?? duration.$())
          : ([...frames].reverse().find(value => value < current) ?? 0)
      seek(next)
      playing.$(false)
    },
  }
}
