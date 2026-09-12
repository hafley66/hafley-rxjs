import { Subject } from "rxjs"
import { describe, expect, test } from "vitest"
import type { GraphFrame } from "../../src/index.js"
import { graphRenderer } from "../../src/index.js"

function frame(ids: readonly string[]): GraphFrame {
  return {
    graph: Object.fromEntries(ids.map(id => [id, { id, type: "node" as const }])),
    geometry: {
      revisionId: "geometry",
      boundsById: {},
      endpointAnchorById: {},
      routesById: {},
      headerBoundsById: {},
    },
    camera: { x: 0, y: 0, scale: 1, viewport: { x: 0, y: 0, width: 1, height: 1 } },
    presentation: {
      stickyHeaders: [],
      hiddenIds: new Set(),
      focusedIds: new Set(),
      labelsById: {},
      sealedSvgArtifactsByRootId: {},
    },
  }
}

describe("graphRenderer", () => {
  test("owns one keyed resource lifetime per subscription", () => {
    const frames$ = new Subject<GraphFrame>()
    const receipts: unknown[] = []
    const events: string[] = []
    const renderer = graphRenderer(() => ({
      render: (_frame, receipt) => receipts.push(receipt),
      unsubscribe: () => events.push("unsubscribe"),
    }))

    const subscription = frames$.pipe(renderer({} as HTMLElement)).subscribe()
    frames$.next(frame(["a", "b"]))
    frames$.next(frame(["b", "c"]))
    subscription.unsubscribe()

    expect({ receipts, events }).toMatchInlineSnapshot(`
      {
        "events": [
          "unsubscribe",
        ],
        "receipts": [
          {
            "enterIds": [
              "a",
              "b",
            ],
            "exitIds": [],
            "updateIds": [],
          },
          {
            "enterIds": [
              "c",
            ],
            "exitIds": [
              "a",
            ],
            "updateIds": [
              "b",
            ],
          },
        ],
      }
    `)
  })
})
