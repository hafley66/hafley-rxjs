import type { Graph, GraphPoint, GraphRect } from "@hafley66/grapht-model"

/** Routes retain center endpoints so renderers can clip against their node shapes. */
export function fsRoutes(graph: Graph, bounds: Readonly<Record<string, GraphRect>>, anchors: Record<string, GraphPoint>, symlinks: ReadonlySet<string>, straight = false) {
  const gutter = Math.max(0, ...Object.values(bounds).map(b => b.x + b.width)) + 40
  const routes: Record<string, Float32Array> = {}
  for (const edge of Object.values(graph)) {
    if (edge.type !== "edge") continue
    const a = anchors[edge.fromId], b = anchors[edge.toId]
    const via = symlinks.has(edge.id)
      ? [gutter, a.y, gutter, b.y]
      : straight ? [] : [a.x, a.y + 20, (bounds[edge.fromId]?.x ?? a.x) + 8, a.y + 20, (bounds[edge.fromId]?.x ?? a.x) + 8, b.y]
    routes[edge.id] = new Float32Array([a.x, a.y, ...via, b.x, b.y])
    // Preserve edge-to-edge endpoint identity without allocating extra visible nodes.
    anchors[edge.id] = { x: via[0] ?? (a.x + b.x) / 2, y: via[1] ?? (a.y + b.y) / 2 }
  }
  return routes
}
