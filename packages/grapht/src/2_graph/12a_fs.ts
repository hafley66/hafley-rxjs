import { validateGraph, type Graph } from "@hafley66/grapht-model"
import { fsRoutes } from "../lib/5_fsRoutes.js"
import type { GraphGeometry } from "./0_frame.js"

export type FsHints = {
  entrypoints?: readonly string[]
  order?: readonly string[]
  symlinks?: readonly string[]
}

/** ordered DFS forest, one row per item, one indent per depth. */
export function FS(hints: FsHints = {}) {
  return (graph: Graph, signal: AbortSignal): GraphGeometry => {
    signal.throwIfAborted()
    const diagnostics = validateGraph(graph)
    if (diagnostics.length) throw new Error(diagnostics.map(d => d.message).join("\n"))
    const ids = Object.keys(graph)
    if (ids.some(id => graph[id].type === "node" && graph[id].layout?.mode && graph[id].layout?.mode !== "managed")) {
      throw new Error("FS supports managed items only")
    }
    const rank = new Map(hints.order?.map((id, index) => [id, index]))
    ids.sort((a, b) => (rank.get(a) ?? Infinity) - (rank.get(b) ?? Infinity) || a.localeCompare(b))
    const children = new Map(ids.map(id => [id, [] as string[]]))
    const incoming = new Set<string>()
    const symlinks = new Set(hints.symlinks)
    for (const id of ids) {
      const item = graph[id]
      if (item.parentId !== undefined) {
        children.get(item.parentId)!.push(id)
        incoming.add(id)
      }
      if (item.type === "edge" && !symlinks.has(id) && graph[item.toId].parentId === undefined) {
        children.get(item.fromId)!.push(item.toId)
        incoming.add(item.toId)
      }
    }
    for (const list of children.values()) {
      list.sort((a, b) => (rank.get(a) ?? Infinity) - (rank.get(b) ?? Infinity) || a.localeCompare(b))
    }
    const roots = hints.entrypoints ?? ids.filter(id => graph[id].type === "node" && !incoming.has(id))
    for (const id of roots) if (!graph[id]) throw new Error(`Unknown FS entrypoint: ${id}`)
    const reserved = new Set(roots)
    const seen = new Set<string>()
    const boundsById: Record<string, { x: number; y: number; width: number; height: number }> = {}
    const endpointAnchorById: Record<string, { x: number; y: number }> = {}
    let row = 0
    // Explicit stack keeps deep paths independent of the JavaScript call stack.
    for (const root of [...roots, ...ids.filter(id => graph[id].type === "node")]) {
      const stack = [{ id: root, depth: 0 }]
      while (stack.length) {
        signal.throwIfAborted()
        const { id, depth } = stack.pop()!
        if (seen.has(id)) continue
        seen.add(id)
        const bounds = { x: 24 + depth * 32, y: 24 + row++ * 40, width: 144, height: 28 }
        if (graph[id].type === "node") boundsById[id] = bounds
        endpointAnchorById[id] = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
        const next = children.get(id)!
        for (let i = next.length - 1; i >= 0; i--) {
          if (!reserved.has(next[i])) stack.push({ id: next[i], depth: depth + 1 })
        }
      }
    }
    // Edge proxies support the model's edge-to-edge references too.
    for (const id of ids) {
      if (!endpointAnchorById[id]) endpointAnchorById[id] = { x: 240, y: 38 + row++ * 40 }
    }
    const routesById = fsRoutes(graph, boundsById, endpointAnchorById, symlinks)
    return {
      revisionId: `fs:${JSON.stringify([boundsById, endpointAnchorById, Object.entries(routesById).map(([id, points]) => [id, [...points]])])}`,
      boundsById, endpointAnchorById, routesById, headerBoundsById: {},
    }
  }
}
