import { parentPort } from "node:worker_threads"
import { performance } from "node:perf_hooks"
import { layoutGrid, type LayoutParameters } from "./2_layout.js"

export type WorkerLayoutRequest = { kind: "layout"; nodeCount: number; edges: Uint32Array; parameters: LayoutParameters }
export type WorkerLayoutResponse = { kind: "layout-result"; positions: Float32Array; layoutNs: number; nodeCount: number; edgeCount: number }

function edgePairs(edges: Uint32Array): Array<[number, number]> {
  const pairs: Array<[number, number]> = []
  for (let index = 0; index + 1 < edges.length; index += 2) pairs.push([edges[index], edges[index + 1]])
  return pairs
}

export function runWorker(): void {
  if (!parentPort) throw new Error("worker thread must run with a parent port")
  parentPort.on("message", (message: unknown) => {
    try {
      const request = message as WorkerLayoutRequest
      if (request.kind !== "layout" || !(request.edges instanceof Uint32Array)) throw new Error("invalid worker layout request")
      const started = performance.now()
      const positions = layoutGrid(request.nodeCount, edgePairs(request.edges), request.parameters)
      const layoutNs = Math.round((performance.now() - started) * 1e6)
      parentPort?.postMessage({ kind: "layout-result", positions, layoutNs, nodeCount: request.nodeCount, edgeCount: request.edges.length / 2 } satisfies WorkerLayoutResponse, [positions.buffer as ArrayBuffer])
    } catch (error) {
      parentPort?.postMessage({ kind: "error", message: error instanceof Error ? error.message : String(error) })
    }
  })
}

if (parentPort) runWorker()
