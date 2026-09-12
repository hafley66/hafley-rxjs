---
created: 2026-08-25
updated: 2026-08-25
type: epic
owner: sol-high
status: done
priority: high
epic: grapht-renderer-platform
labels:
- model:sol-high
- size:large
- lane:research
size: L
lane: research
collision: [packages-grapht]
closed: 2026-08-25
---

# Specify RxJS renderer composition

## Description

## Scope

Define native event signals, interaction reducers, computed frames, renderer operators, teardown, batching, and probes as an RxJS operator graph using the repository signal types. Use `packages/rxjsx` and `packages/rxjs-ext/src/4_combinePartial.ts` as the local reference. Introduce a second animation-frame queue only when measurements require lossy paint coalescing. Do not introduce an effect registry, reconciliation scheduler, or standalone runtime package.

## Contract evidence

Hollow signatures live in `packages/grapht/src/30_rendererRuntimeContract.ts`.
They use `Observable`, `OperatorFunction`, `SchedulerLike`, `Subscription`, and
the repository `Signal` type directly. No runtime class, effect registry,
ownership layer, reconciler scheduler, or alternate memo language is declared.

### Signatures and pseudocode

The fixed root set is created once for one mounted application:

```ts
function graphApplicationSignals(input): GraphApplicationSignals {
  const document = Signal(input.document$, input.initialDocument)
  const events = Signal<GraphInteraction>()
  const interaction = graphInteractionState(input.initialInteraction, [
    events.$,
    ...input.events$,
  ])
  const geometry = Signal(input.nativeGeometry$, input.initialGeometry)
  const frame = Signal(() =>
    resolveGraphFrame(document.$(), interaction.$(), geometry.$()),
  )
  const rendererKind = Signal(input.rendererKind$, input.initialRendererKind)
  const receipts = Signal<RendererProjectionReceipt>()
  const metrics = Signal(input.initialMetrics)

  return { document, events, interaction, geometry, frame, rendererKind, receipts, metrics }
}
```

`Signal(() => dependency.$())` is the pure memo form. `$()` performs the
synchronous read and `dependency.$` remains an ordinary Observable input to
RxJS. The contract declares no `use(observable)` form.

Interaction state uses merge and scan:

```ts
function graphInteractionState(initial, sources): Signal<GraphInteractionState> {
  return Signal(
    merge(...sources).pipe(scan(reduceGraphInteraction, initial)),
    initial,
  )
}
```

Renderer replacement uses latest-owner cancellation:

```ts
function rendererFrames(kind$, frame$, operatorOf) {
  return kind$.pipe(
    switchMap(kind => frame$.pipe(operatorOf(kind))),
  )
}
```

Cytoscape and Pixi use the same operator shape. Acquisition and mutation occur
inside the resource Observable. `concatMap` keeps frame application ordered for
one resource; finalization invokes the repository-owned `unsubscribe` method:

```ts
function renderCytoscape(host): OperatorFunction<GraphFrame, RendererProjectionReceipt> {
  return source$ => defer(() => acquireCytoscape(host)).pipe(
    switchMap(resource => source$.pipe(
      concatMap(frame => resource.apply(frame)),
      finalize(() => { resource.unsubscribe() }),
    )),
  )
}
```

`renderPixi` and optional `renderReact` have the same
`OperatorFunction<GraphFrame, RendererProjectionReceipt>` signature. React
projection can join the output with `merge`; it reads the same frame signal and
does not own graph state.

The application root contains the only explicit subscription. A React shell,
when present, has the corresponding single `ReactDOM.render()` call:

```ts
function mountGraphApplication(receipts$): Subscription {
  ReactDOM.render(<GraphShell />, reactHost)
  return receipts$.subscribe()
}
```

Every helper above the mount returns a Signal, Observable, OperatorFunction,
resource, frame, receipt, or Subscription. Renderer adapters and helpers have
zero explicit `subscribe()` calls. RxJS owns their inner subscriptions.

### Operator selection

