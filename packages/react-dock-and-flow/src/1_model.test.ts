import { describe, expect, it } from "vitest"
import { createDockAndFlowModel, reduceDockFlow } from "./1_model.js"

describe("react-dock-and-flow state", () => {
  it("records the before, event, and after states", () => {
    const model = createDockAndFlowModel(2)
    const before = model.state.$()
    const event = { type: "panel-value-changed", panelId: "panel-1", value: "retained" } as const
    const after = reduceDockFlow(before, event)

    expect({ before, event, after }).toMatchInlineSnapshot(`
      {
        "after": {
          "dockPanels": 0,
          "eventCount": 1,
          "lastEvent": "panel-value-changed",
          "nodes": [
            {
              "data": {
                "panelId": "panel-0",
                "title": "Panel 1",
              },
              "id": "panel-0",
              "position": {
                "x": 0,
                "y": 0,
              },
              "type": "dockFlowPanel",
            },
            {
              "data": {
                "panelId": "panel-1",
                "title": "Panel 2",
              },
              "id": "panel-1",
              "position": {
                "x": 280,
                "y": 0,
              },
              "type": "dockFlowPanel",
            },
          ],
          "requestedNodes": 2,
          "values": {
            "panel-1": "retained",
          },
        },
        "before": {
          "dockPanels": 0,
          "eventCount": 0,
          "lastEvent": "initial",
          "nodes": [
            {
              "data": {
                "panelId": "panel-0",
                "title": "Panel 1",
              },
              "id": "panel-0",
              "position": {
                "x": 0,
                "y": 0,
              },
              "type": "dockFlowPanel",
            },
            {
              "data": {
                "panelId": "panel-1",
                "title": "Panel 2",
              },
              "id": "panel-1",
              "position": {
                "x": 280,
                "y": 0,
              },
              "type": "dockFlowPanel",
            },
          ],
          "requestedNodes": 2,
          "values": {},
        },
        "event": {
          "panelId": "panel-1",
          "type": "panel-value-changed",
          "value": "retained",
        },
      }
    `)
    model.dispose()
  })
})
