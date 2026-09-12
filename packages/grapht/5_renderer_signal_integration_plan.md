# Renderer Signal Integration Plan

## Goal

Represent Grapht application state, native renderer events, interaction reduction, visual grouping, port resolution, and renderer projection with `@hafley66/signals` and RxJS. Graphology supplies the topology substrate. Grapht retains its hierarchy, visual, port, geometry, and renderer-interface traits. Cytoscape and Pixi are the first complete renderer lowerings. The type contracts retain mappings for React Flow and yEd-style rich graph editing without requiring those adapters in this phase.

Vocabulary follows CSS where an equivalent term exists: `kind`, `viewport`, `focus`, `selection`, and `translate`. Selection includes ranges over text-bearing visual parts.

## Current checkpoint

- `PortLocation` and `resolvePortLocation` are committed.
- `GraphVisual` groups SVG parts and ports by canonical graph identity.
- `translateGraphGeometry` translates nodes and connected route endpoints.
- Cytoscape and Pixi movement wiring remains uncommitted while the signal topology is replaced.
- `grapht-golden/src/1_app.ts` contains `Subscription.add`, Subject forwarding, manual DOM listener cleanup, and terminal DOM writes.

## 0. Canonical types

```ts
type GraphSelection =
  | { kind: "identities"; ids: ReadonlySet<GraphId> }
  | {
      kind: "text-range"
      graphId: GraphId
      partId: GraphVisualPartId
      anchor: number
      focus: number
    }

type GraphDocument<NodeData = unknown, EdgeData = unknown> = {
  topology: graphology.Graph<NodeData, EdgeData>
  visuals: readonly GraphVisual[]
  ports: readonly GraphPort[]
}

type GraphInteraction =
  | { kind: "viewport"; viewport: GraphViewport }
  | { kind: "focus"; ids: ReadonlySet<GraphId> }
  | { kind: "selection"; selection: GraphSelection }
  | { kind: "translate"; id: GraphId; dx: number; dy: number }

type GraphInteractionState = {
  viewport: GraphViewport
  focusedIds: ReadonlySet<GraphId>
  selection: GraphSelection
  translateById: GraphTranslations
}
```

Bodies:

```ts
function reduceGraphInteraction(
  state: GraphInteractionState,
  event: GraphInteraction,
): GraphInteractionState {
  // Return the next immutable interaction state.
  // Accumulate translation deltas in translateById by canonical graph ID.
  // Preserve unrelated state branches by reference.
}

function resolveGraphVisuals(
  document: GraphDocument,
  geometry: GraphGeometry,
): readonly ResolvedGraphVisual[] {
  // Resolve every visual part from canonical geometry.
  // Resolve every GraphPort through resolvePortLocation.
  // Retain graphId as the event identity for every native part.
}
```

Definition of done:

- `GraphDocument` references Graphology topology plus Grapht visuals and ports.
- Mixed, directed, undirected, bidirectional, self, and parallel edges retain canonical identity.
- Renderer packages do not infer semantic ownership by traversing SVG parents.
- Every visual part and port resolves to one canonical `graphId`.
- Snapshot tests cover nested groups, actor visual parts, self edges, multi-edges, and all `PortLocation` variants.

## 1. Native event signals

```ts
type RendererEventSignals = {
  events: Signal<GraphInteraction>
}

function cytoscapeEventSignals(
  cy: cytoscape.Core,
  viewportOf: () => GraphViewport,
): RendererEventSignals {
  // Wrap cy.on/cy.off with fromEventPattern.
  // Normalize viewport, focus, selection, and translate events.
  // Return event Signal semantics with no initial value or replay.
}

function pixiEventSignals(
  stage: Container,
  viewportOf: () => GraphViewport,
): RendererEventSignals {
  // Wrap Pixi federated events as Observables.
  // Normalize viewport, focus, selection, and translate events.
  // Return the same GraphInteraction union as Cytoscape.
}

function domEventSignal<EventType extends Event>(
  target: EventTarget,
  type: string,
): Signal<EventType> {
  // Construct an event Signal from fromEvent.
  // Let RxJS own listener installation and removal.
}
```

