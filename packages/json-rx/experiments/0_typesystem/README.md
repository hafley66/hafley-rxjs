# TypeSpec encoding for RxJS and JSON-RX type flow

## Research metadata

- Date: 2026-07-21
- TypeSpec compiler tested: 1.14.0
- TypeSpec homepage: https://typespec.io/
- TypeSpec repository: https://github.com/microsoft/typespec
- TypeSpec templates: https://typespec.io/docs/language-basics/templates/
- TypeSpec operations: https://typespec.io/docs/language-basics/operations/
- TypeSpec functions: https://typespec.io/docs/extending-typespec/implement-functions/
- TypeSpec streaming proposal: https://github.com/microsoft/typespec/issues/154
- RxJS merge: https://rxjs.dev/api/index/function/merge
- RxJS mergeWith: https://rxjs.dev/api/index/function/mergeWith

TypeSpec 1.14.0 is the installed and current documented release used for these
experiments. TypeSpec functions and the emitter framework remain experimental.
The typekit API is the stable library surface used for assignability checks.

## Result

Represent every executable JSON-RX node as a TypeSpec operation.

- The operation signature carries stream input and output types.
- Operation-reference decorators carry graph edges.
- Fixed-arity operation templates encode RxJS variadic overloads.
- A decorator validation pass compares referenced upstream return types with
  the receiving operation's stream parameters.
- The emitter lowers operation references to JSON `$ref` values.
- JSON Schema validates the serialized graph shape after lowering.

The tested graph reports TypeSpec's native structural diagnostic for an invalid
edge:

```text
Type 'Stream<Tick>' is not assignable to type 'Stream<Click>'
  Types of property 'value' are incompatible
    Property 'x' is missing on type 'Tick' but required in 'Click'
```

## Executive index

| Concept | TypeSpec encoding | JSON-RX encoding |
| --- | --- | --- |
| event payload | `model EventPayload` | JSON Schema instance |
| observable value type | `Stream<T>` | schema reference attached to a flow |
| source or creation operator | `op Source(): Stream<T>` | source node or creation node |
| pipeable unary operator | `op Map<I, O>(input: Stream<I>, ...): Stream<O>` | pipe step with implicit previous input |
| fixed-arity creation operator | `Merge2` through `Merge5` | creation node with 2 through 5 `$ref` inputs |
| graph edge | operation reference passed to a decorator | `{ "$ref": "..." }` |
| type compatibility | typekit `type.isAssignableTo` | compile-time diagnostic |
| serialized structure | emitted model/union vocabulary | JSON Schema 2020-12 |
| runtime behavior | operator semantic catalog | RxJS implementation |

## Type signatures

### Stream carrier

```typespec
model Stream<T> {
  value: T;
}
```

`value` makes `T` structurally visible to TypeSpec assignability. The JSON-RX
emitter treats `Stream<T>` as a compile-time carrier and emits the schema for
`T`, rather than serializing the wrapper.

RxJS has an untyped error channel, so the initial carrier has one type
parameter. Completion and error behavior belong to operator semantics and
conformance tests. A later profile may introduce `Stream<T, Error>` for hosts
whose stream type carries errors in the item type.

### Function-like descriptors

```typespec
model Transform<Input, Output> {
  input: Input;
  output: Output;
}

model Predicate<Input> {
  input: Input;
  output: boolean;
}

model Reducer<State, Event> {
  state: State;
  event: Event;
  output: State;
}
```

These models describe type relationships. A host-specific expression binding,
such as JSONata, supplies the executable implementation. JSONata strings do not
carry enough information to infer their output type, so the authored operation
instantiation states that output type and the generated schema checks emitted
values at the boundary selected by the runtime profile.

### Creation operators

Creation operators have no implicit pipe input:

```typespec
op From<T>(): Stream<T>;
op Timer(): Stream<uint64>;

op Merge2<A, B>(a: Stream<A>, b: Stream<B>): Stream<A | B>;
op Merge3<A, B, C>(a: Stream<A>, b: Stream<B>, c: Stream<C>): Stream<A | B | C>;
op Merge4<A, B, C, D>(a: Stream<A>, b: Stream<B>, c: Stream<C>, d: Stream<D>): Stream<A | B | C | D>;
op Merge5<A, B, C, D, E>(a: Stream<A>, b: Stream<B>, c: Stream<C>, d: Stream<D>, e: Stream<E>): Stream<A | B | C | D | E>;
```

