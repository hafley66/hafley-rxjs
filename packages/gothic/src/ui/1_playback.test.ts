import { Signal } from "@hafley66/signals"
import { Subject, tap } from "rxjs"
import { expect, it } from "vitest"
import { playback } from "./1_playback.js"

it("stays cold until observed, shares the clock, holds and releases its last connection", () => {
  const values = Signal({ time: 0.25, speed: 1, run: true })
  const visible = Signal(false)
  const ticks = new Subject<number>()
  let listeners = 0
  const frames = ticks.pipe(tap({ subscribe: () => { listeners++ }, finalize: () => { listeners-- } }))
  const model = playback(values, 4000, { visible: visible.$, frames })
  const receipt: unknown[] = []
  const record = () => receipt.push([listeners, model.frame.$()])
  record()
  // This harness stands in for the renderer's observation boundary.
  const first = model.frame.time.$.subscribe()
  const second = model.frame.active.$.subscribe()
  record()
  visible.$(true); ticks.next(1000); record()
  values.$({ time: 0.125, speed: 2, run: false }); ticks.next(1000); record()
  values.run.$(true); ticks.next(1000); record()
  visible.$(false); ticks.next(1000); record()
  visible.$(true); ticks.next(1000); record()
  first.unsubscribe(); record()
  second.unsubscribe(); ticks.next(1000); record()
  expect(receipt).toMatchInlineSnapshot(`
    [
      [
        0,
        {
          "active": false,
          "time": 0,
        },
      ],
      [
        0,
        {
          "active": false,
          "time": 1000,
        },
      ],
      [
        1,
        {
          "active": true,
          "time": 2000,
        },
      ],
      [
        0,
        {
          "active": false,
          "time": 500,
        },
      ],
      [
        1,
        {
          "active": true,
          "time": 2500,
        },
      ],
      [
        0,
        {
          "active": false,
          "time": 2500,
        },
      ],
      [
        1,
        {
          "active": true,
          "time": 500,
        },
      ],
      [
        1,
        {
          "active": true,
          "time": 500,
        },
      ],
      [
        0,
        {
          "active": true,
          "time": 500,
        },
      ],
    ]
  `)
})

it("honors reduced motion and replays a completed one-shot repeatedly", () => {
  const values = Signal({ time: 0.5, speed: 1, run: true })
  const ticks = new Subject<number>()
  const model = playback(values, 1000, { loop: false, reducedMotion: true, frames: ticks })
  const sub = model.frame.$.subscribe()
  ticks.next(1000)
  expect(model.frame.$()).toEqual({ time: 500, active: false })
  for (let n = 0; n < 2; n++) {
    model.replay(); ticks.next(250)
    expect(model.frame.$()).toEqual({ time: 250, active: true })
    ticks.next(1000)
    expect(model.frame.$()).toEqual({ time: 1000, active: false })
  }
  model.seek(400)
  expect(model.frame.$()).toEqual({ time: 400, active: false })
  sub.unsubscribe()
})