Instance timeline:

1. Renderer resource is acquired for one host.
2. Native event signals are created without installing duplicate listeners.
3. The renderer output subscription activates the event sources.
4. Renderer replacement or application teardown calls `unsubscribe` once.
5. RxJS removes Cytoscape, Pixi, and DOM listeners.

Definition of done:

- Zero manual `addEventListener` cleanup closures in the golden app.
- Zero Subject-to-BehaviorSubject forwarding subscriptions.
- Event signals have no initial emission and no replay.
- One native event produces one normalized `GraphInteraction`.
- Tests count native listener attachment and removal.

## 2. Interaction state signal

The default runtime is RxJS composition. `packages/rxjsx` supplies the local reference implementation:

- `combinePartialArray` and `combinePartialRecord` merge tagged source emissions through `scan` and retain only each source's latest value.
- `jsx` merges prop and child emissions, scans them into partial render state, and maps that state to a retained VNode.
- `createChildrenObservable` uses `switchMap` for changing child structure and coalesces output on `animationFrameScheduler`.
- `renderToDOM` owns the single terminal rendering subscription.

Grapht uses the same shape. There is no standalone reactive-runtime abstraction and no ownership split between RxJS and signals. Signals retain their Observable `$` surface. They can enter any RxJS operator graph directly.

Use a signal when synchronous `$()` reads, dot-access projection, or memo dependency tracking shorten the graph. Pure memos read signals directly. No `use(observable)` syntax or alternate dependency language is added.

```ts
type GraphApplicationSignals = {
  document: Signal<GraphDocument>
  interaction: Signal<GraphInteractionState>
  geometry: Signal<GraphGeometry>
  frame: Signal<GraphFrame>
  subscription: Subscription
}

function graphApplication(
  document$: Observable<GraphDocument>,
  events$: Observable<GraphInteraction>,
): GraphApplicationSignals {
  // Instantiate one fixed root signal set for the mounted graph.
  // Wrap an Observable as a Signal when current reads or dot projection help.
  // Express pure combinations as Signal(() => dependency.$()).
  // Keep nodes, edges, ports, and visual parts as values within root signals.
}
```

RxJS keeps its temporal operators intact: `scan`, `switchMap`, `delay`, `auditTime`, schedulers, cancellation, and teardown. React may subscribe as a rendering target over the same graph. Cytoscape and Pixi may subscribe through renderer operators. No effect registry or custom reconciliation scheduler sits between them.

Composition rules:

- Graph logic emits discriminated values through `next`; `event`, `state`, and `effect` do not require separate runtime categories.
- Combining independent streams without accumulated history uses `merge` or another merge-family operator.
- Combining the latest current value from initialized inputs uses `combineLatest`.
- Combining current values before every input initializes uses `combinePartialArray` or `combinePartialRecord`.
- Accumulating synchronous history uses `scan`.
- Accumulating history while replacing an asynchronous inner process uses `switchScan`.
- Latest-owner replacement uses `switchMap`.
- Intentional concurrent work uses `mergeMap` with an explicit concurrency bound when cardinality can grow.
- Graph logic does not use `tap` as an effect channel.
- Public functions do not return `void`. They return an Observable, Signal, Subscription, renderer resource, frame, or receipt that can continue through composition.
- One explicit application-root `subscribe()` activates the mounted graph, at the same boundary where an application calls `ReactDOM.render()` once. Helper functions and renderer adapters do not create additional explicit subscriptions.
- Native APIs that require mutation are enclosed by the renderer Observable or resource boundary and emit receipts describing applied work.

```ts
function graphInteractionState(
  initial: GraphInteractionState,
  sources: readonly Observable<GraphInteraction>[],
): Signal<GraphInteractionState> {
  // merge(...sources)
  // scan(reduceGraphInteraction, initial)
  // Signal(observable, initial)
}
```

