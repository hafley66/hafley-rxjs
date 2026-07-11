// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import { StorageSignal } from "./6_Storage.js"

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
