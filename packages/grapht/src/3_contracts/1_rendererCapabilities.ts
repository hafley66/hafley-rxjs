import type { GraphId } from "@hafley66/grapht-model"
import type { GraphCamera, GraphFrame } from "../2_graph/0_frame.js"
import type { GraphTranslations } from "../2_graph/5_translateGeometry.js"
import type { GraphologyDocument } from "./0_graphology.js"

export type RendererKind = "cytoscape" | "pixi" | "react-flow" | "yed" | "sigma" | "graphviz"

export type RendererDelivery = "first" | "second" | "compatibility" | "deferred" | "tertiary"

export type RendererCapability =
  | "hierarchy"
  | "ports"
  | "arbitrary-visuals"
  | "interaction"
  | "layout"
  | "rich-selection"
  | "viewport"
  | "high-count"

export type RendererFallbackAction = "approximate" | "omit" | "overlay" | "precompute" | "reject"

export type RendererCapabilitySupport =
  | { kind: "supported"; evidence: string }
  | { kind: "degraded"; fallback: Exclude<RendererFallbackAction, "reject">; reason: string }
  | { kind: "unsupported"; fallback: RendererFallbackAction; reason: string }
  | { kind: "deferred"; delivery: "deferred" | "tertiary"; reason: string }

export type RendererCapabilityContract = {
  kind: RendererKind
  delivery: RendererDelivery
  capabilities: Readonly<Record<RendererCapability, RendererCapabilitySupport>>
}

export type RendererCapabilityReceipt = {
  kind: "degraded" | "unsupported" | "deferred"
  renderer: RendererKind
  capability: RendererCapability
  action: RendererFallbackAction
  graphIds: readonly GraphId[]
  detail: string
}

export type CanonicalRendererState<
  NodeData = unknown,
  EdgeData = unknown,
  Selection = unknown,
> = {
  document: GraphologyDocument<NodeData, EdgeData>
  frame: GraphFrame<NodeData, EdgeData>
  viewport: GraphCamera
  focus: ReadonlySet<GraphId>
  selection: Selection
  translate: GraphTranslations
}

export type RendererOwnedState<NativeHandle = unknown> = {
  resourceId: string
  host: HTMLElement
  nativeByGraphId: ReadonlyMap<GraphId, NativeHandle>
  measuredBoundsByGraphId: Readonly<Record<GraphId, DOMRectReadOnly>>
  appliedFrameRevisionId?: string
  hoveredGraphId?: GraphId
  pointerCaptureGraphId?: GraphId
}

export type RendererProjectionReceipt<NativeHandle = unknown> = {
  kind: "renderer-projection"
  renderer: RendererKind
  frameRevisionId: string
  enteredIds: readonly GraphId[]
  updatedIds: readonly GraphId[]
  exitedIds: readonly GraphId[]
  capabilityReceipts: readonly RendererCapabilityReceipt[]
  nativeByGraphId: ReadonlyMap<GraphId, NativeHandle>
}

export type ReactFlowCompatibility = {
  kind: "react-flow"
  handles: { source: "GraphPort"; target: "GraphPort"; location: "PortLocation" }
  nestedNodes: { parentId: "GraphHierarchy.parentById"; extent: "LayoutParticipation" }
  visuals: { nodeTypes: "GraphVisual.parts"; edgeTypes: "GraphVisual.parts" }
  interaction: {
    viewport: "viewport"
    focus: "focus"
    selection: "selection"
    positionChange: "translate"
  }
}

export type YedCompatibility = {
  kind: "yed"
  pathPorts: "PortLocation.path"
  groupNesting: "GraphHierarchy.parentById"
  labels: "GraphVisual.parts"
  bends: "GraphGeometry.routesById"
  multiEdges: "GraphologyIdentity.edgeByGraphId"
  interaction: { viewport: "viewport"; focus: "focus"; selection: "selection"; move: "translate" }
}

export type GraphvizTertiaryContract = {
  kind: "graphviz"
  ingestion: "GraphologyDocument"
  layoutOutput: "GraphGeometry"
  svgBinding: "element-id-to-graph-id"
  semanticBindingRequired: true
  delivery: "tertiary"
}

export type RendererCompatibility = ReactFlowCompatibility | YedCompatibility | GraphvizTertiaryContract

export declare function rendererCapabilityContract(kind: RendererKind): RendererCapabilityContract

export declare function rendererCompatibility(
  kind: "react-flow" | "yed" | "graphviz",
): RendererCompatibility
