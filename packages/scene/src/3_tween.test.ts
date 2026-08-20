import { describe, expect, it } from "vitest"
import { diff } from "./1_diff"
import { geometryOf } from "./2_geometry"
import { easeInOutCubic, linear, tween } from "./3_tween"

const from = geometryOf(
  ["a", "b"],
  new Map([
    ["a", [0, 0]],
    ["b", [10, 10]],
  ]),
)
const to = geometryOf(
  ["b", "c"],
  new Map([
    ["b", [20, 30]],
    ["c", [5, 5]],
  ]),
)
const d = diff(from.ids, to.ids)

describe("tween", () => {
  it("lerps kept ids, holds entering ids at their target, drops exits", () => {
    const mid = tween()(from, to, d, 0.5)
    expect(mid.ids).toEqual(["b", "c"])
    expect(Array.from(mid.pos)).toEqual([15, 20, 5, 5])
  })
  it("returns from at t=0 and to at t=1 for kept ids, clamping outside [0,1]", () => {
    const f = tween()
    expect(Array.from(f(from, to, d, 0).pos).slice(0, 2)).toEqual([10, 10])
    expect(Array.from(f(from, to, d, 1).pos).slice(0, 2)).toEqual([20, 30])
    expect(Array.from(f(from, to, d, 7).pos).slice(0, 2)).toEqual([20, 30])
    expect(Array.from(f(from, to, d, -1).pos).slice(0, 2)).toEqual([10, 10])
  })
  it("writes into a supplied buffer of the right length and allocates otherwise", () => {
    const out = new Float32Array(4)
    const r = tween()(from, to, d, 0.5, out)
    expect(r.pos).toBe(out)
    const wrong = new Float32Array(2)
    expect(tween()(from, to, d, 0.5, wrong).pos).not.toBe(wrong)
  })
  it("applies easing", () => {
    expect(linear(0.25)).toBe(0.25)
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
    expect(easeInOutCubic(0.5)).toBe(0.5)
    const eased = tween(easeInOutCubic)(from, to, d, 0.25)
    expect(eased.pos[0]).toBeCloseTo(10 + 10 * easeInOutCubic(0.25))
  })
  it("carries size and routes from the target", () => {
    const sized = { ...to, size: new Float32Array([1, 1, 2, 2]) }
    expect(tween()(from, sized, d, 0.5).size).toBe(sized.size)
  })
})
