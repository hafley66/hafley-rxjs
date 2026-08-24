import { BENCH_SCENARIOS, type BenchScenario } from "./9_scenarioTypes.js"

export { BENCH_SCENARIOS }
export type { BenchScenario } from "./9_scenarioTypes.js"

export const SUPPORTED: readonly BenchScenario[] = [
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
]
