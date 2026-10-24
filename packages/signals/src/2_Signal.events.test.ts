import { expect, test } from "vitest"
import { Signal } from "./2_Signal.js"

// An event is an edge: a memo sees it on the run it caused, then reads undefined until the event
// fires again, equal value or not.
test("a memo sees each event once, and an event read pushes a rerun", () => {
  const click = Signal<{ x: number }>()
  const page = Signal(1)
  const runs: unknown[] = []
  const memo = Signal(() => {
    const seen = { page: page.$(), click: click.$() }
    runs.push(seen)
    return seen
  })
  const sub = memo.$.subscribe(() => {})
  click.$({ x: 1 })
  page.$(2)
  page.$(3)
  click.$({ x: 1 })
  sub.unsubscribe()
  expect(runs).toEqual([
    { page: 1, click: undefined },
    { page: 1, click: { x: 1 } },
    { page: 2, click: undefined },
    { page: 3, click: undefined },
    { page: 3, click: { x: 1 } },
  ])
})

test("child paths of one event agree within a run", () => {
  const drag = Signal<{ x: number; y: number }>()
  const runs: unknown[] = []
  const memo = Signal(() => {
    const seen = { x: drag.x.$(), y: drag.y.$() }
    runs.push(seen)
    return seen
  })
  const sub = memo.$.subscribe(() => {})
  drag.$({ x: 3, y: 4 })
  sub.unsubscribe()
  expect(runs.at(-1)).toEqual({ x: 3, y: 4 })
})
