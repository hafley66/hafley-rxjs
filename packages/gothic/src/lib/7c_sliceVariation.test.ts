import { expect, it } from "vitest"
import { SLICE_DEFAULTS, SLICE_SPEC } from "../kit/slice/0_spec.js"
import { slicePaths } from "./6a_slicePaths.js"
import { slicePose } from "./6b_slicePose.js"
import { defaultVariation, type StrokeMotionFrame } from "./7a_variation.js"
import { variedSlicePose } from "./7c_sliceVariation.js"

it("preserves every original pose without variation and independently samples stroke weights and afterimages", () => {
  const strokes = slicePaths(["M-80 0H80", "M0 -80V80"], { spread: 0, cut: 40 }).strokes
  for (const stroke of strokes) for (const time of [0, 50, 100, 160, 200, 300]) {
    const { bladeWidth, afterimageWidth, afterimagePath, ...pose } = variedSlicePose(stroke, time, SLICE_DEFAULTS)
    expect(pose).toEqual(slicePose(stroke, time, SLICE_DEFAULTS))
  }
  const motion: StrokeMotionFrame = { time: 1700, fields: Object.fromEntries(["weight", "finalWeight", "aiFade", "aiOpacity", "ailen"].map(name =>
    [name, { ...defaultVariation(SLICE_SPEC[name as keyof typeof SLICE_SPEC], SLICE_DEFAULTS[name as keyof typeof SLICE_DEFAULTS]), scope: "stroke" }])) }
  const poses = strokes.map(s => variedSlicePose(s, s.t0 + s.dur + 60, SLICE_DEFAULTS, motion))
  expect(new Set(poses.map(p => p.width)).size).toBeGreaterThan(1)
  expect(new Set(poses.map(p => p.afterimage)).size).toBeGreaterThan(1)
  expect(poses.map(p => [p.width, p.afterimage, p.afterimageWidth, p.afterimagePath])).toMatchSnapshot()
  expect(strokes.map(s => variedSlicePose(s, s.t0 + s.dur + 60, SLICE_DEFAULTS, motion))).toEqual(poses)
  expect(variedSlicePose(strokes[0], 500, { ...SLICE_DEFAULTS, aiFade: 1000 }).afterimage).toBeGreaterThan(0)
})
