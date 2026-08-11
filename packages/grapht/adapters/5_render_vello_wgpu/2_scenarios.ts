import {
  type BenchScenario,
  type BenchScenarioHandler,
  type BenchScenarioHandlers,
} from "../../src/0_benchProtocol.js"
import { BENCH_SCENARIO_CASES, type ScenarioSample } from "../../src/11_scenarios.js"
import type { FixtureLoad } from "./0_fixture.ts"
import type { VelloBrowserRenderer } from "./1_wasm.ts"

export type VelloScenarioState = {
  renderer: VelloBrowserRenderer | null
  fixture: FixtureLoad
  canvas: HTMLCanvasElement
  disposed: boolean
  lastSceneUnits: number | null
}

export type VelloScenarioOptions = {
  loadFixture: (fixture: string) => Promise<FixtureLoad>
}

const now = () => performance.now()
const frame = () => new Promise<number>(resolve => requestAnimationFrame(resolve))

async function frames(count: number): Promise<number[]> {
  const values: number[] = []
  let previous = now()
  for (let index = 0; index < count; index++) {
    const timestamp = await frame()
    values.push(Math.max(0, timestamp - previous))
    previous = timestamp
  }
  return values
}

function percentile(values: number[], quantile: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1)]
}

function memory(): number | null {
  const value = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize
  return typeof value === "number" ? value : null
}

function counts(state: VelloScenarioState): { nodes: number; edges: number } {
  if (!state.renderer || state.disposed) return { nodes: 0, edges: 0 }
  return { nodes: state.renderer.node_count(), edges: state.renderer.edge_count() }
}

function sample(state: VelloScenarioState, scenario: BenchScenario, operationLatencyMs: number, frameTimes: number[], uploadedBytesEstimate: number | null): ScenarioSample {
  const visible = counts(state)
  return {
    scenario,
    support: "supported",
    operationLatencyMs,
    frameP50Ms: percentile(frameTimes, 0.5),
    frameP95Ms: percentile(frameTimes, 0.95),
    frameMaxMs: frameTimes.length === 0 ? null : Math.max(...frameTimes),
    droppedFrames: frameTimes.filter(value => value > 16.67).length,
    jsHeapUsedBytes: memory(),
    processRssBytes: null,
    uploadedBytesEstimate,
    drawCount: state.lastSceneUnits,
    visibleNodeCount: visible.nodes,
    visibleEdgeCount: visible.edges,
  }
}

function unsupported(state: VelloScenarioState, scenario: BenchScenario, reason: string): { state: VelloScenarioState; sample: ScenarioSample } {
  const visible = counts(state)
  return {
    state,
    sample: {
      scenario,
      support: "unsupported",
      reason,
      operationLatencyMs: 0,
      frameP50Ms: null,
      frameP95Ms: null,
      frameMaxMs: null,
      droppedFrames: null,
      jsHeapUsedBytes: null,
      processRssBytes: null,
      uploadedBytesEstimate: null,
      drawCount: null,
      visibleNodeCount: visible.nodes,
      visibleEdgeCount: visible.edges,
    },
  }
}

async function supported(state: VelloScenarioState, scenario: BenchScenario, operation: () => void | Promise<void>, frameCount: number, uploadedBytesEstimate: number | null = 0): Promise<{ state: VelloScenarioState; sample: ScenarioSample }> {
  const started = now()
  await operation()
  const operationLatencyMs = now() - started
  const frameTimes = await frames(frameCount)
  return { state, sample: sample(state, scenario, operationLatencyMs, frameTimes, uploadedBytesEstimate) }
}

function unsupportedHandler<S extends BenchScenario>(scenario: S, reason: string): BenchScenarioHandler<VelloScenarioState, S, ScenarioSample> {
  return state => unsupported(state, scenario, reason)
}

function requireRenderer(state: VelloScenarioState, scenario: BenchScenario): VelloBrowserRenderer | null {
  if (state.disposed || !state.renderer) return null
  return state.renderer
}

function render(state: VelloScenarioState): void {
  if (!state.renderer) return
  state.lastSceneUnits = state.renderer.render_frame()
}

