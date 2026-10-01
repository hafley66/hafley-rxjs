import { fsRoutes } from "../lib/5_fsRoutes.js"
import type { Graph } from "@hafley66/grapht-model"
import { FS, type FsHints } from "./12a_fs.js"

/** Traverse in FS order; each step is (+/-step, +step), bouncing at lane ends. */
export function zigzag(hints: FsHints & { columns?: number; step?: number } = {}) {
  const columns = hints.columns ?? 3
  const step = hints.step ?? 160
  if (!Number.isInteger(columns) || columns < 2) throw new Error("zigzag columns must be an integer >= 2")
  if (!Number.isFinite(step) || step < 160) throw new Error("zigzag step must be >= 160")
  const fs = FS(hints)
  return (graph: Graph, signal: AbortSignal) => {
    const geometry = fs(graph, signal)
    if (Object.values(graph).some(item => item.type === "edge" && (graph[item.fromId].type === "edge" || graph[item.toId].type === "edge"))) {
      throw new Error("zigzag supports node-to-node edges only")
    }
    const endpointAnchorById = { ...geometry.endpointAnchorById }
    const period = 2 * (columns - 1)
    Object.values(geometry.boundsById).sort((a, b) => a.y - b.y).forEach((bounds, row) => {
      const phase = row % period
      bounds.x = 24 + Math.min(phase, period - phase) * step
      bounds.y = 24 + row * step
    })
    for (const [id, b] of Object.entries(geometry.boundsById)) {
      endpointAnchorById[id] = { x: b.x + b.width / 2, y: b.y + b.height / 2 }
    }
    const routesById = fsRoutes(graph, geometry.boundsById, endpointAnchorById, new Set(hints.symlinks), true)
    return { ...geometry, endpointAnchorById, routesById, revisionId: `zigzag:${columns}:${step}:${geometry.revisionId}` }
  }
}
