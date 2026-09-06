import { describe, expect, it } from "vitest"
import { formatAge, formatDuration } from "./time.js"

const NOW = 1_800_000_000_000

describe("formatAge", () => {
  it("formats seconds", () => {
    expect(formatAge(NOW - 14_000, NOW)).toBe("14s ago")
  })
  it("formats minutes", () => {
    expect(formatAge(NOW - 125_000, NOW)).toBe("2m ago")
  })
  it("formats hours and minutes", () => {
    expect(formatAge(NOW - (60 * 60_000 + 4 * 60_000), NOW)).toBe("1h 4m ago")
  })
  it("drops zero minutes on the hour boundary", () => {
    expect(formatAge(NOW - 2 * 60 * 60_000, NOW)).toBe("2h ago")
  })
  it("formats days", () => {
    expect(formatAge(NOW - 3 * 24 * 60 * 60_000, NOW)).toBe("3d ago")
  })
  it("clamps a future timestamp to zero", () => {
    expect(formatAge(NOW + 5_000, NOW)).toBe("0s ago")
  })
})

describe("formatDuration", () => {
  it("formats seconds", () => {
    expect(formatDuration(14_000)).toBe("14s")
  })
  it("formats minutes and seconds", () => {
    expect(formatDuration(130_000)).toBe("2m 10s")
  })
  it("drops zero seconds", () => {
    expect(formatDuration(120_000)).toBe("2m")
  })
  it("formats hours and minutes without seconds", () => {
    expect(formatDuration(60 * 60_000 + 4 * 60_000)).toBe("1h 4m")
  })
  it("drops zero minutes on the hour boundary", () => {
    expect(formatDuration(2 * 60 * 60_000)).toBe("2h")
  })
})
