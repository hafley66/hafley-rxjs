import { firstValueFrom, toArray } from "rxjs"
import { expect, it } from "vitest"
import { frameStats, metrics$, metricsRealm } from "./8_metrics.js"

it("tells a caller what the realm can measure rather than assuming a browser", () => {
  expect(metricsRealm({ requestAnimationFrame: undefined, performance: undefined })).toEqual({
    frames: false,
    heap: false,
  })
  expect(metricsRealm({ requestAnimationFrame: () => 0, cancelAnimationFrame: () => {} })).toEqual({
    frames: true,
    heap: false,
  })
  const memory = { memory: { usedJSHeapSize: 1, totalJSHeapSize: 2, jsHeapSizeLimit: 3 } }
  expect(
    metricsRealm({
      requestAnimationFrame: () => 0,
      cancelAnimationFrame: () => {},
      performance: memory as unknown as Performance,
    }),
  ).toEqual({ frames: true, heap: true })
})

it("subscribes in a realm with no animation frames without throwing and without a sample", async () => {
  // This file is the node realm: a clock, no `requestAnimationFrame`, no `performance.memory`. Both
  // streams have to end empty, because the module is imported by harnesses that are not a browser.
  expect(metricsRealm()).toEqual({ frames: false, heap: false })
  await expect(firstValueFrom(frameStats().pipe(toArray()))).resolves.toEqual([])
  await expect(firstValueFrom(metrics$(undefined).pipe(toArray()))).resolves.toEqual([])
})
