import { describe, expect, test } from "vitest"
import { layoutStickyStack } from "@hafley66/grapht-model"

describe("sticky stack layout", () => {
  test("places natural, stacked, and released items deterministically", () => {
    expect(layoutStickyStack({
      inset: 80,
      gap: 4,
      items: [
        { id: "nested", naturalTop: 40, boundaryBottom: 260, height: 18, order: 1 },
        { id: "future", naturalTop: 180, boundaryBottom: 400, height: 20, order: 2 },
        { id: "outer", naturalTop: 20, boundaryBottom: 300, height: 20, order: 0 },
        { id: "past", naturalTop: -100, boundaryBottom: 70, height: 20, order: 3 },
      ],
    })).toMatchInlineSnapshot(`
      [
        {
          "id": "outer",
          "slot": 80,
          "state": "stuck",
          "top": 80,
          "visible": true,
        },
        {
          "id": "nested",
          "slot": 104,
          "state": "stuck",
          "top": 104,
          "visible": true,
        },
        {
          "id": "future",
          "slot": 126,
          "state": "natural",
          "top": 180,
          "visible": true,
        },
        {
          "id": "past",
          "slot": 126,
          "state": "released",
          "top": -100,
          "visible": false,
        },
      ]
    `)
  })
})
