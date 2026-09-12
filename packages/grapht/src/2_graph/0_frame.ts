import type { Graph, GraphId, ResolvedPortLocation } from "@hafley66/grapht-model"
import type { Rect } from "../1_sequence/3_geometry.js"
import type { SealedSvgArtifactsByRootId } from "./3_sealedSvgArtifact.js"

export type GraphGeometry = {
  revisionId: string
  boundsById: Readonly<Record<GraphId, Rect>>
  endpointAnchorById: Readonly<Record<GraphId, { x: number; y: number }>>
  routesById: Readonly<Record<GraphId, Float32Array>>
  headerBoundsById: Readonly<Record<GraphId, Rect>>
}

export type GraphCamera = {
  x: number
  y: number
  scale: number
  viewport: Rect
}

export type HeaderPlacement = {
  id: GraphId
  depth: number
  top: number
  visible: boolean
  state: "natural" | "stuck" | "released"
}

export type GraphLabel = {
  text: string
}

export type GraphPresentation = {
  stickyHeaders: readonly HeaderPlacement[]
  hiddenIds: ReadonlySet<GraphId>
  focusedIds: ReadonlySet<GraphId>
  labelsById: Readonly<Record<GraphId, GraphLabel>>
  sealedSvgArtifactsByRootId: SealedSvgArtifactsByRootId
  translationsById?: Readonly<Record<GraphId, { x: number; y: number }>>
  resolvedPortsById?: Readonly<Record<GraphId, ResolvedPortLocation>>
}

export type GraphFrame<NodeData = unknown, EdgeData = unknown> = {
  graph: Graph<NodeData, EdgeData>
  geometry: GraphGeometry
  camera: GraphCamera
  presentation: GraphPresentation
}
