import { bench, describe } from "vitest"
import type { Signal as Sig } from "./0_types.js"
import { Signal } from "./2_Signal.js"

// Two shapes signal-grid puts on this library, each printed as a count and then timed.
// Run with `../../node_modules/.bin/vitest bench --run src/1_SignalCreator.bench.ts`.

const ROWS = 20_000
type Row = { id: number; rank: number }
const seedRows = (salt: number): Row[] =>
  Array.from({ length: ROWS }, (_, index) => ({ id: index, rank: (index * 7919 + salt) % ROWS }))

// `detailed` feeds `flat` and `vertical`, and `vertical` reads both: the grid's diamond.
const diamond = () => {
  const rows = Signal<Row[]>(seedRows(0))
  const detailed = Signal(() => [...rows.$()].sort((a, b) => a.rank - b.rank))
  const flat = Signal(() => detailed.$().map((it) => it.id))
  let verticalRecomputes = 0
  const vertical = Signal(() => {
    verticalRecomputes++
    const byId = new Map(detailed.$().map((it) => [it.id, it] as const))
    return flat.$().map((id) => byId.get(id)!.rank).sort((a, b) => a - b)
  })
  const sub = vertical.$.subscribe(() => {})
  return { rows, sub, recomputes: () => verticalRecomputes }
}

describe("diamond: one root write", () => {
  const shape = diamond()
  const before = shape.recomputes()
  shape.rows.$(seedRows(1))
  console.log(`diamond vertical recomputes per root write: ${shape.recomputes() - before}`)

  let salt = 2
  bench("root write through detailed, flat, and vertical", () => {
    shape.rows.$(seedRows(salt++))
  })
})

// A DOM binding subscribes the tail, and an event handler reads a stage untracked while it is live.
const gridLike = (rows: Sig<Row[]>) => {
  const sorted = Signal(() => [...rows.$()].sort((a, b) => a.rank - b.rank))
  const detailed = Signal(() => sorted.$().slice(0, 100))
  const flat = Signal(() => detailed.$().map((it) => it.id))
  const vertical = Signal(() => detailed.$().length + flat.$().length)
  const binding = vertical.$.subscribe(() => {})
  detailed.$()
  return () => binding.unsubscribe()
}

const observersOn = (signal: Sig<Row[]>) => signal.$.observers.length

describe("teardown: three grids over one rows signal", () => {
  const rows = Signal<Row[]>(seedRows(0))
  const start = observersOn(rows)
  const teardowns = [gridLike(rows), gridLike(rows), gridLike(rows)]
  const live = observersOn(rows)
  for (const teardown of teardowns) teardown()
  console.log(`rows.$ observers: start=${start} live=${live} after teardown=${observersOn(rows)}`)

  const shared = Signal<Row[]>(seedRows(0))
  bench("build three grid-shaped chains, tear them down, write to rows", () => {
    for (const teardown of [gridLike(shared), gridLike(shared), gridLike(shared)]) teardown()
    shared.$(seedRows(1))
  })
})
