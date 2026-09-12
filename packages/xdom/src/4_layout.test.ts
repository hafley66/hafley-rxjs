// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { of } from "rxjs"
import { layout, type Track } from "./4_layout.js"

const TRACKS: Track[] = [{ name: "nav", min: 100, max: 500, fallback: 300, axis: "x" }]
const memory = () => {
  const writes: string[] = []
  return {
    storage: { read: of(""), write: { next: (v: string) => writes.push(v), error() {}, complete() {} } },
    writes,
  }
}

describe("layout", () => {
  it("writes the CSS var and storage on change, and stops after unsubscribe", () => {
    const { storage, writes } = memory()
    const root = document.createElement("div")
    const shell = layout(root, TRACKS, storage)
    expect(root.style.getPropertyValue("--track-nav")).toBe("300px")

    // The test is the boundary: `run$` carries the writes and does nothing until something holds it.
    const running = shell.run$.subscribe()
    shell.tracks.nav!.$(420)
    expect(root.style.getPropertyValue("--track-nav")).toBe("420px")
    const writesBefore = writes.length

    running.unsubscribe()
    shell.tracks.nav!.$(150)
    expect(root.style.getPropertyValue("--track-nav")).toBe("420px")
    expect(writes.length).toBe(writesBefore)
  })

  it("holds the fallback on the element until something subscribes to run$", () => {
    const { storage } = memory()
    const root = document.createElement("div")
    const shell = layout(root, TRACKS, storage)
    shell.tracks.nav!.$(410)
    expect(root.style.getPropertyValue("--track-nav")).toBe("300px")
    shell.run$.subscribe().unsubscribe()
    expect(root.style.getPropertyValue("--track-nav")).toBe("410px")
  })
})
