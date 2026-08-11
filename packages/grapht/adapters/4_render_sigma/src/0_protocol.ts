export const BENCH_PROTOCOL = "grapht-bench/0" as const
export const GEOMETRY_PROTOCOL = "grapht-geometry/0" as const

export type BenchOperation = "layout" | "render" | "interaction"

export type BenchInput = {
  protocol: typeof BENCH_PROTOCOL
  runId: string
  fixture: string
  operation: BenchOperation
  input?: string
  outputDirectory: string
  parameters: Record<string, string | number | boolean>
}

export type BenchSample = {
  protocol: typeof BENCH_PROTOCOL
  type: "sample"
  runId: string
  phase: string
  startedNs: number
  endedNs: number
  counters: Record<string, number>
}

export type BenchResult = {
  protocol: typeof BENCH_PROTOCOL
  type: "result"
  runId: string
  implementation: "sigma"
  operation: BenchOperation
  artifact?: string
  artifactHash?: string
  counters: Record<string, number>
}

export type BenchError = {
  protocol: typeof BENCH_PROTOCOL
  type: "error"
  runId: string
  message: string
}

export type BenchOutput = BenchSample | BenchResult | BenchError

export type GeometryManifest = {
  protocol: typeof GEOMETRY_PROTOCOL
  nodeIds: string
  positions: string
  edges: string
  nodeCount: number
  edgeCount: number
  scalar: "f32-le"
}

export type Geometry = {
  nodeIds: string[]
  positions: Float32Array
  edges: [number, number][]
}

let runCounter = 0

export function newRunId(prefix: string): string {
  runCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${runCounter}`
}

export type PhaseName =
  | "load"
  | "import"
  | "init"
  | "firstRender"
  | "zoom"
  | "pan"
  | "pick"
  | "cameraReadback"
  | "visibleCount"
  | "dispose"

export class Sampler {
  readonly records: BenchOutput[] = []

  constructor(readonly runId: string) {}

  sample(phase: PhaseName, counters: Record<string, number> = {}, startedNs?: number, endedNs?: number): void {
    const s = startedNs ?? performance.now()
    const e = endedNs ?? performance.now()
    this.records.push({ protocol: BENCH_PROTOCOL, type: "sample", runId: this.runId, phase, startedNs: s, endedNs: e, counters })
  }

  result(counters: Record<string, number>, artifact?: string, artifactHash?: string): void {
    this.records.push({ protocol: BENCH_PROTOCOL, type: "result", runId: this.runId, implementation: "sigma", operation: "render", artifact, artifactHash, counters })
  }

  error(message: string): void {
    this.records.push({ protocol: BENCH_PROTOCOL, type: "error", runId: this.runId, message })
  }

  toJsonl(): string {
    return this.records.map(record => JSON.stringify(record)).join("\n")
  }
}
