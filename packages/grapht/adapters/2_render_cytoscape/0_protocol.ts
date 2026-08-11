import { z } from "zod"

export const BENCH_PROTOCOL = "grapht-bench/0"
export const GEOMETRY_PROTOCOL = "grapht-geometry/0"
export const benchOperationSchema = z.enum(["layout", "render", "interaction"])
export type BenchOperation = z.infer<typeof benchOperationSchema>
export const benchInputSchema = z.object({
  protocol: z.literal(BENCH_PROTOCOL), runId: z.string().min(1), fixture: z.string().min(1),
  operation: benchOperationSchema, input: z.string().optional(), outputDirectory: z.string().min(1),
  parameters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
})
export type BenchInput = z.infer<typeof benchInputSchema>
export const geometryManifestSchema = z.object({
  protocol: z.literal(GEOMETRY_PROTOCOL), nodeIds: z.string().min(1), positions: z.string().min(1),
  edges: z.string().min(1), nodeCount: z.number().int().nonnegative(), edgeCount: z.number().int().nonnegative(), scalar: z.literal("f32-le"),
})
export type GeometryManifest = z.infer<typeof geometryManifestSchema>
export type Geometry = { nodeIds: string[]; positions: Float32Array; edges: [number, number][]; nodeCount: number; edgeCount: number }
export type BenchSample = { protocol: typeof BENCH_PROTOCOL; type: "sample"; runId: string; phase: string; startedNs: number; endedNs: number; counters: Record<string, number> }
export type BenchResult = { protocol: typeof BENCH_PROTOCOL; type: "result"; runId: string; implementation: string; operation: BenchOperation; artifact?: string; artifactHash?: string; counters: Record<string, number> }
export type BenchError = { protocol: typeof BENCH_PROTOCOL; type: "error"; runId: string; message: string }
export function sample(runId: string, phase: string, startedNs: number, endedNs: number, counters: Record<string, number>): BenchSample {
  return { protocol: BENCH_PROTOCOL, type: "sample", runId, phase, startedNs, endedNs, counters }
}
