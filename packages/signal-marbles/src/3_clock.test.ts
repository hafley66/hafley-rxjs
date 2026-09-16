import { BehaviorSubject, of } from "rxjs"
import { TestScheduler } from "rxjs/testing"
import { describe, expect, it } from "vitest"
import { type MarbleClockInputs, marbleClock } from "./3_clock.js"

const TICK_MS = 10
// 600 frames per second over a 10 ms tick is 6 frames per tick: small numbers, exact arithmetic.
const RATE = 600

type Drive = { frames: Array<[number, number]>; values: number[]; completed: boolean }

function drive(
  inputs: Partial<MarbleClockInputs>,
  schedule?: (scheduler: TestScheduler) => void,
  maxFrames = 60,
): Drive {
  const scheduler = new TestScheduler(() => undefined)
  const frames: Array<[number, number]> = []
  let completed = false
  const clock = marbleClock(
    { playing: of(false), rate: of(RATE), position: of(0), duration: of(10), loop: of(false), ...inputs },
    { scheduler, tickMs: TICK_MS },
  )
  clock.subscribe({
    next: value => frames.push([scheduler.frame, value]),
    complete: () => {
      completed = true
    },
  })
  schedule?.(scheduler)
  scheduler.maxFrames = maxFrames
  scheduler.flush()
  return { frames, values: frames.map(([, value]) => value), completed }
}

describe("marbleClock", () => {
  it("holds the position and completes while paused", () => {
    const run = drive({ position: of(5) })
    expect(run.frames).toEqual([[0, 5]])
    expect(run.completed).toBe(true)
  })

  it("advances by the rate each tick and stops on the last frame", () => {
    const run = drive({ playing: of(true) })
    // 6 frames per tick, clamped to the 10-frame extent rather than overshooting it.
    expect(run.frames).toEqual([
      [0, 0],
      [10, 6],
      [20, 10],
    ])
    expect(run.completed).toBe(true)
  })

  it("treats a zero rate as paused instead of emitting the same frame forever", () => {
    const run = drive({ playing: of(true), rate: of(0), position: of(3) })
    expect(run.frames).toEqual([[0, 3]])
    expect(run.completed).toBe(true)
  })

  it("restarts from the new position when a seek lands mid-run", () => {
    const position = new BehaviorSubject(0)
    const run = drive({ playing: of(true), position }, scheduler => {
      scheduler.schedule(() => position.next(1), 5)
    })
    expect(run.frames).toEqual([
      [0, 0],
      [5, 1],
      [15, 7],
      [25, 10],
    ])
  })

  it("loops from the resume point and never completes", () => {
    const run = drive({ playing: of(true), loop: of(true) }, undefined, 40)
    expect(run.values.slice(0, 6)).toEqual([0, 6, 10, 0, 6, 10])
    expect(run.completed).toBe(false)
  })
})
