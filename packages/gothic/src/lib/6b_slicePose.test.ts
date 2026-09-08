import { expect, it } from "vitest"
import { SLICE_DEFAULTS, SLICE_SPEC } from "../kit/slice/0_spec.js"
import { slicePaths } from "./6a_slicePaths.js"
import { slicePose } from "./6b_slicePose.js"

it("seeks every reveal and easing directly and lands on an identity pose", () => {
  const stroke = slicePaths(["M-10 0L40 30"], { cut: 100, spread: 0 }).strokes[0]
  const receipt = []
  for (const reveal of SLICE_SPEC.reveal.options) for (const fease of SLICE_SPEC.fease.options) {
    const params = { ...SLICE_DEFAULTS, reveal, fease }
    const middle = slicePose(stroke, stroke.t0 + stroke.dur * 0.5, params)
    const landed = slicePose(stroke, stroke.t0 + stroke.dur + 200, params)
    expect(landed).toMatchObject({ opacity: 1, matrix: [1, 0, 0, 1, 0, 0], blade: "", width: 1, afterimage: 0 })
    expect(middle.matrix.every(Number.isFinite)).toBe(true)
    expect(slicePose(stroke, stroke.t0 - 1, params).opacity).toBe(0)
    expect(slicePose(stroke, stroke.t0 + stroke.dur * 0.5, params)).toEqual(middle)
    receipt.push({ reveal, fease, dash: middle.dash, blade: Boolean(middle.blade), translation: middle.matrix.slice(4).map(n => Math.round(n)) })
  }
  expect(receipt).toMatchSnapshot()
})
