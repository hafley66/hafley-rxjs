import type {
  BenchScenario,
  BenchScenarioHandler,
  BenchScenarioHandlers,
} from "../../../src/0_benchProtocol.js"
import type { ScenarioSample } from "../../../src/11_scenarios.js"
import { shakeOffsets } from "../../../src/12_shake.js"
import type { Geometry } from "./0_protocol.js"
import { buildGraph } from "./1_graphology.js"
import { SigmaProjection } from "./2_projection.js"

export type SigmaFixture = { geometry: Geometry; bytes?: number }

export type SigmaScenarioState = {
  projection: SigmaProjection | null
  geometry: Geometry
  container: HTMLElement | null
  fixtureBytes: number | null
  disposed: boolean
}

export type SigmaScenarioOptions = {
  loadFixture?: (fixture: string) => Promise<SigmaFixture>
}

function now(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now()
}

function memory(): number | null {
  const value = (globalThis as { performance?: { memory?: { usedJSHeapSize: number } } }).performance?.memory?.usedJSHeapSize
  if (typeof value === "number") return value
  const processValue = (globalThis as { process?: { memoryUsage?: () => { heapUsed: number } } }).process?.memoryUsage?.()
  return processValue?.heapUsed ?? null
}

function frame(): Promise<number> {
  if (typeof requestAnimationFrame === "function") return new Promise(resolve => requestAnimationFrame(timestamp => resolve(timestamp)))
  return new Promise(resolve => setTimeout(() => resolve(now()), 0))
}

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

function visible(state: SigmaScenarioState): { nodes: number; edges: number } {
  if (!state.projection || state.disposed) return { nodes: 0, edges: 0 }
  return { nodes: state.projection.visibleCount(), edges: state.projection.visibleEdgeCount() }
}

function sample(state: SigmaScenarioState, scenario: BenchScenario, operationLatencyMs: number, frameTimes: number[], uploadedBytesEstimate: number | null): ScenarioSample {
  const counts = visible(state)
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
    drawCount: null,
    visibleNodeCount: counts.nodes,
    visibleEdgeCount: counts.edges,
  }
}

function unsupported(state: SigmaScenarioState, scenario: BenchScenario, reason: string): { state: SigmaScenarioState; sample: ScenarioSample } {
  const counts = visible(state)
  return { state, sample: { scenario, support: "unsupported", reason, operationLatencyMs: 0, frameP50Ms: null, frameP95Ms: null, frameMaxMs: null, droppedFrames: null, jsHeapUsedBytes: null, processRssBytes: null, uploadedBytesEstimate: null, drawCount: null, visibleNodeCount: counts.nodes, visibleEdgeCount: counts.edges } }
}

async function supported(state: SigmaScenarioState, scenario: BenchScenario, operation: () => void | Promise<void>, frameCount: number, uploadedBytesEstimate: number | null = 0): Promise<{ state: SigmaScenarioState; sample: ScenarioSample }> {
  const started = now()
  await operation()
  const operationLatencyMs = now() - started
  const frameTimes = await frames(frameCount)
  return { state, sample: sample(state, scenario, operationLatencyMs, frameTimes, uploadedBytesEstimate) }
}

function unsupportedHandler<S extends BenchScenario>(scenario: S, reason: string): BenchScenarioHandler<SigmaScenarioState, S, ScenarioSample> {
  return state => unsupported(state, scenario, reason)
}

function requireProjection(state: SigmaScenarioState): SigmaProjection | null {
  return state.disposed ? null : state.projection
}

function updatePositions(state: SigmaScenarioState, count: number, dx: number, dy: number): void {
  const projection = state.projection
  if (!projection) return
  const selected = new Set(state.geometry.nodeIds.slice(0, count))
  projection.graph.forEachNode((node, attributes) => {
    if (selected.has(node)) projection.graph.mergeNodeAttributes(node, { x: attributes.x + dx, y: attributes.y + dy })
  })
  projection.sigma.refresh()
}

