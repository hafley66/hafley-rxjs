import { describe, expect, it } from "vitest"
import { BENCH_SCENARIOS } from "../../../src/0_benchProtocol.js"
import { BENCH_SCENARIO_CASES, reduceBenchScenarioCases, type ScenarioRunReceipt, type ScenarioSample } from "../../../src/11_scenarios.js"
import { createPixiScenarioHandlers, initialPixiScenarioState, type PixiScenarioState } from "../src/6_scenarios.js"

function runDisposedReduction(): Promise<{ state: PixiScenarioState; receipts: ScenarioRunReceipt<ScenarioSample>[] }> {
  const geometry = { nodeIds: ["a", "b", "c"], positions: new Float32Array([0, 0, 10, 0, 10, 10]), edges: [[0, 1], [1, 2]] as [number, number][] }
  const state: PixiScenarioState = initialPixiScenarioState(geometry, null, null, null)
  return reduceBenchScenarioCases(state, BENCH_SCENARIO_CASES, createPixiScenarioHandlers())
}

describe("PixiJS scenario handler conformance", () => {
  it("declares exactly the canonical scenario keys (no missing, no extras)", () => {
    const handlers = createPixiScenarioHandlers()
    const keys = Object.keys(handlers).sort()
    expect(keys).toEqual([...BENCH_SCENARIOS].sort())
  })

  it("produces a sample for every canonical case through the shared runner", async () => {
    const { receipts } = await runDisposedReduction()
    expect(receipts).toHaveLength(BENCH_SCENARIOS.length)
    const summary = receipts.map(receipt => [receipt.scenario, receipt.sample.support])
    expect(summary).toMatchInlineSnapshot(`
      [
        [
          "camera-pan",
          "unsupported",
        ],
        [
          "camera-wheel-zoom",
          "unsupported",
        ],
        [
          "camera-pinch-zoom",
          "unsupported",
        ],
        [
          "style-update",
          "unsupported",
        ],
        [
          "position-update",
          "unsupported",
        ],
        [
          "viewport-resize",
          "unsupported",
        ],
        [
          "device-pixel-ratio-change",
          "unsupported",
        ],
        [
          "group-collapse",
          "unsupported",
        ],
        [
          "group-expand",
          "unsupported",
        ],
        [
          "node-insert",
          "unsupported",
        ],
        [
          "node-delete",
          "unsupported",
        ],
        [
          "edge-insert",
          "unsupported",
        ],
        [
          "edge-delete",
          "unsupported",
        ],
        [
          "visibility-hide",
          "unsupported",
        ],
        [
          "visibility-show",
          "unsupported",
        ],
        [
          "layout-apply",
          "unsupported",
        ],
        [
          "layout-run",
          "unsupported",
        ],
        [
          "position-animation",
          "unsupported",
        ],
        [
          "style-animation",
          "unsupported",
        ],
        [
          "node-click",
          "unsupported",
        ],
        [
          "box-select",
          "unsupported",
        ],
        [
          "node-hover",
          "unsupported",
        ],
        [
          "node-pick",
          "unsupported",
        ],
        [
          "graph-load",
          "unsupported",
        ],
        [
          "graph-clear",
          "unsupported",
        ],
        [
          "graph-replace",
          "unsupported",
        ],
        [
          "graph-dispose",
          "unsupported",
        ],
        [
          "graph-reload",
          "unsupported",
        ],
        [
          "labels-none",
          "unsupported",
        ],
        [
          "labels-visible",
          "unsupported",
        ],
        [
          "labels-fixed-count",
          "unsupported",
        ],
        [
          "labels-dense",
          "unsupported",
        ],
      ]
    `)
  })

  it("records the canonical unsupported representation with a concrete reason per key", async () => {
    const { receipts } = await runDisposedReduction()
    expect(receipts.length).toBeGreaterThan(0)
    for (const receipt of receipts) {
      expect(receipt.sample.support).toBe("unsupported")
      if (receipt.sample.support === "unsupported") expect(receipt.sample.reason).toBeTruthy()
    }
  })

  it("does not phantom-dispose when the projection is already absent", async () => {
    const { state } = await runDisposedReduction()
    expect(state.projection).toBeNull()
    expect(state.disposed).toBe(false)
  })

  it("uses the shared BENCH_SCENARIO_CASES fixture table", () => {
    const caseCount = Object.values(BENCH_SCENARIO_CASES).reduce((total, cases) => total + cases.length, 0)
    expect(caseCount).toBe(BENCH_SCENARIOS.length)
  })
})
