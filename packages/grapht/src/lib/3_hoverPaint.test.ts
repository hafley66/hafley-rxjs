import { expect, test } from "vitest"
import { GRAPH_STYLES } from "./0_graphStyle.js"
import { hoverEdgeStops } from "./3_hoverPaint.js"

test("endpoint styles preserve distance, direction, missing context, and custom palette fallback", () => {
  const hops = { a: 1, b: 3 }
  expect({
    fade: hoverEdgeStops(GRAPH_STYLES.dark, hops, "a", "b"),
    color: hoverEdgeStops({ ...GRAPH_STYLES.dark, hopMode: "color" }, hops, "b", "a"),
    context: hoverEdgeStops(GRAPH_STYLES.dark, hops, "a", "absent"),
    idle: hoverEdgeStops(GRAPH_STYLES.dark, {}, "a", "b"),
    custom: hoverEdgeStops({ ...GRAPH_STYLES.dark, hopMode: "color", hopColors: [], focusBorder: "#abcdef" }, hops, "a", "b"),
  }).toMatchInlineSnapshot(`
    {
      "color": [
        {
          "color": "#fb923c",
          "opacity": 0.30250000000000005,
        },
        {
          "color": "#38bdf8",
          "opacity": 1,
        },
      ],
      "context": [
        {
          "color": "#fbbf24",
          "opacity": 1,
        },
        {
          "color": "#94a3b8",
          "opacity": 0.15,
        },
      ],
      "custom": [
        {
          "color": "#abcdef",
          "opacity": 1,
        },
        {
          "color": "#abcdef",
          "opacity": 0.30250000000000005,
        },
      ],
      "fade": [
        {
          "color": "#fbbf24",
          "opacity": 1,
        },
        {
          "color": "#fbbf24",
          "opacity": 0.30250000000000005,
        },
      ],
      "idle": [
        {
          "color": "#94a3b8",
          "opacity": 1,
        },
        {
          "color": "#94a3b8",
          "opacity": 1,
        },
      ],
    }
  `)
})
