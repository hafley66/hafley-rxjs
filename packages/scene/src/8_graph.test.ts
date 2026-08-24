import { describe, expect, test } from "vitest"
import type { GraphFrame, GraphInteraction, GraphStyle } from "./8_graph.js"
import { EMPTY_GRAPH_VIEW } from "./8_graph.js"

describe("common graph renderer contract", () => {
  test("represents the shared Cytoscape and Pixi surface", () => {
    const style = {
      node: { shape: "round-rectangle", fill: "#203555", stroke: "#57a5ff", strokeWidth: 3, opacity: 1 },
      edge: { color: "#78879d", width: 2, line: "dashed", opacity: 0.8, directed: true },
    } satisfies GraphStyle
    const interactions = [
      { type: "node-hover", id: "client" },
      { type: "node-select", id: "api", additive: false },
      { type: "node-move", id: "database", x: 810, y: 55 },
      { type: "viewport-change", viewport: { x: 12, y: -8, zoom: 1.5 } },
    ] satisfies GraphInteraction[]
    const frameKeys = {
      scene: true,
      geometry: true,
      diff: true,
      view: true,
      style: true,
    } satisfies Record<keyof GraphFrame, true>

    expect({ EMPTY_GRAPH_VIEW, frameKeys, interactions, style }).toMatchInlineSnapshot(`
      {
        "EMPTY_GRAPH_VIEW": {
          "selected": Set {},
          "viewport": {
            "x": 0,
            "y": 0,
            "zoom": 1,
          },
          "visible": Set {},
        },
        "frameKeys": {
          "diff": true,
          "geometry": true,
          "scene": true,
          "style": true,
          "view": true,
        },
        "interactions": [
          {
            "id": "client",
            "type": "node-hover",
          },
          {
            "additive": false,
            "id": "api",
            "type": "node-select",
          },
          {
            "id": "database",
            "type": "node-move",
            "x": 810,
            "y": 55,
          },
          {
            "type": "viewport-change",
            "viewport": {
              "x": 12,
              "y": -8,
              "zoom": 1.5,
            },
          },
        ],
        "style": {
          "edge": {
            "color": "#78879d",
            "directed": true,
            "line": "dashed",
            "opacity": 0.8,
            "width": 2,
          },
          "node": {
            "fill": "#203555",
            "opacity": 1,
            "shape": "round-rectangle",
            "stroke": "#57a5ff",
            "strokeWidth": 3,
          },
        },
      }
    `)
  })
})