Optional two-queue form:

```ts
const state$ = merge(topology$, visuals$, nativeEvents$).pipe(
  scan(reduceGraphState, initialState),
)

const frame$ = state$.pipe(
  auditTime(0, animationFrameScheduler),
  map(resolveGraphFrame),
)
```

The first queue preserves ordered semantic state transitions. The animation-frame queue is lossy between paints and retains the latest state, matching the `rxjsx` partial-combination model. It is an ordinary operator choice. Other timing policies remain ordinary RxJS composition such as `delay`, `debounceTime`, `sample`, or a different scheduler.

Storage:

- Viewport is stored once in `GraphInteractionState.viewport`.
- Focus and selection are canonical graph-ID sets.
- Translation is stored once as accumulated deltas per graph ID.
- Cytoscape and Pixi native objects live in the active renderer resource, keyed by canonical identity.
- SVG element IDs remain visual-part identity, not application state identity.

Sequence of writes:

1. Native event adapter emits `GraphInteraction`.
2. `scan` produces one next interaction state.
3. Computed geometry reads `translateById`.
4. Computed presentation reads viewport, focus, and selection.
5. Active renderer reads the resulting frame.

Uniqueness conditions:

- One interaction-state signal exists per mounted Grapht application.
- One translation record exists per canonical graph ID.
- One renderer resource exists per active renderer and host.
- Switching renderers unsubscribes the previous resource before activating the next.
- The default implementation has one RxJS operator graph and one terminal rendering subscription.
- The optional frame queue stores one latest pending state and cannot grow with input frequency.

Definition of done:

- No renderer stores a second authoritative viewport or selection state.
- Hover frames cannot reset dragged positions.
- Moving one actor updates its visual group and connected route endpoints in one state emission.
- Self-edge routes translate as a whole when their actor moves.

## 3. Computed geometry and presentation signals

```ts
const translatedGeometry = Signal(() =>
  translateGraphGeometry(
    document.topology.$(),
    nativeGeometry.$(),
    interactionState.translateById.$(),
  ),
)

const resolvedVisuals = Signal(() =>
  resolveGraphVisuals(document.$(), translatedGeometry.$()),
)

const frame = Signal(() =>
  presentGraphFrame({
    document: document.$(),
    geometry: translatedGeometry.$(),
    visuals: resolvedVisuals.$(),
    interaction: interactionState.$(),
  }),
)
```

Definition of done:

- Geometry recomputes only when graph geometry or translations change.
- Focus changes do not remeasure SVG or rebuild native renderer elements.
- Viewport changes do not rebuild canonical graph records.
- Port resolution returns position, tangent, normal, and angle.
- Actor, label, lifeline, and attached ports share one visual transform.

## 4. Renderer lowering

```ts
type RendererSignals<Native> = {
  frame: Signal<GraphFrame>
  visuals: Signal<readonly ResolvedGraphVisual[], RendererSignalField<Native>>
  events: Signal<GraphInteraction>
  subscription: Subscription
}

function renderCytoscape(
  host: HTMLElement,
): OperatorFunction<GraphFrame, RendererReceipt> {
  // Acquire the Cytoscape resource on subscription.
  // Apply each frame as one Cytoscape batch inside the resource Observable.
  // Emit receipts after the batch commits.
  // Unsubscribe native events and destroy the resource during teardown.
}

function renderPixi(
  host: HTMLElement,
): OperatorFunction<GraphFrame, RendererReceipt> {
  // Acquire the Pixi resource on subscription.
  // Apply each frame against retained native handles inside the resource Observable.
  // Emit receipts after rendering.
  // Unsubscribe native events and destroy the resource during teardown.
}

function lowerCytoscape(
  host: HTMLElement,
  frame: Signal<GraphFrame>,
): RendererSignals<cytoscape.SingularElementReturnValue> {
  // Reconcile canonical visual IDs to retained Cytoscape elements.
  // Store each native element in its visual signal $field.native.
  // Forward normalized events through the shared event signal.
}

function lowerPixi(
  host: HTMLElement,
  frame: Signal<GraphFrame>,
): RendererSignals<Container> {
  // Reconcile canonical visual IDs to retained Pixi containers.
  // Build a Container per GraphVisual, then add its parts as children.
  // Draw message routes from resolved canonical geometry.
}
```

