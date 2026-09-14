import { expect, it } from "vitest"
import { WheelMomentum } from "./2_wheelMomentum.js"

it("decays pan and cursor-anchored pinch, replaces direction, and ends on teardown or timeout", () => {
  const camera = { x: 0, y: 0, scale: 1, viewport: { x: 0, y: 0, width: 800, height: 600 } }
  const at = { x: 400, y: 300 }
  const wheel = { deltaX: 0, deltaY: 100, deltaMode: 0, shiftKey: false, ctrlKey: false, metaKey: false }
  const traces = []
  for (const ctrlKey of [false, true]) {
    const motion = new WheelMomentum()
    let current = motion.push(camera, { ...wheel, ctrlKey }, at, 0)
    const samples = []
    for (const now of [0, 16, 32, 100, 300, 500]) {
      const next = now === 0 ? current : motion.step(current, now)
      if (next) current = next
      if (ctrlKey) {
        expect((at.x - current.x) / current.scale).toBeCloseTo(400, 9)
        expect((at.y - current.y) / current.scale).toBeCloseTo(300, 9)
      }
      samples.push(next ? [Number(current.x.toFixed(2)), Number(current.y.toFixed(2)), Number(current.scale.toFixed(3))] : "finished")
    }
    traces.push(samples)
    motion.push(current, { ...wheel, deltaY: -100 }, at, 600)
    expect(motion.velocityY).toBe(-2)
    motion.unsubscribe()
    expect(motion.step(current, 616)).toBeUndefined()
  }
  expect(traces).toMatchInlineSnapshot(`
    [
      [
        [
          0,
          -100,
          1,
        ],
        [
          0,
          -129.17,
          1,
        ],
        [
          0,
          -153.33,
          1,
        ],
        [
          0,
          -217.58,
          1,
        ],
        [
          0,
          -265.02,
          1,
        ],
        "finished",
      ],
      [
        [
          65.89,
          49.42,
          0.835,
        ],
        [
          82.98,
          62.24,
          0.793,
        ],
        [
          96.47,
          72.36,
          0.759,
        ],
        [
          129.62,
          97.22,
          0.676,
        ],
        [
          151.75,
          113.81,
          0.621,
        ],
        "finished",
      ],
    ]
  `)
})

it("configures sensitivity and momentum without changing pan distance or retaining an old tail", () => {
  const camera = { x: 0, y: 0, scale: 1, viewport: { x: 0, y: 0, width: 800, height: 600 } }
  const wheel = { deltaX: 0, deltaY: -100, deltaMode: 0, shiftKey: false, ctrlKey: true, metaKey: false }
  const motion = new WheelMomentum()
  motion.configure({ zoomSensitivity: 2, momentum: false })
  const zoom = motion.push(camera, wheel, { x: 400, y: 300 }, 0)
  expect(zoom.scale).toBeCloseTo(Math.exp(0.3), 10)
  expect(motion.step(zoom, 16)).toBeUndefined()
  const pan = motion.push(camera, { ...wheel, ctrlKey: false }, { x: 400, y: 300 }, 20)
  expect(pan).toEqual({ ...camera, y: 100 })
  motion.configure({ decayMs: 200, maxDurationMs: 100, strength: 0.5 })
  motion.push(camera, wheel, { x: 400, y: 300 }, 0)
  expect(motion.step(camera, 100)).toBeUndefined()
  motion.configure({ zoomSensitivity: NaN, decayMs: -5, maxDurationMs: Infinity, strength: 99 })
  expect(motion.settings).toEqual({ zoomSensitivity: 1.2, momentum: true, decayMs: 20, maxDurationMs: 500, strength: 2 })
  expect(motion.step(camera, 1)).toBeUndefined()
})
