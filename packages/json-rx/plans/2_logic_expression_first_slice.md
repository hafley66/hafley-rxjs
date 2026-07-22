# JSON-RX logic expressions: first slice

## Objective

`logic(...)` is an authoring shorthand for a synchronous current-value
derivation over lexical flow aliases. It removes explicit dependency tuples,
`combineLatest`, and repeated map callback plumbing from the TypeSpec surface.

```text
TypeSpec aliases + JSONLogic var paths
  -> compiler discovers referenced aliases
  -> compiler generates/fuses an RxJS graph
  -> reusable Observable flow
```

Signals motivate the ergonomics: a derivation reads named values without a
dependency array. The JSON-RX IR and first runtime lowering use direct RxJS
operators. No serialized `Signal` node exists.

## Authoring form

```typespec
alias rateLimits = host(Codex.rateLimits);
alias account = host(Codex.account);

alias remaining = logic(#{
  "if": [
    { var: "account.hasCredits" },
    { "-": [{ var: "account.limit" }, { var: "rateLimits.usage" }] },
    0,
  ],
});

alias dashboard = emit(remaining, "codex.remaining");
```

`logic(...)` has no flow arguments. It is compiled in the lexical alias scope.
The compiler finds each JSONLogic `{ var: "root.path" }`, resolves `root` as a
preceding named flow alias, and supplies its latest value to evaluation.

An inline pipeline has one reserved root for the current pipe value:

```text
source
  -> logic({ "+": [{ "var": "$" }, { "var": "rateLimits.usage" }] })
```

`$` is the implicit pipe input. Other roots resolve to lexical aliases.

## IR

```ts
type FlowRef = { ref: string };

type LogicExpressionIr = {
  kind: "logic";
  input?: ObservableExpressionIr;
  references: Array<{ name: string; flow: FlowRef }>;
  logic: RulesLogic;
};

type ObservableExpressionIr =
  | { kind: "source"; ref: string }
  | { kind: "flow"; ref: string }
  | LogicExpressionIr
  | ExistingObservableExpressionIr;
```

`references` are inferred compiler data. The JSONLogic body remains the
authored expression. Canonical IR sorts references by alias name.

Validation:

1. Every non-`$` var root resolves to a lexical flow alias.
2. Each resolved flow exists in the automation graph.
3. Named flow references are cycle-checked before subscription.
4. JSONLogic is restricted to the supported JSON-value operator set.

## Lowering

### One flow

```typespec
alias remaining = logic(#{
  "-": [{ var: "rateLimits.limit" }, { var: "rateLimits.usage" }],
});
```

```ts
rateLimits$.pipe(
  map((rateLimits) => jsonLogic.apply(logic, { rateLimits })),
);
```

### Several flows

```ts
combineLatest({ account: account$, rateLimits: rateLimits$ }).pipe(
  map((scope) => jsonLogic.apply(logic, scope)),
);
```

The compiler may fuse adjacent pure logic maps and scope-object construction.

### Pipeline input plus aliases

```ts
combineLatest({ $: pipeInput$, rateLimits: rateLimits$ }).pipe(
  map((scope) => jsonLogic.apply(logic, scope)),
);
```

The expression emits when any referenced input emits. A future operator may
select `withLatestFrom` when its declared temporal contract is source-triggered.

### Conditional logic

The initial lowering uses every syntactically referenced root:

```json
{
  "if": [
    { "var": "useLeft" },
    { "var": "left" },
    { "var": "right" }
  ]
}
```

```ts
combineLatest({ useLeft, left, right }).pipe(map(evaluate));
```

This emits on a `right` update while `useLeft` is true, evaluating to the same
left value. A later lowering pass can recognize JSONLogic control flow and emit
branch-sensitive `switchMap` graphs. The authoring form and IR references stay
unchanged.

## Lifetimes and storage

```text
compiled named flow definition
  -> reusable Observable factory

downstream subscription
  -> subscribe each statically inferred dependency
  -> combineLatest waits until every dependency has emitted
  -> evaluate JSONLogic for each combined emission

downstream unsubscribe
  -> unsubscribe combineLatest dependencies
```

| Storage | Key | Lifetime |
| --- | --- | --- |
| flow definition | flow reference | parsed automation |
| inferred references | logic node address | compiled runtime |
| latest input values | one combineLatest subscription | downstream subscription |
| sharing/replay state | authored `share` or `shareReplay` node | that node's subscription lifecycle |

Named-flow reuse and sharing remain separate. A named logic flow is reusable;
an authored sharing operator controls shared acquisition and replay.

## First slice

1. Add `logic(...)` to the TypeSpec alias collector.
2. Capture its JSONLogic literal and source location.
3. Resolve JSONLogic variable roots against preceding lexical aliases.
4. Emit `LogicExpressionIr` with explicit inferred flow references.
5. Lower to direct RxJS `map` or `combineLatest(...).pipe(map(...))`.
6. Preserve the triggering source origin for single-input logic. Multi-input
   origin policy is a later explicit choice.
7. Permit an existing `emit` output to consume the result.

The first slice excludes:

1. Branch-sensitive `switchMap` lowering.
2. A serialized Signal runtime or signal-specific author syntax.
3. JSONLogic-driven async work. `switchMap`, `mergeMap`, and effects stay
   explicit temporal operators.
4. Automatic alias renaming outside the compiler's lexical scope.
5. Rust lowering.

## Test ladder

### A. Reference discovery

```json
{ "*": [{ "var": "price" }, { "var": "quantity" }] }
```

Snapshots `references: ["price", "quantity"]` in canonical order.

### B. Latest-value lowering

```text
price=3, quantity=2 -> 6
price=4             -> 8
quantity=5          -> 20
```

Proves inferred `combineLatest` behavior without authored tuple plumbing.

### C. Nested paths

```text
rateLimits={limit:100, usage:40} -> 60
rateLimits={limit:100, usage:55} -> 45
```

### D. Conditional static reference set

```text
useLeft=true, left=1, right=10 -> 1
right=11                       -> 1
useLeft=false                  -> 11
```

Documents first-slice static flattening. A later branch-sensitive pass changes
only this runtime behavior.

### E. Validation and teardown

1. Unknown var root fails compilation.
2. Unknown flow reference fails compilation.
3. Flow cycle fails compilation.
4. Dependency subscriptions end after the downstream unsubscribe.
5. An authored share node controls shared acquisition separately from logic.

## Files

```text
src/4_typespec/4a_aliasFunctions.tsp  add logic(...)
src/4_typespec/4a_aliasFunctions.ts   collect lexical alias scope and logic AST
src/4_typespec/2_graph.ts              resolve references and emit logic IR
src/4_typespec/3_emitter.ts            generate automation logic nodes
src/7_logicExpressions/                reference discovery and direct RxJS lab
src/8_v2_schema.ts                     serialized logic expression node
src/9_v2_runtime.ts                    RxJS lowering and origin handling
src/5_automations/                     alias-authored logic fixture
```