export function createVelloScenarioHandlers(options: VelloScenarioOptions): BenchScenarioHandlers<VelloScenarioState, ScenarioSample> {
  return {
    "camera-pan": async (state, args) => {
      const renderer = requireRenderer(state, "camera-pan")
      if (!renderer) return unsupported(state, "camera-pan", "graph has been disposed")
      return supported(state, "camera-pan", () => { renderer.set_camera_pan(args.dx, args.dy); render(state) }, args.frames)
    },
    "camera-wheel-zoom": async (state, args) => {
      const renderer = requireRenderer(state, "camera-wheel-zoom")
      if (!renderer) return unsupported(state, "camera-wheel-zoom", "graph has been disposed")
      return supported(state, "camera-wheel-zoom", () => { renderer.set_camera_wheel_zoom(args.deltaY, args.anchorX, args.anchorY); render(state) }, args.frames)
    },
    "camera-pinch-zoom": unsupportedHandler("camera-pinch-zoom", "pinch gesture synthesis is not implemented"),
    "style-update": async (state, args) => {
      const renderer = requireRenderer(state, "style-update")
      if (!renderer) return unsupported(state, "style-update", "graph has been disposed")
      return supported(state, "style-update", () => { renderer.set_style(args.nodeCount, args.color); render(state) }, 2, args.nodeCount * 4)
    },
    "position-update": async (state, args) => {
      const renderer = requireRenderer(state, "position-update")
      if (!renderer) return unsupported(state, "position-update", "graph has been disposed")
      return supported(state, "position-update", () => { renderer.update_positions(args.nodeCount, args.dx, args.dy); render(state) }, 2, args.nodeCount * 8)
    },
    "viewport-resize": async (state, args) => {
      const renderer = requireRenderer(state, "viewport-resize")
      if (!renderer) return unsupported(state, "viewport-resize", "graph has been disposed")
      return supported(state, "viewport-resize", () => { state.canvas.width = args.width; state.canvas.height = args.height; renderer.resize(args.width, args.height); render(state) }, 2)
    },
    "device-pixel-ratio-change": unsupportedHandler("device-pixel-ratio-change", "device pixel ratio is browser-owned"),
    "group-collapse": unsupportedHandler("group-collapse", "compound groups are outside the Vello fixture model"),
    "group-expand": unsupportedHandler("group-expand", "compound groups are outside the Vello fixture model"),
    "node-insert": unsupportedHandler("node-insert", "node insertion is outside the initial scenario slice"),
    "node-delete": unsupportedHandler("node-delete", "node deletion is outside the initial scenario slice"),
    "edge-insert": unsupportedHandler("edge-insert", "edge insertion is outside the initial scenario slice"),
    "edge-delete": unsupportedHandler("edge-delete", "edge deletion is outside the initial scenario slice"),
    "visibility-hide": unsupportedHandler("visibility-hide", "visibility mutation is outside the initial scenario slice"),
    "visibility-show": unsupportedHandler("visibility-show", "visibility mutation is outside the initial scenario slice"),
    "layout-apply": async (state, args) => {
      const renderer = requireRenderer(state, "layout-apply")
      if (!renderer) return unsupported(state, "layout-apply", "graph has been disposed")
      return supported(state, "layout-apply", () => { renderer.update_positions(args.positionCount, 0.125, 0.125); render(state) }, 2, args.positionCount * 8)
    },
    "layout-run": unsupportedHandler("layout-run", "layout execution is outside the browser renderer adapter"),
    "position-animation": async (state, args) => {
      const renderer = requireRenderer(state, "position-animation")
      if (!renderer) return unsupported(state, "position-animation", "graph has been disposed")
      return supported(state, "position-animation", async () => {
        const stepX = 0.25 / Math.max(1, args.frames)
        const stepY = -0.125 / Math.max(1, args.frames)
        for (let index = 0; index < args.frames; index++) { renderer.update_positions(args.nodeCount, stepX, stepY); render(state); await frame() }
      }, args.frames, args.nodeCount * 8)
    },
    "style-animation": unsupportedHandler("style-animation", "style animation is outside the initial scenario slice"),
    "node-click": unsupportedHandler("node-click", "input event synthesis is outside the initial scenario slice"),
    "box-select": unsupportedHandler("box-select", "input event synthesis is outside the initial scenario slice"),
    "node-hover": unsupportedHandler("node-hover", "input event synthesis is outside the initial scenario slice"),
    "node-pick": unsupportedHandler("node-pick", "input event synthesis is outside the initial scenario slice"),
    "graph-load": unsupportedHandler("graph-load", "initial graph load is setup"),
    "graph-clear": unsupportedHandler("graph-clear", "graph clear is outside the initial scenario slice"),
    "graph-replace": async (state, args) => {
      const renderer = requireRenderer(state, "graph-replace")
      if (!renderer) return unsupported(state, "graph-replace", "graph has been disposed")
      const loaded = await options.loadFixture(args.fixture)
      const nextState = { ...state, fixture: loaded }
      return supported(nextState, "graph-replace", () => { renderer.load_fixture_json(loaded.json); render(nextState) }, 2, loaded.source.bytes)
    },
    "graph-dispose": async state => {
      if (!state.renderer || state.disposed) return unsupported(state, "graph-dispose", "graph has already been disposed")
      const started = now()
      state.renderer.dispose()
      const nextState = { ...state, renderer: null, disposed: true, lastSceneUnits: null }
      return { state: nextState, sample: sample(nextState, "graph-dispose", now() - started, [], 0) }
    },
    "graph-reload": unsupportedHandler("graph-reload", "graph reload is outside the initial scenario slice"),
    "labels-none": unsupportedHandler("labels-none", "labels are outside the initial scenario slice"),
    "labels-visible": unsupportedHandler("labels-visible", "labels are outside the initial scenario slice"),
    "labels-fixed-count": unsupportedHandler("labels-fixed-count", "labels are outside the initial scenario slice"),
    "labels-dense": unsupportedHandler("labels-dense", "labels are outside the initial scenario slice"),
  }
}

export { BENCH_SCENARIO_CASES }
