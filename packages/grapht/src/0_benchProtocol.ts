import { z } from "zod"

export const BENCH_PROTOCOL = "grapht-bench/0"
export const GEOMETRY_PROTOCOL = "grapht-geometry/0"

export const benchOperationSchema = z.enum(["layout", "render", "interaction"])
export type BenchOperation = z.infer<typeof benchOperationSchema>

export interface BenchScenarioArguments {
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

export type BenchScenario = keyof BenchScenarioArguments

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
] as const satisfies readonly BenchScenario[]
type MissingBenchScenario = Exclude<BenchScenario, typeof BENCH_SCENARIOS[number]>
const BENCH_SCENARIOS_ARE_EXHAUSTIVE: MissingBenchScenario extends never ? true : never = true
void BENCH_SCENARIOS_ARE_EXHAUSTIVE
export const benchScenarioSchema = z.enum(BENCH_SCENARIOS)

export type BenchScenarioEvent<S extends BenchScenario = BenchScenario> = {
  [K in S]: { scenario: K; args: BenchScenarioArguments[K] }
}[S]

export type BenchScenarioCases = {
  [S in BenchScenario]: readonly BenchScenarioEvent<S>[]
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

export async function reduceBenchScenario<State, Sample>(
  state: State,
  event: BenchScenarioEvent,
  handlers: BenchScenarioHandlers<State, Sample>,
): Promise<BenchScenarioResult<State, Sample>> {
  switch (event.scenario) {
    case "camera-pan": return handlers["camera-pan"](state, event.args)
    case "camera-wheel-zoom": return handlers["camera-wheel-zoom"](state, event.args)
    case "camera-pinch-zoom": return handlers["camera-pinch-zoom"](state, event.args)
    case "style-update": return handlers["style-update"](state, event.args)
    case "position-update": return handlers["position-update"](state, event.args)
    case "viewport-resize": return handlers["viewport-resize"](state, event.args)
    case "device-pixel-ratio-change": return handlers["device-pixel-ratio-change"](state, event.args)
    case "group-collapse": return handlers["group-collapse"](state, event.args)
    case "group-expand": return handlers["group-expand"](state, event.args)
    case "node-insert": return handlers["node-insert"](state, event.args)
    case "node-delete": return handlers["node-delete"](state, event.args)
    case "edge-insert": return handlers["edge-insert"](state, event.args)
    case "edge-delete": return handlers["edge-delete"](state, event.args)
    case "visibility-hide": return handlers["visibility-hide"](state, event.args)
    case "visibility-show": return handlers["visibility-show"](state, event.args)
    case "layout-apply": return handlers["layout-apply"](state, event.args)
    case "layout-run": return handlers["layout-run"](state, event.args)
    case "position-animation": return handlers["position-animation"](state, event.args)
    case "style-animation": return handlers["style-animation"](state, event.args)
    case "node-click": return handlers["node-click"](state, event.args)
    case "box-select": return handlers["box-select"](state, event.args)
    case "node-hover": return handlers["node-hover"](state, event.args)
    case "node-pick": return handlers["node-pick"](state, event.args)
    case "graph-load": return handlers["graph-load"](state, event.args)
    case "graph-clear": return handlers["graph-clear"](state, event.args)
    case "graph-replace": return handlers["graph-replace"](state, event.args)
    case "graph-dispose": return handlers["graph-dispose"](state, event.args)
    case "graph-reload": return handlers["graph-reload"](state, event.args)
    case "labels-none": return handlers["labels-none"](state, event.args)
    case "labels-visible": return handlers["labels-visible"](state, event.args)
    case "labels-fixed-count": return handlers["labels-fixed-count"](state, event.args)
    case "labels-dense": return handlers["labels-dense"](state, event.args)
  }
  const exhaustive: never = event
  return exhaustive
}

export const benchInputSchema = z.object({
  protocol: z.literal(BENCH_PROTOCOL),
  runId: z.string().min(1),
  fixture: z.string().min(1),
  operation: benchOperationSchema,
  scenario: benchScenarioSchema.optional(),
  input: z.string().optional(),
  outputDirectory: z.string().min(1),
  parameters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
})
export type BenchInput = z.infer<typeof benchInputSchema>

export const benchSampleSchema = z.object({
  protocol: z.literal(BENCH_PROTOCOL),
  type: z.literal("sample"),
  runId: z.string().min(1),
  phase: z.string().min(1),
  startedNs: z.number().finite(),
  endedNs: z.number().finite(),
  counters: z.record(z.string(), z.number()).default({}),
})
export type BenchSample = z.infer<typeof benchSampleSchema>

export const benchResultSchema = z.object({
  protocol: z.literal(BENCH_PROTOCOL),
  type: z.literal("result"),
  runId: z.string().min(1),
  implementation: z.string().min(1),
  operation: benchOperationSchema,
  scenario: benchScenarioSchema.optional(),
  artifact: z.string().optional(),
  artifactHash: z.string().optional(),
  counters: z.record(z.string(), z.number()).default({}),
})
export type BenchResult = z.infer<typeof benchResultSchema>

export const benchErrorSchema = z.object({
  protocol: z.literal(BENCH_PROTOCOL),
  type: z.literal("error"),
  runId: z.string().min(1),
  message: z.string().min(1),
})
export type BenchError = z.infer<typeof benchErrorSchema>

export const benchOutputSchema = z.discriminatedUnion("type", [benchSampleSchema, benchResultSchema, benchErrorSchema])
export type BenchOutput = z.infer<typeof benchOutputSchema>

export function parseBenchInput(text: string): BenchInput {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error("empty input: expected a single BenchInput JSON object on stdin")
  }
  const parsed = JSON.parse(trimmed) as unknown
  return benchInputSchema.parse(parsed)
}

