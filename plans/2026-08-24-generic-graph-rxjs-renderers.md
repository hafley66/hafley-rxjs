# Generic graph model and RxJS renderer boundary

## Objective

Define one generic graph and tree model for every ingest adapter, derive layout and
presentation from that model, and send the resulting frames through interchangeable
renderer operators. RxJS owns time, cancellation, resource lifetime, errors, completion,
and teardown. Signals expose named current values and dependency projections.

The model must support:

- arbitrary parent nesting;
- nodes and edges in one identity space;
- edges whose endpoints are nodes or edges;
- undirected, directed, and bidirectional edges;
- parallel edges and self edges;
- D2 containers, Mermaid subgraphs, sequence groups, and filesystem trees;
- generic nested group-header stacking;
- Cytoscape and Pixi projections from the same frame.

## Canonical types

```ts
type GraphId = string

type GraphItemBase<Data> = {
  id: GraphId
  parentId?: GraphId
  data?: Data
}

type GraphNode<Data = unknown> = GraphItemBase<Data> & {
  type: "node"
}

type GraphEdge<Data = unknown> = GraphItemBase<Data> & {
  type: "edge"
  fromId: GraphId
  toId: GraphId
  direction: "none" | "forward" | "both"
}

type GraphItem<NodeData = unknown, EdgeData = unknown> =
  | GraphNode<NodeData>
  | GraphEdge<EdgeData>

type Graph<NodeData = unknown, EdgeData = unknown> =
  Readonly<Record<GraphId, GraphItem<NodeData, EdgeData>>>
```

The object key and `item.id` must match. `fromId`, `toId`, and `parentId` reference the same
identity space. Endpoint-pair uniqueness is not an invariant. Children and adjacency are
derived indexes, not stored duplicates.

## Validation and derived indexes

```ts
type GraphIndexes = {
  childrenByParent: ReadonlyMap<GraphId, readonly GraphId[]>
  incomingByEndpoint: ReadonlyMap<GraphId, readonly GraphId[]>
  outgoingByEndpoint: ReadonlyMap<GraphId, readonly GraphId[]>
  incidentByEndpoint: ReadonlyMap<GraphId, readonly GraphId[]>
}

function validateGraph(graph: Graph): GraphDiagnostic[]
function indexGraph(graph: Graph): GraphIndexes
function ancestorsOf(graph: Graph, id: GraphId): readonly GraphId[]
function descendantsOf(graph: Graph, id: GraphId): readonly GraphId[]
function depthOf(graph: Graph, id: GraphId): number
```

Validation covers key/id equality, missing parents, missing endpoints, parent cycles, and
deterministic diagnostic order. A parent may be a node or edge because both are graph items.
No `children` property is added to the canonical model. `incomingByEndpoint` and
`outgoingByEndpoint` follow edge direction. `incidentByEndpoint` includes every direction
mode and records a self edge once.

## Geometry and presentation

```ts
type Rect = { x: number; y: number; width: number; height: number }

type GraphGeometry = {
  revisionId: string
  boundsById: Readonly<Record<GraphId, Rect>>
  endpointAnchorById: Readonly<Record<GraphId, { x: number; y: number }>>
  routesById: Readonly<Record<GraphId, Float32Array>>
  headerBoundsById: Readonly<Record<GraphId, Rect>>
}

type GraphCamera = {
  x: number
  y: number
  scale: number
  viewport: Rect
}

type HeaderPlacement = {
  id: GraphId
  depth: number
  top: number
  visible: boolean
  state: "natural" | "stuck" | "released"
}

type GraphPresentation = {
  stickyHeaders: readonly HeaderPlacement[]
  hiddenIds: ReadonlySet<GraphId>
  focusedIds: ReadonlySet<GraphId>
}

type GraphFrame<NodeData = unknown, EdgeData = unknown> = {
  graph: Graph<NodeData, EdgeData>
  geometry: GraphGeometry
  camera: GraphCamera
  presentation: GraphPresentation
}
```