This mirrors RxJS's tuple overload:

```ts
merge<A extends readonly unknown[]>(
  ...sources: [...ObservableInputTuple<A>]
): Observable<A[number]>
```

TypeSpec has rest parameters for value and function declarations, but it lacks
TypeScript's variadic tuple indexing operation `A[number]`. `Merge2` through
`Merge5` preserve heterogeneous input types and produce exact unions.

`CombineLatest2` through `CombineLatest5` use tuple outputs:

```typespec
op CombineLatest2<A, B>(a: Stream<A>, b: Stream<B>): Stream<[A, B]>;
op CombineLatest3<A, B, C>(a: Stream<A>, b: Stream<B>, c: Stream<C>): Stream<[A, B, C]>;
```

The distinction is type-level and temporal:

- `merge` outputs a union, one value from any input at a time.
- `combineLatest` outputs a product tuple containing one current value from
  every input after every input has produced at least once.

### Pipeable operators

The first parameter is the implicit pipe input:

```typespec
op Map<Input, Output>(
  input: Stream<Input>,
  transform: Transform<Input, Output>,
): Stream<Output>;

op Filter<T>(
  input: Stream<T>,
  predicate: Predicate<T>,
): Stream<T>;

op Scan<Event, State>(
  input: Stream<Event>,
  reducer: Reducer<State, Event>,
  seed: State,
): Stream<State>;

op MergeMap<Input, Output>(
  input: Stream<Input>,
  project: Transform<Input, Stream<Output>>,
  concurrency?: int32,
): Stream<Output>;

op SwitchMap<Input, Output>(
  input: Stream<Input>,
  project: Transform<Input, Stream<Output>>,
): Stream<Output>;

op TakeUntil<T, Notification>(
  input: Stream<T>,
  notifier: Stream<Notification>,
): Stream<T>;
```

## Graph encoding

```typespec
interface Graph {
  op clicks is Create<Click>;
  op ticks is Create<Tick>;

  @inputs2(Graph.clicks, Graph.ticks)
  op joined is Merge2<Click, Tick>;

  @input(Graph.joined)
  op projected is Map<Click | Tick, View>;
}
```

Decorator validation pseudocode:

```ts
function validateInputs(
  program: Program,
  target: Operation,
  inputs: Operation[],
): Diagnostic[] {
  // Read target.parameters in declaration order.
  // For each input operation, read input.returnType.
  // Compare input.returnType with the matching target parameter type.
  // Return TypeSpec assignability diagnostics unchanged.
}
```

The working implementation uses:

```ts
$(program).type.isAssignableTo.withDiagnostics(
  input.returnType,
  expectedParameter.type,
  input,
)
```

## Instance timeline and lifetimes

### TypeSpec compilation

1. TypeSpec instantiates each concrete operation template.
2. Decorators receive concrete `Operation` references and store graph edges.
3. `onGraphFinish` validates every edge after all referenced operations finish.
4. The emitter reads the same operation graph and emits JSON-RX addresses,
   `$ref` edges, payload schemas, and static documents.
5. Compiler types and graph metadata are discarded at process exit.

### JSON-RX runtime

1. A generated JSON-RX document is parsed against generated Zod and JSON Schema.
2. Host bindings supply runtime streams for source addresses.
3. Flow references resolve to runtime observables.
4. Operators create subscription-scoped RxJS instances.
5. Unsubscription disposes operator instances without changing the static type
   graph or generated document.

## Storage, reads, writes, and uniqueness

- The TypeSpec `Operation` identity is the in-memory graph node key.
- Namespace plus interface plus operation name produces the default serialized
  address.
- Decorator state maps store referenced `Operation` objects during compilation.
- The emitter reads concrete operation parameters and return types after graph
  validation.
- One operation owns one JSON-RX node address.
- Every referenced operation must belong to the emitted reachable graph.
- Every input edge is checked once against its positional operator parameter.
- Generated JSON stores addresses and payload schema references, while generic
  `Stream<T>` wrappers remain compiler metadata.

## Experiments

