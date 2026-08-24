import type { Scene } from "./1_scene.js"
import type { Geometry } from "./0_protocol.js"
import { BENCH_SCENARIOS, pan, zoomAt, type Camera, type BenchScenario, type BenchScenarioArguments, type BenchScenarioHandlers, type BenchScenarioResult } from "./9_scenarioTypes.js"
import { frameStats, measureUploadBytes, type FrameStatsRecord } from "./9_scenarioTypes.js"
import { shakeOffsets } from "../../src/12_shake.js"

export type { BenchScenario, BenchScenarioArguments, BenchScenarioHandlers, BenchScenarioResult, Camera, FrameStatsRecord, Geometry }
export { frameStats, measureUploadBytes }

export type CanvasKitScenarioState = {
  geometry: Geometry
  positions: Float32Array
  camera: Camera
  nodeRadius: number
  nodeColor: [number, number, number, number]
  edgeAlpha: number
  viewport: { width: number; height: number; pixelRatio: number }
  collapsed: Set<number>
  renderer: Scene | null
  generation: number
  disposed: boolean
  bench: { frameBudgetMs: number; frameDurations: number[] | null }
}

export type CanvasKitScenarioSample = {
  scenario: BenchScenario
  supported: boolean
  phase: string
  latencyMs: number
  frame: FrameStatsRecord | null
  memory: { jsHeapUsedBytes: number | null; wasmPages: number }
  visibility: { visibleNodeCount: number; visibleEdgeCount: number }
  draw: { drawCount: number } | null
  uploadBytes: number | null
  fixture?: string
  counters: Record<string, number>
}

export type CanvasKitScenarioStateInit = {
  geometry: Geometry
  renderer?: Scene | null
  viewport?: { width: number; height: number; pixelRatio?: number }
  bench?: { frameBudgetMs?: number; frameDurations?: number[] | null }
}

const RGBA = (rgb: number, alpha = 1): [number, number, number, number] => [
  ((rgb >> 16) & 0xff) / 255,
  ((rgb >> 8) & 0xff) / 255,
  (rgb & 0xff) / 255,
  alpha,
]

export function initialState(init: CanvasKitScenarioStateInit): CanvasKitScenarioState {
  const geometry = init.geometry
  return {
    geometry,
    positions: geometry.positions.slice(),
    camera: { scale: 1, tx: 0, ty: 0 },
    nodeRadius: 2,
    nodeColor: RGBA(0x5b9bed),
    edgeAlpha: 0.2,
    viewport: { width: init.viewport?.width ?? 1024, height: init.viewport?.height ?? 768, pixelRatio: init.viewport?.pixelRatio ?? 1 },
    collapsed: new Set(),
    renderer: init.renderer ?? null,
    generation: 0,
    disposed: false,
    bench: { frameBudgetMs: init.bench?.frameBudgetMs ?? 16.67, frameDurations: init.bench?.frameDurations ?? null },
  }
}

function jsHeap(): number | null {
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
  return memory ? memory.usedJSHeapSize : null
}

function visibleCounts(state: CanvasKitScenarioState): { visibleNodeCount: number; visibleEdgeCount: number } {
  const hidden = state.collapsed
  const visibleNodeCount = state.geometry.nodeCount - hidden.size
  let visibleEdgeCount = 0
  for (const [a, b] of state.geometry.edges) {
    if (hidden.has(a) || hidden.has(b)) continue
    visibleEdgeCount++
  }
  return { visibleNodeCount, visibleEdgeCount }
}

function fillSample(
  state: CanvasKitScenarioState,
  scenario: BenchScenario,
  phase: string,
  startedMs: number,
  latencyMs: number,
  drawCount: number,
): CanvasKitScenarioSample {
  void startedMs
  const frame = state.bench.frameDurations === null ? null : frameStats(state.bench.frameDurations, state.bench.frameBudgetMs)
  return {
    scenario,
    supported: true,
    phase,
    latencyMs,
    frame,
    memory: { jsHeapUsedBytes: jsHeap(), wasmPages: state.renderer ? state.renderer.memoryPages() : 0 },
    visibility: visibleCounts(state),
    draw: { drawCount },
    uploadBytes: null,
    counters: {
      nodeCount: state.geometry.nodeCount,
      edgeCount: state.geometry.edgeCount,
      visibleNodeCount: visibleCounts(state).visibleNodeCount,
      generation: state.generation,
    },
  }
}

export function replaceRenderer(state: CanvasKitScenarioState, renderer: Scene | null): CanvasKitScenarioState {
  if (state.renderer) state.renderer.dispose()
  return { ...state, renderer, disposed: false, generation: state.generation + 1 }
}

export function parseGroupIndexes(groupIds: readonly number[]): number[] {
  return groupIds.map(id => (Number.isInteger(id) && id >= 0 && id < 1_000_000 ? id : -1))
}

