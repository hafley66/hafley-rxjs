import type {
  Graph as GraphtGraph,
  GraphId,
  GraphPort,
  GraphVisual,
  LayoutParticipation,
} from "@hafley66/grapht-model"
import type Graphology from "graphology"
import type { Observable } from "rxjs"

export type GraphologyNodeKey = string
export type GraphologyEdgeKey = string

export type GraphologyNodeAttributes<NodeData = unknown> =
  | {
      kind: "node"
      graphId: GraphId
      data?: NodeData
    }
  | {
      kind: "edge-endpoint"
      graphId: GraphId
    }

export type GraphologyEdgeAttributes<EdgeData = unknown> = {
  kind: "edge"
  graphId: GraphId
  leg: "single" | "forward" | "reverse"
  data?: EdgeData
}

export type GraphologyGraphAttributes = {
  kind: "grapht-topology"
  contract: "grapht-graphology/0"
}

export type GraphologyTopology<NodeData = unknown, EdgeData = unknown> = Graphology<
  GraphologyNodeAttributes<NodeData>,
  GraphologyEdgeAttributes<EdgeData>,
  GraphologyGraphAttributes
>

export type GraphologyEdgeMapping =
  | {
      graphId: GraphId
      direction: "none"
      self: boolean
      keys: readonly [GraphologyEdgeKey]
    }
  | {
      graphId: GraphId
      direction: "forward"
      self: boolean
      keys: readonly [GraphologyEdgeKey]
    }
  | {
      graphId: GraphId
      direction: "both"
      self: true
      keys: readonly [GraphologyEdgeKey]
    }
  | {
      graphId: GraphId
      direction: "both"
      self: false
      keys: readonly [GraphologyEdgeKey, GraphologyEdgeKey]
    }

export type GraphologyIdentity = {
  topologyNodeKeyByGraphId: Readonly<Record<GraphId, GraphologyNodeKey>>
  graphIdByTopologyNodeKey: Readonly<Record<GraphologyNodeKey, GraphId>>
  edgeByGraphId: Readonly<Record<GraphId, GraphologyEdgeMapping>>
  graphIdByTopologyEdgeKey: Readonly<Record<GraphologyEdgeKey, GraphId>>
}

export type GraphHierarchy = {
  parentById: Readonly<Record<GraphId, GraphId | undefined>>
  childrenByParentId: Readonly<Record<GraphId, readonly GraphId[]>>
  layoutById: Readonly<Record<GraphId, LayoutParticipation | undefined>>
}

export type GraphologyDocument<NodeData = unknown, EdgeData = unknown> = {
  topology: GraphologyTopology<NodeData, EdgeData>
  identity: GraphologyIdentity
  hierarchy: GraphHierarchy
  visuals: readonly GraphVisual[]
  ports: readonly GraphPort[]
}

export type SerializedGraphologyDocument<NodeData = unknown, EdgeData = unknown> = {
  contract: "grapht-graphology/0"
  topology: ReturnType<GraphologyTopology<NodeData, EdgeData>["export"]>
  identity: GraphologyIdentity
  hierarchy: GraphHierarchy
  visuals: readonly GraphVisual[]
  ports: readonly GraphPort[]
}

export type GraphologyMutation<NodeData = unknown, EdgeData = unknown> =
  | { kind: "node-added"; key: GraphologyNodeKey; attributes: GraphologyNodeAttributes<NodeData> }
  | { kind: "node-dropped"; key: GraphologyNodeKey; attributes: GraphologyNodeAttributes<NodeData> }
  | {
      kind: "edge-added" | "edge-dropped"
      key: GraphologyEdgeKey
      source: GraphologyNodeKey
      target: GraphologyNodeKey
      undirected: boolean
      attributes: GraphologyEdgeAttributes<EdgeData>
    }
  | { kind: "node-attributes-updated"; key: GraphologyNodeKey }
  | { kind: "edge-attributes-updated"; key: GraphologyEdgeKey }
  | { kind: "topology-cleared"; scope: "edges" | "all" }

export type GraphologyImportReceipt<NodeData = unknown, EdgeData = unknown> = {
  graph: GraphtGraph<NodeData, EdgeData>
  nodeCount: number
  edgeCount: number
  directedEdgeCount: number
  undirectedEdgeCount: number
  selfEdgeCount: number
  parallelEdgeCount: number
}

export declare function graphologyDocumentOf<NodeData = unknown, EdgeData = unknown>(
  graph: GraphtGraph<NodeData, EdgeData>,
  visuals?: readonly GraphVisual[],
  ports?: readonly GraphPort[],
): GraphologyDocument<NodeData, EdgeData>

export declare function graphtGraphOf<NodeData = unknown, EdgeData = unknown>(
  document: GraphologyDocument<NodeData, EdgeData>,
): GraphologyImportReceipt<NodeData, EdgeData>

export declare function graphologyMutations<NodeData = unknown, EdgeData = unknown>(
  topology: GraphologyTopology<NodeData, EdgeData>,
): Observable<GraphologyMutation<NodeData, EdgeData>>

export declare function serializeGraphologyDocument<NodeData = unknown, EdgeData = unknown>(
  document: GraphologyDocument<NodeData, EdgeData>,
): SerializedGraphologyDocument<NodeData, EdgeData>

export declare function parseGraphologyDocument<NodeData = unknown, EdgeData = unknown>(
  value: SerializedGraphologyDocument<NodeData, EdgeData>,
): GraphologyDocument<NodeData, EdgeData>
