// Render a graph from explicit geometry, camera, and presentation state.
import type { Graph, GraphId, ResolvedPortLocation } from "@hafley66/grapht-model"
import type { Rect } from "../1_sequence/3_geometry.js"
import type { SealedSvgArtifactsByRootId } from "./3_sealedSvgArtifact.js"

/** Geometry keyed by graph item ID. The revision identifies the captured layout; bounds and routes use world coordinates. */
export type GraphGeometry = {
  revisionId: string
  boundsById: Readonly<Record<GraphId, Rect>>
  endpointAnchorById: Readonly<Record<GraphId, { x: number; y: number }>>
  routesById: Readonly<Record<GraphId, Float32Array>>
  headerBoundsById: Readonly<Record<GraphId, Rect>>
  // Sequence actors and any other item that owns a vertical column; a renderer pins their
  // headers in a screen-space row so a tall diagram stays readable while it scrolls.
  columnBoundsById?: Readonly<Record<GraphId, Rect>>
}

/** Map world coordinates to screen pixels with world * scale + translation; the viewport defines the visible screen rectangle. */
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

/** Presentation projected onto graph IDs: visibility, focus, labels, sticky layers, and optional manual translations. */
export type GraphPresentation = {
  stickyHeaders: readonly HeaderPlacement[]
  hiddenIds: ReadonlySet<GraphId>
  focusedIds: ReadonlySet<GraphId>
  /** Collapsed groups retain their logical IDs and header controls. */
  collapsedIds?: ReadonlySet<GraphId>
  /** Hover distance by logical graph ID; missing IDs are faded context while nonempty. */
  hopsById?: Readonly<Record<GraphId, number>>
  labelsById: Readonly<Record<GraphId, GraphLabel>>
  sealedSvgArtifactsByRootId: SealedSvgArtifactsByRootId
  /** Enables manual movement gestures. Camera gestures remain available when false. */
  editable?: boolean
  translationsById?: Readonly<Record<GraphId, { x: number; y: number }>>
  resolvedPortsById?: Readonly<Record<GraphId, ResolvedPortLocation>>
}

/** A complete render input combining the graph with its geometry, camera, and presentation. The caller owns state and lifetime. */
export type GraphFrame<NodeData = unknown, EdgeData = unknown> = {
  graph: Graph<NodeData, EdgeData>
  geometry: GraphGeometry
  camera: GraphCamera
  presentation: GraphPresentation
}
