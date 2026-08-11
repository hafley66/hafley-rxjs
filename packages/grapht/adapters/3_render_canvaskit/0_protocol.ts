import { z } from "zod"

export const BENCH_PROTOCOL = "grapht-bench/0"
export const GEOMETRY_PROTOCOL = "grapht-geometry/0"

export const benchOperationSchema = z.enum(["layout", "render", "interaction"])
export type BenchOperation = z.infer<typeof benchOperationSchema>

export const benchInputSchema = z.object({
  protocol: z.literal(BENCH_PROTOCOL),
  runId: z.string().min(1),
  fixture: z.string().min(1),
  operation: benchOperationSchema,
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

export const benchOutputSchema = z.discriminatedUnion("type", [
  benchSampleSchema,
  benchResultSchema,
  benchErrorSchema,
])
export type BenchOutput = z.infer<typeof benchOutputSchema>

export const geometryManifestSchema = z.object({
  protocol: z.literal(GEOMETRY_PROTOCOL),
  nodeIds: z.string().min(1),
  positions: z.string().min(1),
  edges: z.string().min(1),
  nodeCount: z.number().int().nonnegative(),
  edgeCount: z.number().int().nonnegative(),
  scalar: z.literal("f32-le"),
})
export type GeometryManifest = z.infer<typeof geometryManifestSchema>

export type Geometry = {
  nodeIds: string[]
  positions: Float32Array
  edges: [number, number][]
  nodeCount: number
  edgeCount: number
}

export function nowNs(): number {
  return Number(process?.hrtime?.bigint?.() ?? performance.now() * 1e6)
}

export function sample(
  runId: string,
  phase: string,
  startedNs: number,
  endedNs: number,
  counters: Record<string, number> = {},
): BenchSample {
  return { protocol: BENCH_PROTOCOL, type: "sample", runId, phase, startedNs, endedNs, counters }
}

export function computeInitial(bench: BenchInput): string | undefined {
  return bench.input
}
