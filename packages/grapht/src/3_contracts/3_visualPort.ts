import type {
  GraphId,
  GraphPoint,
  GraphPort,
  GraphVisual,
  GraphVisualPart,
  LayoutParticipation,
  PortLocation,
  ResolvedPortLocation,
} from "@hafley66/grapht-model"
import type { Rect } from "../1_sequence/3_geometry.js"
import type { GraphGeometry } from "../2_graph/0_frame.js"
import type { GraphTranslations } from "../2_graph/5_translateGeometry.js"
import type {
  GraphologyDocument,
  GraphologyEdgeKey,
  GraphologyNodeKey,
} from "./0_graphology.js"
import type { RendererKind } from "./1_rendererCapabilities.js"
import type { GraphViewport } from "./2_rendererRuntime.js"

export type GraphVisualId = string
export type GraphVisualPartId = string

export type GraphSemanticIdentity = {
  kind: "semantic"
  graphId: GraphId
}

export type GraphTopologyIdentity = {
  kind: "topology"
  graphId: GraphId
  nodeKey: GraphologyNodeKey
  edgeKeys: readonly GraphologyEdgeKey[]
}

export type GraphVisualIdentity = {
  kind: "visual"
  graphId: GraphId
  visualId: GraphVisualId
}

export type GraphVisualPartIdentity = {
  kind: "visual-part"
  graphId: GraphId
  visualId: GraphVisualId
  partId: GraphVisualPartId
}

export type GraphRendererHandleIdentity<NativeHandle = unknown> = {
  kind: "renderer-handle"
  renderer: RendererKind
  resourceId: string
  graphId: GraphId
  visualId: GraphVisualId
  partId?: GraphVisualPartId
  native: NativeHandle
}

export type GraphVisualPartContract = GraphVisualPart & {
  id: GraphVisualPartId
  graphId: GraphId
  visualId: GraphVisualId
}

export type GraphPortContract = GraphPort & {
  visualId: GraphVisualId
}

export type GraphVisualContract = Omit<GraphVisual, "parts" | "ports"> & {
  kind: "graph-visual"
  layout: LayoutParticipation
  parts: readonly GraphVisualPartContract[]
  ports: readonly GraphPortContract[]
}

export type SequenceRootVisualContract = GraphVisualContract & {
  kind: "graph-visual"
  rootKind: "sequence"
  layout: Extract<LayoutParticipation, { mode: "sealed" }>
}

export type SealedDiagramVisualContract = GraphVisualContract & {
  kind: "graph-visual"
  rootKind: "sealed-diagram"
  layout: Extract<LayoutParticipation, { mode: "sealed" }>
}

export type ResolvedGraphVisualPart = {
  identity: GraphVisualPartIdentity
  source: GraphVisualPart
  bounds: Rect
  translate: GraphPoint
}

export type ResolvedGraphPort = {
  id: GraphId
  ownerId: GraphId
  visualId: GraphVisualId
  location: PortLocation
  resolved: ResolvedPortLocation
}

export type ResolvedGraphVisual = {
  identity: GraphVisualIdentity
  source: GraphVisual
  bounds: Rect
  translate: GraphPoint
  parts: readonly ResolvedGraphVisualPart[]
  ports: readonly ResolvedGraphPort[]
}

export type StickyGraphVisualInput = {
  viewport: GraphViewport
  groups: readonly {
    graphId: GraphId
    visualId: GraphVisualId
    labelPartId: GraphVisualPartId
    parentId?: GraphId
    depth: number
    naturalBounds: Rect
  }[]
}

export type GraphVisualFrame<NodeData = unknown, EdgeData = unknown> = {
  revisionId: string
  document: GraphologyDocument<NodeData, EdgeData>
  geometry: GraphGeometry
  translate: GraphTranslations
  visuals: readonly ResolvedGraphVisual[]
  sticky: StickyGraphVisualInput
}

export type GraphTranslatePlan = {
  kind: "translate"
  graphId: GraphId
  delta: GraphPoint
  graphIds: readonly GraphId[]
  visualIds: readonly GraphVisualId[]
  partIds: readonly GraphVisualPartId[]
  portIds: readonly GraphId[]
  routeEndpointIds: readonly GraphId[]
  wholeRouteIds: readonly GraphId[]
  edgeLabelPartIds: readonly GraphVisualPartId[]
}

export type FivePortLocationExamples = readonly [
  { kind: "absolute"; point: { x: 7; y: 8 } },
  { kind: "relative-box"; x: 0.25; y: 0.5 },
  {
    kind: "side"
    side: "right"
    offset: { unit: "ratio"; value: 0.5 }
    orientation: { mode: "tangent" }
  },
  {
    kind: "boundary"
    offset: { unit: "length"; value: 125 }
    lateralOffset: 3
    orientation: { mode: "reverse-tangent" }
  },
  {
    kind: "path"
    pathId: "route"
    offset: { unit: "ratio"; value: 0.75 }
    lateralOffset: 4
    orientation: { mode: "fixed"; angle: 1.25 }
  },
]

export declare function resolveGraphVisuals<NodeData = unknown, EdgeData = unknown>(
  document: GraphologyDocument<NodeData, EdgeData>,
  geometry: GraphGeometry,
  translate: GraphTranslations,
): readonly ResolvedGraphVisual[]

export declare function graphTranslatePlan<NodeData = unknown, EdgeData = unknown>(
  document: GraphologyDocument<NodeData, EdgeData>,
  geometry: GraphGeometry,
  graphId: GraphId,
  delta: GraphPoint,
): GraphTranslatePlan

export declare function applyGraphTranslate<NodeData = unknown, EdgeData = unknown>(
  frame: GraphVisualFrame<NodeData, EdgeData>,
  plan: GraphTranslatePlan,
): GraphVisualFrame<NodeData, EdgeData>

export declare function stickyGraphVisualInputOf(
  viewport: GraphViewport,
  visuals: readonly ResolvedGraphVisual[],
): StickyGraphVisualInput
