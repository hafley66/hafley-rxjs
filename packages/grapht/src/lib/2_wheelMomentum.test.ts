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
          55.72,
          41.79,
          0.861,
        ],
        [
          70.46,
          52.84,
          0.824,
        ],
        [
          82.19,
          61.64,
          0.795,
        ],
        [
          111.38,
          83.54,
          0.722,
        ],
        [
          131.21,
          98.41,
          0.672,
        ],
        "finished",
      ],
    ]
  `)
})
