import { describe, expect, it } from "vitest"
import { readMarbles } from "./1_notation.js"
import { createMarblePlayer, PLAY_SECONDS } from "./4_player.js"

const SOURCE = ["source  : -a---|", "  derived : --a--|"].join("\n")

function player() {
  return createMarblePlayer(readMarbles(SOURCE))
}

describe("createMarblePlayer", () => {
  it("derives the extent and the indentation from the document", () => {
    const subject = player()
    expect(subject.duration.$()).toBe(6)
    expect(subject.laneViews.$().map(view => [view.lane.id, view.depth])).toEqual([
      ["source", 0],
      ["derived", 1],
    ])
  })

  it("stays cold until something reads the playhead", () => {
    const subject = player()
    subject.seek(3)
    // Nothing observes `frame`, so the clock was never connected and no seek reached it.
    expect(subject.frame.$()).toBe(0)
  })

  it("follows a seek and a step once the playhead is observed", () => {
    const subject = player()
    const live = subject.frame.$.subscribe()
    subject.seek(3)
    expect(subject.frame.$()).toBe(3)
    subject.seek(99)
    expect(subject.frame.$()).toBe(6)

    subject.seek(0)
    subject.step(1)
    expect(subject.frame.$()).toBe(1)
    subject.step(1)
    expect(subject.frame.$()).toBe(2)
    subject.step(-1)
    expect(subject.frame.$()).toBe(1)
    live.unsubscribe()
  })

  it("saves the playhead as the resume point when it pauses", () => {
    const subject = player()
    const live = subject.frame.$.subscribe()
    subject.seek(4)
    subject.pause()
    expect(subject.playing.$()).toBe(false)
    expect(subject.position.$()).toBe(4)
    expect(subject.frame.$()).toBe(4)
    live.unsubscribe()
  })

  it("rewinds to the start when a new document is loaded", () => {
    const subject = player()
    const live = subject.frame.$.subscribe()
    subject.seek(4)
    subject.play()
    subject.load(readMarbles("next: -b-|"))
    expect(subject.position.$()).toBe(0)
    expect(subject.playing.$()).toBe(false)
    expect(subject.frame.$()).toBe(0)
    expect(subject.duration.$()).toBe(4)
    expect(subject.laneViews.$().map(view => view.lane.id)).toEqual(["next"])
    live.unsubscribe()
  })

  it("scales the base rate by the speed", () => {
    const subject = player()
    // The base rate is whatever plays the whole diagram in the default duration.
    expect(subject.rate.$()).toBeCloseTo(6 / PLAY_SECONDS, 10)
    subject.speed.$(4)
    expect(subject.rate.$()).toBeCloseTo((6 / PLAY_SECONDS) * 4, 10)
  })
})
