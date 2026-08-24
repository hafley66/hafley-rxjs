import type { BenchScenario, BenchScenarioHandler, BenchScenarioHandlers } from "../../../src/0_benchProtocol.js"
import type { Geometry } from "../../../src/1_geometryProtocol.js"
import type { ScenarioSample } from "../../../src/11_scenarios.js"
import type { PixiProjection } from "./2_projection.js"

export type PixiFixture = { geometry: Geometry; bytes?: number }

export type PixiScenarioState = {
  projection: PixiProjection | null
  geometry: Geometry
  container: HTMLElement | null
  fixtureBytes: number | null
  disposed: boolean
}

export type PixiScenarioOptions = {
  loadFixture?: (fixture: string) => Promise<PixiFixture>
}

function now(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now()
}

function frame(): Promise<number> {
  if (typeof requestAnimationFrame === "function") {
    return new Promise(resolve => requestAnimationFrame(timestamp => resolve(timestamp)))
  }
  return new Promise(resolve => setTimeout(() => resolve(now()), 0))
}

async function frames(count: number): Promise<number[]> {
  if (count <= 0) return []
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

function visible(state: PixiScenarioState): { nodes: number; edges: number } {
  if (!state.projection || state.disposed) return { nodes: 0, edges: 0 }
  return { nodes: state.projection.visibleNodeCount(), edges: state.projection.visibleEdgeCount() }
}

function sample(
  state: PixiScenarioState,
  scenario: BenchScenario,
  operationLatencyMs: number,
  frameTimes: number[],
  uploadedBytesEstimate: number | null,
): ScenarioSample {
  const counts = visible(state)
  return {
    scenario,
    support: "supported",
    operationLatencyMs,
    frameP50Ms: percentile(frameTimes, 0.5),
    frameP95Ms: percentile(frameTimes, 0.95),
    frameMaxMs: frameTimes.length === 0 ? null : Math.max(...frameTimes),
    droppedFrames: frameTimes.filter(value => value > 16.67).length,
    jsHeapUsedBytes: null,
    processRssBytes: null,
    uploadedBytesEstimate,
    drawCount: null,
    visibleNodeCount: counts.nodes,
    visibleEdgeCount: counts.edges,
  }
}

function unsupported(state: PixiScenarioState, scenario: BenchScenario, reason: string): { state: PixiScenarioState; sample: ScenarioSample } {
  const counts = visible(state)
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
      visibleNodeCount: counts.nodes,
      visibleEdgeCount: counts.edges,
    },
  }
}

async function supported(
  state: PixiScenarioState,
  scenario: BenchScenario,
  operation: () => void | Promise<void>,
  frameCount: number,
  uploadedBytesEstimate: number | null = 0,
): Promise<{ state: PixiScenarioState; sample: ScenarioSample }> {
  const started = now()
  await operation()
  const operationLatencyMs = now() - started
  const frameTimes = await frames(frameCount)
  return { state, sample: sample(state, scenario, operationLatencyMs, frameTimes, uploadedBytesEstimate) }
}

function unsupportedHandler<S extends BenchScenario>(scenario: S, reason: string): BenchScenarioHandler<PixiScenarioState, S, ScenarioSample> {
  return state => unsupported(state, scenario, reason)
}

function requireProjection(state: PixiScenarioState): PixiProjection | null {
  return state.disposed ? null : state.projection
}

function colorHex(value: number): number {
  return value & 0xffffff
}