export function createSigmaScenarioHandlers(options: SigmaScenarioOptions = {}): BenchScenarioHandlers<SigmaScenarioState, ScenarioSample> {
  return {
    "camera-pan": async (state, args) => {
      const projection = requireProjection(state)
      if (!projection) return unsupported(state, "camera-pan", "graph has been disposed")
      return supported(state, "camera-pan", () => { const camera = projection.sigma.getCamera(); const current = camera.getState(); camera.setState({ ...current, x: current.x + args.dx, y: current.y + args.dy }); projection.sigma.refresh() }, args.frames)
    },
    "camera-wheel-zoom": async (state, args) => {
      const projection = requireProjection(state)
      if (!projection) return unsupported(state, "camera-wheel-zoom", "graph has been disposed")
      return supported(state, "camera-wheel-zoom", () => { const camera = projection.sigma.getCamera(); camera.setState({ ...camera.getState(), ratio: camera.getState().ratio * Math.exp(args.deltaY / 600) }); projection.sigma.refresh() }, args.frames)
    },
    "camera-pinch-zoom": unsupportedHandler("camera-pinch-zoom", "pinch gesture synthesis is not implemented"),
    "camera-shake": async (state, args) => {
      const projection = requireProjection(state)
      if (!projection) return unsupported(state, "camera-shake", "graph has been disposed")
      const started = now()
      projection.resetCamera()
      const camera = projection.sigma.getCamera()
      const rest = camera.getState()
      const viewportWidth = state.container?.clientWidth || 800
      const offsets = shakeOffsets(args.seed, args.amplitudePx, args.frames)
      const frameTimes: number[] = []
      let previous = now()
      for (let index = 0; index < args.frames; index++) {
        camera.setState({ ...rest, x: rest.x + offsets[index * 2] / viewportWidth, y: rest.y + offsets[index * 2 + 1] / viewportWidth })
        projection.sigma.refresh()
        const timestamp = await frame()
        frameTimes.push(Math.max(0, timestamp - previous))
        previous = timestamp
      }
      return { state, sample: sample(state, "camera-shake", now() - started, frameTimes, 0) }
    },
    "style-update": async (state, args) => {
      const projection = requireProjection(state)
      if (!projection) return unsupported(state, "style-update", "graph has been disposed")
      const color = `#${(args.color & 0xffffff).toString(16).padStart(6, "0")}`
      return supported(state, "style-update", () => { let index = 0; projection.graph.forEachNode(node => { if (index++ < args.nodeCount) projection.graph.setNodeAttribute(node, "color", color) }); projection.sigma.refresh() }, 2, args.nodeCount * 4)
    },
    "position-update": async (state, args) => {
      const projection = requireProjection(state)
      if (!projection) return unsupported(state, "position-update", "graph has been disposed")
      return supported(state, "position-update", () => updatePositions(state, args.nodeCount, args.dx, args.dy), 2, args.nodeCount * 8)
    },
    "viewport-resize": async (state, args) => {
      const projection = requireProjection(state)
      if (!projection || !state.container) return unsupported(state, "viewport-resize", "a mounted Sigma container is required")
      return supported(state, "viewport-resize", () => { state.container!.style.width = `${args.width}px`; state.container!.style.height = `${args.height}px`; projection.resize() }, 2)
    },
    "device-pixel-ratio-change": unsupportedHandler("device-pixel-ratio-change", "device pixel ratio is browser-owned and cannot be changed by the scenario runner"),
    "group-collapse": unsupportedHandler("group-collapse", "Sigma projection has no group compound-node model"),
    "group-expand": unsupportedHandler("group-expand", "Sigma projection has no group compound-node model"),
    "node-insert": unsupportedHandler("node-insert", "node insertion is outside the initial scenario slice"),
    "node-delete": unsupportedHandler("node-delete", "node deletion is outside the initial scenario slice"),
    "edge-insert": unsupportedHandler("edge-insert", "edge insertion is outside the initial scenario slice"),
    "edge-delete": unsupportedHandler("edge-delete", "edge deletion is outside the initial scenario slice"),
    "visibility-hide": unsupportedHandler("visibility-hide", "visibility mutation is outside the initial scenario slice"),
    "visibility-show": unsupportedHandler("visibility-show", "visibility mutation is outside the initial scenario slice"),
    "layout-apply": async (state, args) => {
      const projection = requireProjection(state)
      if (!projection) return unsupported(state, "layout-apply", "graph has been disposed")
      return supported(state, "layout-apply", () => updatePositions(state, args.positionCount, 0.125, 0.125), 2, args.positionCount * 8)
    },
    "layout-run": unsupportedHandler("layout-run", "layout execution is outside the initial scenario slice"),
    "position-animation": async (state, args) => {
      const projection = requireProjection(state)
      if (!projection) return unsupported(state, "position-animation", "graph has been disposed")
      return supported(state, "position-animation", async () => {
        const stepX = 0.25 / Math.max(1, args.frames)
        const stepY = -0.125 / Math.max(1, args.frames)
        for (let index = 0; index < args.frames; index++) { updatePositions(state, args.nodeCount, stepX, stepY); await frame() }
      }, args.frames, args.nodeCount * 8)
    },
    "style-animation": unsupportedHandler("style-animation", "style animation is outside the initial scenario slice"),
    "node-click": unsupportedHandler("node-click", "input event synthesis is outside the initial scenario slice"),
    "box-select": unsupportedHandler("box-select", "box selection is outside the initial scenario slice"),
    "node-hover": unsupportedHandler("node-hover", "input event synthesis is outside the initial scenario slice"),
    "node-pick": unsupportedHandler("node-pick", "input event synthesis is outside the initial scenario slice"),
    "graph-load": unsupportedHandler("graph-load", "initial graph load is setup rather than a scenario operation"),
    "graph-clear": unsupportedHandler("graph-clear", "graph clear is outside the initial scenario slice"),
    "graph-replace": async (state, args) => {
      const projection = requireProjection(state)
      if (!projection) return unsupported(state, "graph-replace", "graph has been disposed")
      const loaded: SigmaFixture = options.loadFixture ? await options.loadFixture(args.fixture) : { geometry: state.geometry, bytes: state.fixtureBytes ?? undefined }
      const nextState = { ...state, geometry: loaded.geometry, fixtureBytes: loaded.bytes ?? state.fixtureBytes }
      return supported(nextState, "graph-replace", () => projection.replace(loaded.geometry), 2, loaded.bytes ?? null)
    },
    "graph-dispose": async state => {
      if (!state.projection || state.disposed) return unsupported(state, "graph-dispose", "graph has already been disposed")
      const started = now()
      state.projection.dispose()
      const nextState = { ...state, projection: null, disposed: true }
      return { state: nextState, sample: sample(nextState, "graph-dispose", now() - started, [], 0) }
    },
    "graph-reload": unsupportedHandler("graph-reload", "graph reload is outside the initial scenario slice"),
    "labels-none": unsupportedHandler("labels-none", "label policy is outside the initial scenario slice"),
    "labels-visible": unsupportedHandler("labels-visible", "label policy is outside the initial scenario slice"),
    "labels-fixed-count": unsupportedHandler("labels-fixed-count", "label policy is outside the initial scenario slice"),
    "labels-dense": unsupportedHandler("labels-dense", "label policy is outside the initial scenario slice"),
  }
}

export function initialSigmaScenarioState(geometry: Geometry, container: HTMLElement, fixtureBytes: number | null = null): SigmaScenarioState {
  return { projection: new SigmaProjection(container, buildGraph(geometry)), geometry, container, fixtureBytes, disposed: false }
}
