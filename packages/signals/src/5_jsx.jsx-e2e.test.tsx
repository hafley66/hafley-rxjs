import { describe, it, expect } from "vitest"
import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { Endpoint, Signal } from "@hafley66/signals"
import { of } from "rxjs"

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

  it("starts and renders a createQuery through a tracked read", async () => {
    const endpoint = new Endpoint<{ id: string }, { name: string }>({
      request: (input) => ({ url: `/name/${input.id}`, method: "GET" }),
      decode: (response) => response.body as { name: string },
    }, () => of({ status: 200, body: { name: "Network" } }))
    const query = endpoint.createQuery({ id: "1" })

    function Plain() {
      const state = query.$()
      return <span>{state.data?.name ?? state.status}</span>
    }

    const host = document.createElement("div")
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(<Plain />)
      await new Promise((resolve) => setTimeout(resolve, 60))
    })

    expect(host.textContent).toBe("Network")
    root.unmount()
  })
})
