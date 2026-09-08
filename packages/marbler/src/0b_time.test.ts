import { describe, expect, it } from "vitest"
import { formatDuration } from "./0b_time.js"

describe("formatDuration", () => {
  it("reads exact zero as 0ms", () => {
    expect(formatDuration(0)).toBe("0ms")
  })

  it("keeps two decimals for a sub-millisecond span that still happened", () => {
    expect(formatDuration(0.187011718)).toBe("0.19ms")
    expect(formatDuration(0.4)).toBe("0.40ms")
  })

  it("rounds whole milliseconds under a second", () => {
    expect(formatDuration(14)).toBe("14ms")
    expect(formatDuration(999)).toBe("999ms")
  })

  it("carries one decimal of seconds under ten seconds", () => {
    expect(formatDuration(1200)).toBe("1.2s")
    expect(formatDuration(9999)).toBe("10.0s")
  })

  it("drops the decimal from ten seconds to a minute", () => {
    expect(formatDuration(14000)).toBe("14s")
    expect(formatDuration(59000)).toBe("59s")
  })

  it("pairs minutes with seconds under an hour", () => {
    expect(formatDuration(130000)).toBe("2m 10s")
    expect(formatDuration(60000)).toBe("1m 0s")
  })

  it("carries a rounded-up minor unit into the major unit", () => {
    expect(formatDuration(119999)).toBe("2m 0s")
  })

  it("pairs hours with minutes under a day", () => {
    expect(formatDuration(3_840_000)).toBe("1h 4m")
  })

  it("pairs days with hours above a day", () => {
    expect(formatDuration(183_600_000)).toBe("2d 3h")
    expect(formatDuration(384_796_875)).toBe("4d 11h")
  })

  it("floors a negative span at zero", () => {
    expect(formatDuration(-50)).toBe("0ms")
  })
})
