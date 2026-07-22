# TypeSpec to JSON-RX generation plan

## Scope

Keep the TypeSpec vocabulary, custom emitter, generated artifacts, editor,
runtime, and example automation slices inside `packages/json-rx`.

The package accepts automation definitions authored in TypeSpec or TypeScript.
Both paths lower to the same JSON-RX document contract. Tests serialize the
document to JSON, validate it against the emitted JSON Schema, parse it through
the runtime schema, and compile it through the JSON-RX runtime.

## Package tree

```text
packages/json-rx/
  plans/
    0_typespec_json_rx_generation.md
  spec/
    0_main.tsp
    1_models.tsp
    2_operators.tsp
    3_hosts.tsp
    4_automations.tsp
  src/
    0_types.auto.ts
    1_schema.auto.ts
    2_runtime.ts
    3_editor/
      0_formSchema.ts
      1_formRoot.tsx
      2_form.tsx
      2_form.browser.test.tsx
    4_typespec/
      0_library.ts
      1_decorators.ts
      2_graph.ts
      3_emitter.tsx
    5_automations/
      0_claude_usage/
        0_input.tsp
        1_document.auto.ts
        2_document.snapshot.json
        3_document.test.ts
      1_codex_usage/
        0_input.ts
        1_document.auto.ts
        2_document.snapshot.json
        3_document.test.ts
  automation.schema.json
  tspconfig.yaml
```

Generated TypeScript remains under `src` and ends in `.auto.ts`. Generated JSON
snapshots remain beside the automation slice that produced them.

## Source-of-truth layers

| Layer | Authoritative input | Generated output |
| --- | --- | --- |
| JSON-RX vocabulary | `spec/0_main.tsp` through `spec/3_hosts.tsp` | `src/0_types.auto.ts`, `src/1_schema.auto.ts`, `automation.schema.json` |
| TypeSpec automation | `src/5_automations/*/0_input.tsp` | `1_document.auto.ts`, `2_document.snapshot.json` |
| TypeScript automation | `src/5_automations/*/0_input.ts` | `1_document.auto.ts`, `2_document.snapshot.json` |
| Editor reference catalog | TypeSpec symbol graph plus the current JSON-RX document | catalog data embedded in generated types or emitted as a static object |
| Runtime | handwritten `src/2_runtime.ts` | runtime emissions only |

## Compiler graph

```text
TypeSpec vocabulary and automation slices
  -> TypeSpec compiler
  -> JSON-RX semantic graph
  -> JSON-RX emitter
     -> JSON Schema 2020-12
     -> TypeScript types
     -> static JSON-RX documents
     -> editor reference catalog

TypeScript automation slices
  -> typed JSON-RX builder
  -> JSON-RX semantic graph
  -> the same document and validation pipeline

Static JSON-RX document
  -> JSON serialization
  -> JSON Schema validation
  -> AutomationSchema parsing
  -> runtime compilation
```

## Semantic core and generator boundary

The semantic typed core describes reactive meaning independently of any target
runtime. It owns payload types, graph type flow, resource identity, state
transitions, concurrency, cancellation, caching, invalidation, retry, polling,
optimistic updates, and subscription lifetime.

The generator implementation consumes a normalized reactive plan. Target
generators own framework imports, emitted syntax, host lifecycle integration,
file layout, and diagnostics for semantics that the target cannot preserve.

```text
TypeSpec or TypeScript input
  -> semantic typed core
  -> reference resolution and type-flow checking
  -> normalized reactive plan
  -> region recognition
  -> target generator scheme registry
     -> hafley-rxjs Signals
```

Operator-level plans remain available for direct RxJS generation. Region
recognition also retains higher-level resource shapes so the Signals target can
generate endpoints, query keys, cache policy, invalidation, and reactive React
consumers as coherent units.

### Semantic signatures

```ts
type Resource<Input, Value, Failure> = {
  id: string
  input: JsonSchemaReference
  value: JsonSchemaReference
  failure: JsonSchemaReference
  identity: KeyExpression<Input>
  request: ContractReference
  lifetime: ResourceLifetime
  invalidation: InvalidationRule[]
}

type DerivedState<Input, Output> = {
  id: string
  input: StreamReference<Input>
  output: JsonSchemaReference
  pipeline: Operator[]
}

type ReactivePlan = {
  sources: PlannedSource[]
  nodes: PlannedNode[]
  sinks: PlannedSink[]
  resources: PlannedResource[]
  regions: PlannedRegion[]
}

type FlattenNode = {
  kind: 'flatten'
  input: NodeReference
  output: JsonSchemaReference
  project: TypedExpression
  concurrency:
    | { kind: 'latest' }
    | { kind: 'concat' }
    | { kind: 'exhaust' }
    | { kind: 'merge'; maximum?: number }
}

type GeneratorScheme<Node> = {
  target: GeneratorTarget
  accepts(node: PlannedNode | PlannedRegion): node is Node
  dependencies(node: Node): GeneratedDependency[]
  emit(context: EmitContext, node: Node): GeneratedFragment
}
```

Generator scheme bodies follow this shape:

```ts
const rxjsLatestFlatten: GeneratorScheme<FlattenNode> = {
  target: 'rxjs',
  accepts(node): node is FlattenNode {
    return node.kind === 'flatten' && node.concurrency.kind === 'latest'
  },
  dependencies() {
    return [{ package: 'rxjs', import: 'switchMap' }]
  },
  emit(context, node) {
    // Emit switchMap using the already type-checked projection.
    // Return imports and source fragments through the Alloy target model.
  },
}
```

### Operator normalization

Source syntax lowers to semantic axes before generator selection:

| JSON-RX operator | Normalized meaning |
| --- | --- |
| `switchMap` | `flatten` with `latest` concurrency |
| `concatMap` | `flatten` with `concat` concurrency |
| `exhaustMap` | `flatten` with `exhaust` concurrency |
| `mergeMap` | `flatten` with unbounded `merge` concurrency |
| bounded `mergeMap` | `flatten` with `merge` concurrency and a maximum |
| `shareReplay(1)` | shared lifetime with one replayed value |

The normalized form preserves RxJS terminology in authoring and diagnostics
while giving non-RxJS targets explicit semantic requirements to match.

### Current values, keyed events, and reducer state

The normalized plan keeps these three graph shapes distinct:

```text
current-value derivation
  latest input values -> projection -> derived value

keyed event fan-in
  named input emission -> { key, value }

state reduction
  prior accumulator + { key, value } -> next accumulator
```

`mergeByKey` lowers a record of named inputs to the tagged event form. Its
event identity remains available to routing and reducer code.

`mergeByKeyScan` is a linear record reducer. Given a seed record, each event
replaces only the accumulator slot with the same key:

