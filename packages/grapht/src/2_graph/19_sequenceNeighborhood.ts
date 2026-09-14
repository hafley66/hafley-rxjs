import { sequenceFlowOf, type SequenceGraph } from "@hafley66/grapht-model"
import { groupHeaderHops, hoverRepresentatives, type HoverOptions } from "./16_neighborhood.js"

/** Traverse ordered message events, including fork/join branches, then paint their actor endpoints. */
export function sequenceNeighborhood(graph: SequenceGraph, focus: ReadonlySet<string>, options: HoverOptions): Record<string, number> {
  if (options.mode === "off" || !focus.size) return {}
  const flow = sequenceFlowOf(graph)
  const representatives = hoverRepresentatives(graph, options.components)
  const previous: Record<string, Set<string>> = {}, next: Record<string, Set<string>> = {}
  for (const [id, targets] of Object.entries(flow.nextById)) for (const target of targets) {
    const from = representatives[id] ?? id, to = representatives[target] ?? target
    if (from === to) continue
    ;(next[from] ??= new Set()).add(to); (previous[to] ??= new Set()).add(from)
  }
  const hops: Record<string, number> = {}, queue: string[] = []
  const add = (id: string, distance: number) => {
    id = representatives[id] ?? id
    if (hops[id] !== undefined && hops[id] <= distance) return
    hops[id] = distance; queue.push(id)
  }
  for (const id of focus) {
    if (!graph[id]) continue
    add(id, 0)
    if (graph[id].type === "node") {
      for (const item of Object.values(graph)) if (item.type === "edge" && ((representatives[item.fromId] ?? item.fromId) === (representatives[id] ?? id) || (representatives[item.toId] ?? item.toId) === (representatives[id] ?? id))) add(item.id, 0)
    }
  }
  const limit = options.mode === "neighbors" ? 1 : Math.max(0, Math.floor(options.depth))
  for (let at = 0; at < queue.length; at++) {
    const id = queue[at], distance = hops[id]
    for (const item of Object.values(graph)) if (item.parentId === id) add(item.id, distance)
    if (graph[id]?.type === "node" && distance === 0) {
      for (const item of Object.values(graph)) if (item.type === "edge" && ((representatives[item.fromId] ?? item.fromId) === (representatives[id] ?? id) || (representatives[item.toId] ?? item.toId) === (representatives[id] ?? id))) add(item.id, 0)
    }
    if (distance >= limit) continue
    const neighbors = options.mode === "upstream" ? previous[id] ?? [] : options.mode === "downstream" ? next[id] ?? [] : [...(previous[id] ?? []), ...(next[id] ?? [])]
    for (const other of neighbors) add(other, distance + 1)
  }
  for (const [id, representative] of Object.entries(representatives)) if (hops[representative] !== undefined) hops[id] = hops[representative]
  for (const [id, distance] of Object.entries(hops)) {
    const item = graph[id]
    if (item?.type === "edge") for (const endpoint of [item.fromId, item.toId]) hops[endpoint] = Math.min(hops[endpoint] ?? Infinity, distance)
  }
  return groupHeaderHops(graph, hops)
}
