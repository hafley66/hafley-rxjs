import { describe, expect, test } from "vitest"
import {
  BENCH_SCENARIO_CASES,
  INITIAL_BENCH_SCENARIO_CASES,
  reduceBenchScenario,
  type BenchScenarioHandlers,
} from "../src/index.js"

const handler = (state: number) => ({ state: state + 1, sample: "reduced" })
const handlers = {
  "camera-pan": handler,
  "camera-wheel-zoom": handler,
  "camera-pinch-zoom": handler,
  "style-update": handler,
  "position-update": handler,
  "viewport-resize": handler,
  "device-pixel-ratio-change": handler,
  "group-collapse": handler,
  "group-expand": handler,
  "node-insert": handler,
  "node-delete": handler,
  "edge-insert": handler,
  "edge-delete": handler,
  "visibility-hide": handler,
  "visibility-show": handler,
  "layout-apply": handler,
  "layout-run": handler,
  "position-animation": handler,
  "style-animation": handler,
  "node-click": handler,
  "box-select": handler,
  "node-hover": handler,
  "node-pick": handler,
  "graph-load": handler,
  "graph-clear": handler,
  "graph-replace": handler,
  "graph-dispose": handler,
  "graph-reload": handler,
  "labels-none": handler,
  "labels-visible": handler,
  "labels-fixed-count": handler,
  "labels-dense": handler,
} satisfies BenchScenarioHandlers<number, string>

describe("scenario case tables", () => {
  test.each(INITIAL_BENCH_SCENARIO_CASES)("keeps the initial scenario args explicit: $scenario", event => {
    expect(BENCH_SCENARIO_CASES[event.scenario]).toContainEqual(event)
  })

  test("contains one explicit case for every contract scenario", () => {
    expect(Object.fromEntries(Object.entries(BENCH_SCENARIO_CASES).map(([scenario, cases]) => [scenario, cases.length]))).toMatchInlineSnapshot(`
      {
        "box-select": 1,
        "camera-pan": 1,
        "camera-pinch-zoom": 1,
        "camera-wheel-zoom": 1,
        "device-pixel-ratio-change": 1,
        "edge-delete": 1,
        "edge-insert": 1,
        "graph-clear": 1,
        "graph-dispose": 1,
        "graph-load": 1,
        "graph-reload": 1,
        "graph-replace": 1,
        "group-collapse": 1,
        "group-expand": 1,
        "labels-dense": 1,
        "labels-fixed-count": 1,
        "labels-none": 1,
        "labels-visible": 1,
        "layout-apply": 1,
        "layout-run": 1,
        "node-click": 1,
        "node-delete": 1,
        "node-hover": 1,
        "node-insert": 1,
        "node-pick": 1,
        "position-animation": 1,
        "position-update": 1,
        "style-animation": 1,
        "style-update": 1,
        "viewport-resize": 1,
        "visibility-hide": 1,
        "visibility-show": 1,
      }
    `)
  })
})

describe("reduceBenchScenario", () => {
  test("dispatches a typed event to its exhaustive handler", async () => {
    const result = await reduceBenchScenario(0, BENCH_SCENARIO_CASES["camera-pan"][0], handlers)
    expect(result).toMatchInlineSnapshot(`
      {
        "sample": "reduced",
        "state": 1,
      }
    `)
  })
})