| File | Result |
| --- | --- |
| `0_rx_algebra.tsp` | `Stream<T>`, generic operations, and `Merge2` through `Merge5` compile |
| `1_graph_wiring.tsp` | operation references in decorators and valid edge checking compile |
| `2_invalid_graph_wiring.tsp` | expected native `unassignable` diagnostic |
| `3_return_type_inference.tsp` | direct `op::returnType` access fails for an instantiated generic operation in 1.14.0 |
| `4_inference_functions.tsp` | custom `streamValue(Operation)` function unwraps the stream value type; compiler warns that functions are experimental |
| `5_operator_catalog.tsp` | creation, combination, unary, stateful, higher-order, cancellation, and sharing signatures compile |
| `6_alias_pipeline.tsp` | `http -> map -> shareReplay -> emit` aliases compile; `http` resolves the explicit HTTP 200 body as `UsageSnapshot` |
| `7_alias_pipeline_assertions.tsp` | compile-only payload assertions kept outside the authoring example |

## Inference boundary

TypeSpec checks explicitly instantiated operations and graph edges. Two inference
paths were tested:

### Explicit operation instantiation

```typespec
op joined is Merge2<Click, Tick>;
```

This uses stable templates and stable typekit assignability.

### Compiler function unwrapping

```typespec
alias ClickValue = streamValue(Graph.clicks);
op projected is Map<ClickValue, View>;
```

The JavaScript function reads `Graph.clicks.returnType`, unwraps `Stream<T>`,
and returns `T`. This compiles in TypeSpec 1.14.0 with the documented
experimental-function warning. It reduces repeated types at the cost of an
experimental TypeSpec feature.

The initial JSON-RX vocabulary should use explicit operation instantiation.
The compiler function remains an experiment until TypeSpec functions stabilize.

## Prior-art correspondence

### Local TypeSpec architecture notes

`claude-research/tsp-arch/8_evolution.md` reached these primitives:

- models are data;
- interface plus operation is a component unit;
- operation arity determines role;
- unions represent closed variants;
- enums represent closed configuration axes;
- decorators carry emitter configuration;
- namespaces provide stable addresses.

The operation graph encoding preserves that result. `Stream<T>` is a carrier
used by operation signatures, while creation, mapping, reduction, and consuming
roles remain visible through operation arity.

The earlier `Boundary<TIn, TOut, TCard>` model separated payload types from
cardinality. JSON-RX can retain that separation as metadata:

```typespec
enum Cardinality {
  once,
  streamIn,
  streamOut,
  stream,
}
```

RxJS operators operate on `streamOut`. Host bindings may lower OpenAPI calls to
`once` or observed HTTP traffic to `streamOut`. gRPC server streaming and
bidirectional streaming select other cardinalities without changing operator
signatures.

### Local JSON-RX synthesis

`instant/books/json-rx-automation/4_json-rx-specification-synthesis.md`
separates:

- JSON Schema payloads from temporal behavior;
- point-free pipe ordering from nested expressions;
- creation operators from pipeable operators;
- process-local circuits from host bindings;
- Observable lifecycle from demand/backpressure profiles;
- a small semantic kernel from derived RxJS-shaped operators.

The TypeSpec signature graph adds static payload flow to those runtime
semantics. JSON Schema remains the payload and serialized-document contract.

### TeSSLa and RTLola

TeSSLa contributes typed stream equations and trace-based conformance. RTLola
adds asynchronous inputs, windows, triggers, deterministic evaluation order,
and static memory analysis. JSON-RX operation signatures correspond to stream
equations; operator conformance fixtures provide the trace semantics.

### ReactiveX and RxJS

ReactiveX contributes `next`, `error`, `complete`, subscription lifetime, and
operator semantics. RxJS provides the executable reference and its TypeScript
signatures define the intended generic relationships. Fixed TypeSpec arities
specialize the variadic tuple overloads used by RxJS.

### Reactive Streams and Rust Stream

Reactive Streams contributes explicit demand and cancellation at asynchronous
boundaries. Rust `Stream` contributes poll-based consumer progress. These are
runtime profiles attached to boundaries. They do not change the payload
relationship `Stream<Input> -> Stream<Output>`.

### Beam, Flink, Kafka Streams, and Differential Dataflow

- Beam contributes event time, windows, watermarks, and triggers.
- Flink contributes keyed state, timers, checkpoints, and process functions.
- Kafka Streams distinguishes event streams from materialized latest values.
- Differential Dataflow contributes logical time and incrementally maintained
  collections.

These systems require additional carrier properties beyond `Stream<T>` when
their semantics enter scope, such as key type, time domain, update difference,
or boundedness. Those axes can be explicit generic parameters or decorators.

### OpenAPI, AsyncAPI, and TypeSpec streams