```ts
(state, event) => ({ ...state, [event.key]: event.value })
```

`latestByKey` is the partial-current-value specialization. For inputs
`Record<string, Flow<T>>`, it produces a record of `Option<T>` values, seeded
with `None` for every key. `Some(value)` represents an observed input emission;
it remains distinct from `Some(null)` and `Some(undefined)`. A complete
current-value node can filter or prove all slots `Some`, then project their
unwrapped values. That node has `combineLatest`-style first-emission behavior.

General scan reducers own the state transition. Their semantic signature is:

```ts
reduce(previous: State, event: TaggedEvent): State
```

One event creates one pure reducer transaction. Draft-style writes may read and
write multiple state fields and commit one next state. The TypeScript scheme
may emit an Immer `produce` call; the Rust scheme mutates an owned transition
value before emitting it. Reducer blocks do not infer current-value flow
dependencies.

Candidate inferred-current-value syntax, including `$ { ... }`, belongs only
to the current-value derivation shape. It remains deferred until its capture,
initial-value, completion/error, equality, sharing, and provenance rules are
specified.

### Resource regions

A resource region groups graph nodes that jointly describe keyed state:

```ts
type PlannedResource = {
  kind: 'resource'
  id: string
  input: JsonSchemaReference
  value: JsonSchemaReference
  failure: JsonSchemaReference
  identity: PlannedKey
  transport: PlannedRequest
  concurrency: FlattenNode['concurrency']
  cache: PlannedCachePolicy
  refresh: PlannedRefreshPolicy
  invalidation: PlannedInvalidation[]
  optimisticUpdates: PlannedOptimisticUpdate[]
}
```

The hafley-rxjs Signals target consumes a resource region to generate an
`Endpoint`, `createQuery` or `createMutation` wiring, typed query signals, and
an optional `SignalReact` rendering boundary. Its implementation uses the
existing RxJS-backed Signals runtime.

### Hafley Signals target

The first state-management target is `@hafley66/signals`. Its existing runtime
types provide the initial lowering surface:

| Semantic plan | Signals runtime |
| --- | --- |
| state cell and observable value | `Signal<T>` |
| serializable request boundary | `Endpoint<I, O>` |
| keyed cached resource | `Endpoint.createQuery` |
| imperative write resource | `Endpoint.createMutation` |
| current resource state | `QueryState<T, E>` |
| latest request cancellation | query input `switchMap` |
| explicit refresh | `query.refetch()` |
| stale plus refresh | `query.invalidate()` |
| cache identity | `Endpoint.key(input)` |
| React subscription boundary | `SignalReact` and synchronous `.$()` reads |

The first generated application shape is:

```ts
const usageEndpoint = new Endpoint<UsageInput, UsageSnapshot>(
  generatedUsageEndpointConfig,
  hostTransport,
)

const usageInput = Signal<UsageInput | undefined>(undefined)

const usage = usageEndpoint.createQuery<UsageFailure>(usageInput, {
  staleTime: 5_000,
  cacheTime: 60_000,
  skip: 'retain',
})
```

Generated React reads the generated resource directly:

```tsx
const UsagePanel = SignalReact(() => (
  <UsageView
    data={usage.data.$()}
    loading={usage.isLoading.$()}
    error={usage.error.$()}
  />
))
```

Polling is currently outside `QueryOptions`. The first slice records polling
as semantic plan data and generates an owned timer that calls `refetch()`. A
later signals-runtime change may move polling into `createQuery` while keeping
the JSON-RX resource contract unchanged.

### Generator capability diagnostics

Every target registers the semantic shapes it can preserve. Generation stops
with a structured diagnostic when no scheme matches a required node or region.
No generator silently removes cancellation, ordering, replay, invalidation, or
cache behavior.

```text
JRX-GEN-021
Target: signals-query
Region: pipelines.uploadQueue
Semantic requirement: concat sequencing
Available schemes: keyed latest-request resource, invalidation, mutation
```

Initial target coverage records direct, synthesized, and unsupported mappings
for these features:

- map and filter
- latest, concat, exhaust, unbounded merge, and bounded merge concurrency
- replay and shared subscription lifetime
- polling, focus refresh, reconnect refresh, and explicit invalidation
- request cancellation
- resource keys and request deduplication
- stale and expiration policy
- optimistic mutation and rollback
- loading, success, error, and retained-previous-data states
- server rendering and hydration inputs

### Generator instance timelines

1. One compiler invocation creates one semantic graph.
2. Resolution assigns stable references and checks graph type flow.
3. Normalization creates one immutable `ReactivePlan`.
4. Region recognition annotates compatible subgraphs without deleting their
   operator nodes.
5. One target generator selects schemes for every required node and region.
6. Scheme selection completes before any file is written.
7. Alloy renders the selected target model into deterministic source files.
8. Generated target tests compile and exercise the emitted state timeline.

### Generator storage and uniqueness

- The semantic graph and normalized plan exist only during compilation.
- Scheme registries are static target modules indexed by semantic node kind.
- A target and semantic region pair resolves to exactly one highest-priority
  scheme. Multiple equal-priority matches produce a compiler diagnostic.
- Generated artifact paths have one owning automation and target pair.
- Target-specific configuration remains in binding or generator configuration,
  outside the semantic resource definition.
- Generated files end in `.auto.ts` and retain their source document and target
  in the generated header.

## Internal and external reactive structure

JSON-RX describes an application's reactive structure at two scopes:

- Internal structure connects sources, operators, resources, state machines,
  effects, and sinks within one runtime.
- External structure connects typed interactions across worker, thread,
  extension, browser, process, service, and machine boundaries.

Both scopes use the same payload schemas and interaction identities. A binding
selects the execution mechanism and introduces its transport guarantees,
serialization boundary, permissions, and lifecycle.

```text
semantic interaction
  -> local binding
     -> function, callback, Observable, async iterable, channel
  -> process binding
     -> worker message, extension Port, IPC, WebSocket, HTTP, gRPC
  -> tool binding
     -> LSP, CDP, Playwright, VS Code
```

### Interaction primitives

The semantic core includes these interaction shapes:

```ts
type Interaction =
  | EventInteraction
  | RequestInteraction
  | StreamInteraction
  | CoroutineInteraction
  | StateInteraction

type CoroutineInteraction<Start, Resume, Yield, Return, Failure> = {
  kind: 'coroutine'
  id: ContractReference
  start: JsonSchemaReference<Start>
  resume: JsonSchemaReference<Resume>
  yield: JsonSchemaReference<Yield>
  return: JsonSchemaReference<Return>
  failure: JsonSchemaReference<Failure>
  cancellation: 'unsupported' | 'cooperative' | 'required'
  ordering: 'ordered'
  resumability: 'connection' | 'session' | 'durable'
  ownership: 'caller' | 'callee' | 'shared'
}
```

