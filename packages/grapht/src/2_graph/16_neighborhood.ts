import type { Graph, GraphId } from "@hafley66/grapht-model"

export type HoverMode = "off" | "neighbors" | "upstream" | "downstream" | "both"
export type HoverOptions = { mode: HoverMode; depth: number; components?: ReadonlySet<GraphId> }

/** Breadth-first traversal gives every branch the same distance; cycles retain shortest paths.
 * Edge focus starts at its endpoints. Group focus starts at descendant nodes. Ownership does
 * not consume a hop; traversing a message/edge consumes one. Source order is never rewritten.
 */
export function graphNeighborhood(graph: Graph, focus: ReadonlySet<GraphId>, options: HoverOptions): Record<GraphId, number> {
  if (options.mode === "off" || !focus.size) return {}
  const representatives = hoverRepresentatives(graph, options.components)
  const hops: Record<GraphId, number> = {}
  const queue: string[] = []
  const add = (id: string, distance: number) => {
    id = representatives[id] ?? id
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
    const from = representatives[item.fromId] ?? item.fromId, to = representatives[item.toId] ?? item.toId
    if (from === to && from !== item.fromId) continue
    if (forward) edges.set(from, [...(edges.get(from) ?? []), { id: item.id, next: to }])
    if (backward) edges.set(to, [...(edges.get(to) ?? []), { id: item.id, next: from }])
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
  for (const [id, representative] of Object.entries(representatives)) if (hops[representative] !== undefined) hops[id] = hops[representative]
  for (const item of Object.values(graph)) if (item.type === "edge" && representatives[item.fromId] && representatives[item.fromId] === representatives[item.toId] && hops[representatives[item.fromId]] !== undefined) hops[item.id] = hops[representatives[item.fromId]]
  return groupHeaderHops(graph, hops)
}

/** Focus and first-hop neighbors share full intensity; subsequent hops fade geometrically. */
export function hoverOpacity(hop: number | undefined, active: boolean): number {
  return !active ? 1 : hop === undefined ? 0.15 : Math.pow(0.55, Math.max(0, hop - 1))
}

/** Outermost selected ownership component is one traversal node; source IDs stay intact. */
export function hoverRepresentatives(graph: Graph, components?: ReadonlySet<GraphId>): Record<string, string> {
  const representatives: Record<string, string> = {}
  if (!components?.size) return representatives
  for (const item of Object.values(graph)) {
    let id: string | undefined = item.id
    const seen = new Set<string>()
    while (id && !seen.has(id)) {
      seen.add(id)
      if (components.has(id)) representatives[item.id] = id
      id = graph[id]?.parentId
    }
  }
  return representatives
}

/** Header paint follows the closest reached member without expanding unrelated siblings. */
export function groupHeaderHops(graph: Graph, hops: Record<string, number>): Record<string, number> {
  for (const [id, distance] of Object.entries(hops)) {
    let parent = graph[id]?.parentId
    const seen = new Set<string>()
    while (parent && !seen.has(parent)) {
      seen.add(parent)
      hops[parent] = Math.min(hops[parent] ?? Infinity, distance)
      parent = graph[parent]?.parentId
    }
  }
  return hops
}
