import { describe, expect, it } from "vitest"
import {
  localVirtualOffset,
  visibleVirtualRange,
  viewportCapStyle,
} from "./4a_virtualizationBoundary"

describe("virtualization extraction boundary", () => {
  it("translates parent scroll coordinates into a bounded local extent", () => {
    expect([
      localVirtualOffset(20, 100, 21_000),
      localVirtualOffset(5_140, 100, 21_000),
      localVirtualOffset(22_000, 100, 21_000),
    ]).toMatchInlineSnapshot(`
      [
        0,
        5040,
        21000,
      ]
    `)
  })

  it("calculates the visible index range without Grid or TanStack rows", () => {
    expect(visibleVirtualRange({
      count: 500,
      estimateSize: 42,
      offset: 120 * 42,
      viewportHeight: 800,
      leading: 36,
      trailing: 33,
    })).toMatchInlineSnapshot(`
      {
        "end": 137,
        "start": 120,
      }
    `)
    expect(viewportCapStyle(21_069)).toMatchInlineSnapshot(`
      {
        "height": "min(100dvh, 21069px)",
        "maxHeight": "100vh",
      }
    `)
  })
})
