// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import { StorageSignal, hashAdapter, historyAdapter } from "./6_Storage.js"

describe("StorageSignal", () => {
  beforeEach(() => localStorage.clear())
  it("hydrates, persists, and retains recursive Signal ergonomics", () => {
    localStorage.setItem("settings", JSON.stringify({ theme: "light", sidebar: true }))
    const settings = StorageSignal("settings", { theme: "dark", sidebar: false })
    expect(settings.theme.$()).toBe("light")
    settings.sidebar.$(false)
    expect(JSON.parse(localStorage.getItem("settings")!)).toEqual({ theme: "light", sidebar: false })
  })
})

describe("hashAdapter", () => {
  beforeEach(() => history.replaceState(null, "", "/"))

  it("reads the current hash param and writes back into location.hash", () => {
    location.hash = "#tab=b"
    const backend = hashAdapter("tab")
    let seen: string | null = null
    backend.read.subscribe(v => { seen = v })
    expect(seen).toBe("b")
    backend.write.next("c")
    expect(new URLSearchParams(location.hash.slice(1)).get("tab")).toBe("c")
  })

  it("emits on hashchange", () => {
    const backend = hashAdapter("tab")
    const seen: string[] = []
    backend.read.subscribe(v => seen.push(v))
    location.hash = "#tab=x"
    dispatchEvent(new HashChangeEvent("hashchange"))
    expect(seen).toContain("x")
  })
})

describe("historyAdapter", () => {
  beforeEach(() => history.replaceState(null, "", "/"))

  it("pushes a history entry only when the value changes", () => {
    const backend = historyAdapter("s")
    const before = history.length
    backend.write.next("a")
    expect(new URLSearchParams(location.search).get("s")).toBe("a")
    expect(history.length).toBe(before + 1)
    backend.write.next("a")
    expect(history.length).toBe(before + 1)
  })

  it("emits on popstate", () => {
    const backend = historyAdapter("s")
    const seen: string[] = []
    backend.read.subscribe(v => seen.push(v))
    history.pushState(null, "", "/?s=b")
    dispatchEvent(new PopStateEvent("popstate"))
    expect(seen).toContain("b")
  })
})