export function createPixiScenarioHandlers(options: PixiScenarioOptions = {}): BenchScenarioHandlers<PixiScenarioState, ScenarioSample> {
  return {
    "camera-pan": async (state, args) => {
      const projection = requireProjection(state)
      if (!projection) return unsupported(state, "camera-pan", "graph has been disposed")
      return supported(state, "camera-pan", () => { projection.panBy(args.dx, args.dy); projection.render() }, args.frames)
    },
    "camera-wheel-zoom": async (state, args) => {
      const projection = requireProjection(state)
      if (!projection) return unsupported(state, "camera-wheel-zoom", "graph has been disposed")
      return supported(state, "camera-wheel-zoom", () => { projection.zoomBy(Math.exp(args.deltaY / 600), args.anchorX, args.anchorY); projection.render() }, args.frames)
    },
    "camera-pinch-zoom": async (state, args) => {
      const projection = requireProjection(state)
      if (!projection) return unsupported(state, "camera-pinch-zoom", "graph has been disposed")
      return supported(state, "camera-pinch-zoom", () => { projection.zoomBy(args.scale, args.anchorX, args.anchorY); projection.render() }, args.frames)
    },
    "style-update": async (state, args) => {
      const projection = requireProjection(state)
      if (!projection) return unsupported(state, "style-update", "graph has been disposed")
      return supported(state, "style-update", () => { projection.setNodeColor(args.nodeCount, colorHex(args.color)); projection.render() }, 2, args.nodeCount * 4)
    },
    "position-update": async (state, args) => {
      const projection = requireProjection(state)
      if (!projection) return unsupported(state, "position-update", "graph has been disposed")
      return supported(state, "position-update", () => { projection.updatePositions(args.nodeCount, args.dx, args.dy); projection.render() }, 2, args.nodeCount * 8)
    },
    "viewport-resize": async (state, args) => {
      const projection = requireProjection(state)
      if (!projection) return unsupported(state, "viewport-resize", "graph has been disposed")
      return supported(state, "viewport-resize", () => { projection.resize(args.width, args.height); projection.render() }, 2)
    },
    "device-pixel-ratio-change": unsupportedHandler("device-pixel-ratio-change", "device pixel ratio is browser-owned and cannot be changed by the scenario runner"),
    "group-collapse": unsupportedHandler("group-collapse", "PixiJS projection has no group compound-node model"),
    "group-expand": unsupportedHandler("group-expand", "PixiJS projection has no group compound-node model"),
    "node-insert": unsupportedHandler("node-insert", "node insertion is outside the initial scenario slice"),
    "node-delete": unsupportedHandler("node-delete", "node deletion is outside the initial scenario slice"),
    "edge-insert": unsupportedHandler("edge-insert", "edge insertion is outside the initial scenario slice"),
    "edge-delete": unsupportedHandler("edge-delete", "edge deletion is outside the initial scenario slice"),
    "visibility-hide": unsupportedHandler("visibility-hide", "visibility mutation is outside the initial scenario slice"),
    "visibility-show": unsupportedHandler("visibility-show", "visibility mutation is outside the initial scenario slice"),
    "layout-apply": async (state, args) => {
      const projection = requireProjection(state)
      if (!projection) return unsupported(state, "layout-apply", "graph has been disposed")
      return supported(state, "layout-apply", () => { projection.updatePositions(args.positionCount, 0.125, 0.125); projection.render() }, 2, args.positionCount * 8)
    },
    "layout-run": unsupportedHandler("layout-run", "layout execution is outside the initial scenario slice"),
    "position-animation": async (state, args) => {
      const projection = requireProjection(state)
      if (!projection) return unsupported(state, "position-animation", "graph has been disposed")
      return supported(state, "position-animation", async () => {
        const stepX = 0.25 / Math.max(1, args.frames)
        const stepY = -0.125 / Math.max(1, args.frames)
        for (let index = 0; index < args.frames; index++) {
          projection.updatePositions(args.nodeCount, stepX, stepY)
          projection.render()
          await frame()
        }
      }, args.frames, args.nodeCount * 8)
    },
    "style-animation": async (state, args) => {
      const projection = requireProjection(state)
      if (!projection) return unsupported(state, "style-animation", "graph has been disposed")
      return supported(state, "style-animation", async () => {
        const colors = [0xffa33b, 0x3bffa3, 0xa33bff]
        for (let index = 0; index < args.frames; index++) {
          projection.setNodeColor(args.nodeCount, colors[index % colors.length])
          projection.render()
          await frame()
        }
      }, args.frames, args.nodeCount * 4)
    },
    "node-click": async (state, args) => {
      const projection = requireProjection(state)
      if (!projection) return unsupported(state, "node-click", "graph has been disposed")
      return supported(state, "node-click", () => { projection.pickNodeAt(args.nodeIndex * 7, args.nodeIndex * 7); projection.render() }, 2)
    },
    "box-select": unsupportedHandler("box-select", "box selection is outside the initial scenario slice"),
    "node-hover": async (state, args) => {
      const projection = requireProjection(state)
      if (!projection) return unsupported(state, "node-hover", "graph has been disposed")
      return supported(state, "node-hover", () => { projection.pickNodeAt(args.nodeIndex * 7, args.nodeIndex * 7); projection.render() }, 2)
    },
    "node-pick": async (state, args) => {
      const projection = requireProjection(state)
      if (!projection) return unsupported(state, "node-pick", "graph has been disposed")
      return supported(state, "node-pick", () => { projection.pickNodeAt(args.x, args.y); projection.render() }, 2)
    },
    "graph-load": unsupportedHandler("graph-load", "initial graph load is setup rather than a scenario operation"),
    "graph-clear": unsupportedHandler("graph-clear", "graph clear is outside the initial scenario slice"),
    "graph-replace": async (state, args) => {
      const projection = requireProjection(state)
      if (!projection) return unsupported(state, "graph-replace", "graph has been disposed")
      const loaded: PixiFixture = options.loadFixture ? await options.loadFixture(args.fixture) : { geometry: state.geometry, bytes: state.fixtureBytes ?? undefined }
      const nextState = { ...state, geometry: loaded.geometry, fixtureBytes: loaded.bytes ?? state.fixtureBytes }
      return supported(nextState, "graph-replace", () => { projection.replace(loaded.geometry); projection.render() }, 2, loaded.bytes ?? null)
    },
    "graph-dispose": async state => {
      if (!state.projection || state.disposed) return unsupported(state, "graph-dispose", "graph has already been disposed")
      const started = now()
      state.projection.unsubscribe()
      const nextState = { ...state, projection: null, disposed: true }
      return { state: nextState, sample: sample(nextState, "graph-dispose", now() - started, [], 0) }
    },
    "graph-reload": unsupportedHandler("graph-reload", "graph reload is outside the initial scenario slice"),
    "labels-none": unsupportedHandler("labels-none", "text label policy is outside the initial scenario slice"),
    "labels-visible": unsupportedHandler("labels-visible", "text label policy is outside the initial scenario slice"),
    "labels-fixed-count": unsupportedHandler("labels-fixed-count", "text label policy is outside the initial scenario slice"),
    "labels-dense": unsupportedHandler("labels-dense", "text label policy is outside the initial scenario slice"),
  }
}

export function initialPixiScenarioState(
  geometry: Geometry,
  container: HTMLElement | null,
  fixtureBytes: number | null = null,
  projection: PixiProjection | null = null,
): PixiScenarioState {
  return { projection, geometry, container, fixtureBytes, disposed: false }
}
