import { describe, expect, it } from "vitest"
import { ACTIVE_WINDOW_MS, deriveStatus, isActive, statusDefinition, waitingOnPeer, type StatusFrame, type StatusInput } from "./status.js"

const NOW = 1_800_000_000_000

function input(overrides: Partial<StatusInput>): StatusInput {
  return { live: true, closedTs: null, exitStatus: "unknown", lastActivityTs: NOW, frames: [], now: NOW, ...overrides }
}

describe("isActive", () => {
  it("requires live and recent activity within the active window", () => {
    expect(isActive({ live: true, lastActivityTs: NOW, now: NOW })).toBe(true)
    expect(isActive({ live: false, lastActivityTs: NOW, now: NOW })).toBe(false)
    expect(isActive({ live: true, lastActivityTs: null, now: NOW })).toBe(false)
  })
  it("is false right past the window edge", () => {
    expect(isActive({ live: true, lastActivityTs: NOW - ACTIVE_WINDOW_MS, now: NOW })).toBe(true)
    expect(isActive({ live: true, lastActivityTs: NOW - ACTIVE_WINDOW_MS - 1, now: NOW })).toBe(false)
  })
})

describe("deriveStatus", () => {
  it("is done when closed with an ok exit", () => {
    expect(deriveStatus(input({ closedTs: NOW, exitStatus: "ok" }))).toBe("done")
  })
  it("is failed when closed with an error exit", () => {
    expect(deriveStatus(input({ closedTs: NOW, exitStatus: "error" }))).toBe("failed")
  })
  it("is unknown when closed with an unresolved exit", () => {
    expect(deriveStatus(input({ closedTs: NOW, exitStatus: "unknown" }))).toBe("unknown")
  })
  it("is idle when live but past the active window", () => {
    expect(deriveStatus(input({ lastActivityTs: NOW - ACTIVE_WINDOW_MS - 1 }))).toBe("idle")
  })
  it("is idle when live with no activity at all", () => {
    expect(deriveStatus(input({ lastActivityTs: null }))).toBe("idle")
  })
  it("is running when active and the last frame is not outbound", () => {
    expect(deriveStatus(input({ lastActivityTs: NOW - 5_000 }))).toBe("running")
    expect(deriveStatus(input({ lastActivityTs: NOW - 40 * 60_000 }))).toBe("running")
  })
  it("is waiting when active and the last frame is outbound", () => {
    const frames: StatusFrame[] = [{ t: NOW - 10 * 60_000, direction: "out", peer: "parent" }]
    expect(deriveStatus(input({ lastActivityTs: NOW - 10 * 60_000, frames }))).toBe("waiting")
  })
  it("is unknown when not live and not closed", () => {
    expect(deriveStatus(input({ live: false, lastActivityTs: NOW }))).toBe("unknown")
  })
})

describe("waitingOnPeer", () => {
  it("returns the peer of a trailing outbound frame", () => {
    const frames: StatusFrame[] = [
      { t: 1, direction: "in", peer: "a" },
      { t: 2, direction: "out", peer: "coordinator" },
    ]
    expect(waitingOnPeer(frames)).toBe("coordinator")
  })
  it("returns null when the trailing frame is inbound", () => {
    expect(waitingOnPeer([{ t: 1, direction: "in", peer: "a" }])).toBeNull()
  })
  it("returns null with no frames", () => {
    expect(waitingOnPeer([])).toBeNull()
  })
})

describe("statusDefinition", () => {
  it("has one line for every status word", () => {
    for (const word of ["running", "waiting", "idle", "done", "failed", "unknown"] as const) {
      expect(statusDefinition(word).length).toBeGreaterThan(0)
    }
  })
})
