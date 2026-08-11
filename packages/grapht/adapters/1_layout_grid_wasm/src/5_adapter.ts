import { performance } from "node:perf_hooks"
import { Worker } from "node:worker_threads"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { compactGraphToArrays, positionsToJson, sha256, writeGeometry } from "./1_geometry.js"
import { parseLayoutParameters } from "./2_layout.js"
import { IMPLEMENTATION, type BenchInput, type BenchResult, type BenchSample } from "./0_protocol.js"
import { resolveGraph } from "./4_fixtures.js"
import type { WasmWorkerRequest, WasmWorkerResponse } from "./3_wasm_worker.js"
export type AdapterOutput = { samples: BenchSample[]; result: BenchResult }
const now = (): number => performance.now() * 1e6
const elapsed = (started: number): number => Math.max(0, Math.round(now() - started))
const sample = (runId: string, phase: string, startedNs: number, counters: Record<string, number>): BenchSample => ({ protocol: "grapht-bench/0", type: "sample", runId, phase, startedNs: Math.round(startedNs), endedNs: Math.round(now()), counters })
export async function runAdapter(input: BenchInput, parseNs: number): Promise<AdapterOutput> {
  if (input.operation !== "layout") throw new Error(`unsupported operation: ${input.operation}`)
  const totalStart = now(); const graph = resolveGraph(input); const compact = compactGraphToArrays(graph); const parameters = parseLayoutParameters(input.parameters)
  const spawnStart = now(); const worker = new Worker(new URL("./3_wasm_worker.js", import.meta.url), { workerData: {} }); const spawnNs = elapsed(spawnStart)
  const transferStart = now(); const edges = new Uint32Array(compact.edges)
  const response = await new Promise<WasmWorkerResponse>((resolve, reject) => { worker.once("error", reject); worker.once("message", (message: unknown) => { if ((message as { kind?: string }).kind === "error") reject(new Error((message as { message: string }).message)); else resolve(message as WasmWorkerResponse) }); const request: WasmWorkerRequest = { kind: "layout", wasmPath: join(new URL("..", import.meta.url).pathname, "wasm", "grapht_layout_wasm.wasm"), nodeCount: compact.nodeCount, edges, parameters }; worker.postMessage(request, [edges.buffer]) })
  const transferNs = elapsed(transferStart); await worker.terminate()
  const serializeStart = now(); await mkdir(input.outputDirectory, { recursive: true }); const geometry = await writeGeometry(input.outputDirectory, response.positions, compact.edges, graph.nodeIds); const positionsText = positionsToJson(response.positions, graph.nodeIds); await writeFile(join(input.outputDirectory, "positions.txt"), positionsText); const serializeNs = elapsed(serializeStart); const totalNs = elapsed(totalStart)
  const hashes = { ...geometry.hashes, positionsTxt: sha256(Buffer.from(positionsText)) }; const artifactHash = sha256(Buffer.from(JSON.stringify(hashes, Object.keys(hashes).sort())))
  const counters = { nodes: compact.nodeCount, edges: compact.edgeCount, parseNs, spawnNs, loadNs: response.loadNs, instantiateNs: response.instantiateNs, transferNs, layoutNs: response.layoutNs, serializeNs, totalNs }
  return { samples: [sample(input.runId, "load", totalStart, { bytes: 0 }), sample(input.runId, "instantiate", totalStart, {}), sample(input.runId, "transfer", transferStart, { workerRoundTripNs: Math.max(0, transferNs - response.layoutNs) }), sample(input.runId, "layout", totalStart, { nodes: compact.nodeCount, edges: compact.edgeCount }), sample(input.runId, "serialize", serializeStart, { nodes: compact.nodeCount, edges: compact.edgeCount }), sample(input.runId, "total", totalStart, { nodes: compact.nodeCount, edges: compact.edgeCount })], result: { protocol: "grapht-bench/0", type: "result", runId: input.runId, implementation: IMPLEMENTATION, operation: "layout", artifact: "geometry.manifest.json", artifactHash, counters } }
}
