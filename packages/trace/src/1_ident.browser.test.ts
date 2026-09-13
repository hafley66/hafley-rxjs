import { describe, expect, it } from "vitest"
import { firstValueFrom } from "rxjs"
import { ident, key, resetIdent, runtimeOf } from "./1_ident.js"
import { workerName } from "./6_spawn.js"
import { lag$, lagKinds } from "./4_lag.js"
import { ATTR, resource } from "./2_resource.js"

const TAB_KEY = "hafley.trace.tab"

describe("ident in a browser", () => {
  it("mints a tab id and keeps it for the life of the tab", () => {
    resetIdent()
    sessionStorage.removeItem(TAB_KEY)
    const first = ident({ service: "grid" })
    expect(runtimeOf()).toBe("browser")
    expect(first.pid).toMatch(/^[0-9a-f-]{8}$/)
    expect(ident({ service: "grid" }).pid).toBe(first.pid)
    expect(sessionStorage.getItem(TAB_KEY)).toBe(first.pid)
  })

  it("treats an inherited sessionStorage as the parent's, which is what a popup and a frame read", () => {
    // vitest drives the suite inside a frame, so `top !== self` here for the same reason a
    // `window.open` copy does: the id already in storage belongs to whoever opened this document.
    resetIdent()
    sessionStorage.setItem(TAB_KEY, "parent99")
    sessionStorage.setItem("hafley.trace.born", "1700000000123")
    const child = ident({ service: "grid" })
    expect(window.top === window.self).toBe(false)
    expect(child.pid).not.toBe("parent99")
    expect(child.parent).toBe("parent99")
    expect(child.parentBorn).toBe(1700000000123)
    expect(ident({ service: "grid" }).pid).toBe(child.pid)
  })

  it("prints a prefix that names the runtime", () => {
    expect(ident({ service: "grid" }).prefix.startsWith("grid/browser:")).toBe(true)
  })

  it("maps to the browser runtime attribute", () => {
    expect(resource(ident({ service: "grid" }))[ATTR.processRuntimeName]).toBe("browser")
  })
})

describe("a worker", () => {
  it("reads its parent and its service off the one channel it has before its first message", async () => {
    const host = ident({ service: "host", pid: "0bfcc223" })
    const code = `
      const hit = /^hafley:([^:]*):([^:]*)$/.exec(self.name)
      const held = hit === null ? null : hit[1]
      const at = held === null ? -1 : held.indexOf("@")
      self.postMessage({
        name: self.name,
        parent: held === null ? null : at === -1 ? held : held.slice(0, at),
        parentBorn: held === null ? null : at === -1 ? null : Number(held.slice(at + 1)),
        service: hit === null ? null : hit[2],
        sessionStorage: typeof sessionStorage !== "undefined",
      })`
    const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }))
    const worker = new Worker(url, { name: workerName(host, "sorter"), type: "module" })
    const got = await new Promise<Record<string, unknown>>((resolve) => {
      worker.onmessage = (event: MessageEvent) => resolve(event.data as Record<string, unknown>)
    })
    worker.terminate()
    URL.revokeObjectURL(url)
    expect(got["name"]).toBe(`hafley:${key(host)}:sorter`)
    expect(got["parent"]).toBe("0bfcc223")
    expect(got["parentBorn"]).toBe(Math.round(host.born))
    expect(got["service"]).toBe("sorter")
    // The reason the name is the channel at all: a worker has no storage to read an id out of.
    expect(got["sessionStorage"]).toBe(false)
  })
})

describe("lag", () => {
  it("offers the frame clock in a browser", () => {
    expect(lagKinds()).toEqual(["raf", "timeout"])
  })

  it("reports a window of frame gaps with the long-frame split", async () => {
    const sample = await firstValueFrom(lag$("raf", 300))
    expect(sample.kind).toBe("raf")
    expect(sample.samples).toBeGreaterThan(4)
    expect(sample.p50).toBeGreaterThan(0)
    expect(sample.worst).toBeGreaterThanOrEqual(sample.p50)
    expect(sample.heapBytes).toBeGreaterThan(0)
  })

  it("reports timeout drift too, which is the only clock a worker has", async () => {
    const sample = await firstValueFrom(lag$("timeout", 300, 16))
    expect(sample.kind).toBe("timeout")
    expect(sample.expectedMs).toBe(16)
    expect(sample.samples).toBeGreaterThan(4)
    expect(sample.p50).toBeGreaterThanOrEqual(16)
  })

  it("schedules nothing until something subscribes", async () => {
    let ticks = 0
    const raw = globalThis.setTimeout
    ;(globalThis as { setTimeout: typeof setTimeout }).setTimeout = ((fn: () => void, ms?: number) => {
      ticks += 1
      return raw(fn, ms)
    }) as typeof setTimeout
    const cold = lag$("timeout", 200, 16)
    expect(ticks).toBe(0)
    const sub = cold.subscribe()
    await new Promise((r) => raw(r, 60))
    sub.unsubscribe()
    const after = ticks
    await new Promise((r) => raw(r, 60))
    expect(ticks).toBe(after)
    ;(globalThis as { setTimeout: typeof setTimeout }).setTimeout = raw
    expect(after).toBeGreaterThan(0)
  })
})
