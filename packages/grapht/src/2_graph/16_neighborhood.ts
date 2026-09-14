import type { Graph, GraphId } from "@hafley66/grapht-model"

export type HoverMode = "off" | "neighbors" | "upstream" | "downstream" | "both"
export type HoverOptions = { mode: HoverMode; depth: number }

/** Breadth-first traversal gives every branch the same distance; cycles retain shortest paths.
 * Edge focus starts at its endpoints. Group focus starts at descendant nodes. Ownership does
 * not consume a hop; traversing a message/edge consumes one. Source order is never rewritten.
 */
export function graphNeighborhood(graph: Graph, focus: ReadonlySet<GraphId>, options: HoverOptions): Record<GraphId, number> {
  if (options.mode === "off" || !focus.size) return {}
  const hops: Record<GraphId, number> = {}
  const queue: string[] = []
  const add = (id: string, distance: number) => {
    if (!graph[id] || (hops[id] !== undefined && hops[id] <= distance)) return
    hops[id] = distance
    queue.push(id)
  }
  const children = new Map<string, string[]>()
  const edges = new Map<string, { id: string; next: string }[]>()
  for (const item of Object.values(graph)) {
    if (item.parentId) children.set(item.parentId, [...(children.get(item.parentId) ?? []), item.id])
    if (item.type !== "edge") continue
    const forward = options.mode !== "upstream" || item.direction !== "forward"
    const backward = options.mode !== "downstream" || item.direction !== "forward"
    if (forward) edges.set(item.fromId, [...(edges.get(item.fromId) ?? []), { id: item.id, next: item.toId }])
    if (backward) edges.set(item.toId, [...(edges.get(item.toId) ?? []), { id: item.id, next: item.fromId }])
  }
  for (const id of focus) {
    add(id, 0)
    const item = graph[id]
    if (item?.type === "edge") { add(item.fromId, 0); add(item.toId, 0) }
  }
  const limit = options.mode === "neighbors" ? 1 : Math.max(0, Math.floor(options.depth))
  for (let at = 0; at < queue.length; at++) {
    const id = queue[at], distance = hops[id]
    const item = graph[id]
    if (item.type === "edge") { add(item.fromId, distance); add(item.toId, distance) }
    for (const child of children.get(id) ?? []) add(child, distance)
    if (distance >= limit) continue
    for (const edge of edges.get(id) ?? []) {
      if (hops[edge.id] === undefined || hops[edge.id] > distance + 1) hops[edge.id] = distance + 1
      add(edge.next, distance + 1)
    }
  }
  return hops
}

/** Focus and first-hop neighbors share full intensity; subsequent hops fade geometrically. */
export function hoverOpacity(hop: number | undefined, active: boolean): number {
  return !active ? 1 : hop === undefined ? 0.15 : Math.pow(0.55, Math.max(0, hop - 1))
}
