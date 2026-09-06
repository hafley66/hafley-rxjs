import { describe, expect, it } from "vitest"
import { countHeader, matchesWindow, partitionWindow, sortByRecencyDesc, type WindowActivity } from "./window.js"
import { ACTIVE_WINDOW_MS } from "./status.js"

const NOW = 1_800_000_000_000
const HOUR = 60 * 60_000

function row(overrides: Partial<WindowActivity>): WindowActivity {
  return { live: false, lastActivityTs: NOW, openedTs: NOW, ...overrides }
}

describe("matchesWindow", () => {
  it("active keeps only live rows inside the active window", () => {
    expect(matchesWindow(row({ live: true, lastActivityTs: NOW }), "active", NOW)).toBe(true)
    expect(matchesWindow(row({ live: true, lastActivityTs: NOW - ACTIVE_WINDOW_MS - 1 }), "active", NOW)).toBe(false)
    expect(matchesWindow(row({ live: false, lastActivityTs: NOW }), "active", NOW)).toBe(false)
  })
  it("live keeps only live rows regardless of activity age", () => {
    expect(matchesWindow(row({ live: true, lastActivityTs: NOW - 10 * HOUR }), "live", NOW)).toBe(true)
    expect(matchesWindow(row({ live: false }), "live", NOW)).toBe(false)
  })
  it("today keeps rows within 24h regardless of live", () => {
    expect(matchesWindow(row({ lastActivityTs: NOW - 23 * HOUR }), "today", NOW)).toBe(true)
    expect(matchesWindow(row({ lastActivityTs: NOW - 25 * HOUR }), "today", NOW)).toBe(false)
  })
  it("7d keeps rows within a week", () => {
    expect(matchesWindow(row({ lastActivityTs: NOW - 6 * 24 * HOUR }), "7d", NOW)).toBe(true)
    expect(matchesWindow(row({ lastActivityTs: NOW - 8 * 24 * HOUR }), "7d", NOW)).toBe(false)
  })
  it("all keeps everything", () => {
    expect(matchesWindow(row({ lastActivityTs: null, openedTs: null }), "all", NOW)).toBe(true)
  })
})

describe("countHeader", () => {
  it("counts active/live/today as overlapping, not partitioned", () => {
    const rows: WindowActivity[] = [
      row({ live: true, lastActivityTs: NOW }),
      row({ live: false, lastActivityTs: NOW - 2 * HOUR }),
      row({ live: false, lastActivityTs: NOW - 10 * 24 * HOUR }),
    ]
    expect(countHeader(rows, NOW)).toEqual({ active: 1, live: 1, today: 2, total: 3 })
  })
})

describe("sortByRecencyDesc", () => {
  it("orders newest activity first and pushes nulls last", () => {
    const rows: WindowActivity[] = [
      row({ lastActivityTs: NOW - 10_000, openedTs: null }),
      row({ lastActivityTs: null, openedTs: null }),
      row({ lastActivityTs: NOW, openedTs: null }),
    ]
    expect(sortByRecencyDesc(rows).map((r) => r.lastActivityTs)).toEqual([NOW, NOW - 10_000, null])
  })
})

describe("partitionWindow", () => {
  it("splits within-window rows from older ones", () => {
    const rows: WindowActivity[] = [row({ lastActivityTs: NOW - 2 * HOUR }), row({ lastActivityTs: NOW - 10 * 24 * HOUR })]
    const { within, older } = partitionWindow(rows, "today", NOW)
    expect(within.length).toBe(1)
    expect(older.length).toBe(1)
  })
  it("all window puts everything within", () => {
    const rows: WindowActivity[] = [row({ lastActivityTs: NOW - 30 * 24 * HOUR })]
    expect(partitionWindow(rows, "all", NOW).older.length).toBe(0)
  })
})
