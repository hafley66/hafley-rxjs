import {
  BENCH_SCENARIOS,
  type BenchScenario,
  type BenchScenarioArguments,
  type BenchScenarioCases,
  type BenchScenarioEvent,
  type BenchScenarioHandlers,
  type BenchScenarioResult,
  reduceBenchScenario,
} from "./0_benchProtocol.js"

export const INITIAL_BENCH_SCENARIOS = [
  "camera-pan",
  "camera-wheel-zoom",
  "camera-shake",
  "style-update",
  "position-update",
  "viewport-resize",
  "group-collapse",
  "group-expand",
  "layout-apply",
  "position-animation",
  "graph-replace",
  "graph-dispose",
] as const satisfies readonly BenchScenario[]

export type InitialBenchScenario = typeof INITIAL_BENCH_SCENARIOS[number]

export type ScenarioSample = {
  scenario: BenchScenario
  support: "supported"
  operationLatencyMs: number
  frameP50Ms: number | null
  frameP95Ms: number | null
  frameMaxMs: number | null
  droppedFrames: number | null
  jsHeapUsedBytes: number | null
  processRssBytes: number | null
  uploadedBytesEstimate: number | null
  drawCount: number | null
  visibleNodeCount: number
  visibleEdgeCount: number
} | {
  scenario: BenchScenario
  support: "unsupported"
  reason: string
  operationLatencyMs: 0
  frameP50Ms: null
  frameP95Ms: null
  frameMaxMs: null
  droppedFrames: null
  jsHeapUsedBytes: null
  processRssBytes: null
  uploadedBytesEstimate: null
  drawCount: null
  visibleNodeCount: number
  visibleEdgeCount: number
}

export type ScenarioRunReceipt<Sample = ScenarioSample> = {
  scenario: BenchScenario
  args: BenchScenarioArguments[BenchScenario]
  sample: Sample
}

export const BENCH_SCENARIO_CASES: BenchScenarioCases = {
  "camera-pan": [{ scenario: "camera-pan", args: { dx: 12, dy: -8, frames: 3 } }],
  "camera-wheel-zoom": [{ scenario: "camera-wheel-zoom", args: { deltaY: -120, anchorX: 256, anchorY: 192, frames: 3 } }],
  "camera-pinch-zoom": [{ scenario: "camera-pinch-zoom", args: { scale: 1.1, anchorX: 256, anchorY: 192, frames: 3 } }],
  "camera-shake": [{ scenario: "camera-shake", args: { seed: 1337, amplitudePx: 24, frames: 120 } }],
  "style-update": [{ scenario: "style-update", args: { nodeCount: 64, color: 0xffa33b } }],
  "position-update": [{ scenario: "position-update", args: { nodeCount: 64, dx: 0.25, dy: -0.125 } }],
  "viewport-resize": [{ scenario: "viewport-resize", args: { width: 960, height: 640 } }],
  "device-pixel-ratio-change": [{ scenario: "device-pixel-ratio-change", args: { pixelRatio: 2 } }],
  "group-collapse": [{ scenario: "group-collapse", args: { groupIds: [0, 1] } }],
  "group-expand": [{ scenario: "group-expand", args: { groupIds: [0, 1] } }],
  "node-insert": [{ scenario: "node-insert", args: { count: 2 } }],
  "node-delete": [{ scenario: "node-delete", args: { count: 2 } }],
  "edge-insert": [{ scenario: "edge-insert", args: { count: 2 } }],
  "edge-delete": [{ scenario: "edge-delete", args: { count: 2 } }],
  "visibility-hide": [{ scenario: "visibility-hide", args: { nodeCount: 2, edgeCount: 2 } }],
  "visibility-show": [{ scenario: "visibility-show", args: { nodeCount: 2, edgeCount: 2 } }],
  "layout-apply": [{ scenario: "layout-apply", args: { positionCount: 64 } }],
  "layout-run": [{ scenario: "layout-run", args: { algorithm: "grid", iterations: 10 } }],
  "position-animation": [{ scenario: "position-animation", args: { nodeCount: 64, frames: 3, durationMs: 50 } }],
  "style-animation": [{ scenario: "style-animation", args: { nodeCount: 64, frames: 3, durationMs: 50 } }],
  "node-click": [{ scenario: "node-click", args: { nodeIndex: 0 } }],
  "box-select": [{ scenario: "box-select", args: { x: 0, y: 0, width: 32, height: 32 } }],
  "node-hover": [{ scenario: "node-hover", args: { nodeIndex: 0 } }],
  "node-pick": [{ scenario: "node-pick", args: { x: 0, y: 0 } }],
  "graph-load": [{ scenario: "graph-load", args: { fixture: "grid-1k" } }],
  "graph-clear": [{ scenario: "graph-clear", args: {} }],
  "graph-replace": [{ scenario: "graph-replace", args: { fixture: "grid-1k" } }],
  "graph-dispose": [{ scenario: "graph-dispose", args: {} }],
  "graph-reload": [{ scenario: "graph-reload", args: { fixture: "grid-1k" } }],
  "labels-none": [{ scenario: "labels-none", args: {} }],
  "labels-visible": [{ scenario: "labels-visible", args: {} }],
  "labels-fixed-count": [{ scenario: "labels-fixed-count", args: { count: 16 } }],
  "labels-dense": [{ scenario: "labels-dense", args: {} }],
}

export const INITIAL_BENCH_SCENARIO_CASES: readonly BenchScenarioEvent[] = [
  ...BENCH_SCENARIO_CASES["camera-pan"],
  ...BENCH_SCENARIO_CASES["camera-wheel-zoom"],
  ...BENCH_SCENARIO_CASES["camera-shake"],
  ...BENCH_SCENARIO_CASES["style-update"],
  ...BENCH_SCENARIO_CASES["position-update"],
  ...BENCH_SCENARIO_CASES["viewport-resize"],
  ...BENCH_SCENARIO_CASES["group-collapse"],
  ...BENCH_SCENARIO_CASES["group-expand"],
  ...BENCH_SCENARIO_CASES["layout-apply"],
  ...BENCH_SCENARIO_CASES["position-animation"],
  ...BENCH_SCENARIO_CASES["graph-replace"],
  ...BENCH_SCENARIO_CASES["graph-dispose"],
]

export async function reduceBenchScenarioCases<State, Sample>(
  state: State,
  cases: BenchScenarioCases,
  handlers: BenchScenarioHandlers<State, Sample>,
): Promise<{ state: State; receipts: ScenarioRunReceipt<Sample>[] }> {
  let current = state
  const receipts: ScenarioRunReceipt<Sample>[] = []
  for (const scenario of BENCH_SCENARIOS) {
    for (const event of cases[scenario]) {
      const result: BenchScenarioResult<State, Sample> = await reduceBenchScenario(current, event, handlers)
      receipts.push({ scenario: event.scenario, args: event.args, sample: result.sample })
      current = result.state
    }
  }
  return { state: current, receipts }
}