Dense renderer storage may compile IDs, positions, bounds, and endpoints into typed arrays.
Those arrays are derived projection data. They do not become a second topology model.
Every graph item has an endpoint anchor, including edges. An adapter whose native model only
permits node endpoints may create private helper nodes at these anchors.

## Generic nested header stacking

```ts
type GroupHeader = {
  id: GraphId
  naturalTop: number
  boundaryBottom: number
  height: number
  order: number
}

function stackGroupHeaders(input: {
  graph: Graph
  headers: readonly GroupHeader[]
  camera: GraphCamera
  inset: number
  gap: number
}): readonly HeaderPlacement[]
```

Rules:

1. Natural headers retain their geometry position.
2. A header sticks when its natural top crosses its depth slot.
3. Active ancestors occupy consecutive slots.
4. A nested header stacks below its active ancestors.
5. Siblings occupy the same depth and replace one another by interval and order.
6. A header releases at its own group boundary.
7. Output depends only on graph, geometry-derived header input, and camera.
8. Renderers receive placements and perform no ancestry or stacking calculation.

## Operator contracts

```ts
type Ingest<Source, NodeData, EdgeData> =
  OperatorFunction<Source, Graph<NodeData, EdgeData>>

type Layout<NodeData, EdgeData> =
  OperatorFunction<Graph<NodeData, EdgeData>, {
    graph: Graph<NodeData, EdgeData>
    geometry: GraphGeometry
  }>

type Present<NodeData, EdgeData> =
  (input: {
    camera$: Observable<GraphCamera>
    focusIds$: Observable<ReadonlySet<GraphId>>
    selectionIds$: Observable<ReadonlySet<GraphId>>
  }) => OperatorFunction<{
    graph: Graph<NodeData, EdgeData>
    geometry: GraphGeometry
  }, GraphFrame<NodeData, EdgeData>>

type Renderer<Frame> =
  (host: HTMLElement) => MonoTypeOperatorFunction<Frame>

type GraphRenderer<NodeData = unknown, EdgeData = unknown> =
  Renderer<GraphFrame<NodeData, EdgeData>>

type RendererInteractions = {
  cameraInput$: Subject<GraphCamera>
  focusInput$: Subject<ReadonlySet<GraphId>>
  selectionInput$: Subject<ReadonlySet<GraphId>>
}
```

Async ingest and layout operators use `switchMap` so a new source revision unsubscribes the
older parse, render, measurement, or layout operation. Synchronous projections may use `map`
inside an operator when they cannot outlive their input. Unsubscribing from `from(promise)`
only suppresses a stale emission. Cancellable work must expose Observable teardown that stops
the native operation or accept an `AbortSignal` wired to that teardown.

```ts
source$.pipe(
  ingest(adapter),
  layout(engine),
  present({ camera$, focusIds$, selectionIds$ }),
  pixi(host, interactions),
).subscribe()
```

The terminal subscription has no side-effect callback. Renderer effects occur inside the
renderer operator. Renderer-owned native resources remain private and implement
`Unsubscribable` when a resource wrapper is required.
Renderer pointer, camera, focus, and selection events publish through caller-owned Subjects
or bare Signals. Their derived state re-enters `present`; renderers do not expose imperative
`setCamera` or `focus` methods.

The generic `Renderer<T>` alias has one package owner. Grapht imports it and adds only the
`GraphRenderer` specialization. If Grapht owns RxJS operators, its package manifest declares
RxJS using the repository's established dependency policy.

## Instance timeline

```text
source revision
  -> ingest switchMap
       previous ingest unsubscribed
       next Graph emitted
  -> layout switchMap
       previous layout unsubscribed
       next GraphGeometry emitted
  -> presentation combines graph + geometry + camera
       HeaderPlacement[] derived for every relevant camera emission
  -> renderer operator
       subscription acquires Cytoscape or Pixi resource
       GraphFrame emissions update keyed native objects
       error and completion forward through RxJS
       unsubscribe releases the native resource
```

