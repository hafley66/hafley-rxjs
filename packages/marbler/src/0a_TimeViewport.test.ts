import { describe, expect, it } from "vitest"
import { createTimeViewport, densityBuckets, eventRange, reduceTimeViewport } from "./0a_TimeViewport"

describe("time viewport", () => {
  it("reduces cursor zoom, pan, brush, and follow deterministically", () => {
    const initial = createTimeViewport([0, 1000])
    const zoomed = reduceTimeViewport(initial, { type: "zoom", anchorPx: 250, factor: 0.5, widthPx: 1000 })
    const panned = reduceTimeViewport(zoomed, { type: "pan", deltaPx: -100, widthPx: 1000 })
    const brushed = reduceTimeViewport(panned, { type: "brush", range: [900, 1200] })
    const followed = reduceTimeViewport(brushed, { type: "follow", enabled: true })
    expect({ initial, zoomed, panned, brushed, followed }).toMatchInlineSnapshot(`
      {
        "brushed": {
          "followLive": false,
          "full": [
            0,
            1000,
          ],
          "visible": [
            700,
            1000,
          ],
        },
        "followed": {
          "followLive": true,
          "full": [
            0,
            1000,
          ],
          "visible": [
            700,
            1000,
          ],
        },
        "initial": {
          "followLive": true,
          "full": [
            0,
            1000,
          ],
          "visible": [
            0,
            1000,
          ],
        },
        "panned": {
          "followLive": false,
          "full": [
            0,
            1000,
          ],
          "visible": [
            175,
            675,
          ],
        },
        "zoomed": {
          "followLive": false,
          "full": [
            0,
            1000,
          ],
          "visible": [
            125,
            625,
          ],
        },
      }
    `)
  })

  it("bins marks into fixed storage", () => {
    expect([...densityBuckets([
      { id: "a", kind: "dot", time: 0 },
      { id: "b", kind: "span", start: 24, end: 27 },
      { id: "c", kind: "dot", time: 99 },
    ], [0, 100], 4)]).toMatchInlineSnapshot(`
      [
        2,
        0,
        0,
        1,
      ]
    `)
  })

  it("ignores events without timing instead of assigning a timestamp", () => {
    expect(eventRange([
      { start: null, duration: null },
      { start: 20, duration: 5 },
    ])).toMatchInlineSnapshot(`
      [
        20,
        25,
      ]
    `)
    expect(eventRange([{ start: null, duration: null }])).toMatchInlineSnapshot(`
      [
        0,
        1,
      ]
    `)
  })
})
