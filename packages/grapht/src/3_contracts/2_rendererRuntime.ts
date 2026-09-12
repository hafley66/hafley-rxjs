import type { GraphId } from "@hafley66/grapht-model"
import type { Signal } from "@hafley66/signals"
import type {
  Observable,
  OperatorFunction,
  SchedulerLike,
  Subscription,
} from "rxjs"
import type { GraphFrame, GraphGeometry } from "../2_graph/0_frame.js"
import type { GraphTranslations } from "../2_graph/5_translateGeometry.js"
import type { GraphologyDocument } from "./0_graphology.js"
import type {
  RendererKind,
  RendererProjectionReceipt,
} from "./1_rendererCapabilities.js"

export type GraphViewport = {
  x: number
  y: number
  scale: number
  width: number
  height: number
}

export type GraphSelection =
  | { kind: "identities"; ids: ReadonlySet<GraphId> }
  | {
      kind: "text-range"
      graphId: GraphId
      partId: string
      anchor: number
      focus: number
    }

export type GraphInteraction =
  | { kind: "viewport"; viewport: GraphViewport }
  | { kind: "focus"; ids: ReadonlySet<GraphId> }
  | { kind: "selection"; selection: GraphSelection }
  | { kind: "translate"; id: GraphId; dx: number; dy: number }

export type GraphInteractionState = {
  viewport: GraphViewport
  focus: ReadonlySet<GraphId>
  selection: GraphSelection
  translate: GraphTranslations
}

export type RendererEventSignals = {
  events: Signal<GraphInteraction>
}

export type NativeRendererEventSource<NativeEvent> = {
  events$: Observable<NativeEvent>
  normalize: (event: NativeEvent) => GraphInteraction
}

export type GraphRuntimeMetrics = {
  frameCount: number
  geometryRecomputeCount: number
  visualProjectionCount: number
  nativeCreateCount: number
  nativeUpdateCount: number
  nativeRemoveCount: number
  activeNativeListenerCount: number
}

export type GraphApplicationSignals<NodeData = unknown, EdgeData = unknown> = {
  document: Signal<GraphologyDocument<NodeData, EdgeData>>
  interaction: Signal<GraphInteractionState>
  geometry: Signal<GraphGeometry>
  frame: Signal<GraphFrame<NodeData, EdgeData>>
  rendererKind: Signal<RendererKind>
  events: Signal<GraphInteraction>
  receipts: Signal<RendererProjectionReceipt>
  metrics: Signal<GraphRuntimeMetrics>
}

export type GraphApplicationRootCardinality = {
  document: 1
  interaction: 1
  geometry: 1
  frame: 1
  rendererKind: 1
  events: 1
  receipts: 1
  metrics: 1
  elementSignals: 0
}

export type GraphApplicationInput<NodeData = unknown, EdgeData = unknown> = {
  initialDocument: GraphologyDocument<NodeData, EdgeData>
  initialGeometry: GraphGeometry
  initialRendererKind: RendererKind
  document$: Observable<GraphologyDocument<NodeData, EdgeData>>
  nativeGeometry$: Observable<GraphGeometry>
  events$: readonly Observable<GraphInteraction>[]
  rendererKind$: Observable<RendererKind>
  initialInteraction: GraphInteractionState
  initialMetrics: GraphRuntimeMetrics
}

export type RendererUnsubscribeReceipt = {
  kind: "renderer-unsubscribe"
  renderer: RendererKind
  resourceId: string
  removedNativeListenerCount: number
  removedNativeHandleCount: number
}

export type GraphRendererResource<Native = unknown> = {
  kind: RendererKind
  resourceId: string
  native: Native
  events$: Observable<GraphInteraction>
  apply(frame: GraphFrame): Observable<RendererProjectionReceipt<Native>>
  unsubscribe(): RendererUnsubscribeReceipt
}

export type GraphRendererResourceFactory<Native = unknown> = (
  host: HTMLElement,
) => Observable<GraphRendererResource<Native>>

export type GraphOperatorPolicy = {
  merge: "independent-events-without-history"
  combineLatest: "initialized-current-value-product"
  combinePartial: "partially-initialized-current-value-product"
  scan: "synchronous-accumulated-history"
  switchScan: "accumulated-history-with-replaced-async-inner"
  switchMap: "latest-owner-replacement"
  mergeMap: "explicit-bounded-concurrency"
}

declare const mergeMapConcurrencyBrand: unique symbol

export type MergeMapConcurrency = number & {
  readonly [mergeMapConcurrencyBrand]: "MergeMapConcurrency"
}

export type GraphPaintQueueOptions = {
  kind: "animation-frame"
  scheduler: SchedulerLike
  capacity: 1
  retention: "latest"
}

export type GraphFrameQueues<State, Frame> = {
  state$: Observable<State>
  frame$: Observable<Frame>
  paintPendingCardinality: 0 | 1
}

export declare function reduceGraphInteraction(
  state: GraphInteractionState,
  event: GraphInteraction,
): GraphInteractionState

export declare function rendererEventSignals<NativeEvent>(
  source: NativeRendererEventSource<NativeEvent>,
): RendererEventSignals

export declare function domEventSignal<EventType extends Event>(
  target: EventTarget,
  type: string,
): Signal<EventType>

export declare function graphInteractionState(
  initial: GraphInteractionState,
  sources: readonly Observable<GraphInteraction>[],
): Signal<GraphInteractionState>

export declare function graphApplicationSignals<NodeData = unknown, EdgeData = unknown>(
  input: GraphApplicationInput<NodeData, EdgeData>,
): GraphApplicationSignals<NodeData, EdgeData>

export declare function graphFrameQueues<State, Frame>(
  state$: Observable<State>,
  resolve: (state: State) => Frame,
  paint?: GraphPaintQueueOptions,
): GraphFrameQueues<State, Frame>

export declare function mergeMapConcurrency(value: number): MergeMapConcurrency

export declare function boundedMergeMap<Input, Output>(
  project: (value: Input, index: number) => Observable<Output>,
  concurrency: MergeMapConcurrency,
): OperatorFunction<Input, Output>

export declare function renderCytoscape(
  host: HTMLElement,
): OperatorFunction<GraphFrame, RendererProjectionReceipt>

export declare function renderPixi(
  host: HTMLElement,
): OperatorFunction<GraphFrame, RendererProjectionReceipt>

export declare function renderReact(
  host: Element,
): OperatorFunction<GraphFrame, RendererProjectionReceipt>

export declare function rendererFrames(
  kind$: Observable<RendererKind>,
  frame$: Observable<GraphFrame>,
  operatorOf: (kind: RendererKind) => OperatorFunction<GraphFrame, RendererProjectionReceipt>,
): Observable<RendererProjectionReceipt>

export declare function mountGraphApplication(
  receipts$: Observable<RendererProjectionReceipt>,
): Subscription