A coroutine is one activation with a typed conversation timeline:

```text
start(Start)
  -> yield(Yield)
  -> resume(Resume)
  -> yield(Yield)
  -> resume(Resume)
  -> return(Return) | fail(Failure) | cancel
```

`StreamInteraction<T>` covers repeated values with no value sent back at each
yield. `RequestInteraction<I, O, E>` covers one input and one terminal result.
The coroutine form covers bidirectional suspension and resumption.

### Coroutine activation state

```ts
type CoroutineActivation = {
  contract: ContractReference
  activationId: string
  sessionId: string
  owner: EndpointReference
  phase:
    | 'starting'
    | 'running'
    | 'suspended-at-yield'
    | 'suspended-at-resume'
    | 'returned'
    | 'failed'
    | 'cancelled'
  nextSequence: number
  resumeToken?: string
}
```

Within one process, `activationId` identifies one generator, task, actor, or
subscription instance. Across a transport, it correlates the messages that
belong to the same suspended computation. The serialized protocol transfers
typed continuation messages. It does not transfer stack frames or executable
continuations.

### Wire protocol

```ts
type CoroutineEnvelope =
  | { kind: 'coroutine.start'; activationId: string; contract: ContractReference; sequence: 0; payload: unknown }
  | { kind: 'coroutine.yield'; activationId: string; sequence: number; payload: unknown }
  | { kind: 'coroutine.resume'; activationId: string; sequence: number; payload: unknown }
  | { kind: 'coroutine.return'; activationId: string; sequence: number; payload: unknown }
  | { kind: 'coroutine.throw'; activationId: string; sequence: number; error: unknown }
  | { kind: 'coroutine.cancel'; activationId: string; sequence: number; reason?: unknown }
  | { kind: 'coroutine.ack'; activationId: string; sequence: number }
```

Transport bindings add delivery policy:

```ts
type DeliveryPolicy = {
  delivery: 'at-most-once' | 'at-least-once'
  replay: 'none' | 'session-buffer' | 'durable-log'
  disconnect: 'cancel' | 'suspend' | 'detach'
  duplicateHandling: 'reject' | 'ignore' | 'replay-result'
  timeoutMs?: number
  maximumBufferedYields?: number
}
```

Sequence numbers detect duplicates, gaps, and out-of-order continuation
messages. Durable resumption additionally requires persisted activation state
or an application-defined checkpoint. The contract records whether such a
checkpoint exists.

### Runtime lowerings

| Semantic form | TypeScript lowering | Rust lowering | Remote lowering |
| --- | --- | --- | --- |
| request | `Promise<Result>` | `Future<Output = Result>` | correlated request/response |
| stream | `Observable<T>` or `AsyncIterable<T>` | `Stream<Item = T>` | event frames with flow control |
| coroutine | `AsyncGenerator<Yield, Return, Resume>` | task plus typed `mpsc` channels or explicit state-machine future | activation protocol |
| state | reducer plus observable snapshot | enum state plus reducer/task | snapshot and transition events |

RxJS coroutine generation represents resume values as an input stream and
yield values as an output stream tied to one activation lifetime. Generated
code owns teardown, cancellation, and terminal-state propagation. Rust
generation assumes Tokio and uses typed channels around a spawned task when
bidirectional suspension is required.

The RxJS lowering treats a coroutine as a scan whose accumulator is the
activation state and whose input is a typed start, resume, cancel, or failure
event. The accumulator returns an inner stream containing the next state,
yield, effect request, or terminal result.

```ts
type CoroutineInput<Start, Resume> =
  | { kind: 'start'; value: Start }
  | { kind: 'resume'; value: Resume }
  | { kind: 'cancel'; reason?: unknown }

type CoroutineStep<State, Yield, Return, Failure> =
  | { kind: 'state'; state: State }
  | { kind: 'yield'; state: State; value: Yield }
  | { kind: 'return'; state: State; value: Return }
  | { kind: 'failure'; state: State; error: Failure }

function stepCoroutine<State, Start, Resume, Yield, Return, Failure>(
  state: State,
  input: CoroutineInput<Start, Resume>,
): Observable<CoroutineStep<State, Yield, Return, Failure>>
```

```ts
const activation$ = input$.pipe(
  switchScan(
    (state, input) => stepCoroutine(state, input),
    initialState,
  ),
)
```

`switchScan` gives each new input authority to cancel the prior asynchronous
step. The normalized concurrency policy selects the corresponding scan form:

| Coroutine step policy | RxJS lowering |
| --- | --- |
| latest resume replaces in-flight step | `switchScan` |
| resumes wait in order | `concatScan` |
| resumes are ignored while a step runs | `exhaustScan` |
| resumes may overlap | `mergeScan` |

The wire envelopes are therefore a transport representation of the input and
output streams around this scan. Cross-process execution adds correlation,
ordering, buffering, and recovery metadata without changing the internal
reactive decomposition.

### Temporal durable-execution lowering

Temporal is a durable runtime target for the same stateful interaction graph.
The generated workflow owns activation state, processes typed messages, emits
commands, waits on durable awaitables, and reconstructs state by replaying its
ordered event history.

| Semantic contract | Temporal lowering |
| --- | --- |
| coroutine activation | Workflow Execution |
| stable activation identity | Workflow ID and Run ID |
| start input | Workflow start argument |
| asynchronous resume event | Signal |
| tracked resume with result | Update |
| state read | Query |
| external side effect | Activity |
| nested durable activation | Child Workflow |
| scheduled resume | durable Timer |
| recorded input or effect result | Event History event |
| state reconstruction | deterministic replay |
| history rollover | Continue-As-New |
| activation cancellation | Workflow cancellation |

The semantic scan remains useful as the workflow transition description:

```text
recorded start, signal, update, timer, or activity result
  -> deterministic transition
  -> next workflow state plus commands
  -> commands become recorded completion events
  -> replay folds the history back into the same state
```

Temporal generation introduces requirements beyond an in-memory RxJS target:

- Workflow transitions and command selection are deterministic under replay.
- Network, filesystem, database, clock, random, and other external effects are
  emitted as Activities or replay-safe workflow operations.
- Every persisted payload has a schema and an evolution policy.
- Retry, timeout, cancellation, and idempotency policy are explicit per effect.
- Workflow code version changes include a replay compatibility strategy.
- Unbounded input histories define a Continue-As-New condition.

The target generator may emit imperative workflow code from the normalized
plan while preserving the plan's typed state transitions and interaction
contracts. A Temporal binding can coexist with RxJS at process edges: RxJS
handles live UI and local event flow, and Temporal owns selected durable
activations whose state must survive process and machine failure.

