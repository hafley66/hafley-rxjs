import { describe, expect, test } from "vitest"
import type { Ticker } from "pixi.js"
import type { Viewport } from "pixi-viewport"
import { createPixiViewportLayoutScheduler } from "../src/12_stickyViewport.js"

describe("Pixi viewport layout scheduler", () => {
  test("coalesces a pointer-event-sized burst into one ticker flush", () => {
    const listeners = new Map<string, Set<() => void>>()
    const viewport = {
      on(event: string, listener: () => void) {
        const eventListeners = listeners.get(event) ?? new Set()
        eventListeners.add(listener)
        listeners.set(event, eventListeners)
      },
      off(event: string, listener: () => void) {
        listeners.get(event)?.delete(listener)
      },
    } as unknown as Viewport
    let tick = () => {}
    const ticker = {
      add(listener: () => void) {
        tick = listener
      },
      remove() {
        tick = () => {}
      },
    } as unknown as Ticker
    const scheduler = createPixiViewportLayoutScheduler({ viewport, ticker })
    let firstLayouts = 0
    let secondLayouts = 0
    scheduler.add(() => { firstLayouts += 1 })
    scheduler.add(() => { secondLayouts += 1 })

    for (let index = 0; index < 80; index += 1) {
      for (const listener of listeners.get("moved") ?? []) listener()
    }

    expect({
      beforeTick: scheduler.receipt(),
      layouts: [firstLayouts, secondLayouts],
    }).toMatchInlineSnapshot(`
      {
        "beforeTick": {
          "callbacks": 0,
          "coalescedRequests": 80,
          "flushes": 0,
          "requests": 80,
        },
        "layouts": [
          1,
          1,
        ],
      }
    `)

    tick()

    expect({
      afterTick: scheduler.receipt(),
      layouts: [firstLayouts, secondLayouts],
    }).toMatchInlineSnapshot(`
      {
        "afterTick": {
          "callbacks": 2,
          "coalescedRequests": 79,
          "flushes": 1,
          "requests": 80,
        },
        "layouts": [
          2,
          2,
        ],
      }
    `)
  })
})
