import v8 from "node:v8"
import vm from "node:vm"
import { expect, test } from "vitest"
import { Signal } from "./2_Signal.js"

v8.setFlagsFromString("--expose_gc")
const gc = vm.runInNewContext("gc") as () => void
const settle = () => { for (let index = 0; index < 4; index++) gc() }

const MEMOS = 2_000
const EVENTS = 4
const FIRES = 10

// Retained heap per memo once every memo reads one state signal and EVENTS event signals, after
// each event fired FIRES times. The edge bookkeeping must stay a few numbers per (memo, event).
export function measure(): { bytesPerMemo: number } {
  settle()
  const before = process.memoryUsage().heapUsed
  const page = Signal(0)
  const events = Array.from({ length: EVENTS }, () => Signal<{ n: number }>())
  const memos = Array.from({ length: MEMOS }, () =>
    Signal(() => events.reduce((sum, event) => sum + (event.$()?.n ?? 0), page.$())))
  const subs = memos.map(memo => memo.$.subscribe(() => {}))
  for (let fire = 0; fire < FIRES; fire++) for (const event of events) event.$({ n: fire })
  page.$(1)
  settle()
  const bytesPerMemo = (process.memoryUsage().heapUsed - before) / MEMOS
  for (const sub of subs) sub.unsubscribe()
  return { bytesPerMemo }
}

test("edge bookkeeping retains a bounded number of bytes per memo", () => {
  const runs = [measure(), measure(), measure()].map(run => Math.round(run.bytesPerMemo))
  console.log(JSON.stringify({ bytesPerMemo: runs }))
  expect(Math.min(...runs)).toBeLessThan(Number(process.env.EDGE_BYTES_PER_MEMO_MAX ?? Infinity))
})
