import { beforeEach, describe, expect, it, vi } from "vitest"
import { Observable } from "rxjs"
import { StorageSignal, hashAdapter, historyAdapter, storageSignal, urlAdapter, type Storage } from "./6_Storage.js"

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

describe("adapter listener lifetime", () => {
  it("urlAdapter removes its popstate listener when the read subscription ends", () => {
    const added = vi.spyOn(window, "addEventListener")
    const removed = vi.spyOn(window, "removeEventListener")
    const sub = urlAdapter("q").read.subscribe()
    const popstateAdds = added.mock.calls.filter(([name]) => name === "popstate").length
    expect(popstateAdds).toBe(1)
    sub.unsubscribe()
    expect(removed.mock.calls.filter(([name]) => name === "popstate").length).toBe(1)
    added.mockRestore()
    removed.mockRestore()
  })
})

describe("storageSignal teardown", () => {
  it("close releases the backend subscriptions, so a window listener does not outlive the signal", () => {
    let reads = 0
    let disposed = 0
    const backend: Storage<string> = {
      read: new Observable<string>((subscriber) => {
        reads++
        subscriber.next("1")
        return () => {
          disposed++
        }
      }),
      write: { next() {}, error() {}, complete() {} },
    }

    const signal = storageSignal<string>(backend, "0")
    // One subscription seeds and unsubscribes, one stays live to track changes.
    expect(reads).toBe(2)
    expect(disposed).toBe(1)

    signal.close()
    expect(disposed).toBe(2)
  })

  it("a closed signal still reads and writes its own value", () => {
    const backend: Storage<string> = {
      read: new Observable<string>((subscriber) => subscriber.next("1")),
      write: { next() {}, error() {}, complete() {} },
    }
    const signal = storageSignal<string>(backend, "0")
    signal.close()
    signal.$("7")
    expect(signal.$()).toBe("7")
  })
})