Graph and geometry revisions are durable values. Camera and presentation are ephemeral
stream state. Native renderer objects exist for one renderer subscription. Renderer maps use
`GraphId` as their only durable join key.

## Current code retained as input

| Existing code | Reuse |
|---|---|
| `grapht-model/src/0_sequenceIdentity.ts` | Move sequence payload and identity logic onto generic `Graph` items |
| `grapht-model/src/5_stickyStack.ts` | Retain the math as input, then move parent-aware presentation stacking to `grapht` |
| `grapht/src/15_sequenceGeometry.ts` | Adapt measured bounds into generic `GraphGeometry` |
| `grapht/src/18_sequenceCollapse.ts` | Generalize descendant filtering over `Graph.parentId` |
| D2 and Mermaid sequence adapters | Emit the canonical flat `Graph` plus language payloads |
| Cytoscape and Pixi projections | Compile the same `GraphFrame` into renderer-native objects |

## RxJS and type-system duplication audit

### Replace

1. `scene/src/4_renderer.ts` defines `subscribe`, `next`, and `unsubscribe` hooks, manually
   creates an Observable, forwards notifications, and forwards errors. Keep the public
   operator shape and implement resource ownership with RxJS resource and teardown
   primitives rather than a second observer vocabulary.
2. `grapht-model/src/2_sequenceArtifact.ts#createSequenceArtifactCurrent` owns an
   `AbortController`, current request, and latest-result check. Express latest-revision
   ownership with `switchMap`; cancellation remains the inner Observable teardown.
3. `grapht/src/17_sequenceBoard.ts` exposes `replace`, `setCamera`, `focus`, and `unmount` and
   manually calls `renderState`. Replace it with graph, geometry, camera, and focus streams
   feeding a renderer operator. DOM/SVG rendering, if retained, becomes an adapter.
4. Repo-owned projections expose `dispose()` while repository lifecycle vocabulary is
   `unsubscribe()`. Migrate the application renderer surface. Benchmark protocol projection
   APIs remain scoped to their existing wire contracts. Native `destroy()` and `dispose()`
   calls remain internal implementation details.
5. `scene/src/0_types.ts` owns `Item.parent`, `Scene.items`, `Scene.edges`, and a geometry type
   parallel to Grapht. Scene keeps tweening and frame timing. Graph topology comes from
   `grapht-model`; geometry comes from `grapht`.
6. D2 and Mermaid sequence lowering store containment twice through `parentId` and `contains`
   relations, and represent a message as both an occurrence and relation. Lower each message
   to one `GraphEdge`; derive containment from `parentId`.
7. `scene/src/5_frames.ts` keeps `last` and `buffer` outside subscription scope. Multiple
   subscribers share mutable transition state, and `concatMap` can leave later keyframes
   queued behind a non-completing animation-frame clock. Allocate state under `defer` and use
   latest-transition semantics through `switchMap` or `switchScan`.
8. `scene/src/7_pixi.ts` manually implements replay-one state, readiness gating,
   cancellation, and asynchronous teardown. Pixi initialization rejection also sits outside
   the Observable error channel. Move acquisition, readiness, errors, replay, and teardown
   into the renderer Observable subscription.
9. `grapht/src/15_sequenceGeometry.ts` cannot cancel an active Playwright measurement.
   Closing the browser or threading an `AbortSignal` must be part of inner Observable
   teardown. D2 `execFile` already accepts a signal; Mermaid currently checks its signal only
   around Playwright work.

### Keep

1. Benchmark scenario reducers are explicit protocol state machines. They are deterministic
   request execution, not application stream composition.
2. JSONL stdin/stdout adapters are one-request process boundaries. RxJS wrapping adds no
   cancellation or composition at that boundary.
3. Native Pixi, Cytoscape, Three.js, CanvasKit, and Wasm teardown names remain inside their
   adapters. Only repo-owned public lifecycle uses `unsubscribe`.
4. Pure validation, indexing, layout math, hashing, and graph traversal remain ordinary
   functions.
