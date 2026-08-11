export type { Camera } from "./2_hitTest.js"
export { pan, zoomAt } from "./2_hitTest.js"

export const BENCH_SCENARIOS = [
  "camera-pan",
  "camera-wheel-zoom",
  "camera-pinch-zoom",
  "style-update",
  "position-update",
  "viewport-resize",
  "device-pixel-ratio-change",
  "group-collapse",
  "group-expand",
  "node-insert",
  "node-delete",
  "edge-insert",
  "edge-delete",
  "visibility-hide",
  "visibility-show",
  "layout-apply",
  "layout-run",
  "position-animation",
  "style-animation",
  "node-click",
  "box-select",
  "node-hover",
  "node-pick",
  "graph-load",
  "graph-clear",
  "graph-replace",
  "graph-dispose",
  "graph-reload",
  "labels-none",
  "labels-visible",
  "labels-fixed-count",
  "labels-dense",
] as const satisfies readonly string[]

export type BenchScenario = (typeof BENCH_SCENARIOS)[number]

export type BenchScenarioArguments = {
  "camera-pan": { dx: number; dy: number; frames: number }
  "camera-wheel-zoom": { deltaY: number; anchorX: number; anchorY: number; frames: number }
  "camera-pinch-zoom": { scale: number; anchorX: number; anchorY: number; frames: number }
  "style-update": { nodeCount: number; color: number }
  "position-update": { nodeCount: number; dx: number; dy: number }
  "viewport-resize": { width: number; height: number }
  "device-pixel-ratio-change": { pixelRatio: number }
  "group-collapse": { groupIds: readonly number[] }
  "group-expand": { groupIds: readonly number[] }
  "node-insert": { count: number }
  "node-delete": { count: number }
  "edge-insert": { count: number }
  "edge-delete": { count: number }
  "visibility-hide": { nodeCount: number; edgeCount: number }
  "visibility-show": { nodeCount: number; edgeCount: number }
  "layout-apply": { positionCount: number }
  "layout-run": { algorithm: string; iterations: number }
  "position-animation": { nodeCount: number; frames: number; durationMs: number }
  "style-animation": { nodeCount: number; frames: number; durationMs: number }
  "node-click": { nodeIndex: number }
  "box-select": { x: number; y: number; width: number; height: number }
  "node-hover": { nodeIndex: number }
  "node-pick": { x: number; y: number }
  "graph-load": { fixture: string }
  "graph-clear": Record<string, never>
  "graph-replace": { fixture: string }
  "graph-dispose": Record<string, never>
  "graph-reload": { fixture: string }
  "labels-none": Record<string, never>
  "labels-visible": Record<string, never>
  "labels-fixed-count": { count: number }
  "labels-dense": Record<string, never>
}

export type BenchScenarioResult<State, Sample = unknown> = {
  state: State
  sample: Sample
}

export type BenchScenarioHandler<State, S extends BenchScenario, Sample = unknown> = (
  state: State,
  args: BenchScenarioArguments[S],
) => BenchScenarioResult<State, Sample> | Promise<BenchScenarioResult<State, Sample>>

export type BenchScenarioHandlers<State, Sample = unknown> = {
  [S in BenchScenario]: BenchScenarioHandler<State, S, Sample>
}

export type FrameStatsRecord = {
  count: number
  p50Ms: number
  p95Ms: number
  maxMs: number
  droppedFrames: number
}

export function frameStats(durationsMs: number[], budgetMs: number): FrameStatsRecord {
  const sorted = [...durationsMs].sort((a, b) => a - b)
  const count = sorted.length
  if (count === 0) return { count: 0, p50Ms: 0, p95Ms: 0, maxMs: 0, droppedFrames: 0 }
  const p50 = sorted[Math.floor((count - 1) * 0.5)]
  const p95 = sorted[Math.floor((count - 1) * 0.95)]
  return {
    count,
    p50Ms: p50,
    p95Ms: p95,
    maxMs: sorted[count - 1],
    droppedFrames: sorted.filter(value => value > budgetMs).length,
  }
}

export function measureUploadBytes(
  geometry: { nodeCount: number; edgeCount: number },
  nodeCountTarget: number,
): number {
  const count = Math.max(0, Math.min(nodeCountTarget, geometry.nodeCount))
  const positionBytes = count * 2 * Float32Array.BYTES_PER_ELEMENT
  const edgeBytes = geometry.edgeCount * 2 * Uint32Array.BYTES_PER_ELEMENT
  return positionBytes + edgeBytes
}
