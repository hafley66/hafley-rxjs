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

export type BenchScenarioEvent<S extends BenchScenario = BenchScenario> = S extends BenchScenario
  ? { scenario: S; args: BenchScenarioArguments[S] }
  : never

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

export async function reduceBenchScenario<State, S extends BenchScenario, Sample>(
  state: State,
  event: { scenario: S; args: BenchScenarioArguments[S] },
  handlers: BenchScenarioHandlers<State, Sample>,
): Promise<BenchScenarioResult<State, Sample>> {
  const handler = handlers[event.scenario] as BenchScenarioHandler<State, S, Sample>
  return handler(state, event.args)
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
