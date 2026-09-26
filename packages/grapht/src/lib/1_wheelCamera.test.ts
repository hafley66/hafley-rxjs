import { expect, it } from "vitest"
import { clampCamera, fitScaleOf } from "./1_wheelCamera.js"
import { WheelMomentum } from "./2_wheelMomentum.js"

const viewport = { x: 0, y: 0, width: 800, height: 400 }
const bounds = { x: 0, y: 0, width: 1000, height: 300 }

it("a 40-event fling stops with at most half the viewport empty, and the coast ends at the clamp", () => {
  const floor = fitScaleOf(bounds, viewport)
  const motion = new WheelMomentum()
  motion.clamp = camera => clampCamera(camera, bounds, floor)
  let camera = { x: 0, y: 0, scale: 1, viewport }
  const trace: string[] = []
  const at = { x: 400, y: 200 }
  for (let index = 0; index < 40; index++) {
    camera = motion.push(camera, { deltaX: 120, deltaY: 120, deltaMode: 0, shiftKey: false, ctrlKey: false, metaKey: false }, at, index * 16)
    if (index % 8 === 0 || index === 39) trace.push(`push ${index}: x=${camera.x.toFixed(1)} y=${camera.y.toFixed(1)}`)
  }
  const coast = motion.step(camera, 39 * 16 + 16)
  trace.push(`coast: ${coast === undefined ? "none" : `x=${coast.x.toFixed(1)} y=${coast.y.toFixed(1)}`}; next step ${motion.step(coast ?? camera, 39 * 16 + 32) === undefined ? "ended" : "running"}`)
  const right = bounds.width * camera.scale + camera.x
  const bottom = bounds.height * camera.scale + camera.y
  trace.push(`right edge ${right.toFixed(1)} of ${viewport.width}; bottom edge ${bottom.toFixed(1)} of ${viewport.height}`)
  expect(trace).toMatchInlineSnapshot(`
    [
      "push 0: x=-120.0 y=-100.0",
      "push 8: x=-600.0 y=-100.0",
      "push 16: x=-600.0 y=-100.0",
      "push 24: x=-600.0 y=-100.0",
      "push 32: x=-600.0 y=-100.0",
      "push 39: x=-600.0 y=-100.0",
      "coast: x=-600.0 y=-100.0; next step ended",
      "right edge 400.0 of 800; bottom edge 200.0 of 400",
    ]
  `)
})

it("zoom out stops at the fit scale; zoom in and in-bounds pans pass through", () => {
  const floor = fitScaleOf(bounds, viewport)
  const cases = {
    zoomedOutPastFit: clampCamera({ x: 100, y: 50, scale: 0.1, viewport }, bounds, floor),
    zoomedIn: clampCamera({ x: -300, y: -100, scale: 2, viewport }, bounds, floor),
    inBounds: clampCamera({ x: -100, y: 20, scale: 1, viewport }, bounds, floor),
    draggedFarLeft: clampCamera({ x: -5000, y: 0, scale: 1, viewport }, bounds, floor),
    draggedFarRight: clampCamera({ x: 5000, y: 0, scale: 1, viewport }, bounds, floor),
  }
  expect({ floor, cases }).toMatchInlineSnapshot(`
    {
      "cases": {
        "draggedFarLeft": {
          "scale": 1,
          "viewport": {
            "height": 400,
            "width": 800,
            "x": 0,
            "y": 0,
          },
          "x": -600,
          "y": 0,
        },
        "draggedFarRight": {
          "scale": 1,
          "viewport": {
            "height": 400,
            "width": 800,
            "x": 0,
            "y": 0,
          },
          "x": 400,
          "y": 0,
        },
        "inBounds": {
          "scale": 1,
          "viewport": {
            "height": 400,
            "width": 800,
            "x": 0,
            "y": 0,
          },
          "x": -100,
          "y": 20,
        },
        "zoomedIn": {
          "scale": 2,
          "viewport": {
            "height": 400,
            "width": 800,
            "x": 0,
            "y": 0,
          },
          "x": -300,
          "y": -100,
        },
        "zoomedOutPastFit": {
          "scale": 0.8,
          "viewport": {
            "height": 400,
            "width": 800,
            "x": 0,
            "y": 0,
          },
          "x": -400,
          "y": -40,
        },
      },
      "floor": 0.8,
    }
  `)
})
