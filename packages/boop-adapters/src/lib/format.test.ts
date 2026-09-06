import { describe, expect, it } from "vitest"
import { formatTokens, lastPathSegment, shortId } from "./format.js"

describe("formatTokens", () => {
  it("adds thousands separators", () => {
    expect(formatTokens(0)).toBe("0")
    expect(formatTokens(999)).toBe("999")
    expect(formatTokens(1000)).toBe("1,000")
    expect(formatTokens(1234567)).toBe("1,234,567")
  })
})

describe("lastPathSegment", () => {
  it("returns the final path component", () => {
    expect(lastPathSegment("/Users/chrishafley/projects/sprefa")).toBe("sprefa")
    expect(lastPathSegment("/Users/chrishafley/projects/sprefa/")).toBe("sprefa")
  })
  it("returns empty string for null or empty input", () => {
    expect(lastPathSegment(null)).toBe("")
    expect(lastPathSegment("")).toBe("")
  })
})

describe("shortId", () => {
  it("shortens a long hex-looking id", () => {
    expect(shortId("955b1208-a76f-4608-a04f-7b75049276ba")).toBe("955b1208…")
  })
  it("passes short or non-hex names through", () => {
    expect(shortId("main")).toBe("main")
    expect(shortId("nickname-here")).toBe("nickname-here")
  })
})
