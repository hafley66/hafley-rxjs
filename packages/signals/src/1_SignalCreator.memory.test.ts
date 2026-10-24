import v8 from "node:v8"
import vm from "node:vm"
import { expect, test } from "vitest"
import { Signal } from "./2_Signal.js"

v8.setFlagsFromString("--expose_gc")
const gc = vm.runInNewContext("gc") as () => void
const settle = () => { for (let index = 0; index < 4; index++) gc() }

const COUNT = 5_000

// Retained heap per instance of one shape, built COUNT times and held.
const perInstance = (build: () => unknown): number => {
  settle()
  const before = process.memoryUsage().heapUsed
  const held = Array.from({ length: COUNT }, build)
  settle()
  const bytes = (process.memoryUsage().heapUsed - before) / COUNT
  void held
  return Math.round(bytes)
}

// The floor each shape has reached; a change that raises one fails here. Lower these when a change
// lowers the measurement.
const CEILING = {
  stateSignal: 1_300,
  memoCold: 4_400,
  memoSubscribed: 9_600,
  memoSubscribedPerDependency: 750,
  memoOnMemoPerDependency: 750,
}

test("bytes per signal shape stay at their floor", () => {
  const page = Signal(0)
  const subscribed = (deps: number) => () => {
    const memo = Signal(() => {
      let sum = 0
      for (let index = 0; index < deps; index++) sum += page.$()
      return sum
    })
    return [memo, memo.$.subscribe(() => {})]
  }
  const others = Array.from({ length: 4 }, () => Signal(0))
  const fourDeps = () => {
    const memo = Signal(() => others.reduce((sum, other) => sum + other.$(), 0))
    return [memo, memo.$.subscribe(() => {})]
  }
  const upstream = Array.from({ length: 4 }, () => Signal(() => 1))
  const fourMemoDeps = () => {
    const memo = Signal(() => upstream.reduce((sum, other) => sum + other.$(), 0))
    return [memo, memo.$.subscribe(() => {})]
  }
  const measured = {
    stateSignal: perInstance(() => Signal(0)),
    memoCold: perInstance(() => Signal(() => 1)),
    memoSubscribed: perInstance(subscribed(0)),
    memoSubscribedPerDependency: Math.round((perInstance(fourDeps) - perInstance(subscribed(0))) / 4),
    memoOnMemoPerDependency: Math.round((perInstance(fourMemoDeps) - perInstance(subscribed(0))) / 4),
  }
  console.log(JSON.stringify(measured))
  for (const [shape, bytes] of Object.entries(measured)) {
    expect(bytes, shape).toBeLessThanOrEqual(CEILING[shape as keyof typeof CEILING])
  }
})