### State machines and effects

Long-lived interactions can expose their protocol state explicitly:

```ts
type ProtocolMachine<State, Event, Effect> = {
  initial: State
  transition: TypedReducer<State, Event, State>
  effects: TypedEffectSelection<State, Event, Effect>
}
```

The transition model permits code generation for reducers, exhaustive Rust
enum matches, XState-style machines, RxJS scans, reconnection logic, and
protocol diagnostics. Effects remain referenced contracts or bindings so the
machine definition stays independent of application integrations.

### Composition rules

- Every external interaction references JSON Schema for each transferred value.
- Every activation has one owner responsible for terminal cleanup.
- Cancellation propagates only along edges marked for propagation.
- Buffer and overflow policy are explicit at asynchronous seams.
- Local graph edges may retain static language types beyond JSON Schema.
- External graph edges use the schema-representable portion of those types.
- Binding replacement must preserve the interaction's ordering, cancellation,
  lifetime, and delivery requirements.
- Generator capability data records which local and remote lowerings preserve
  each interaction shape.

## Browser protocol import and bridge generation

Browser-extension APIs and application-defined extension messages enter the
same contract graph through importers. Imported declarations are generated
TypeSpec source with stable provenance, then pass through the ordinary
TypeSpec, JSON Schema, JSON-RX, TypeScript, and Rust generation pipeline.

```text
Chromium extension API JSON or WebIDL
Chromium feature and permission JSON
application message JSON Schema
application TypeSpec contracts
        │
        ▼
browser protocol importer
        │
        ├── browser_api.auto.tsp
        ├── browser_features.auto.tsp
        └── application_messages.auto.tsp
                    │
                    ▼
              TypeSpec compiler
                    │
                    ├── contract catalog
                    ├── JSON Schema bundle
                    ├── TypeScript bridge
                    ├── Rust bridge
                    └── manifest permission fragment
```

Chromium's extension API specifications define functions, events, types, and
properties in JSON or IDL. Feature files separately describe availability,
contexts, manifest versions, platforms, channels, and permission dependencies.
The importer joins these inputs using fully qualified API member names.

### Import inputs

```ts
type BrowserProtocolImport = {
  id: string
  source:
    | ChromiumExtensionApiSource
    | JsonSchemaMessageSource
    | TypeSpecMessageSource
  include: BrowserMemberPattern[]
  revision: string
  output: `${string}.auto.tsp`
}

type ChromiumExtensionApiSource = {
  kind: 'chromium-extension-api'
  apiSchemas: SourceFile[]
  apiFeatures: SourceFile[]
  permissionFeatures: SourceFile[]
  manifestFeatures?: SourceFile[]
}

type JsonSchemaMessageSource = {
  kind: 'json-schema-messages'
  schema: SourceFile
  interactions: MessageInteractionDeclaration[]
}
```

Each imported symbol records:

```ts
type ImportedSymbolOrigin = {
  sourceKind: 'chromium-json' | 'chromium-webidl' | 'json-schema' | 'typespec'
  sourceUri: string
  revision: string
  sourcePointer: string
  sourceHash: string
}
```

Generated declarations retain this origin in decorators and generated-file
headers. Regeneration compares the pinned source revision and content hash.

### Browser interaction normalization

| Browser API member | Semantic interaction |
| --- | --- |
| event listener | `EventInteraction<Arguments>` |
| asynchronous function | `RequestInteraction<Arguments, Return, Failure>` |
| synchronous function | local `RequestInteraction` binding |
| long-lived `Port` | duplex stream or coroutine binding |
| `runtime.sendMessage` | request or event binding selected by response contract |
| `tabs.sendMessage` | contextual request or event with tab/frame target |
| `onMessageExternal` | externally addressable request or event |
| `chrome.debugger` event | CDP event binding |
| `chrome.debugger.sendCommand` | CDP request binding |

Multiple callback parameters become a generated named model. The importer
retains optionality, unions, arrays, references, enum values, descriptions,
deprecation metadata, and numeric constraints. Browser context and permission
requirements attach to the interaction instead of entering its payload model.

```typespec
@origin(
  "chromium-json",
  "chrome/common/extensions/api/tabs.json",
  "<pinned revision>",
  "/0/events/onUpdated"
)
@browserEvent("tabs.onUpdated")
@browserContexts(#[BrowserContext.extensionServiceWorker])
@browserPermission("tabs")
op TabsOnUpdated(): EventInteraction<TabsOnUpdatedArguments>;
```

The example above represents emitter output. Agents and developers edit the
import configuration or upstream application schemas, then regenerate the
`.auto.tsp` file.

### Generated TypeScript bridge

```ts
export function bindTabsOnUpdated(
  sink: EventSink<TabsOnUpdatedArguments>,
): Unsubscribe {
  const listener = (
    tabId: number,
    changeInfo: chrome.tabs.TabChangeInfo,
    tab: chrome.tabs.Tab,
  ) => sink.next({ tabId, changeInfo, tab })

  chrome.tabs.onUpdated.addListener(listener)
  return () => chrome.tabs.onUpdated.removeListener(listener)
}
```

Application-defined messages generate discriminated envelopes and exhaustive
dispatch:

```ts
type ExtensionMessage =
  | { type: 'page.capture'; payload: PageCaptureInput }
  | { type: 'page.selection.changed'; payload: SelectionChanged }

const handlers = {
  'page.capture': handlePageCapture,
  'page.selection.changed': handleSelectionChanged,
} satisfies ExtensionMessageHandlers
```

### Generated Rust bridge

Rust generation emits payload structs and enums, interaction identifiers, wire
envelopes, validation hooks, and a router over the selected transport:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum ExtensionMessage {
    #[serde(rename = "page.capture")]
    PageCapture(PageCaptureInput),
    #[serde(rename = "page.selection.changed")]
    PageSelectionChanged(SelectionChanged),
}

pub async fn route_extension_message(
    state: &BridgeState,
    message: ExtensionMessage,
) -> Result<Option<ExtensionResponse>, BridgeError> {
    match message {
        ExtensionMessage::PageCapture(input) => {
            state.page_capture(input).await.map(Some)
        }
        ExtensionMessage::PageSelectionChanged(event) => {
            state.page_selection_changed(event).await?;
            Ok(None)
        }
    }
}
```

The Rust transport can be WebSocket, Tokio `mpsc`, native messaging, or another
binding. The generated enum and handler surface remain transport-independent.

### Bridge generation checks

- Every selected browser event and function resolves to one imported symbol.
- Every imported reference resolves within the selected Chromium schema set.
- Every generated message variant has one TypeScript and one Rust handler slot.
- Request contracts have a generated correlation and error path.
- Event contracts cannot accidentally produce response frames.
- Required browser contexts and permissions appear in generated metadata.
- Generated manifests contain the union of selected public permissions and host
  permissions.
- Internal or unavailable Chromium features produce diagnostics.
- TypeScript and Rust fixtures encode to the same JSON snapshots.
- A WebSocket round-trip test decodes TypeScript frames in Rust and Rust frames
  in TypeScript.

## Generated Axum WebSocket bridge

The Rust bridge generator emits an Axum router that can be merged into an
existing Axum application. The host supplies one generated handler trait
implementation. Application state remains owned by the host handler value.

```rust
let app = Router::new()
    .merge(json_rx_bridge::router(bridge_handler));
