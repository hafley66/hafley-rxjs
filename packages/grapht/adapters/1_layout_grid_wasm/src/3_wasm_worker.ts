import { parentPort, workerData } from "node:worker_threads"
import { performance } from "node:perf_hooks"
import { readFile } from "node:fs/promises"
import type { LayoutParameters } from "./2_layout.js"
export type WasmWorkerRequest = { kind: "layout"; wasmPath: string; nodeCount: number; edges: Uint32Array; parameters: LayoutParameters }
export type WasmWorkerResponse = { kind: "layout-result"; positions: Float32Array; loadNs: number; instantiateNs: number; layoutNs: number; nodeCount: number; edgeCount: number }
type Exports = { memory: WebAssembly.Memory; alloc(size: number): number; reset_arena(): void; layout(edges: number, edgeCount: number, nodes: number, positions: number, spacing: number, margin: number, columns: number): number }
async function run(request: WasmWorkerRequest): Promise<WasmWorkerResponse> {
  const loadStarted = performance.now()
  const bytes = await readFile(request.wasmPath)
  const loadNs = Math.round((performance.now() - loadStarted) * 1e6)
  const instantiateStarted = performance.now()
  const { instance } = await WebAssembly.instantiate(bytes)
  const instantiateNs = Math.round((performance.now() - instantiateStarted) * 1e6)
  const exports = instance.exports as unknown as Exports
  exports.reset_arena()
  const edgeBytes = Math.max(8, request.edges.byteLength)
  const edgesPointer = exports.alloc(edgeBytes)
  const positionsPointer = exports.alloc(Math.max(8, request.nodeCount * 2 * 4))
  new Uint32Array(exports.memory.buffer, edgesPointer, request.edges.length).set(request.edges)
  const layoutStarted = performance.now()
  exports.layout(edgesPointer, request.edges.length / 2, request.nodeCount, positionsPointer, request.parameters.spacing, request.parameters.margin, request.parameters.columns ?? 0)
  const layoutNs = Math.round((performance.now() - layoutStarted) * 1e6)
  const positions = new Float32Array(request.nodeCount * 2)
  positions.set(new Float32Array(exports.memory.buffer, positionsPointer, positions.length))
  return { kind: "layout-result", positions, loadNs, instantiateNs, layoutNs, nodeCount: request.nodeCount, edgeCount: request.edges.length / 2 }
}
if (!parentPort) throw new Error("Wasm worker requires parent port")
parentPort.on("message", async (message: unknown) => { try { const response = await run(message as WasmWorkerRequest); parentPort?.postMessage(response, [response.positions.buffer as ArrayBuffer]) } catch (error) { parentPort?.postMessage({ kind: "error", message: error instanceof Error ? error.message : String(error) }) } })
