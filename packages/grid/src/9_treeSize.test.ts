import { describe, expect, it } from "vitest"
import { hasWidthSignal, anyWidthSignal } from "./9_treeSize"

describe("hasWidthSignal", () => {
  it("is false when neither a drag nor an authored size exists", () => {
    expect(hasWidthSignal("name", {}, undefined)).toBe(false)
  })

  it("is true when the column has been dragged", () => {
    expect(hasWidthSignal("name", { name: 220 }, undefined)).toBe(true)
  })

  it("is true when the column authored an explicit size, even with no drag", () => {
    expect(hasWidthSignal("name", {}, 180)).toBe(true)
  })

  it("prefers the drag signal but is true either way", () => {
    expect(hasWidthSignal("name", { name: 300 }, 180)).toBe(true)
  })
})

describe("anyWidthSignal", () => {
  it("is false when no column in the set carries a signal", () => {
    expect(anyWidthSignal(["a", "b"], {}, { a: undefined, b: undefined })).toBe(false)
  })

  it("is true when one column was dragged", () => {
    expect(anyWidthSignal(["a", "b"], { b: 100 }, { a: undefined, b: undefined })).toBe(true)
  })

  it("is true when one column authored an explicit size", () => {
    expect(anyWidthSignal(["a", "b"], {}, { a: 140, b: undefined })).toBe(true)
  })

  it("is false for an empty column set", () => {
    expect(anyWidthSignal([], {}, {})).toBe(false)
  })
})
