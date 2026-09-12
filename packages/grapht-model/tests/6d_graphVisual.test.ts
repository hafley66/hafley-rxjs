import { expect, it } from "vitest"
import { graphVisualsOf } from "../src/index.js"

it("groups SVG parts and ports by canonical graph identity", () => {
  expect(graphVisualsOf(
    [
      { elementId: "label", graphId: "actor", role: "actor-label", ordinal: 0 },
      { elementId: "line", graphId: "actor", role: "lifeline", ordinal: 0 },
      { elementId: "shape", graphId: "actor", role: "actor-shape", ordinal: 0 },
    ],
    [{ id: "actor:message-source", ownerId: "actor", location: { kind: "side", side: "bottom", offset: { unit: "ratio", value: 0.5 } } }],
  )).toMatchInlineSnapshot(`
    [
      {
        "graphId": "actor",
        "id": "actor:visual",
        "parts": [
          {
            "elementId": "label",
            "ordinal": 0,
            "role": "actor-label",
          },
          {
            "elementId": "shape",
            "ordinal": 0,
            "role": "actor-shape",
          },
          {
            "elementId": "line",
            "ordinal": 0,
            "role": "lifeline",
          },
        ],
        "ports": [
          {
            "id": "actor:message-source",
            "location": {
              "kind": "side",
              "offset": {
                "unit": "ratio",
                "value": 0.5,
              },
              "side": "bottom",
            },
            "ownerId": "actor",
          },
        ],
      },
    ]
  `)
})
