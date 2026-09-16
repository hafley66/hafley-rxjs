import { BehaviorSubject, of } from "rxjs"
import { TestScheduler } from "rxjs/testing"
import { describe, expect, it } from "vitest"
import { type MarbleClockInputs, marbleClock } from "./3_clock.js"

const TICK_MS = 10
// 600 columns per second over a 10 ms tick is 6 columns per tick: small numbers, exact arithmetic.
const RATE = 600
const COLUMNS = 10

type Drive = { steps: Array<[number, number]>; values: number[]; completed: boolean }

function drive(
  inputs: Partial<MarbleClockInputs>,
  schedule?: (scheduler: TestScheduler) => void,
  maxFrames = 60,
): Drive {
  const scheduler = new TestScheduler(() => undefined)
  const steps: Array<[number, number]> = []
  let completed = false
  const clock = marbleClock(
    { playing: of(false), rate: of(RATE), position: of(0), columns: of(COLUMNS), loop: of(false), ...inputs },
    { scheduler, tickMs: TICK_MS },
  )
  clock.subscribe({
    next: value => steps.push([scheduler.frame, value]),
    complete: () => {
      completed = true
    },
  })
  schedule?.(scheduler)
  scheduler.maxFrames = maxFrames
  scheduler.flush()
  return { steps, values: steps.map(([, value]) => value), completed }
}

describe("marbleClock", () => {
  it("holds the resume point and completes while paused", () => {
    const run = drive({ position: of(5) })
    expect(run.steps).toEqual([[0, 5]])
    expect(run.completed).toBe(true)
  })

  it("walks the columns by the rate and stops on the last column", () => {
    const run = drive({ playing: of(true) })
    // 6 columns per tick, stopped on the 10th column rather than overshooting it.
    expect(run.steps).toEqual([
      [0, 0],
      [10, 6],
      [20, 9],
    ])
    expect(run.completed).toBe(true)
  })

  it("lands on the last column when one step is longer than the whole run", () => {
    const run = drive({ playing: of(true), rate: of(6000) })
    // A single 60-column step still names the last column, never one past the edge.
    expect(run.steps).toEqual([
      [0, 0],
      [10, 9],
    ])
    expect(run.completed).toBe(true)
  })

  it("clamps a resume point past the last column onto it", () => {
    const run = drive({ position: of(99) })
    expect(run.steps).toEqual([[0, COLUMNS - 1]])
  })

  it("treats a zero rate as paused instead of emitting the same column forever", () => {
    const run = drive({ playing: of(true), rate: of(0), position: of(3) })
    expect(run.steps).toEqual([[0, 3]])
    expect(run.completed).toBe(true)
  })

  it("restarts from the new resume point when a reveal lands mid-run", () => {
    const position = new BehaviorSubject(0)
    const run = drive({ playing: of(true), position }, scheduler => {
      scheduler.schedule(() => position.next(1), 5)
    })
    expect(run.steps).toEqual([
      [0, 0],
      [5, 1],
      [15, 7],
      [25, 9],
    ])
  })

  it("loops from the resume point and never completes", () => {
    const run = drive({ playing: of(true), loop: of(true) }, undefined, 40)
    expect(run.values.slice(0, 6)).toEqual([0, 6, 9, 0, 6, 9])
    expect(run.completed).toBe(false)
  })

  it("has nothing to walk in a document with no columns", () => {
    const run = drive({ playing: of(true), columns: of(0) })
    expect(run.steps).toEqual([[0, 0]])
    expect(run.completed).toBe(true)
  })
})
