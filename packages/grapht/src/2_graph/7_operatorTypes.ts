import type { Graph, GraphId } from "@hafley66/grapht-model"
import type { Renderer } from "@hafley66/scene"
import type { Observable, OperatorFunction, Subject } from "rxjs"
import type { GraphCamera, GraphFrame, GraphGeometry } from "./0_frame.js"
import type { SealedSvgArtifactsByRootId } from "./3_sealedSvgArtifact.js"

export type Ingest<Source, NodeData, EdgeData> = OperatorFunction<Source, Graph<NodeData, EdgeData>>

export type Layout<NodeData, EdgeData> = OperatorFunction<
  Graph<NodeData, EdgeData>,
  { graph: Graph<NodeData, EdgeData>; geometry: GraphGeometry }
>

export type Present<NodeData, EdgeData> = (input: {
  camera$: Observable<GraphCamera>
  focusIds$: Observable<ReadonlySet<GraphId>>
  selectionIds$: Observable<ReadonlySet<GraphId>>
  sealedSvgArtifactsByRootId$?: Observable<SealedSvgArtifactsByRootId>
  translationsById$?: Observable<Readonly<Record<GraphId, { x: number; y: number }>>>
}) => OperatorFunction<{ graph: Graph<NodeData, EdgeData>; geometry: GraphGeometry }, GraphFrame<NodeData, EdgeData>>

export type GraphRenderer<NodeData = unknown, EdgeData = unknown> = Renderer<GraphFrame<NodeData, EdgeData>>

export type RendererInteractions = {
  cameraInput$: Subject<GraphCamera>
  focusInput$: Subject<ReadonlySet<GraphId>>
  selectionInput$: Subject<ReadonlySet<GraphId>>
  moveInput$?: Subject<{ id: GraphId; dx: number; dy: number }>
}