export function collapseGroups(state: CanvasKitScenarioState, groupIds: readonly number[]): CanvasKitScenarioState {
  const collapsed = new Set(state.collapsed)
  for (const groupId of parseGroupIndexes(groupIds ?? [])) {
    const start = groupId * 100
    const end = Math.min(start + 100, state.geometry.nodeCount)
    for (let index = start; index < end; index++) collapsed.add(index)
  }
  return { ...state, collapsed }
}

export function expandGroups(state: CanvasKitScenarioState, groupIds: readonly number[]): CanvasKitScenarioState {
  const collapsed = new Set(state.collapsed)
  for (const groupId of parseGroupIndexes(groupIds ?? [])) {
    const start = groupId * 100
    const end = Math.min(start + 100, state.geometry.nodeCount)
    for (let index = start; index < end; index++) collapsed.delete(index)
  }
  return { ...state, collapsed }
}

export function applyLayout(state: CanvasKitScenarioState, positionCount: number): CanvasKitScenarioState {
  const positions = state.positions.slice()
  const count = Math.max(0, Math.min(positionCount, state.geometry.nodeCount))
  const columns = Math.ceil(Math.sqrt(state.geometry.nodeCount))
  for (let index = 0; index < count; index++) {
    positions[index * 2] = (index % columns) * 10
    positions[index * 2 + 1] = Math.floor(index / columns) * 10
  }
  return { ...state, positions }
}

export function updatePositions(state: CanvasKitScenarioState, nodeCount: number, dx: number, dy: number): CanvasKitScenarioState {
  const positions = state.positions.slice()
  const count = Math.max(0, Math.min(nodeCount, state.geometry.nodeCount))
  for (let index = 0; index < count; index++) {
    positions[index * 2] += dx
    positions[index * 2 + 1] += dy
  }
  return { ...state, positions }
}

function unsupportedSample(state: CanvasKitScenarioState, scenario: BenchScenario): CanvasKitScenarioSample {
  return {
    scenario,
    supported: false,
    phase: "unsupported",
    latencyMs: 0,
    frame: null,
    memory: { jsHeapUsedBytes: jsHeap(), wasmPages: state.renderer ? state.renderer.memoryPages() : 0 },
    visibility: visibleCounts(state),
    draw: null,
    uploadBytes: null,
    counters: { unsupported: 1, nodeCount: state.geometry.nodeCount },
  }
}

