import { sequenceFlowOf, type SequenceGraph } from "@hafley66/grapht-model"
import type { HoverOptions } from "./16_neighborhood.js"

/** Traverse ordered message events, including fork/join branches, then paint their actor endpoints. */
export function sequenceNeighborhood(graph: SequenceGraph, focus: ReadonlySet<string>, options: HoverOptions): Record<string, number> {
  if (options.mode === "off" || !focus.size) return {}
  const flow = sequenceFlowOf(graph)
  const hops: Record<string, number> = {}, queue: string[] = []
  const add = (id: string, distance: number) => {
    if (hops[id] !== undefined && hops[id] <= distance) return
    hops[id] = distance; queue.push(id)
  }
  for (const id of focus) {
    if (!graph[id]) continue
    add(id, 0)
    if (graph[id].type === "node") {
      for (const item of Object.values(graph)) if (item.type === "edge" && (item.fromId === id || item.toId === id)) add(item.id, 0)
    }
  }
  const limit = options.mode === "neighbors" ? 1 : Math.max(0, Math.floor(options.depth))
  for (let at = 0; at < queue.length; at++) {
    const id = queue[at], distance = hops[id]
    for (const item of Object.values(graph)) if (item.parentId === id) add(item.id, distance)
    if (distance >= limit) continue
    const next = options.mode === "upstream" ? flow.previousById[id] ?? [] : options.mode === "downstream" ? flow.nextById[id] ?? [] : [...(flow.previousById[id] ?? []), ...(flow.nextById[id] ?? [])]
    for (const other of next) add(other, distance + 1)
  }
  for (const [id, distance] of Object.entries(hops)) {
    const item = graph[id]
    if (item?.type === "edge") for (const endpoint of [item.fromId, item.toId]) hops[endpoint] = Math.min(hops[endpoint] ?? Infinity, distance)
  }
  return hops
}
