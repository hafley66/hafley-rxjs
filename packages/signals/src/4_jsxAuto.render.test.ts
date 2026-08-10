// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { Signal } from "./2_Signal.js"
import { SignalReact } from "./3_react.js"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const el = React.createElement
const mount = (ui: React.ReactElement) => {
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  act(() => root.render(ui))
  return { root, host, unmount: () => act(() => root.unmount()) }
}
// Flush the raf-throttled forceRender + any trailing edge.
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 60)) })

describe("SignalReact render counts + edge cases", () => {
  it("renders once on mount", () => {
    const sig = Signal({ v: 1 })
    let renders = 0
    const C = SignalReact(() => { renders++; return el("span", null, sig.v.$()) })
    mount(el(C))
    expect(renders).toBe(1)
  })

  it("one signal change => exactly one extra render", async () => {
    const sig = Signal({ v: 1 })
    let renders = 0
    const C = SignalReact(() => { renders++; return el("span", null, sig.v.$()) })
    mount(el(C))
    expect(renders).toBe(1)
    await act(async () => { sig.v.$(2); await new Promise(r => setTimeout(r, 60)) })
    expect(renders).toBe(2)
    await act(async () => { sig.v.$(3); await new Promise(r => setTimeout(r, 60)) })
    expect(renders).toBe(3)
  })

  it("changing an unread signal => no extra render", async () => {
    const a = Signal({ v: 1 })
    const b = Signal({ v: 99 })
    let renders = 0
    const C = SignalReact(() => { renders++; return el("span", null, a.v.$()) })
    mount(el(C))
    await act(async () => { b.v.$(100); await new Promise(r => setTimeout(r, 60)) })
    expect(renders).toBe(1)
  })

  it("render count stays bounded after settling (no feedback loop)", async () => {
    const sig = Signal({ v: 1 })
    let renders = 0
    const C = SignalReact(() => { renders++; return el("span", null, sig.v.$()) })
    mount(el(C))
    await act(async () => { sig.v.$(2); await new Promise(r => setTimeout(r, 60)) })
    await act(async () => { await new Promise(r => setTimeout(r, 60)) })
    expect(renders).toBeLessThanOrEqual(3)
  })

  it("unmount: later writes do not render", async () => {
    const sig = Signal({ v: 1 })
    let renders = 0
    const C = SignalReact(() => { renders++; return el("span", null, sig.v.$()) })
    const { unmount } = mount(el(C))
    const before = renders
    unmount()
    await act(async () => { sig.v.$(2); await new Promise(r => setTimeout(r, 60)) })
    expect(renders).toBe(before)
  })

  it("conditional: dropping a read stops tracking that signal", async () => {
    const show = Signal({ on: true })
    const data = Signal({ x: "a" })
    let renders = 0
    const C = SignalReact(() => {
      renders++
      return el("span", null, show.on.$() ? data.x.$() : "off")
    })
    mount(el(C))
    await act(async () => { show.on.$(false); await new Promise(r => setTimeout(r, 60)) })
    const atOff = renders
    await act(async () => { data.x.$("b"); await new Promise(r => setTimeout(r, 60)) })
    expect(renders).toBe(atOff)
  })
})
