export type BenchOperation = "layout" | "render" | "interaction"

export type BenchInput = {
  protocol: "grapht-bench/0"
  runId: string
  fixture: string
  operation: BenchOperation
  input?: string
  outputDirectory: string
  parameters: Record<string, string | number | boolean>
}

export type BenchSample = {
  protocol: "grapht-bench/0"
  type: "sample"
  runId: string
  phase: string
  startedNs: number
  endedNs: number
  counters: Record<string, number>
}

export type BenchResult = {
  protocol: "grapht-bench/0"
  type: "result"
  runId: string
  implementation: string
  operation: BenchOperation
  artifact?: string
  artifactHash?: string
  counters: Record<string, number>
}

export type BenchError = {
  protocol: "grapht-bench/0"
  type: "error"
  runId: string
  message: string
}

export type BenchOutput = BenchSample | BenchResult | BenchError

export type GeometryManifest = {
  protocol: "grapht-geometry/0"
  nodeIds: string
  positions: string
  edges: string
  nodeCount: number
  edgeCount: number
  scalar: "f32-le"
}

export const BENCH_PROTOCOL = "grapht-bench/0"
export const GEOMETRY_PROTOCOL = "grapht-geometry/0"
export const IMPLEMENTATION = "layout-grid-worker"

export function isBenchInput(value: unknown): value is BenchInput {
  if (typeof value !== "object" || value === null) return false
  const record = value as Record<string, unknown>
  const params = record.parameters
  return record.protocol === BENCH_PROTOCOL &&
    typeof record.runId === "string" && record.runId.length > 0 &&
    typeof record.fixture === "string" && record.fixture.length > 0 &&
    (record.operation === "layout" || record.operation === "render" || record.operation === "interaction") &&
    typeof record.outputDirectory === "string" &&
    typeof params === "object" && params !== null && !Array.isArray(params)
}

export function encodeJsonLine(value: unknown): string {
  return `${JSON.stringify(value)}\n`
}