```

Axum integration is isolated to the generated adapter. Protocol types, handler
signatures, dispatch, and serialization derive from the shared contract catalog
and JSON Schema bundle.

### Generated modules

```text
generated/json_rx_bridge/
  0_types.auto.rs
  1_frames.auto.rs
  2_handler.auto.rs
  3_dispatch.auto.rs
  4_axum.auto.rs
  mod.auto.rs
```

`0_types.auto.rs` is generated from the JSON Schema bundle through Typify's
programmatic `TypeSpace` API. Later modules depend on those generated payload
types. Every file retains the catalog hash and schema source in its header.

### Shared wire frames

TypeScript and Rust generation consume the same frame schema:

```ts
type ClientFrame =
  | { kind: 'hello'; protocolVersion: string; catalogHash: string }
  | { kind: 'request'; id: string; contract: ContractReference; payload: unknown }
  | { kind: 'event'; contract: ContractReference; payload: unknown }
  | { kind: 'cancel'; id: string }
  | { kind: 'subscribe'; id: string; contract: ContractReference; payload: unknown }
  | { kind: 'unsubscribe'; id: string }
  | { kind: 'pong'; nonce: string }

type ServerFrame =
  | { kind: 'hello'; protocolVersion: string; catalogHash: string }
  | { kind: 'response'; id: string; result: ResponseResult }
  | { kind: 'event'; subscriptionId?: string; contract: ContractReference; payload: unknown }
  | { kind: 'complete'; subscriptionId: string }
  | { kind: 'protocolError'; id?: string; error: ProtocolError }
  | { kind: 'ping'; nonce: string }
```

The outer frame schema provides routing and correlation. Generated request and
event enums provide statically typed payload dispatch in both languages.

### Generated handler interface

One trait method is emitted per selected contract. Request methods return their
declared output and failure types. Event methods return unit. Subscription
methods receive a bounded connection sender for generated server events.

```rust
pub trait JsonRxBridgeHandler: Clone + Send + Sync + 'static {
    fn page_capture(
        &self,
        context: ConnectionContext,
        input: PageCaptureInput,
    ) -> impl Future<Output = Result<PageCaptureOutput, PageCaptureFailure>> + Send;

    fn page_selection_changed(
        &self,
        context: ConnectionContext,
        event: SelectionChanged,
    ) -> impl Future<Output = Result<(), BridgeError>> + Send;

    fn subscribe_page_events(
        &self,
        context: ConnectionContext,
        input: PageEventsInput,
        sender: ConnectionSender,
    ) -> impl Future<Output = Result<SubscriptionGuard, BridgeError>> + Send;
}
```

The generator emits the exhaustive contract-address match that invokes these
typed methods. Host code contains domain behavior and does not parse envelopes,
match string addresses, correlate responses, or serialize payloads.

### Generated Axum adapter

```rust
pub fn router<H>(handler: H) -> axum::Router
where
    H: JsonRxBridgeHandler,
{
    axum::Router::new()
        .route("/json-rx", axum::routing::any(upgrade::<H>))
        .with_state(handler)
}

async fn upgrade<H>(
    axum::extract::State(handler): axum::extract::State<H>,
    upgrade: axum::extract::ws::WebSocketUpgrade,
) -> axum::response::Response
where
    H: JsonRxBridgeHandler,
{
    upgrade
        .protocols([JSON_RX_SUBPROTOCOL])
        .on_upgrade(move |socket| serve_connection(socket, handler))
}
```

`serve_connection` splits the WebSocket into receive and send halves. One task
decodes client frames and dispatches typed handler calls. One task drains a
bounded Tokio `mpsc` queue into server frames. Request and subscription tasks
never own the socket sink directly.

```text
Axum WebSocket receive half
  -> decode and validate ClientFrame
  -> generated exhaustive dispatch
  -> host handler future
  -> bounded ConnectionSender
  -> Axum WebSocket send half
```

### Generic configuration

```rust
pub struct BridgeConfig {
    pub path: &'static str,
    pub outbound_capacity: usize,
    pub maximum_message_bytes: usize,
    pub request_timeout: Duration,
    pub heartbeat_interval: Duration,
    pub authentication: AuthenticationPolicy,
    pub overflow: OverflowPolicy,
}
```

The generated router constructor accepts configuration and an optional
authentication callback. Connection context can contain authenticated subject,
peer address, request headers, negotiated protocol version, and a generated
connection ID.

### Axum bridge lifecycle

1. Axum extracts `WebSocketUpgrade` and generated handler state.
2. The adapter negotiates a versioned JSON-RX WebSocket subprotocol.
3. The client and server exchange protocol version and catalog hash.
4. The connection closes when incompatible contracts cannot be negotiated.
5. The socket splits into one receive owner and one send owner.
6. Incoming requests create cancellable Tokio tasks keyed by request ID.
7. Incoming cancellation frames abort the corresponding task.
8. Subscriptions retain generated guards keyed by subscription ID.
9. Disconnect drops all guards, aborts owned tasks, and closes the outbound
   queue.

### Axum bridge gates

- Generated Rust types compile from the emitted JSON Schema bundle.
- An existing Axum `Router` can merge the generated router with one expression.
- Every request receives one response or protocol error unless cancelled.
- Duplicate live request and subscription IDs are rejected.
- Outbound queues are bounded and exercise the configured overflow policy.
- Invalid JSON, unknown contracts, oversized messages, and incompatible catalog
  hashes produce deterministic protocol errors or close codes.
- Disconnect cancels request tasks and drops subscription guards.
- TypeScript client and Rust server pass shared frame snapshot fixtures.
- An Axum integration test performs request, response, event, subscription,
  cancellation, heartbeat, and disconnect timelines over a real local socket.

## Example: one service, one extension worker, two UIs

Add one complete example under the JSON-RX package. Application-specific
contracts, automation graphs, UI layout, and deployment configuration remain
inside the example. Core importers, planning, code generation, protocol frames,
and runtime adapters remain reusable package code.

```text
examples/1_axum_extension_multi_ui/
  0_spec/
    0_models.tsp
    1_contracts.tsp
    2_automations.tsp
    3_deployment.tsp
  1_generated/
    schema/
    typescript/
    rust/
  2_server/
    Cargo.toml
    src/
      0_state.rs
      1_handlers.rs
      2_app.rs
      main.rs
  3_extension/
    src/
      0_generated/
      1_transport.ts
      2_automation.ts
      3_serviceWorker.ts
    manifest.json
    vite.config.ts
  4_tauri/
    src/
      0_generated/
      1_state.ts
      2_App.tsx
      main.tsx
    src-tauri/
      src/lib.rs
    vite.config.ts
  5_egui/
    Cargo.toml
    src/
      0_generated/
      1_client.rs
      2_state.rs
      3_app.rs
      main.rs
  6_tests/
    0_protocol.test.ts
    1_serviceWorker.browser.test.ts
    2_tauriUi.browser.test.tsx
    3_system.test.ts