| Operator | Contract use | Cardinality and history |
| --- | --- | --- |
| `merge` | native events, DOM events, optional renderer outputs | One output per source emission; stores no accumulated history. |
| `combineLatest` | current-value products whose inputs all have initialized values | One retained current value per input; emits after every input has emitted. |
| `combinePartialArray` / `combinePartialRecord` | current-value products allowed to emit before every input initializes | One retained current value per initialized input; missing entries remain absent or `undefined`. |
| `scan` | interaction state and other synchronous accumulated history | One accumulator; one next state per input event. |
| `switchScan` | accumulated state whose asynchronous inner work is replaced by newer input | One accumulator and at most one active inner process. It is not used for current-value products. |
| `switchMap` | renderer replacement, scenario replacement, changing child structure | At most one active owned inner resource. Replacement unsubscribes the previous inner first. |
| `mergeMap` | intentionally concurrent work | `MergeMapConcurrency` is mandatory. Active inner cardinality is bounded by the branded positive integer. |

The GraphOperatorPolicy type records these uses. `mergeMapConcurrency(value)`
rejects zero, negative, fractional, and non-finite values before returning the
branded bound.

### Local RxJS evidence

- `packages/rxjsx/src/jsx-runtime.tsx` merges tagged prop and child emissions,
  scans them into one current partial render state, and exposes
  `renderToDOM` as its terminal subscription boundary.
- `packages/rxjsx/src/util.dual.ts` uses `combineLatest` for initialized child
  products, `switchMap` for changing nested child structure, and
  `throttleTime(..., animationFrameScheduler, { leading: true, trailing: true })`
  for bounded paint coalescing.
- `packages/rxjs-ext/src/4_combinePartial.ts` implements both partial combiners
  as tagged `merge` followed by `scan`. The accumulator stores one latest value
  per array index or record key. Grapht reuses these operators directly for
  partially initialized products.
- Grapht generalizes the retained-VNode pattern to retained graph frame values.
  The extension changes the value type and frame resolver; the operator
  ownership and cardinality remain RxJS semantics.

### Optional semantic and paint queues

The default `graphFrameQueues` maps every semantic state to a frame without a
second queue. The optional form accepts this literal policy:

```ts
{
  kind: "animation-frame",
  scheduler: animationFrameScheduler,
  capacity: 1,
  retention: "latest",
}
```

Its semantic `state$` preserves every ordered reducer output. The paint queue
may drop intermediate frames between paints and retains at most one pending
latest state. `GraphFrameQueues.paintPendingCardinality` is therefore `0 | 1`.
Measurements must show a paint-coalescing requirement before this option is
enabled.

### Event cardinality, cancellation, and lifetimes

- One native Cytoscape, Pixi, or DOM event normalizes to one
  `GraphInteraction`. Event Signals have no initial value and no replay.
- `kind: "translate"` carries one canonical ID and one `(dx, dy)` delta. The
  reducer emits one next interaction state and accumulates one translate entry
  for that ID.
- The semantic reducer queue is ordered and lossless. Only the optional paint
  queue is lossy, with one latest pending state.
- `switchMap` cancels a replaced renderer resource, scenario, or asynchronous
  owner. `switchScan` additionally retains the accumulated outer state.
- `mergeMap` permits concurrency only through an explicit bound.
- One native event Signal lives with its renderer resource. One interaction
  state Signal and one fixed root set live with the mounted graph application.
- Renderer replacement calls the previous resource's `unsubscribe` once before
  the next resource becomes active. Application teardown unsubscribes the one
  root Subscription, which tears down the active inner resource and listeners.

`GraphRendererResource.unsubscribe()` returns a `RendererUnsubscribeReceipt`
containing removed listener and handle counts. RxJS's inherited
`Subscription.unsubscribe(): void` remains unchanged only at the direct
third-party boundary.

### Storage and read/write sequence

- `document` stores one current Graphology topology plus Grapht sidecars.
- `interaction` stores one viewport, one focus set, one selection value, and
  one accumulated translate record keyed by canonical ID.
- `geometry` stores one current geometry value. `frame` is a pure Signal memo
  over document, interaction, and geometry reads.
- Nodes, edges, ports, and visual parts are values inside `document`; the fixed
  root cardinality declares `elementSignals: 0`.
- Renderer native objects live only in the active resource. Metrics and
  receipts are values keyed by canonical identity.

The write sequence is:

1. A native adapter emits one normalized interaction into its event Signal.
2. `merge` forwards it without history; `scan` writes one interaction state.
3. Geometry reads accumulated `translate` values.
4. The frame memo reads document, interaction, and geometry synchronously.
5. `switchMap` selects the active renderer operator.
6. The resource applies the frame and emits a receipt after its native mutation
   boundary.