export type JsonlEntry<T> =
  | { ok: true; line: number; value: T }
  | { ok: false; line: number; text: string; error: string }

export function parseJsonl<T>(text: string, schema: z.ZodSchema<T>): JsonlEntry<T>[] {
  const lines = text.split("\n")
  const entries: JsonlEntry<T>[] = []
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = i + 1
    const trimmed = raw.trim()
    if (trimmed === "") continue
    let parsed: unknown
    try {
      parsed = JSON.parse(trimmed)
    } catch (e) {
      entries.push({ ok: false, line, text: raw, error: `invalid JSON: ${(e as Error).message}` })
      continue
    }
    const result = schema.safeParse(parsed)
    if (result.success) {
      entries.push({ ok: true, line, value: result.data as T })
    } else {
      entries.push({
        ok: false,
        line,
        text: raw,
        error: `schema error: ${result.error.issues
          .map(issue => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
          .join("; ")}`,
      })
    }
  }
  return entries
}

export type OutputRecord = { line: number; value: BenchOutput }
export type Terminal = { kind: "result"; value: BenchResult } | { kind: "error"; value: BenchError }
export type OutputIssue = { line: number; message: string }

export type OutputAnalysis = {
  samples: BenchSample[]
  terminal: Terminal | null
  issues: OutputIssue[]
}

export function analyzeOutput(records: OutputRecord[], runId: string): OutputAnalysis {
  const samples: BenchSample[] = []
  let terminal: Terminal | null = null
  const issues: OutputIssue[] = []
  for (const record of records) {
    if (record.value.runId !== runId) {
      issues.push({
        line: record.line,
        message: `runId mismatch: expected ${runId}, got ${record.value.runId}`,
      })
      continue
    }
    if (record.value.type === "sample") {
      samples.push(record.value)
    } else if (terminal) {
      issues.push({
        line: record.line,
        message: `duplicate terminal: a ${record.value.type} follows an earlier ${terminal.kind}`,
      })
    } else if (record.value.type === "result") {
      terminal = { kind: "result", value: record.value }
    } else {
      terminal = { kind: "error", value: record.value }
    }
  }
  if (!terminal) {
    issues.push({ line: 0, message: "no terminal record (BenchResult or BenchError) found" })
  }
  return { samples, terminal, issues }
}

export function operationLabel(operation: BenchOperation): string {
  return operation
}