```

### Deployment topology

```text
                         one Axum service
                     ┌─────────────────────┐
                     │ connection registry │
                     │ request router      │
                     │ shared snapshots    │
                     │ subscription broker │
                     └───────┬─────┬───────┘
                             │     │
             WebSocket       │     │       WebSocket
       ┌─────────────────────┘     └─────────────────────┐
       │                                                 │
extension service worker                         generated clients
  browser capabilities                      ┌────────────┴───────────┐
  placed automations                         │                        │
  Chrome events                             Tauri web UI          egui UI
  Chrome commands                           Signals state         Rust state
```

Both UI processes connect to the same service and subscribe to the same typed
snapshots and events. Commands from either UI reach the same server handlers.
Commands requiring browser privileges route through the registered extension
service-worker connection.

### Placement model

The deployment specification assigns graph nodes to execution hosts:

```typespec
enum ExampleHost {
  server,
  extensionServiceWorker,
  tauriWebview,
  eguiClient,
}

@deploy(ExampleHost.extensionServiceWorker)
op observeTabs(): BrowserEvent<TabChanged>;

@deploy(ExampleHost.extensionServiceWorker)
op capturePage(input: CapturePageInput): CapturePageOutput;

@deploy(ExampleHost.server)
op reducePageState(event: PageEvent): PageSnapshot;

