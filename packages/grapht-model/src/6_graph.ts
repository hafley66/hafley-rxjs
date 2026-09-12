export type GraphId = string

export type GraphItemBase<Data> = {
  id: GraphId
  parentId?: GraphId
  data?: Data
}

export type GraphNode<NodeData = unknown> = GraphItemBase<NodeData> & {
  type: "node"
}

export type GraphEdge<EdgeData = unknown> = GraphItemBase<EdgeData> & {
  type: "edge"
  fromId: GraphId
  toId: GraphId
  direction: "none" | "forward" | "both"
}

export type GraphItem<NodeData = unknown, EdgeData = unknown> =
  | GraphNode<NodeData>
  | GraphEdge<EdgeData>

export type Graph<NodeData = unknown, EdgeData = unknown> =
  Readonly<Record<GraphId, GraphItem<NodeData, EdgeData>>>

export type GraphDiagnosticCode =
  | "GRAPH_KEY_ID_MISMATCH"
  | "GRAPH_MISSING_PARENT"
  | "GRAPH_MISSING_EDGE_ENDPOINT"
  | "GRAPH_PARENT_CYCLE"

export type GraphDiagnostic = {
  code: GraphDiagnosticCode
  id: GraphId
  referenceId?: GraphId
  message: string
}

export type GraphIndexes = {
  childrenByParent: ReadonlyMap<GraphId, readonly GraphId[]>
  incomingByEndpoint: ReadonlyMap<GraphId, readonly GraphId[]>
  outgoingByEndpoint: ReadonlyMap<GraphId, readonly GraphId[]>
  incidentByEndpoint: ReadonlyMap<GraphId, readonly GraphId[]>
}

function compareDiagnostics(left: GraphDiagnostic, right: GraphDiagnostic): number {
  const codeOrder = left.code.localeCompare(right.code)
  if (codeOrder !== 0) return codeOrder
  const idOrder = left.id.localeCompare(right.id)
  if (idOrder !== 0) return idOrder
  return (left.referenceId ?? "").localeCompare(right.referenceId ?? "")
}

export function validateGraph(graph: Graph): GraphDiagnostic[] {
  const diagnostics: GraphDiagnostic[] = []

  for (const [key, item] of Object.entries(graph)) {
    if (key !== item.id) {
      diagnostics.push({
        code: "GRAPH_KEY_ID_MISMATCH",
        id: item.id,
        referenceId: key,
        message: `record key ${key} does not match item id ${item.id}`,
      })
    }
  }

  for (const item of Object.values(graph)) {
    if (item.parentId !== undefined && !(item.parentId in graph)) {
      diagnostics.push({
        code: "GRAPH_MISSING_PARENT",
        id: item.id,
        referenceId: item.parentId,
        message: `item ${item.id} references missing parent ${item.parentId}`,
      })
    }
    if (item.type === "edge") {
      if (!(item.fromId in graph)) {
        diagnostics.push({
          code: "GRAPH_MISSING_EDGE_ENDPOINT",
          id: item.id,
          referenceId: item.fromId,
          message: `edge ${item.id} references missing from endpoint ${item.fromId}`,
        })
      }
      if (!(item.toId in graph)) {
        diagnostics.push({
          code: "GRAPH_MISSING_EDGE_ENDPOINT",
          id: item.id,
          referenceId: item.toId,
          message: `edge ${item.id} references missing to endpoint ${item.toId}`,
        })
      }
    }
  }

  for (const item of Object.values(graph)) {
    if (item.parentId === undefined) continue
    const visited = new Set<GraphId>([item.id])
    let cursor: GraphId | undefined = item.parentId
    while (cursor !== undefined) {
      if (visited.has(cursor)) {
        diagnostics.push({
          code: "GRAPH_PARENT_CYCLE",
          id: item.id,
          referenceId: cursor,
          message: `item ${item.id} reaches parent cycle at ${cursor}`,
        })
        break
      }
      visited.add(cursor)
      cursor = graph[cursor]?.parentId
    }
  }

  return diagnostics.sort(compareDiagnostics)
}

function append(map: Map<GraphId, GraphId[]>, key: GraphId, value: GraphId): void {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

function sortedIndex(map: Map<GraphId, GraphId[]>): ReadonlyMap<GraphId, readonly GraphId[]> {
  for (const list of map.values()) list.sort((left, right) => left.localeCompare(right))
  return new Map([...map.entries()].sort(([left], [right]) => left.localeCompare(right)))
}

export function indexGraph(graph: Graph): GraphIndexes {
  const childrenByParent = new Map<GraphId, GraphId[]>()
  const incomingByEndpoint = new Map<GraphId, GraphId[]>()
  const outgoingByEndpoint = new Map<GraphId, GraphId[]>()
  const incidentByEndpoint = new Map<GraphId, GraphId[]>()

  for (const item of Object.values(graph)) {
    if (item.parentId !== undefined) {
      append(childrenByParent, item.parentId, item.id)
    }
    if (item.type !== "edge") continue

    if (item.direction !== "none") {
      append(outgoingByEndpoint, item.fromId, item.id)
      append(incomingByEndpoint, item.toId, item.id)
      if (item.direction === "both" && item.toId !== item.fromId) {
        append(outgoingByEndpoint, item.toId, item.id)
        append(incomingByEndpoint, item.fromId, item.id)
      }
    }
    append(incidentByEndpoint, item.fromId, item.id)
    if (item.toId !== item.fromId) {
      append(incidentByEndpoint, item.toId, item.id)
    }
  }

  return {
    childrenByParent: sortedIndex(childrenByParent),
    incomingByEndpoint: sortedIndex(incomingByEndpoint),
    outgoingByEndpoint: sortedIndex(outgoingByEndpoint),
    incidentByEndpoint: sortedIndex(incidentByEndpoint),
  }
}

export function ancestorsOf(graph: Graph, id: GraphId): readonly GraphId[] {
  const ancestors: GraphId[] = []
  const visited = new Set<GraphId>([id])
  let cursor: GraphId | undefined = graph[id]?.parentId
  while (cursor !== undefined && !visited.has(cursor)) {
    ancestors.push(cursor)
    visited.add(cursor)
    cursor = graph[cursor]?.parentId
  }
  return ancestors
}

export function descendantsOf(graph: Graph, id: GraphId): readonly GraphId[] {
  const { childrenByParent } = indexGraph(graph)
  const descendants: GraphId[] = []
  const queue: GraphId[] = [...(childrenByParent.get(id) ?? [])]
  while (queue.length > 0) {
    const current = queue.shift() as GraphId
    descendants.push(current)
    queue.push(...(childrenByParent.get(current) ?? []))
  }
  return descendants
}

export function depthOf(graph: Graph, id: GraphId): number {
  return ancestorsOf(graph, id).length
}
