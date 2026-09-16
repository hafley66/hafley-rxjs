import { firstValueFrom, take, toArray } from "rxjs"
import { expect, it } from "vitest"
import { metricsRealm } from "./8_metrics.js"
import { performanceReadout } from "./11_performanceReadout.js"

it("fills the readings this realm can produce from real frames", async () => {
  // Chromium: animation frames and `performance.memory` both exist, which is the whole meter.
  expect(metricsRealm()).toEqual({ frames: true, heap: true })
  const host = document.createElement("div")
  document.body.append(host)
  try {
    const widget = performanceReadout(host)
    host.append(widget.el)
    await firstValueFrom(widget.painted$.pipe(take(2), toArray()))
    expect(Number(widget.el.querySelector('[data-metric="fps"]')?.textContent)).toBeGreaterThan(0)
    // The element count comes from the mounted host, so an empty reading would be the bug.
    expect(Number(widget.el.querySelector('[data-metric="nodes"]')?.textContent)).toBeGreaterThan(0)
    expect(widget.el.textContent).not.toContain("no performance.memory")
  } finally {
    host.remove()
  }
})

it("says why a reading is unavailable in a realm that cannot produce it", () => {
  // Same page, no `performance.memory`: this is Firefox's realm, produced here by shadowing the
  // prototype getter so the readout has to report the absence instead of a zero.
  Object.defineProperty(performance, "memory", { value: undefined, configurable: true })
  try {
    expect(metricsRealm().heap).toBe(false)
    const widget = performanceReadout(document.createElement("div"))
    expect(widget.el.textContent).toContain("no performance.memory")
  } finally {
    Reflect.deleteProperty(performance, "memory")
  }
  expect(metricsRealm().heap).toBe(true)
})