@deploy(#[ExampleHost.tauriWebview, ExampleHost.eguiClient])
op observePageSnapshot(): StateInteraction<PageSnapshot>;
```

The compiler lowers placement into a deployment plan:

```ts
type DeploymentPlan = {
  hosts: PlannedHost[]
  localGraphs: Map<HostReference, ReactivePlan>
  bridges: PlannedBridge[]
}

type PlannedBridge = {
  from: HostReference
  to: HostReference
  interaction: ContractReference
  transport: BindingReference
  delivery: DeliveryPolicy
}
```

Every graph edge that crosses a host boundary produces a bridge entry. Local
edges remain direct Signals or runtime connections. The generated deployment
plan is snapshot-tested so placement changes are visible during review.

### Service-worker automation

The extension service worker contains one generated automation host:

```ts
const runtime = createExtensionAutomationRuntime({
  catalog,
  transport: createReconnectingWebSocketTransport(serverUrl),
  storage: chrome.storage.local,
  capabilities: generatedBrowserCapabilities,
})

runtime.start()
```

The runtime:

- registers its generated browser capabilities after connecting
- binds selected Chrome events to generated JSON-RX sources
- executes nodes placed on `extensionServiceWorker`
- routes server requests to generated Chrome API handlers
- persists durable inputs and checkpoints through a storage binding
- reconnects and registers again after service-worker activation
- disposes browser listeners when a generated automation is replaced

Chrome service workers can use WebSockets. Their lifecycle still requires
reconnection and activity handling, so the generated runtime treats each
activation as recoverable and re-registers capabilities after reconnect.

### Shared server state

The Axum example owns one application snapshot and one broadcast stream:

```rust
pub struct AppState {
    pub snapshot: tokio::sync::watch::Sender<PageSnapshot>,
    pub connections: ConnectionRegistry,
}
```

The generated handler implementation performs these flows:

```text
extension event
  -> generated server request/event enum
  -> application reducer
  -> watch snapshot update
  -> generated subscription event
  -> both UI clients

UI browser command
  -> generated server request
  -> locate extension capability connection
  -> forward correlated request
  -> extension service-worker handler
  -> server response
  -> requesting UI
```

`tokio::sync::watch` stores the latest shared snapshot for new UI subscribers.
Bounded `mpsc` queues carry per-connection output. The example does not share a
WebSocket sink across request tasks.

### Tauri UI

The Tauri webview uses the generated TypeScript WebSocket client and generated
Signals store directly:

```ts
const service = createExampleServiceClient(serverUrl)
const page = service.pageSnapshot.createQuery(undefined, {
  skip: 'retain',
})
```

The UI renders through `SignalReact`. Tauri provides the desktop shell and
capability configuration. The example uses the common WebSocket protocol as
its application data path, avoiding a second Tauri-specific protocol for the
same server interactions.

### egui UI

The egui process uses generated Rust frames and payload types. A Tokio task owns
the WebSocket connection and reduces server events into the latest UI state:

```rust
pub struct EguiState {
    pub page: tokio::sync::watch::Receiver<PageSnapshot>,
    pub commands: tokio::sync::mpsc::Sender<ClientCommand>,
}
```

The receiving task calls `egui::Context::request_repaint()` after publishing a
new snapshot. The `eframe::App` reads the latest watch value during `update` and
sends typed commands through the bounded channel.

### Development commands

Add package scripts that delegate to numbered example commands:

```json
{
  "scripts": {
    "example:generate": "tsx examples/1_axum_extension_multi_ui/scripts/0_generate.ts",
    "example:check": "pnpm example:generate && git diff --exit-code -- examples/1_axum_extension_multi_ui/1_generated",
    "example:server": "cargo run --manifest-path examples/1_axum_extension_multi_ui/2_server/Cargo.toml",
    "example:extension": "vite build --watch --config examples/1_axum_extension_multi_ui/3_extension/vite.config.ts",
    "example:tauri": "vite --config examples/1_axum_extension_multi_ui/4_tauri/vite.config.ts",
    "example:egui": "cargo run --manifest-path examples/1_axum_extension_multi_ui/5_egui/Cargo.toml",
    "example:test": "vitest --config examples/1_axum_extension_multi_ui/vitest.config.ts"
  }
}
```

The extension development build writes to a stable unpacked-extension
directory for loading in Chromium. The server, extension watcher, Tauri web
frontend, and egui client have separate commands so development does not spawn
unrequested desktop processes.

### Example test matrix

| Gate | Runner | Coverage |
| --- | --- | --- |
| schema and generated snapshots | Vitest node | TypeSpec, JSON Schema, TS/Rust fixtures |
| Signals store | Vitest | query and subscription timelines |
| extension automation kernel | Vitest browser | Chrome adapter fakes, reconnect, listener disposal |
| Tauri web UI | Vitest browser | rendered states and screenshot snapshots |
| Rust protocol and state | Cargo test | decoding, dispatch, reducer, cancellation |
| egui state adapter | Cargo test | watch updates, commands, repaint notification |
| system bridge | Vitest node plus real Axum child process | extension client and two UI clients over one socket service |

The system fixture connects three generated clients with explicit roles:
`extension`, `tauri-ui`, and `egui-ui`. It asserts that one extension event
updates both UI subscriptions and that commands from both UIs route through the
same service-worker capability registration.

## Core type signatures

Define signatures before emitter bodies.

```ts
type JsonRxAddress = string

type JsonRxSymbolKind = 'source' | 'reducer' | 'flow' | 'output'

type JsonRxSymbol = {
  kind: JsonRxSymbolKind
  address: JsonRxAddress
  title: string
  inputSchema?: JsonSchemaReference
  outputSchema?: JsonSchemaReference
}

type JsonSchemaReference = {
  $ref: string
}

type JsonRxGraph = {
  symbols: Map<JsonRxAddress, JsonRxSymbol>
  automations: JsonRxAutomationNode[]
  diagnostics: JsonRxDiagnostic[]
}

type JsonRxEmitterOptions = {
  outputDir: string
  emitSchema: boolean
  emitTypeScript: boolean
  emitDocuments: boolean
}

function collectJsonRxGraph(program: Program): JsonRxGraph

function validateJsonRxGraph(graph: JsonRxGraph): JsonRxDiagnostic[]

function emitAutomationDocument(
  graph: JsonRxGraph,
  automation: JsonRxAutomationNode,
): Automation

function emitTypeScriptDocument(
  document: Automation,
  sourcePath: string,
): string

function emitReferenceCatalog(graph: JsonRxGraph): JsonRxReferenceCatalog

function compileTypeScriptAutomation(input: TypeScriptAutomationInput): Automation

function validateGeneratedAutomation(document: unknown): Automation
```

Emitter bodies follow this shape:

```ts
function collectJsonRxGraph(program: Program): JsonRxGraph {
  // Read decorated entrypoints.
  // Resolve every referenced TypeSpec symbol.
  // Assign stable addresses from namespace and symbol names.
  // Record graph edges without emitting files.
  // Return diagnostics with the graph.
}

function emitAutomationDocument(
  graph: JsonRxGraph,
  automation: JsonRxAutomationNode,
): Automation {
  // Select symbols reachable from the automation entrypoint.
  // Lower source, reducer, flow, and output nodes in dependency order.
  // Serialize graph edges as {$ref: address}.
  // Return a schema-valid JSON-RX document.
}
```

## Instance timelines and lifetimes

### TypeSpec compiler invocation

1. One TypeSpec `Program` exists for one generation command.
2. Decorators register metadata against TypeSpec type identities during checking.
3. The JSON-RX emitter reads the completed program after type checking.
4. `collectJsonRxGraph` creates one in-memory graph for that invocation.
5. Every requested artifact is emitted from that graph.
6. The graph is discarded when the compiler process exits.

### Generated automation module

1. A `.auto.ts` module contains one static `Automation` value.
2. Importing the module creates that object once per JavaScript module instance.
3. The runtime receives the object and resolves host bindings supplied by the
   application.
4. Each runtime compilation creates its own RxJS graph and subscription
   lifetime.
5. Unsubscribing disposes that runtime graph without changing the static
   generated document.

### Editor reference catalog

1. The generated catalog supplies known TypeSpec symbols and stable addresses.
2. The form derives source, reducer, and flow choices from the static catalog
   plus definitions present in the current document.
3. A document edit creates a new controlled form value.
4. Reference resolution reruns against that value.
5. Saving parses the value through `AutomationSchema` before returning it.

## Storage, reads, writes, and uniqueness

### Stable addresses

The TypeSpec namespace and symbol path form the default address:

```text
typespec://Claude.Usage/readUsage
typespec://Claude.Usage/UsageDashboard.usage
typespec://Claude.Usage/DashboardUsage
```

Address construction occurs once while collecting the semantic graph. The
graph stores symbols in `Map<JsonRxAddress, JsonRxSymbol>`. Inserting an existing
address produces an emitter diagnostic. No emitter pass independently invents
an address.

### Write sequence

1. Read `.tsp` files and TypeSpec libraries.
2. Type-check the complete program.
3. Collect decorated JSON-RX entrypoints.
4. Resolve every reference into a TypeSpec symbol identity.
5. Assign and validate stable serialized addresses.
6. Validate graph topology and operator ordering.
7. Lower the graph into plain JSON-RX documents.
8. Write temporary artifact contents through the TypeSpec compiler host.
9. Format TypeScript outputs.
10. Replace generated files only when contents changed.
11. Run JSON Schema, Zod, and runtime validation against the written artifacts.

### Read sequence at runtime

1. Import a generated `.auto.ts` document.
2. Parse it with `AutomationSchema`.
3. Read `bindings.sources` and match each address to a supplied host source.
4. Read flows in document order.
5. Resolve `$ref` values against `circuit.sources`, `circuit.reducers`, and
   `circuit.flows`.
6. Compile operators into RxJS expressions.
7. Subscribe outputs to compiled flows.

### Uniqueness conditions

- TypeSpec symbol address is unique within the compiled program.
- JSON-RX node ID is unique within one automation document.
- Source, reducer, and flow references resolve to exactly one catalog entry.
- Every output flow resolves to exactly one flow definition.
- One generated artifact path has one owning TypeSpec or TypeScript input slice.
- Two input slices cannot claim the same generated artifact path.

## TypeSpec vocabulary

Use TypeSpec constructs for these meanings:

| TypeSpec construct | JSON-RX meaning |
| --- | --- |
| `model` | event, state, input, output, or payload shape |
| `union` | closed operator or state variant |
| `enum` | closed configuration axis |
| `interface` | addressable component or flow group |
| `op` | source, transformation, reducer, or output boundary |
| decorator | emitter configuration and host binding metadata |
| symbol reference | graph edge serialized as `$ref` |

Initial decorators:

```typespec
@source(HostKind.httpEvent)
@flow
@pipe(#[readUsage, projectUsage, shareLatest])
@reducer
@output(OutputKind.hostEmit, "claude.usage")
```

Decorator arguments use TypeSpec enums or symbol references for closed sets.
Free strings remain for external values such as stream names, URL patterns,
operation names, and JSONata expressions.

## Automation slices

Each automation directory is a compiler fixture and a usable example.

### TypeSpec-authored slice

```text
0_input.tsp
  -> JSON-RX emitter
  -> 1_document.auto.ts
  -> JSON.stringify(document)
  -> 2_document.snapshot.json
  -> 3_document.test.ts
```

### TypeScript-authored slice

```text
0_input.ts
  -> typed builder or compiler
  -> 1_document.auto.ts
  -> JSON.stringify(document)
  -> 2_document.snapshot.json
  -> 3_document.test.ts
```

Each `3_document.test.ts` verifies:

1. The generated module matches the JSON snapshot.
2. The JSON snapshot validates against `automation.schema.json`.
3. `AutomationSchema.parse` accepts the document.
4. Every `$ref` resolves within the document or emitted catalog.
5. Runtime compilation succeeds with deterministic fake host sources.
6. A representative emission matches an inline snapshot.

## Generated-file policy

Every generated TypeScript file ends in `.auto.ts` and begins with:

```ts
// @generated by @hafley66/json-rx
// Source: src/5_automations/0_claude_usage/0_input.tsp
// DO NOT EDIT. Run: pnpm generate
```

Add scripts:

```json
{
  "scripts": {
    "generate": "tsp compile . && node scripts/1_generateAutomations.mjs",
    "generate:check": "pnpm generate && git diff --exit-code -- 'packages/json-rx/src/**/*.auto.ts' 'packages/json-rx/src/**/*.snapshot.json' 'packages/json-rx/automation.schema.json'"
  }
}
```

The repository hook runs `pnpm --filter @hafley66/json-rx generate:check`.
Generated files are changed by editing their `.tsp` or TypeScript input and
running the generator.

Add a Sprefa diagnostic for any `.auto.ts` file missing the generated header.
The git hook remains the reproducibility gate because it regenerates artifacts
and compares their contents.

## Implementation phases

### Phase 0: Freeze the current contract

- Snapshot the current `AutomationJsonSchema` and representative documents.
- Move handwritten generated candidates to their future `.auto.ts` names only
  after a generator produces byte-equivalent replacements.
- Keep `automation.v1` as the only document version.

### Phase 1: Add TypeSpec project infrastructure

- Add TypeSpec compiler, JSON Schema, HTTP, and OpenAPI dependencies.
- Add `tspconfig.yaml`.
- Add numbered `spec/` files.
- Compile an empty JSON-RX namespace in package tests.

### Phase 2: Define the JSON-RX vocabulary

- Model sources, reducers, flows, pipe operators, outputs, and references.
- Give every union variant a stable name and documentation.
- Emit JSON Schema 2020-12.
- Compare the emitted schema with the current Zod-derived contract.

### Phase 3: Add the JSON-RX TypeSpec library

- Implement decorators and their typed metadata storage.
- Collect decorated types and operations into `JsonRxGraph`.
- Validate duplicate addresses, unresolved references, operator order, and
  unreachable outputs.

### Phase 4: Emit static TypeScript documents

- Implement `.auto.ts` output with `satisfies Automation`.
- Preserve dependency ordering in object keys and emitted files.
- Emit source comments and deterministic formatting.
- Emit the reference catalog used by the editor.

### Phase 5: Add the first automation slice

- Add `0_claude_usage/0_input.tsp`.
- Emit its TypeScript document and JSON snapshot.
- Validate schema, references, runtime compilation, and deterministic output.
- Add browser coverage showing its source and flow references as dropdowns.

### Phase 6: Add the TypeScript input path

- Define a typed TypeScript automation input contract.
- Lower it through the same `JsonRxGraph` representation.
- Add a fixture whose emitted JSON matches an equivalent TypeSpec fixture.

### Phase 7: Enforce generated artifacts

- Add `generate` and `generate:check` scripts.
- Add the generated header Sprefa rule.
- Add the git-hook reproducibility check.
- Document intentional regeneration and snapshot review.

### Phase 8: Add language targets incrementally

- Treat serialized JSON-RX as the shared wire contract.
- Emit native static representations only where a host needs them.
- Add TypeScript first.
- Add Rust, Python, or Go emitters behind explicit package scripts without
  creating more workspace packages.

### Phase 9: Separate semantic planning from state-management generation

- Add semantic resource, state, lifetime, cache, invalidation, and concurrency
  types without importing a state-management runtime.
- Lower named RxJS operators into normalized plan nodes while retaining source
  locations and RxJS names for diagnostics.
- Recognize resource regions without removing their underlying operator graph.
- Add the target scheme registry and deterministic ambiguity diagnostics.
- Generate a Signals `Endpoint`, query wiring, polling lifecycle, and
  `SignalReact` consumer first.
- Verify the Signals query timeline with the Vitest scheduler.
- Snapshot generated files and run target type checks.
- Add semantic equivalence fixtures for polling, latest-request cancellation,
  cache identity, invalidation, success, and failure transitions.
- Record each target's direct, synthesized, and unsupported semantic mappings
  in generated capability data used by the editor and compiler.

Phase 9 uses this numbered source layout:

```text
src/
  6_semantics/
    0_types.ts
    1_operators.ts
    2_resources.ts
    3_state.ts
  7_analysis/
    0_resolution.ts
    1_typeFlow.ts
    2_lifecycle.ts
    3_regions.ts
  8_plan/
    0_types.ts
    1_lower.ts
    2_normalize.ts
  9_generator/
    0_types.ts
    1_registry.ts
    2_diagnostics.ts
  10_targets/
    0_signals/
```

## Gates

Package gates:

```text
pnpm --filter @hafley66/json-rx generate:check
pnpm --filter @hafley66/json-rx test
pnpm --filter @hafley66/json-rx typecheck
pnpm --filter @hafley66/json-rx build
```

Instant integration gates after a linked-package change:

```text
just check
just build
just cargo-check
just ext-build
```

## First implementation slice

The first slice ends when these artifacts exist and pass their gates:

```text
spec/0_main.tsp
spec/1_models.tsp
spec/2_operators.tsp
src/4_typespec/0_library.ts
src/4_typespec/1_decorators.ts
src/4_typespec/2_graph.ts
src/4_typespec/3_emitter.tsx
src/5_automations/0_claude_usage/0_input.tsp
src/5_automations/0_claude_usage/1_document.auto.ts
src/5_automations/0_claude_usage/2_document.snapshot.json
src/5_automations/0_claude_usage/3_document.test.ts
```

The generated Claude usage document must contain a source `$ref`, a pipe with
named operator variants, a dashboard output, and an emitted payload schema. The
editor must present operator and reference choices from the generated catalog.
