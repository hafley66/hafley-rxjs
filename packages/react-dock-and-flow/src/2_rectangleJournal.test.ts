import { describe, expect, it } from "vitest"
import {
  type Rectangle,
  type RectangleEvent,
  type RectangleJournal,
  reduceRectangleJournal,
  replayRectangles,
} from "./2_rectangleJournal.js"

describe("rectangle event journal", () => {
  it("replays movement, undo, redo, and branching as one timeline", () => {
    const initial: Rectangle[] = [
      {
        id: "session",
        title: "Session",
        position: { x: 0, y: 0 },
        size: { width: 300, height: 200 },
        z: 1,
        content: { kind: "session", lines: ["one"] },
      },
    ]
    const events: RectangleEvent[] = [
      { type: "moved", id: "session", position: { x: 20, y: 30 } },
      { type: "raised", id: "session" },
      { type: "undo" },
      { type: "redo" },
      { type: "undo" },
      { type: "moved", id: "session", position: { x: 90, y: 100 } },
    ]
    type Step = {
      event: RectangleEvent | null
      journal: { events: RectangleEvent[]; cursor: number }
      rectangles: Rectangle[]
    }
    let journal = { events: [], cursor: 0 } as RectangleJournal
    const timeline: Step[] = [{ event: null, journal, rectangles: initial }]
    for (const event of events) {
      journal = reduceRectangleJournal(journal, event)
      timeline.push({ event, journal, rectangles: replayRectangles(initial, journal) })
    }

    expect(timeline).toMatchInlineSnapshot(`
      [
        {
          "event": null,
          "journal": {
            "cursor": 0,
            "events": [],
          },
          "rectangles": [
            {
              "content": {
                "kind": "session",
                "lines": [
                  "one",
                ],
              },
              "id": "session",
              "position": {
                "x": 0,
                "y": 0,
              },
              "size": {
                "height": 200,
                "width": 300,
              },
              "title": "Session",
              "z": 1,
            },
          ],
        },
        {
          "event": {
            "id": "session",
            "position": {
              "x": 20,
              "y": 30,
            },
            "type": "moved",
          },
          "journal": {
            "cursor": 1,
            "events": [
              {
                "id": "session",
                "position": {
                  "x": 20,
                  "y": 30,
                },
                "type": "moved",
              },
            ],
          },
          "rectangles": [
            {
              "content": {
                "kind": "session",
                "lines": [
                  "one",
                ],
              },
              "id": "session",
              "position": {
                "x": 20,
                "y": 30,
              },
              "size": {
                "height": 200,
                "width": 300,
              },
              "title": "Session",
              "z": 1,
            },
          ],
        },
        {
          "event": {
            "id": "session",
            "type": "raised",
          },
          "journal": {
            "cursor": 2,
            "events": [
              {
                "id": "session",
                "position": {
                  "x": 20,
                  "y": 30,
                },
                "type": "moved",
              },
              {
                "id": "session",
                "type": "raised",
              },
            ],
          },
          "rectangles": [
            {
              "content": {
                "kind": "session",
                "lines": [
                  "one",
                ],
              },
              "id": "session",
              "position": {
                "x": 20,
                "y": 30,
              },
              "size": {
                "height": 200,
                "width": 300,
              },
              "title": "Session",
              "z": 2,
            },
          ],
        },
        {
          "event": {
            "type": "undo",
          },
          "journal": {
            "cursor": 1,
            "events": [
              {
                "id": "session",
                "position": {
                  "x": 20,
                  "y": 30,
                },
                "type": "moved",
              },
              {
                "id": "session",
                "type": "raised",
              },
            ],
          },
          "rectangles": [
            {
              "content": {
                "kind": "session",
                "lines": [
                  "one",
                ],
              },
              "id": "session",
              "position": {
                "x": 20,
                "y": 30,
              },
              "size": {
                "height": 200,
                "width": 300,
              },
              "title": "Session",
              "z": 1,
            },
          ],
        },
        {
          "event": {
            "type": "redo",
          },
          "journal": {
            "cursor": 2,
            "events": [
              {
                "id": "session",
                "position": {
                  "x": 20,
                  "y": 30,
                },
                "type": "moved",
              },
              {
                "id": "session",
                "type": "raised",
              },
            ],
          },
          "rectangles": [
            {
              "content": {
                "kind": "session",
                "lines": [
                  "one",
                ],
              },
              "id": "session",
              "position": {
                "x": 20,
                "y": 30,
              },
              "size": {
                "height": 200,
                "width": 300,
              },
              "title": "Session",
              "z": 2,
            },
          ],
        },
        {
          "event": {
            "type": "undo",
          },
          "journal": {
            "cursor": 1,
            "events": [
              {
                "id": "session",
                "position": {
                  "x": 20,
                  "y": 30,
                },
                "type": "moved",
              },
              {
                "id": "session",
                "type": "raised",
              },
            ],
          },
          "rectangles": [
            {
              "content": {
                "kind": "session",
                "lines": [
                  "one",
                ],
              },
              "id": "session",
              "position": {
                "x": 20,
                "y": 30,
              },
              "size": {
                "height": 200,
                "width": 300,
              },
              "title": "Session",
              "z": 1,
            },
          ],
        },
        {
          "event": {
            "id": "session",
            "position": {
              "x": 90,
              "y": 100,
            },
            "type": "moved",
          },
          "journal": {
            "cursor": 2,
            "events": [
              {
                "id": "session",
                "position": {
                  "x": 20,
                  "y": 30,
                },
                "type": "moved",
              },
              {
                "id": "session",
                "position": {
                  "x": 90,
                  "y": 100,
                },
                "type": "moved",
              },
            ],
          },
          "rectangles": [
            {
              "content": {
                "kind": "session",
                "lines": [
                  "one",
                ],
              },
              "id": "session",
              "position": {
                "x": 90,
                "y": 100,
              },
              "size": {
                "height": 200,
                "width": 300,
              },
              "title": "Session",
              "z": 1,
            },
          ],
        },
      ]
    `)
  })
})
