import type { Graph, GraphId } from "./6_graph.js"

export type GraphLayoutScope = {
  itemIds: readonly GraphId[]
  endpointIdByGraphId: Readonly<Record<GraphId, GraphId | undefined>>
}

function endpointIdOf(graph: Graph, id: GraphId): GraphId | undefined {
  const seen = new Set<GraphId>()
  let cursor: GraphId | undefined = id

  while (cursor !== undefined && !seen.has(cursor)) {
    seen.add(cursor)
    const item: Graph[string] | undefined = graph[cursor]
    if (item === undefined) return undefined
    if (item.type === "node") {
      if (item.layout?.mode === "excluded") return undefined
      if (item.layout?.mode === "sealed") return cursor
    }
    cursor = item.parentId
  }

  return seen.has(id) ? id : undefined
}

function participatesInOuterLayout(graph: Graph, id: GraphId): boolean {
  const endpointId = endpointIdOf(graph, id)
  return endpointId === id
}

/**
 * Selects the items visible to an outer layout and resolves logical endpoint
 * identities into that layout's geometry scope. Sealed nodes participate as
 * atomic nodes; their descendants resolve to the sealed node. Excluded nodes
 * and their descendants have no outer-scope endpoint.
 */
export function graphLayoutScopeOf(graph: Graph): GraphLayoutScope {
  const endpointIdByGraphId: Record<GraphId, GraphId | undefined> = {}
  const itemIds: GraphId[] = []

  for (const id of Object.keys(graph).sort()) {
    endpointIdByGraphId[id] = endpointIdOf(graph, id)
    if (participatesInOuterLayout(graph, id)) itemIds.push(id)
  }

  return { itemIds, endpointIdByGraphId }
}
