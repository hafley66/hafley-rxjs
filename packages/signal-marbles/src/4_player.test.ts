import { TestScheduler } from "rxjs/testing"
import { describe, expect, it } from "vitest"
import { readMarbles } from "./1_notation.js"
import type { MarbleClockOptions } from "./3_clock.js"
import { createMarblePlayer, PLAY_SECONDS } from "./4_player.js"

const SOURCE = ["source  : -a---|", "  derived : --a--|"].join("\n")
const TICK_MS = 10

function player(options: MarbleClockOptions = {}) {
  return createMarblePlayer(readMarbles(SOURCE), options)
}

/** A player on a virtual clock, watched from the start, with a column per tick so a whole diagram is
 * a handful of turns of that clock. */
function driven() {
  const scheduler = new TestScheduler(() => undefined)
  const subject = player({ scheduler, tickMs: TICK_MS })
  const seen: Array<number | "all"> = []
  const live = subject.revealed.$.subscribe(value => seen.push(value))
  subject.speed.$(100)
  return { scheduler, subject, seen, live }
}

describe("createMarblePlayer", () => {
  it("starts as a picture of the whole document", () => {
    const subject = player()
    // A diagram in a page is a picture: nothing has been revealed of it until something asks.
    expect(subject.revealed.$()).toBe("all")
    expect(subject.playing.$()).toBe(false)
    expect(subject.columns.$()).toBeGreaterThan(1)
    expect(subject.laneViews.$().map(view => [view.lane.id, view.depth])).toEqual([
      ["source", 0],
      ["derived", 1],
    ])
  })

  it("does no work until something watches the reveal", () => {
    const subject = player()
    subject.revealAt(3)
    // Nothing observes the reveal, so the clock was never connected and the reveal never moved.
    expect(subject.revealed.$()).toBe("all")

    const live = subject.revealed.$.subscribe()
    expect(subject.revealed.$()).toBe(3)
    live.unsubscribe()
  })

  it("walks the columns while playing and stops on the last one", () => {
    const { scheduler, subject, seen, live } = driven()
    subject.play()
    scheduler.flush()

    const last = subject.columns.$() - 1
    expect(subject.playing.$()).toBe(false)
    expect(subject.revealed.$()).toBe(last)
    // The walk went through the diagram, and no revealed column is ever past the last one.
    const columns = seen.filter((value): value is number => typeof value === "number")
    expect(columns[0]).toBe(0)
    expect(columns).toContain(last)
    expect(columns.every(value => value <= last)).toBe(true)
    live.unsubscribe()
  })

  it("starts again at the first column when play is pressed on the last one", () => {
    const { scheduler, subject, live } = driven()
    subject.play()
    scheduler.flush()
    expect(subject.revealed.$()).toBe(subject.columns.$() - 1)

    subject.play()
    expect(subject.revealed.$()).toBe(0)
    expect(subject.playing.$()).toBe(true)
    live.unsubscribe()
  })

  it("names whole columns while the clock is between two of them", () => {
    const { scheduler, subject, seen, live } = driven()
    subject.speed.$(25) // half a column per tick
    subject.play()
    scheduler.maxFrames = 25
    scheduler.flush()

    const columns = seen.filter((value): value is number => typeof value === "number")
    // Half a column is still a column: the reveal names the whole one the clock has reached.
    expect(columns).toEqual([0, 0, 0, 1])
    live.unsubscribe()
  })

  it("holds the column it paused on and carries on from there", () => {
    const { scheduler, subject, live } = driven()
    subject.play()
    scheduler.schedule(() => subject.pause(), 20)
    scheduler.flush()

    const held = subject.revealed.$()
    expect(subject.playing.$()).toBe(false)
    expect(held).toBeLessThan(subject.columns.$() - 1)

    subject.play()
    expect(subject.revealed.$()).toBe(held)
    expect(subject.playing.$()).toBe(true)
    live.unsubscribe()
  })

  it("keeps playing when it loops", () => {
    const { scheduler, subject, seen, live } = driven()
    const last = subject.columns.$() - 1
    subject.loop.$(true)
    subject.play()
    scheduler.maxFrames = 200
    scheduler.flush()

    const columns = seen.filter((value): value is number => typeof value === "number")
    expect(subject.playing.$()).toBe(true)
    expect(columns.every(value => value <= last)).toBe(true)
    // It went round: the reveal named a column before one it had already been on.
    const wrapped = columns.slice(columns.indexOf(last) + 1)
    expect(wrapped[0]).toBeLessThan(last)
    live.unsubscribe()
  })

  it("stops at once on a document that has only one column", () => {
    const scheduler = new TestScheduler(() => undefined)
    const subject = createMarblePlayer(readMarbles("only: a"), { scheduler, tickMs: TICK_MS })
    const live = subject.revealed.$.subscribe()
    expect(subject.columns.$()).toBe(1)

    subject.play()
    expect(subject.revealed.$()).toBe(0)
    expect(subject.playing.$()).toBe(false)
    live.unsubscribe()
  })

  it("names the column while playing, whichever way playback started", () => {
    const { scheduler, subject, live } = driven()
    subject.playing.$(true)
    scheduler.maxFrames = 20
    scheduler.flush()

    // A surface writes intent to the signal as readily as it calls the method, and a diagram being
    // walked is on a column either way.
    const at = subject.revealed.$()
    expect(at).toBeGreaterThan(0)
    live.unsubscribe()
  })

  it("steps one column at a time and clamps at both ends", () => {
    const subject = player()
    const live = subject.revealed.$.subscribe()
    const last = subject.columns.$() - 1

    // Back from the picture is the column before the last, and there is nothing past the last.
    subject.step(-1)
    expect(subject.revealed.$()).toBe(last - 1)
    subject.step(1)
    expect(subject.revealed.$()).toBe(last)
    subject.step(1)
    expect(subject.revealed.$()).toBe(last)
    subject.step(-1)
    expect(subject.revealed.$()).toBe(last - 1)

    // The first column is the other end of the diagram.
    subject.revealAt(0)
    subject.step(-1)
    expect(subject.revealed.$()).toBe(0)
    expect(subject.playing.$()).toBe(false)
    live.unsubscribe()
  })

  it("shows the complete picture again on revealAll, and stops", () => {
    const { scheduler, subject, live } = driven()
    subject.play()
    expect(subject.playing.$()).toBe(true)

    subject.revealAll()
    expect(subject.revealed.$()).toBe("all")
    expect(subject.playing.$()).toBe(false)
    // The clock had its last word where it stopped: nothing keeps walking the reveal after it.
    scheduler.flush()
    expect(subject.revealed.$()).toBe("all")
    live.unsubscribe()
  })

  it("puts the reveal on a column, clamped to the document", () => {
    const subject = player()
    const live = subject.revealed.$.subscribe()
    const last = subject.columns.$() - 1

    subject.revealAt(last + 10)
    expect(subject.revealed.$()).toBe(last)
    subject.revealAt("all")
    expect(subject.revealed.$()).toBe("all")
    subject.revealAt(0)
    expect(subject.revealed.$()).toBe(0)
    expect(subject.playing.$()).toBe(false)
    live.unsubscribe()
  })

  it("shows a new document as a picture again", () => {
    const subject = player()
    const live = subject.revealed.$.subscribe()
    const before = subject.columns.$()
    subject.revealAt(1)
    expect(subject.revealed.$()).toBe(1)

    subject.load(readMarbles("next: -b-|"))
    expect(subject.revealed.$()).toBe("all")
    expect(subject.playing.$()).toBe(false)
    expect(subject.columns.$()).toBeLessThan(before)
    expect(subject.laneViews.$().map(view => view.lane.id)).toEqual(["next"])
    live.unsubscribe()
  })

  it("scales the base rate by the speed", () => {
    const subject = player()
    // The base rate is whatever walks the whole diagram in the default duration.
    expect(subject.baseRate.$()).toBeCloseTo(subject.columns.$() / PLAY_SECONDS, 10)
    expect(subject.rate.$()).toBeCloseTo(subject.columns.$() / PLAY_SECONDS, 10)
    subject.speed.$(4)
    expect(subject.rate.$()).toBeCloseTo((subject.columns.$() / PLAY_SECONDS) * 4, 10)
  })
})
