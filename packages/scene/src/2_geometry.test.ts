import { describe, expect, it } from "vitest"
import { boundsOf, geometryOf, indexOf, pointOf } from "./2_geometry"

const g = geometryOf(
  ["a", "b", "c"],
  new Map([
    ["a", [1, 2]],
    ["b", [-3, 4]],
  ]),
)

describe("geometry", () => {
  it("lays points out as x,y pairs in id order; missing ids sit at the origin", () => {
    expect(Array.from(g.pos)).toEqual([1, 2, -3, 4, 0, 0])
  })
  it("indexOf maps id to slot", () => {
    expect(Object.fromEntries(indexOf(g))).toEqual({ a: 0, b: 1, c: 2 })
  })
  it("pointOf reads through the index", () => {
    expect(pointOf(g, "b")).toEqual([-3, 4])
    expect(pointOf(g, "nope")).toBeUndefined()
  })
  it("boundsOf covers all points and handles empty", () => {
    expect(boundsOf(g)).toEqual([-3, 0, 1, 4])
    expect(boundsOf(geometryOf([], new Map()))).toEqual([0, 0, 0, 0])
  })
})