export const handlers: BenchScenarioHandlers<CanvasKitScenarioState, CanvasKitScenarioSample> = {
  "camera-pan": (state, args) => {
    const { dx, dy, frames } = args
    const framesN = Math.max(1, Math.floor(frames))
    const next: CanvasKitScenarioState = { ...state, camera: pan(state.camera, dx / framesN, dy / framesN) }
    return { state: next, sample: fillSample(next, "camera-pan", "1 frame", performance.now(), 0, 1) }
  },
  "camera-wheel-zoom": (state, args) => {
    const { deltaY, anchorX, anchorY } = args
    const factor = deltaY < 0 ? 1.05 : 0.95
    const zoomed = zoomAt(state.camera, factor, anchorX, anchorY)
    const next: CanvasKitScenarioState = { ...state, camera: zoomed }
    return { state: next, sample: fillSample(next, "camera-wheel-zoom", "1 frame", performance.now(), 0, 1) }
  },
  "camera-pinch-zoom": (state) => ({ state, sample: unsupportedSample(state, "camera-pinch-zoom") }),
  "camera-shake": (state, args) => {
    const offsets = shakeOffsets(args.seed, args.amplitudePx, args.frames)
    const count = offsets.length / 2
    const rest = state.camera
    const durations: number[] = []
    let camera = rest
    for (let index = 0; index < count; index++) {
      camera = { ...rest, tx: rest.tx + offsets[index * 2], ty: rest.ty + offsets[index * 2 + 1] }
      if (!state.renderer) continue
      state.renderer.setCamera(camera)
      durations.push(state.renderer.draw().totalMs)
    }
    const next: CanvasKitScenarioState = {
      ...state,
      camera,
      bench: durations.length === 0 ? state.bench : { ...state.bench, frameDurations: durations },
    }
    return { state: next, sample: fillSample(next, "camera-shake", `${count} frames`, performance.now(), 0, count) }
  },
  "style-update": (state, args) => {
    const { color } = args
    const next: CanvasKitScenarioState = { ...state, nodeColor: RGBA(color) }
    return { state: next, sample: fillSample(next, "style-update", "1 frame", performance.now(), 0, 1) }
  },
  "position-update": (state, args) => {
    const { nodeCount, dx, dy } = args
    const next = updatePositions(state, nodeCount, dx, dy)
    return { state: next, sample: fillSample(next, "position-update", "1 frame", performance.now(), 0, 1) }
  },
  "viewport-resize": (state, args) => {
    const { width, height } = args
    const next: CanvasKitScenarioState = { ...state, viewport: { ...state.viewport, width, height } }
    return { state: next, sample: fillSample(next, "viewport-resize", "1 frame", performance.now(), 0, 1) }
  },
  "device-pixel-ratio-change": (state) => ({ state, sample: unsupportedSample(state, "device-pixel-ratio-change") }),
  "group-collapse": (state, args) => {
    const next = collapseGroups(state, args.groupIds)
    return { state: next, sample: fillSample(next, "group-collapse", "1 frame", performance.now(), 0, 1) }
  },
  "group-expand": (state, args) => {
    const next = expandGroups(state, args.groupIds)
    return { state: next, sample: fillSample(next, "group-expand", "1 frame", performance.now(), 0, 1) }
  },
  "node-insert": (state) => ({ state, sample: unsupportedSample(state, "node-insert") }),
  "node-delete": (state) => ({ state, sample: unsupportedSample(state, "node-delete") }),
  "edge-insert": (state) => ({ state, sample: unsupportedSample(state, "edge-insert") }),
  "edge-delete": (state) => ({ state, sample: unsupportedSample(state, "edge-delete") }),
  "visibility-hide": (state) => ({ state, sample: unsupportedSample(state, "visibility-hide") }),
  "visibility-show": (state) => ({ state, sample: unsupportedSample(state, "visibility-show") }),
  "layout-apply": (state, args) => {
    const next = applyLayout(state, args.positionCount)
    return { state: next, sample: fillSample(next, "layout-apply", "1 frame", performance.now(), 0, 1) }
  },
  "layout-run": (state) => ({ state, sample: unsupportedSample(state, "layout-run") }),
  "position-animation": (state, args) => {
    const { nodeCount, frames, durationMs } = args
    const framesN = Math.max(1, Math.floor(frames))
    const budget = durationMs / framesN
    const next: CanvasKitScenarioState = {
      ...state,
      bench: { ...state.bench, frameDurations: Array.from({ length: framesN }, (_, index) => budget + (index % 5)) },
    }
    return {
      state: next,
      sample: {
        ...fillSample(next, "position-animation", `${framesN} frames`, performance.now(), durationMs, framesN),
        uploadBytes: measureUploadBytes(state.geometry, nodeCount),
      },
    }
  },
  "style-animation": (state) => ({ state, sample: unsupportedSample(state, "style-animation") }),
  "node-click": (state) => ({ state, sample: unsupportedSample(state, "node-click") }),
  "box-select": (state) => ({ state, sample: unsupportedSample(state, "box-select") }),
  "node-hover": (state) => ({ state, sample: unsupportedSample(state, "node-hover") }),
  "node-pick": (state) => ({ state, sample: unsupportedSample(state, "node-pick") }),
  "graph-load": (state) => ({ state, sample: unsupportedSample(state, "graph-load") }),
  "graph-clear": (state) => ({ state, sample: unsupportedSample(state, "graph-clear") }),
  "graph-replace": (state, args) => {
    const next: CanvasKitScenarioState = { ...state, disposed: false, generation: state.generation + 1 }
    return {
      state: next,
      sample: {
        ...fillSample(next, "graph-replace", "replace", performance.now(), 0, 1),
        fixture: args.fixture,
        uploadBytes: measureUploadBytes(state.geometry, state.geometry.nodeCount),
      },
    }
  },
  "graph-dispose": (state) => {
    const next: CanvasKitScenarioState = { ...state, renderer: null, disposed: true, generation: state.generation + 1 }
    return { state: next, sample: fillSample(next, "graph-dispose", "dispose", performance.now(), 0, 0) }
  },
  "graph-reload": (state) => ({ state, sample: unsupportedSample(state, "graph-reload") }),
  "labels-none": (state) => ({ state, sample: unsupportedSample(state, "labels-none") }),
  "labels-visible": (state) => ({ state, sample: unsupportedSample(state, "labels-visible") }),
  "labels-fixed-count": (state) => ({ state, sample: unsupportedSample(state, "labels-fixed-count") }),
  "labels-dense": (state) => ({ state, sample: unsupportedSample(state, "labels-dense") }),
}

export function reduce(
  state: CanvasKitScenarioState,
  event: { scenario: BenchScenario; args: BenchScenarioArguments[BenchScenario] },
  rendererFactory: (() => Scene) | null = null,
): BenchScenarioResult<CanvasKitScenarioState, CanvasKitScenarioSample> {
  const handler = handlers[event.scenario] as unknown as (
    state: CanvasKitScenarioState,
    args: never,
  ) => BenchScenarioResult<CanvasKitScenarioState, CanvasKitScenarioSample>
  const result = handler(state, event.args as never)
  let next = result.state
  if (event.scenario === "graph-replace" && rendererFactory) {
    next = replaceRenderer(next, rendererFactory())
  }
  return { state: next, sample: { ...result.sample } }
}

export const SCENARIO_KEYS = [...BENCH_SCENARIOS] as BenchScenario[]