7. Metrics reduce receipts as ordinary values.

Focus and selection changes do not write geometry. Viewport changes do not
write topology. Renderer mutation receipts do not write canonical application
state.

### Uniqueness and cardinality

- One mounted graph application has exactly eight named root Signals and zero
  per-element Signals.
- One application root has one explicit Subscription and at most one active
  renderer inner subscription.
- One host has at most one active renderer resource and one native listener set.
- One canonical interaction produces one reducer output. One applied frame
  produces one projection receipt.
- The optional paint queue retains at most one pending state.
- Bounded `mergeMap` retains at most its explicit concurrency value in active
  inner work.
- React and a native renderer may consume the same frame through a merged output
  graph while the application still owns one terminal Subscription.

### Counterexamples and stop conditions

- Subject-to-Subject or Subject-to-BehaviorSubject forwarding adds a second
  owner and an extra subscription. Native adapters emit directly through their
  event Signal or Observable boundary.
- `Subscription.add` obscures renderer replacement ownership. `switchMap` owns
  the active inner lifetime.
- `merge` cannot implement current-value products because it retains no value
  for an inactive source.
- `combineLatest` cannot emit a partial product before every input initializes.
- `scan` used for a current-value product invents history semantics;
  `combinePartial` owns that shape.
- Unbounded `mergeMap` lets active frame or measurement work grow with input
  cardinality.
- A `tap` mutation channel hides effects from output values. Resource operators
  emit receipts from the mutation boundary.
- A second explicit helper-level `subscribe()` stops contract review and moves
  ownership back to the application root.
- Public repository functions returning `void`, renderer replacement without
  `switchMap`, a resource without `unsubscribe`, a replaying native event
  Signal, or a paint queue with capacity above one stop implementation.

## Acceptance Criteria

- [x] Signatures and pseudocode show one terminal rendering subscription.
- [x] No Subject forwarding layer, Subscription.add tree, or side effect inside intermediate subscribe.
- [x] Every owned lifecycle returns unsubscribe.
- [x] Event cardinality, frame batching, cancellation, and renderer-switch lifetime are specified.
- [x] Default signatures use RxJS operators directly without a standalone runtime wrapper.
- [x] Optional two-queue signatures bound the paint queue to one latest pending state.
- [x] Evidence states which `rxjsx` and `combinePartial` operators are reused or generalized.
- [x] Signals and RxJS compose through the signal `$` Observable surface without an ownership layer between them.
- [x] Pure combinations use `Signal(() => dependency.$())` memo reads without a `use(observable)` syntax.
- [x] One fixed root signal set is instantiated per mounted graph application.
- [x] Nodes, edges, ports, and visual parts remain values within root signals rather than signal instances.
- [x] RxJS time, scheduling, cancellation, flattening, and teardown remain ordinary operators.
- [x] React can consume the same graph as an optional rendering subscriber.
- [x] Cytoscape and Pixi frame application are RxJS operators with resource teardown.
- [x] Graph logic contains zero `tap` effect channels.
- [x] Public composition functions contain zero `void` returns.
- [x] Exactly one explicit application-root `subscribe()` activates the mounted graph, matching the single `ReactDOM.render()` boundary.
- [x] Helper functions return composable Observables, Signals, renderer resources, frames, receipts, or Subscriptions.
- [x] Helper functions and renderer adapters contain zero explicit `subscribe()` calls.
- [x] Operator selection documents `merge`, `combineLatest`, `combinePartial`, `scan`, `switchScan`, `switchMap`, and bounded `mergeMap` cardinality.
- [x] Renderer-native mutations are enclosed by resource Observables and produce receipts.

## Tests Run

- [x] Targeted TypeScript 7 `--noEmit` check passes for the three hollow contract signature files against current workspace sources.
- [x] Static contract scans report one `.subscribe()` in pseudocode, one `ReactDOM.render()`, zero `Subscription.add`, and zero `tap` effect channels.
- [x] `git diff --check` reports no whitespace errors for the issue diff.

## Implementation Notes

- Added only declarations, type-only exports, the Signals dependency record,
  and issue evidence. Renderer implementations and call sites are unchanged.
