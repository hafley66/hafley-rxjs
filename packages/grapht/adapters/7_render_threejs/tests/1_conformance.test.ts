import { describe, expect, it } from "vitest"
import { BENCH_SCENARIOS, reduceBenchScenario } from "../../../src/0_benchProtocol.js"
import { BENCH_SCENARIO_CASES, reduceBenchScenarioCases, type ScenarioRunReceipt, type ScenarioSample } from "../../../src/11_scenarios.js"
import { createThreeScenarioHandlers, initialThreeScenarioState, type ThreeScenarioState } from "../src/6_scenarios.js"
import type { ThreeProjection } from "../src/2_projection.js"

function runDisposedReduction(): Promise<{ state: ThreeScenarioState; receipts: ScenarioRunReceipt<ScenarioSample>[] }> {
  const geometry = { nodeIds: ["a", "b", "c"], positions: new Float32Array([0, 0, 10, 0, 10, 10]), edges: [[0, 1], [1, 2]] as [number, number][] }
  const state: ThreeScenarioState = initialThreeScenarioState(geometry, null, null, null)
  return reduceBenchScenarioCases(state, BENCH_SCENARIO_CASES, createThreeScenarioHandlers())
}

describe("Three.js scenario handler conformance", () => {
  it("declares exactly the canonical scenario keys (no missing, no extras)", () => {
    const handlers = createThreeScenarioHandlers()
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
          "camera-shake",
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

type CameraTrace = { visited: [number, number][]; projection: ThreeProjection }

function tracingProjection(): CameraTrace {
  const visited: [number, number][] = []
  const camera = { scale: 1, tx: 0, ty: 0 }
  const stub = {
    camera,
    fitCamera: () => { camera.tx = 137; camera.ty = -42 },
    applyCamera: () => { visited.push([camera.tx, camera.ty]) },
    render: () => {},
    visibleNodeCount: () => 3,
    visibleEdgeCount: () => 2,
  }
  return { visited, projection: stub as unknown as ThreeProjection }
}

async function runShake(): Promise<{ visited: [number, number][]; sample: ScenarioSample }> {
  const geometry = { nodeIds: ["a", "b", "c"], positions: new Float32Array([0, 0, 10, 0, 10, 10]), edges: [[0, 1], [1, 2]] as [number, number][] }
  const trace = tracingProjection()
  const state: ThreeScenarioState = initialThreeScenarioState(geometry, null, null, trace.projection)
  const result = await reduceBenchScenario(state, BENCH_SCENARIO_CASES["camera-shake"][0], createThreeScenarioHandlers())
  return { visited: trace.visited, sample: result.sample }
}

describe("camera-shake", () => {
  it("reports a supported sample once a projection is attached", async () => {
    const { sample, visited } = await runShake()
    expect(sample.support).toBe("supported")
    expect(visited).toHaveLength(120)
  })

  it("visits the same camera positions on a second run of the same seed", async () => {
    const first = await runShake()
    const second = await runShake()
    expect(first.visited).toEqual(second.visited)
  })

  it("lands the camera back on the fitted rest position", async () => {
    const { visited } = await runShake()
    expect(visited[visited.length - 1]).toEqual([137, -42])
  })
})
