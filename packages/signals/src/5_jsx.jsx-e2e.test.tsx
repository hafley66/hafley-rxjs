import { describe, it, expect } from "vitest"
import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { Signal } from "@hafley66/signals"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// PLAIN components — no SignalReact wrap anywhere. If the vite plugin works,
// the JSX in this file compiles through @hafley66/signals/jsx-runtime and each
// function component is auto-wrapped, so signal reads track and re-render.

describe("vite plugin jsx auto-track (e2e)", () => {
  it("a plain component re-renders on a tracked signal change", async () => {
    const sig = Signal({ v: 1 })
    let renders = 0
    function Plain() {
      renders++
      return <span>{sig.v.$()}</span>
    }

    const host = document.createElement("div")
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => { root.render(<Plain />) })
    expect(renders).toBe(1)

    await act(async () => { sig.v.$(2); await new Promise((r) => setTimeout(r, 60)) })
    expect(renders).toBe(2)
    root.unmount()
  })

  it("a plain component ignores a signal it never reads", async () => {
    const read = Signal({ v: 1 })
    const unread = Signal({ v: 99 })
    let renders = 0
    function Plain() {
      renders++
      return <span>{read.v.$()}</span>
    }

    const host = document.createElement("div")
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => { root.render(<Plain />) })
    const before = renders

    await act(async () => { unread.v.$(100); await new Promise((r) => setTimeout(r, 60)) })
    expect(renders).toBe(before)
    root.unmount()
  })

  it("nested plain components each track independently", async () => {
    const parent = Signal({ p: 1 })
    const child = Signal({ c: 1 })
    let parentRenders = 0
    let childRenders = 0

    function Child() {
      childRenders++
      return <em>{child.c.$()}</em>
    }
    function Parent() {
      parentRenders++
      return <b>{parent.p.$()}<Child /></b>
    }

    const host = document.createElement("div")
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => { root.render(<Parent />) })

    await act(async () => { child.c.$(2); await new Promise((r) => setTimeout(r, 60)) })
    expect(childRenders).toBe(2)
    expect(parentRenders).toBe(1)   // parent does not read child's signal

    await act(async () => { parent.p.$(2); await new Promise((r) => setTimeout(r, 60)) })
    expect(parentRenders).toBe(2)
    root.unmount()
  })
})