5. Cytoscape, CanvasKit, Sigma, and other benchmark protocol geometry schemas remain explicit
   wire formats. They are not application runtime topology types and need not be replaced by
   `GraphGeometry`.
6. Source-specific D2 and Mermaid parser documents remain ingest-local syntax types. They are
   not renderer graph models.

## Migration sequence

### 1. Canonical model

- Add the flat discriminated `Graph` record and validation tests to `grapht-model`.
- Add tree and adjacency index functions.
- Prove edge-to-edge, parallel, self, directional, bidirectional, and nested cases with one
  inline snapshot.

### 2. Generic presentation

- Add generic geometry identifiers and bounds.
- Generalize collapse and focus over graph indexes.
- Replace flat sticky stacking with parent-aware header stacking owned by `grapht` because it
  depends on geometry and camera state.
- Test nested ancestors, sibling replacement, release boundaries, zoom, and viewport inset.

### 3. Ingest adapters

- Make D2 and Mermaid emit the canonical graph.
- Preserve language-specific syntax information only in item payloads.
- Add a filesystem ingest fixture using the same parent model.
- Use `switchMap` for render and browser-measurement work.

### 4. Renderer operators

- Define one `Renderer<GraphFrame>` operator type.
- Project the same fixture through Cytoscape and Pixi.
- Keep renderer-native objects private to the subscription.
- Add keyed enter, update, exit, and unsubscribe receipts.
- Put per-subscription animation and renderer state under `defer`.
- Route asynchronous initialization errors through the Observable error channel.
- Verify that unsubscribe stops Playwright, D2, Mermaid, and renderer-native async work.

### 5. Remove duplicate systems

- Remove graph topology from scene after consumers use `GraphFrame`.
- Keep `grapht-model` limited to topology, validation, indexes, and identity. Put RxJS
  operators and geometry-dependent presentation in higher packages.
- Move the DOM/SVG sequence board into an adapter or remove it.
- Remove `createSequenceArtifactCurrent` after operator consumers migrate.
- Rename application renderer `dispose` and `unmount` boundaries to `unsubscribe`, or hide
  them behind renderer operators. Leave benchmark wire projection APIs in benchmark scope.

## Definition of done

1. One flat graph fixture contains nested nodes, a nested edge, parallel edges, a self edge,
   an edge-to-edge edge, and all three direction modes.
2. D2, Mermaid, and filesystem ingest produce the canonical graph type.
3. Parent, child, ancestor, descendant, incoming, outgoing, and incident indexes match
   snapshots, including one incident entry for a self edge.
4. Nested group headers produce identical placement records for every renderer.
5. Cytoscape and Pixi consume the same `GraphFrame` without source-language branches.
6. Renderer subscription is the only repo-owned render lifetime.
7. New source revisions unsubscribe older async ingest, measurement, and layout work.
   Tests prove that native work stops, rather than only proving stale emissions are hidden.
8. Scene contains animation and interpolation types without graph topology duplication.
9. The application renderer surface exposes no `mount`, `unmount`, `destroy`, `dispose`, or
   custom observer-hook lifecycle. Benchmark wire projection APIs are outside this condition.
10. Existing benchmark protocol execution and receipts continue to pass.

## Over-correction guards

- Do not add stored child arrays, ancestor arrays, adjacency arrays, or depth fields to the
  canonical graph.
- Do not require every pure synchronous function to become an Observable.
- Do not move graph topology into scene.
- Do not put camera, geometry, presentation, or RxJS operator ownership in `grapht-model`.
- Do not expose native renderer instances through the shared renderer contract.
- Do not redeclare the generic renderer operator alias in multiple packages.
- Do not introduce separate sequence, filesystem, Cytoscape, or Pixi graph models.
- Do not delete source parser AST/document types or benchmark wire schemas while removing
  duplicate application graph models.
- Do not require a class hierarchy, visitor, entity-component system, or generalized
  hypergraph.
- Do not remove benchmark state machines while replacing application lifecycle duplication.
