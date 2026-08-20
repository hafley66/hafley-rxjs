import { describe, expect, it } from "vitest"
import { diff, enterAll, NO_DIFF } from "./1_diff"

describe("diff", () => {
  it("splits keep, enter, exit", () => {
    expect(diff(["a", "b", "c"], ["b", "c", "d"])).toEqual({ keep: ["b", "c"], enter: ["d"], exit: ["a"] })
  })
  it("treats a missing prev as all-enter", () => {
    expect(diff(undefined, ["x", "y"])).toEqual({ keep: [], enter: ["x", "y"], exit: [] })
    expect(diff(null, ["x"])).toEqual(enterAll(["x"]))
  })
  it("treats a missing next as all-exit", () => {
    expect(diff(["x", "y"], undefined)).toEqual({ keep: [], enter: [], exit: ["x", "y"] })
  })
  it("keeps next order for keep and enter, prev order for exit", () => {
    expect(diff(["z", "y", "x"], ["x", "q", "z"])).toEqual({ keep: ["x", "z"], enter: ["q"], exit: ["y"] })
  })
  it("accepts any iterable, including Map keys", () => {
    const prev = new Map([["a", 1]])
    const next = new Map([
      ["a", 2],
      ["b", 3],
    ])
    expect(diff(prev.keys(), next.keys())).toEqual({ keep: ["a"], enter: ["b"], exit: [] })
  })
  it("NO_DIFF is empty and frozen", () => {
    expect(NO_DIFF).toEqual({ keep: [], enter: [], exit: [] })
    expect(Object.isFrozen(NO_DIFF)).toBe(true)
  })
})