OpenAPI supplies request, response, and payload schemas for HTTP operations.
AsyncAPI supplies channels, messages, correlation, and protocol bindings.
TypeSpec issue 154 established `Stream<T>` as a transport-neutral streaming
shape for HTTP and event protocols. JSON-RX host sources can reference those
operation and message types while the JSON-RX operator graph describes temporal
composition.

## Capability matrix

| Requirement | TypeSpec mechanism | Tested |
| --- | --- | ---: |
| generic stream carrier | model template | yes |
| unary input/output relation | operation template | yes |
| heterogeneous merge union | fixed-arity operation templates | yes |
| combineLatest tuple | tuple return type | yes |
| operation graph references | decorator arguments | yes |
| graph-edge type checking | typekit assignability | yes |
| exact invalid-edge diagnostic | returned TypeSpec diagnostics | yes |
| automatic stream-value unwrapping | extern function | yes, experimental |
| arbitrary variadic tuple union | language feature | unavailable |
| infer JSONata output from expression text | language feature | unavailable |
| serialize operator AST | custom emitter | pending implementation |
| generate JSON Schema and Zod | JSON Schema emitter plus generator | pending implementation |

## Known limits

- TypeSpec lacks TypeScript conditional types and `A[number]` tuple indexing.
- Fixed arities are required for exact heterogeneous merge and combination
  signatures.
- Direct `Operation::returnType` use produced `invalid-template-args` for the
  instantiated generic operation tested under 1.14.0.
- TypeSpec functions can unwrap operation return types, but functions are an
  experimental feature.
- String expression languages such as JSONata need an explicitly declared
  output model or a language-specific expression checker.
- Static type compatibility does not specify temporal behavior. Operator tests
  must cover emissions, errors, completion, cancellation, sharing, scheduling,
  and subscription lifetime.
- TypeSpec's JSON Schema emitter describes data shapes. The custom JSON-RX
  emitter must remove compiler-only stream carriers and preserve graph refs.

## Compiler implementation shape

```ts
type TypedNode = {
  operation: Operation
  inputs: Operation[]
  inputTypes: Type[]
  outputType: Type
  operator: OperatorKind
}

function collectTypedGraph(program: Program): TypedNode[] {
  // Walk concrete graph interfaces.
  // Read operation-reference decorators.
  // Ignore uninstantiated template declarations.
  // Preserve operation identity for every edge.
}

function validateTypedGraph(program: Program, nodes: TypedNode[]): Diagnostic[] {
  // Compare every upstream return type with its positional parameter type.
  // Validate creation versus pipeable arity.
  // Validate operator-specific temporal configuration.
  // Return TypeSpec diagnostics at the referenced upstream operation.
}

function emitJsonRx(nodes: TypedNode[]): Automation {
  // Assign addresses from namespace/interface/operation paths.
  // Emit operation references as JSON $ref objects.
  // Emit payload schemas from concrete stream value types.
  // Omit Stream<T> and other compiler-only relationship carriers.
}
```

## Recommended next experiment

Build one complete typed automation using:

```text
HTTP operation response model
  -> From<Response>
  -> Map<Response, UsageSnapshot>
  -> Merge2<UsageSnapshot, UsageUpdate>
  -> Scan<UsageSnapshot | UsageUpdate, UsageState>
  -> ShareReplay<UsageState>
  -> host output
```

The emitted document should include payload schema refs on every named flow.
Generation should reject one fixture where `UsageUpdate` feeds a reducer whose
event type excludes it.

## Official documentation inventory

- Language overview
- Models and model templates
- Unions, tuples, arrays, and records
- Operations and operation templates
- Interfaces and namespaces
- Decorators and validation callbacks
- Experimental functions
- Typekit APIs
- JSON Schema emitter
- OpenAPI emitter and HTTP operation metadata
- Custom emitters and emitter framework
- TypeSpec release notes and breaking-change policy

## Release and issue notes

- TypeSpec 1.14.0 is the compiler used on 2026-07-21.
- TypeSpec functions are documented as experimental.
- The emitter framework is documented as experimental.
- TypeSpec issue 154 proposed transport-neutral `Stream<T>` and event metadata;
  the issue is closed with an accepted design.
- TypeSpec's breaking-change policy identifies the type graph and typekits as
  supported library surfaces, while direct checker access is internal. The
  experiment therefore uses `@typespec/compiler/typekit`.
