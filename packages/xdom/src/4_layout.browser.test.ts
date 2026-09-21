import { describe, expect, it } from "vitest"
import { of } from "rxjs"
import { Signal } from "@hafley66/signals"
import { gutter, layout, type Track } from "./4_layout.js"

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

  it("scales pointer movement for a zoomed track", () => {
    const signal = Signal(900)
    const handle = document.createElement("div")
    document.body.append(handle)
    Object.assign(handle, { setPointerCapture: () => {}, releasePointerCapture: () => {} })
    const unsubscribe = gutter(handle, signal, { scale: 2 })
    handle.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 100, pointerId: 1 }))
    handle.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: 300, pointerId: 1 }))
    unsubscribe()
    handle.remove()
    expect(signal.$()).toBe(1000)
  })

  it("keeps visual zoom scaling separate from a centered width multiplier", () => {
    const signal = Signal(900)
    const handle = document.createElement("div")
    document.body.append(handle)
    Object.assign(handle, { setPointerCapture: () => {}, releasePointerCapture: () => {} })
    const unsubscribe = gutter(handle, signal, { scale: 2, multiplier: 2 })
    handle.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 100, pointerId: 3 }))
    handle.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 300, pointerId: 3 }))
    expect(handle.style.transform).toBe("translateX(100px)")
    handle.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: 300, pointerId: 3 }))
    unsubscribe()
    handle.remove()
    expect(signal.$()).toBe(1100)
  })

  it("cancels a lost pointer capture without committing a partial width", () => {
    const signal = Signal(900)
    const handle = document.createElement("div")
    document.body.append(handle)
    Object.assign(handle, { setPointerCapture: () => {}, releasePointerCapture: () => {} })
    const unsubscribe = gutter(handle, signal)
    handle.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 100, pointerId: 2 }))
    handle.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 300, pointerId: 2 }))
    handle.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: 2 }))
    unsubscribe()
    handle.remove()
    expect(signal.$()).toBe(900)
    expect(handle.classList.contains("dragging")).toBe(false)
    expect(handle.style.transform).toBe("")
  })

  it("clears a live drag when the gutter is unsubscribed", () => {
    const signal = Signal(900)
    const handle = document.createElement("div")
    document.body.append(handle)
    Object.assign(handle, { setPointerCapture: () => {}, releasePointerCapture: () => {} })
    const unsubscribe = gutter(handle, signal)
    handle.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 100, pointerId: 4 }))
    handle.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 140, pointerId: 4 }))
    unsubscribe()
    handle.remove()
    expect(handle.classList.contains("dragging")).toBe(false)
    expect(handle.style.transform).toBe("")
    expect(signal.$()).toBe(900)
  })
})
