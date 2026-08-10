import { describe, it, expect } from "vitest"
import { Fragment } from "react"
import { track } from "./4_jsxAuto.js"

const Comp = (_props: { x: number }) => null

describe("jsx auto track", () => {
  it("passes non-function types through unchanged", () => {
    expect(track(Fragment)).toBe(Fragment)
    expect(track("div")).toBe("div")
  })

  it("wraps a function component and caches the wrapper", () => {
    const a = track(Comp)
    const b = track(Comp)
    expect(typeof a).toBe("function")
    expect(a).not.toBe(Comp)
    expect(a).toBe(b)
  })
})