Definition of done:

- Cytoscape and Pixi lower the same `ResolvedGraphVisual[]`.
- Pixi no longer searches unrelated `SVGScene` descendants during drag.
- Cytoscape frame lines and labels share one visual-group identity.
- Moving a group applies one transform to all nested parts.
- Edge endpoints resolve through ports in both renderers.
- Renderer teardown method is named `unsubscribe` everywhere.

Compatibility contracts:

- React Flow mapping covers handles, nested nodes, selection, viewport, and translate events.
- yEd-style mapping covers nested groups, path-relative ports, labels, bends, and multiple edges.
- Cytoscape is the first complete lowering.
- Pixi follows Cytoscape using the same document, frame, and interaction fixtures.
- Sigma, Graphviz, and additional algorithm providers remain deferred capability entries.

## 5. Golden application

```ts
function goldenApplication(host: HTMLElement): Signal<GoldenApplicationState> {
  // Create DOM input event signals with fromEvent.
  // Derive selected scenario and renderer signals.
  // Create one interaction-state signal.
  // switchMap the active renderer signal.
  // Return application state for diagnostic outputs.
}

function mountGolden(): Subscription {
  // rendererKind$.pipe(
  //   switchMap(kind => frame$.pipe(rendererOperator(kind, host))),
  // ).subscribe()
}
```

`mountGolden()` is the only explicit `subscribe()` call in the application. Renderer replacement occurs inside `switchMap`; RxJS owns the inner subscription and teardown.

Golden sequence coverage:

- Mermaid and D2 each render through Cytoscape and Pixi.
- Actor drag moves actor shape, actor label, and lifeline together.
- Incoming and outgoing message endpoints remain attached.
- Self messages move with their actor.
- Group frame parts and group labels move together.
- Sticky group labels continue stacking.
- Five visible port markers exercise `absolute`, `relative-box`, `side`, `boundary`, and `path`.
- Ratio and length offsets are both present.
- Tangent, reverse-tangent, fixed, and none orientation are present.

Definition of done:

- `rg "Subscription\.add|subscriptions\.add" packages/grapht-golden/src` returns zero matches.
- `rg "addEventListener|removeEventListener" packages/grapht-golden/src` returns zero matches.
- The golden app has one terminal `.subscribe()`.
- Playwright drags an actor in both renderers and verifies translation state changes.
- Playwright verifies connected route endpoints move by the same deltas.
- Playwright verifies all five port kinds are present.
- Playwright verifies sticky nested group labels after movement.

## 6. Performance and lifecycle probes

```ts
type GraphRuntimeMetrics = {
  frameCount: number
  geometryRecomputeCount: number
  visualProjectionCount: number
  nativeCreateCount: number
  nativeUpdateCount: number
  nativeRemoveCount: number
  activeNativeListenerCount: number
}
```

Definition of done:

- Hovering changes zero geometry records.
- Viewport pan creates zero graph visuals.
- Moving one actor updates that actor visual and its incident edges.
- Renderer switching leaves zero native listeners from the previous renderer.
- Repeated scenario switching retains bounded native element and subscription counts.
- Browser tests expose metrics through one diagnostic signal and snapshot them after fixed interactions.

## Commit sequence

1. Canonical visual groups and translated geometry.
2. Native event signal adapters.
3. Interaction reducer and state signal.
4. Computed geometry, ports, and presentation.
5. Cytoscape signal lowering.
6. Pixi signal lowering.
7. Golden application rewrite.
8. Port and translation browser coverage.
9. Runtime metrics and lifecycle assertions.
