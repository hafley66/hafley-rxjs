import { expect, it } from "vitest"
import { GRAPH_STYLES, graphHoverColor } from "./0_graphStyle.js"

it("interpolates configurable hop endpoints, clamps distance, and preserves fade and indexed modes", () => {
  const palette = { ...GRAPH_STYLES.dark, hopMode: "color" as const, hopGradient: { from: "#ff0000", to: "#0000ff", distance: 4 } }
  expect({
    interpolated: [-1, 0, 1, 2, 3, 4, 10].map(hop => graphHoverColor(palette, hop)),
    fade: [0, 1, 4].map(hop => graphHoverColor({ ...palette, hopMode: "fade" }, hop)),
    indexed: [0, 1, 4, 10].map(hop => graphHoverColor({ ...palette, hopGradient: undefined }, hop)),
  }).toMatchInlineSnapshot(`
    {
      "fade": [
        "#ff0000",
        "#ff0000",
        "#ff0000",
      ],
      "indexed": [
        "#fbbf24",
        "#38bdf8",
        "#f87171",
        "#f87171",
      ],
      "interpolated": [
        "#ff0000",
        "#ff0000",
        "#bf0040",
        "#800080",
        "#4000bf",
        "#0000ff",
        "#0000ff",
      ],
    }
  `)
})
