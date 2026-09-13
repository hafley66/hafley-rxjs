import { expect, it, vi } from "vitest"
import { frameStats, heapEstimate, performanceReadout } from "../../../docs-kit/src/3a_performanceReadout.ts"

it("keeps the signal-grid rolling frame statistics and cancels its pending frame", () => {
  const callbacks = new Map<number, FrameRequestCallback>()
  let id = 0
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callbacks.set(++id, callback); return id })
  vi.stubGlobal("cancelAnimationFrame", (key: number) => callbacks.delete(key))
  const values: unknown[] = []
  const clock = vi.spyOn(performance, "now").mockReturnValue(0)
  let now = 0
  const subscription = frameStats().subscribe(value => values.push({ fps: Math.round(value.fps), worst: Math.round(value.worst), slow: value.slow }))
  try {
    for (const gap of [10, 20, 40]) {
      now += gap
      const callback = callbacks.get(id)!
      callbacks.delete(id)
      callback(now)
    }
    expect(values).toMatchInlineSnapshot(`
      [
        {
          "fps": 100,
          "slow": 0,
          "worst": 10,
        },
        {
          "fps": 67,
          "slow": 0,
          "worst": 20,
        },
        {
          "fps": 43,
          "slow": 1,
          "worst": 40,
        },
      ]
    `)
  } finally {
    subscription.unsubscribe()
    expect(callbacks.size).toBe(0)
    clock.mockRestore()
    vi.unstubAllGlobals()
  }
})

it("distinguishes absent heap readings from measured zero and mounts without starting a loop", () => {
  const estimates = [{}, { memory: { usedJSHeapSize: 0, totalJSHeapSize: 20, jsHeapSizeLimit: 100 } }, { memory: { usedJSHeapSize: 50, totalJSHeapSize: 60, jsHeapSizeLimit: 100 } }, { memory: { usedJSHeapSize: NaN, totalJSHeapSize: 60, jsHeapSizeLimit: 100 } }]
  expect(estimates.map(value => heapEstimate(value as Performance))).toMatchInlineSnapshot(`
    [
      undefined,
      {
        "jsHeapSizeLimit": 100,
        "totalJSHeapSize": 20,
        "usedJSHeapSize": 0,
      },
      {
        "jsHeapSizeLimit": 100,
        "totalJSHeapSize": 60,
        "usedJSHeapSize": 50,
      },
      undefined,
    ]
  `)
  const request = vi.spyOn(window, "requestAnimationFrame")
  const widget = performanceReadout(document.createElement("div"))
  expect(widget.el.querySelector('[data-metric="used"]')?.textContent).toBe("unavailable")
  expect(request).not.toHaveBeenCalled()
  request.mockRestore()
})
