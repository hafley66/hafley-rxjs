export type GraphId = string

export type GraphPoint = {
  x: number
  y: number
}

export type GraphRect = {
  x: number
  y: number
  width: number
  height: number
}

export type LayoutParticipation =
  | { mode: "managed" }
  | { mode: "sealed"; bounds: GraphRect; geometryRevisionId: string; ports?: Readonly<Record<string, GraphPoint>> }
  | { mode: "excluded" }

export type GraphItemBase<Data> = {
  id: GraphId
  parentId?: GraphId
  data?: Data
}

export type GraphNode<Data = unknown> = GraphItemBase<Data> & {
  type: "node"
  layout?: LayoutParticipation
}

export type GraphEdge<Data = unknown> = GraphItemBase<Data> & {
  type: "edge"
  fromId: GraphId
  toId: GraphId
  direction: "none" | "forward" | "both"
}

export type GraphItem<NodeData = unknown, EdgeData = unknown> = GraphNode<NodeData> | GraphEdge<EdgeData>

export type Graph<NodeData = unknown, EdgeData = unknown> = Readonly<Record<GraphId, GraphItem<NodeData, EdgeData>>>

export type GraphDiagnostic = {
  code: "GRAPH_KEY_ID_MISMATCH" | "GRAPH_MISSING_PARENT" | "GRAPH_MISSING_ENDPOINT" | "GRAPH_PARENT_CYCLE"
  message: string
}

export type GraphIndexes = {
  childrenByParent: ReadonlyMap<GraphId, readonly GraphId[]>
  incomingByEndpoint: ReadonlyMap<GraphId, readonly GraphId[]>
  outgoingByEndpoint: ReadonlyMap<GraphId, readonly GraphId[]>
  incidentByEndpoint: ReadonlyMap<GraphId, readonly GraphId[]>
}

function sortedIds(graph: Graph): GraphId[] {
  return Object.keys(graph).sort()
}

function append(map: Map<GraphId, GraphId[]>, key: GraphId, id: GraphId): void {
  const entries = map.get(key)
  if (entries) entries.push(id)
  else map.set(key, [id])
}

export function validateGraph(graph: Graph): GraphDiagnostic[] {
  const diagnostics: GraphDiagnostic[] = []
  const ids = new Set(Object.keys(graph))

  for (const key of sortedIds(graph)) {
    const item = graph[key]
    if (item.id !== key) {
      diagnostics.push({
        code: "GRAPH_KEY_ID_MISMATCH",
        message: `graph key ${key} does not match item id ${item.id}`,
      })
    }
    if (item.parentId !== undefined && !ids.has(item.parentId)) {
      diagnostics.push({
        code: "GRAPH_MISSING_PARENT",
        message: `item ${item.id} references missing parent ${item.parentId}`,
      })
    }
    if (item.type === "edge") {
      for (const endpoint of [item.fromId, item.toId]) {
        if (!ids.has(endpoint)) {
          diagnostics.push({
            code: "GRAPH_MISSING_ENDPOINT",
            message: `edge ${item.id} references missing endpoint ${endpoint}`,
          })
        }
      }
    }
  }

  const cycleRoots: GraphId[] = []
  const permanent = new Set<GraphId>()
  const temporary = new Set<GraphId>()

  const visit = (id: GraphId): void => {
    if (permanent.has(id)) return
    if (temporary.has(id)) {
      cycleRoots.push(id)
      return
    }
    temporary.add(id)
    const parentId = graph[id]?.parentId
    if (parentId !== undefined) visit(parentId)
    temporary.delete(id)
    permanent.add(id)
  }

  for (const id of sortedIds(graph)) visit(id)

  for (const root of [...new Set(cycleRoots)].sort()) {
    diagnostics.push({
      code: "GRAPH_PARENT_CYCLE",
      message: `item ${root} participates in a parent cycle`,
    })
  }

  return diagnostics
}

export function indexGraph(graph: Graph): GraphIndexes {
  const childrenByParent = new Map<GraphId, GraphId[]>()
  const incomingByEndpoint = new Map<GraphId, GraphId[]>()
  const outgoingByEndpoint = new Map<GraphId, GraphId[]>()
  const incidentByEndpoint = new Map<GraphId, GraphId[]>()

  for (const id of sortedIds(graph)) {
    const item = graph[id]
    if (item.parentId !== undefined) append(childrenByParent, item.parentId, id)

    if (item.type !== "edge") continue

    const self = item.fromId === item.toId
    append(incidentByEndpoint, item.fromId, id)
    if (!self) append(incidentByEndpoint, item.toId, id)

    if (item.direction === "none") continue

    append(outgoingByEndpoint, item.fromId, id)
    append(incomingByEndpoint, item.toId, id)

    if (item.direction === "both" && !self) {
      append(outgoingByEndpoint, item.toId, id)
      append(incomingByEndpoint, item.fromId, id)
    }
  }

  const freeze = (map: Map<GraphId, GraphId[]>): ReadonlyMap<GraphId, readonly GraphId[]> => {
    for (const entries of map.values()) entries.sort()
    return new Map([...map.entries()].sort(([left], [right]) => left.localeCompare(right)))
  }

  return {
    childrenByParent: freeze(childrenByParent),
    incomingByEndpoint: freeze(incomingByEndpoint),
    outgoingByEndpoint: freeze(outgoingByEndpoint),
    incidentByEndpoint: freeze(incidentByEndpoint),
  }
}

function parentOf(graph: Graph, id: GraphId): GraphId | undefined {
  return graph[id]?.parentId
}

export function ancestorsOf(graph: Graph, id: GraphId): readonly GraphId[] {
  const ancestors: GraphId[] = []
  const seen = new Set<GraphId>()
  let cursor = parentOf(graph, id)
  while (cursor !== undefined && !seen.has(cursor)) {
    seen.add(cursor)
    ancestors.push(cursor)
    cursor = parentOf(graph, cursor)
  }
  return ancestors
}

export function descendantsOf(graph: Graph, id: GraphId): readonly GraphId[] {
  const children = indexGraph(graph).childrenByParent
  const descendants: GraphId[] = []
  const stack = [...(children.get(id) ?? [])]
  while (stack.length > 0) {
    const child = stack.pop()
    if (child === undefined) continue
    descendants.push(child)
    stack.push(...(children.get(child) ?? []))
  }
  return descendants.sort()
}

export function depthOf(graph: Graph, id: GraphId): number {
  return ancestorsOf(graph, id).length
}
