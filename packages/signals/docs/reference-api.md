# Every export

The whole public surface of `@hafley66/signals`, one section per module. The pages above this one explain what to reach for; this one is the list.

Read out of the TypeScript program by `packages/docs-kit/scripts/api.mjs`: the barrel names what is public, each module answers for what it declares, and the checker answers for every signature. Editing this file by hand is editing the thing that overwrites it.

## Modules

| module | exports | what it is |
| --- | --- | --- |
| [src/0_log.ts](#src-0-log-ts) | 14 | LogTape is an optional peer, so nothing here may import it statically. |
| [src/0_types.ts](#src-0-types-ts) | 11 |  |
| [src/1_SignalCreator.ts](#src-1-signalcreator-ts) | 11 |  |
| [src/2_Signal.ts](#src-2-signal-ts) | 6 |  |
| [src/3_Endpoint.ts](#src-3-endpoint-ts) | 6 |  |
| [src/3_react.ts](#src-3-react-ts) | 12 | React integration for signals. |
| [src/4_Query.ts](#src-4-query-ts) | 8 |  |
| [src/5_Route.ts](#src-5-route-ts) | 4 |  |
| [src/6_Storage.ts](#src-6-storage-ts) | 8 |  |
| [src/7_signalMap.ts](#src-7-signalmap-ts) | 1 |  |
| [src/8_sync.ts](#src-8-sync-ts) | 1 |  |
| [src/9_history.ts](#src-9-history-ts) | 5 |  |
| [src/10_slice.ts](#src-10-slice-ts) | 7 |  |
| [src/index.ts](#src-index-ts) | 10 |  |
| [src/vite-plugin.ts](#src-vite-plugin-ts) | 1 |  |

## src/0_log.ts

LogTape is an optional peer, so nothing here may import it statically.

| export | kind |
| --- | --- |
| [`LogFields`](#src-0-log-ts-logfields) | type |
| [`LogEmit`](#src-0-log-ts-logemit) | type |
| [`LOG`](#src-0-log-ts-log) | const |
| [`CAT_WRITE`](#src-0-log-ts-cat-write) | const |
| [`CAT_EMIT`](#src-0-log-ts-cat-emit) | const |
| [`CAT_SELECTOR`](#src-0-log-ts-cat-selector) | const |
| [`CAT_COMPUTE`](#src-0-log-ts-cat-compute) | const |
| [`CAT_INVALIDATE`](#src-0-log-ts-cat-invalidate) | const |
| [`CAT_SUBSCRIBE`](#src-0-log-ts-cat-subscribe) | const |
| [`CAT_UNSUBSCRIBE`](#src-0-log-ts-cat-unsubscribe) | const |
| [`setSignalLogEmit`](#src-0-log-ts-setsignallogemit) | function |
| [`isSignalLogging`](#src-0-log-ts-issignallogging) | function |
| [`enableSignalLogTape`](#src-0-log-ts-enablesignallogtape) | function |
| [`disableSignalLogging`](#src-0-log-ts-disablesignallogging) | function |

### `LogFields` {#src-0-log-ts-logfields}

`LogFields` is declared at `src/0_log.ts:4`.

```ts
export type LogFields = Record<string, unknown>
```

### `LogEmit` {#src-0-log-ts-logemit}

`LogEmit` is declared at `src/0_log.ts:7`.

```ts
export type LogEmit = (
  category: readonly string[],
  message: string,
  fields: LogFields,
) => void

export function setSignalLogEmit(emit: LogEmit | null): void
```

### `LOG` {#src-0-log-ts-log}

`LOG` is declared at `src/0_log.ts:15`.

```ts
LOG: { on: boolean; emit: LogEmit; }
```

### `CAT_WRITE` {#src-0-log-ts-cat-write}

`CAT_WRITE` is declared at `src/0_log.ts:18`.

```ts
CAT_WRITE: readonly ["signals", "write"]
```

### `CAT_EMIT` {#src-0-log-ts-cat-emit}

`CAT_EMIT` is declared at `src/0_log.ts:19`.

```ts
CAT_EMIT: readonly ["signals", "emit"]
```

### `CAT_SELECTOR` {#src-0-log-ts-cat-selector}

`CAT_SELECTOR` is declared at `src/0_log.ts:20`.

```ts
CAT_SELECTOR: readonly ["signals", "selector"]
```

### `CAT_COMPUTE` {#src-0-log-ts-cat-compute}

`CAT_COMPUTE` is declared at `src/0_log.ts:21`.

```ts
CAT_COMPUTE: readonly ["signals", "compute"]
```

### `CAT_INVALIDATE` {#src-0-log-ts-cat-invalidate}

`CAT_INVALIDATE` is declared at `src/0_log.ts:22`.

```ts
CAT_INVALIDATE: readonly ["signals", "invalidate"]
```

### `CAT_SUBSCRIBE` {#src-0-log-ts-cat-subscribe}

`CAT_SUBSCRIBE` is declared at `src/0_log.ts:23`.

```ts
CAT_SUBSCRIBE: readonly ["signals", "subscribe"]
```

### `CAT_UNSUBSCRIBE` {#src-0-log-ts-cat-unsubscribe}

`CAT_UNSUBSCRIBE` is declared at `src/0_log.ts:24`.

```ts
CAT_UNSUBSCRIBE: readonly ["signals", "unsubscribe"]
```

### `setSignalLogEmit` {#src-0-log-ts-setsignallogemit}

`setSignalLogEmit` is declared at `src/0_log.ts:27`.

```ts
setSignalLogEmit: (emit: LogEmit | null) => void
```

### `isSignalLogging` {#src-0-log-ts-issignallogging}

`isSignalLogging` is declared at `src/0_log.ts:32`.

```ts
isSignalLogging: () => boolean
```

### `enableSignalLogTape` {#src-0-log-ts-enablesignallogtape}

`enableSignalLogTape` is declared at `src/0_log.ts:37`.

```ts
enableSignalLogTape: () => Promise<void>
```

### `disableSignalLogging` {#src-0-log-ts-disablesignallogging}

`disableSignalLogging` is declared at `src/0_log.ts:52`.

```ts
disableSignalLogging: () => void
```

## src/0_types.ts

| export | kind |
| --- | --- |
| [`DepthLimit`](#src-0-types-ts-depthlimit) | type |
| [`Act`](#src-0-types-ts-act) | type |
| [`Signal$`](#src-0-types-ts-signal) | interface |
| [`Signal`](#src-0-types-ts-signal-2) | type |
| [`GetNestedValue`](#src-0-types-ts-getnestedvalue) | type |
| [`IsNullish`](#src-0-types-ts-isnullish) | type |
| [`IsRecursive`](#src-0-types-ts-isrecursive) | type |
| [`SignalPath`](#src-0-types-ts-signalpath) | type |
| [`SignalPathValue`](#src-0-types-ts-signalpathvalue) | type |
| [`SignalEvent`](#src-0-types-ts-signalevent) | type |
| [`SignalCreatorOptions`](#src-0-types-ts-signalcreatoroptions) | type |

### `DepthLimit` {#src-0-types-ts-depthlimit}

`DepthLimit` is declared at `src/0_types.ts:8`.

Depth limiter for recursive proxy types.
Prevents TypeScript from exploding on deeply nested structures.

```ts
export type DepthLimit = [never, 0, 1, 2, 3, 4, 5, 6]
```

### `Act` {#src-0-types-ts-act}

`Act` is declared at `src/0_types.ts:13`.

Action type for signal events

```ts
export type Act<T extends string, V> = {
  type: T
  value: V
}
```

### `Signal$` {#src-0-types-ts-signal}

`Signal$` is declared at `src/0_types.ts:32`.

The core signal accessor - extends BehaviorSubject with call signatures.
Named $ because it proxies a BehaviorSubject. jQuery reborn.

```ts
export interface Signal$<T, Base extends object = object> extends BehaviorSubject<T> {
  /** Sync read current value (shorthand for $.value) */
  (): T
  /** Sync write next value, returns the signal for chaining */
  (next: T): Signal<T, Base>
  /** Immer-style mutation */
  setImmer: (recipe: (draft: Draft<T>) => void | Draft<T>) => void
  /** Path from root signal */
  path: string[]
  /** Meta events stream for this signal */
  $: Observable<SignalEvent<T, Base>>
  /** ID getter/setter for debugging */
  id: {
    (setId: string): Signal<T, Base>
    (): string
  }
  /**
   * Run operators and wrap the result back into a Signal, inheriting this node's `distinct`
   * slot. `pipe` returns an Observable for composition; `pipe$` returns something storable.
   * A pipeline that emits synchronously seeds the result, otherwise it reads `undefined` first.
   */
  pipe$<A>(op1: OperatorFunction<T, A>): Signal<A>
  pipe$<A, B>(op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>): Signal<B>
  pipe$<A, B, C>(op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>): Signal<C>
  pipe$<A, B, C, D>(op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>): Signal<D>
  pipe$<A, B, C, D, E>(op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>): Signal<E>
  pipe$<A, B, C, D, E, F>(op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>, op6: OperatorFunction<E, F>): Signal<F>
  pipe$<A, B, C, D, E, F, G>(op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>, op6: OperatorFunction<E, F>, op7: OperatorFunction<F, G>): Signal<G>
  pipe$<A, B, C, D, E, F, G, H>(op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>, op6: OperatorFunction<E, F>, op7: OperatorFunction<F, G>, op8: OperatorFunction<G, H>): Signal<H>
  pipe$<A, B, C, D, E, F, G, H, I>(op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>, op6: OperatorFunction<E, F>, op7: OperatorFunction<F, G>, op8: OperatorFunction<G, H>, op9: OperatorFunction<H, I>): Signal<I>
  pipe$<A, B, C, D, E, F, G, H, I, J>(op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>, op6: OperatorFunction<E, F>, op7: OperatorFunction<F, G>, op8: OperatorFunction<G, H>, op9: OperatorFunction<H, I>, op10: OperatorFunction<I, J>): Signal<J>
  /** React hook - auto re-renders on change. Only available with /react import */
  use?: () => T
}
```

### `Signal` {#src-0-types-ts-signal-2}

`Signal` is declared at `src/0_types.ts:88`.

A signal node. Access `.$` for the reactive accessor,
or traverse properties to get child signals.

The optional `Base` type param allows extensions (like FormSignal)
to attach additional properties at each node via `$field`.

```ts
export type Signal<T, Base extends object = object, Depth extends number = 5> = {
  /** The reactive accessor - read, write, subscribe, pipe */
  $: Signal$<T, Base>
} & (keyof Base extends never
  ? unknown
  : { /** Extension namespace for plugins (e.g. form state) */ $field: Base }
) & (Depth extends never
  ? unknown
  : IsRecursive<NonNullable<T>> extends 1
    ? {
        [K in keyof NonNullable<T>]-?: Signal<
          GetNestedValue<T, K>,
          Base,
          DepthLimit[Depth]
        >
      } & (NonNullable<T> extends unknown[]
        ? Record<number, Signal<GetNestedValue<T, number>, Base, DepthLimit[Depth]>>
        : unknown)
    : unknown)
```

### `GetNestedValue` {#src-0-types-ts-getnestedvalue}

`GetNestedValue` is declared at `src/0_types.ts:111`.

Get nested value type, preserving undefined when parent might be null/undefined

```ts
export type GetNestedValue<T, K> = IsNullish<T> extends true
```

### `IsNullish` {#src-0-types-ts-isnullish}

`IsNullish` is declared at `src/0_types.ts:111`.

Check if type includes null or undefined

```ts
export type GetNestedValue<T, K> = IsNullish<T> extends true
```

### `IsRecursive` {#src-0-types-ts-isrecursive}

`IsRecursive` is declared at `src/0_types.ts:127`.

Check if type should have recursive proxy properties

```ts
export type IsRecursive<T> = NonNullable<T> extends Record<string, unknown>
```

### `SignalPath` {#src-0-types-ts-signalpath}

`SignalPath` is declared at `src/0_types.ts:163`.

Every dotted path into `T`, as a string union. `DepthLimit` bounds it with the one counter
`Signal<T>` already walks, which is what terminates a self-recursive type.

```ts
export type SignalPath<T, Depth extends number = 5> = [Depth] extends [never]
```

### `SignalPathValue` {#src-0-types-ts-signalpathvalue}

`SignalPathValue` is declared at `src/0_types.ts:185`.

What sits at one `SignalPath`, carrying the `undefined` a nullish hop introduces because
`GetNestedValue` does.

```ts
export type SignalPathValue<T, Path extends string> = Path extends `${infer Head}.${infer Rest}`
```

### `SignalEvent` {#src-0-types-ts-signalevent}

`SignalEvent` is declared at `src/0_types.ts:192`.

Events emitted by the signal system for tracking/debugging/memo

```ts
export type SignalEvent<T, Base extends object = object> =
```

### `SignalCreatorOptions` {#src-0-types-ts-signalcreatoroptions}

`SignalCreatorOptions` is declared at `src/0_types.ts:202`.

Options for creating a signal

```ts
export type SignalCreatorOptions<T, Base extends object = object> = {
  initialState?: T
  observable?: Observable<T>
  /** Subject semantics: no initial emission and no replay. */
  event?: boolean
  /** Override synchronous reads (used by lazily evaluated memo signals). */
  read?: () => T
  /**
   * SELECTOR_SLOT.distinct: the operator a nested-path selector dedupes with. Defaults to
   * `distinctShallow()`. `null` disables it, restoring re-emission on every root write.
   */
  distinct?: MonoTypeOperatorFunction<unknown> | null
  /** Mirror a `.$(next)` write into an external holder (writable memos). */
  write?: (next: T) => void
  /** Factory to create Base extension for each node */
  createBase?: (root: Signal<T, Base>, path: string[]) => Base
}
```

## src/1_SignalCreator.ts

| export | kind |
| --- | --- |
| [`signalDispatch`](#src-1-signalcreator-ts-signaldispatch) | const |
| [`shallowEqual`](#src-1-signalcreator-ts-shallowequal) | function |
| [`distinctShallow`](#src-1-signalcreator-ts-distinctshallow) | const |
| [`SELECTOR_SLOT`](#src-1-signalcreator-ts-selector-slot) | const |
| [`inEmitTurn`](#src-1-signalcreator-ts-inemitturn) | function |
| [`trackDependencies`](#src-1-signalcreator-ts-trackdependencies) | function |
| [`SignalCreator`](#src-1-signalcreator-ts-signalcreator) | function |
| [`ComputeResult`](#src-1-signalcreator-ts-computeresult) | type |
| [`ComputeBody`](#src-1-signalcreator-ts-computebody) | type |
| [`ComputedOptions`](#src-1-signalcreator-ts-computedoptions) | type |
| [`createComputedSignal`](#src-1-signalcreator-ts-createcomputedsignal) | function |

### `signalDispatch` {#src-1-signalcreator-ts-signaldispatch}

`signalDispatch` is declared at `src/1_SignalCreator.ts:40`.

Global dispatch for signal events. Used by Signal.memo() to track dependencies.

```ts
signalDispatch: Subject<SignalEvent<unknown>>
```

### `shallowEqual` {#src-1-signalcreator-ts-shallowequal}

`shallowEqual` is declared at `src/1_SignalCreator.ts:43`.

One level deep, which is what immer's structural sharing already gives per branch.

```ts
shallowEqual: (a: unknown, b: unknown) => boolean
```

### `distinctShallow` {#src-1-signalcreator-ts-distinctshallow}

`distinctShallow` is declared at `src/1_SignalCreator.ts:57`.

The default distinction for a nested-path selector.

```ts
distinctShallow: <T>() => MonoTypeOperatorFunction<T>
```

### `SELECTOR_SLOT` {#src-1-signalcreator-ts-selector-slot}

`SELECTOR_SLOT` is declared at `src/1_SignalCreator.ts:64`.

The nested-path selector is a fixed pipeline and a slot is its pipe index, so a caller swaps one
operator without restating the rest. `distinct` is the only slot today: pass `null` for the
pre-2026-09-10 behaviour, where a sibling write re-emitted an unchanged branch.

```ts
SELECTOR_SLOT: { readonly project: 0; readonly distinct: 1; readonly track: 2; readonly share: 3; }
```

### `inEmitTurn` {#src-1-signalcreator-ts-inemitturn}

`inEmitTurn` is declared at `src/1_SignalCreator.ts:80`.

```ts
inEmitTurn: <T>(run: () => T) => T
```

### `trackDependencies` {#src-1-signalcreator-ts-trackdependencies}

`trackDependencies` is declared at `src/1_SignalCreator.ts:116`.

```ts
trackDependencies: <T>(compute: () => T, sink: Set<Signal<unknown>>) => T
```

### `SignalCreator` {#src-1-signalcreator-ts-signalcreator}

`SignalCreator` is declared at `src/1_SignalCreator.ts:139`.

Creates a signal tree with proxy-based nested access.

```ts
SignalCreator: <T, Base extends object = object>(options: SignalCreatorOptions<T, Base>) => Signal<T, Base>
```

### `ComputeResult` {#src-1-signalcreator-ts-computeresult}

`ComputeResult` is declared at `src/1_SignalCreator.ts:440`.

Same shape as Solid 2.0 `ComputeFunction<Prev, Next>`: a value, or a stream of values.

```ts
export type ComputeResult<T> = T | Observable<T> | PromiseLike<T> | AsyncIterable<T>
```

### `ComputeBody` {#src-1-signalcreator-ts-computebody}

`ComputeBody` is declared at `src/1_SignalCreator.ts:443`.

Arity 1 is the scan form: the body is handed its own previous value.

```ts
export type ComputeBody<T> = (prev: T) => ComputeResult<T>
```

### `ComputedOptions` {#src-1-signalcreator-ts-computedoptions}

`ComputedOptions` is declared at `src/1_SignalCreator.ts:445`.

```ts
export type ComputedOptions = {
  /** `.$(next)` overrides the value until the next run, which sees it as `prev`. Default true. */
  writable?: boolean
}
```

### `createComputedSignal` {#src-1-signalcreator-ts-createcomputedsignal}

`createComputedSignal` is declared at `src/1_SignalCreator.ts:463`.

The body receives the current value as `prev`. A stream result feeds the value one emission at a
time: a dependency change cancels it and reruns (switch), completion after at least one emission
reruns (expand), completion with none settles until a dependency changes.

```ts
createComputedSignal: <T>(compute: ComputeBody<T>, seed?: T | undefined, options?: ComputedOptions) => Signal<T>
```

## src/2_Signal.ts

| export | kind |
| --- | --- |
| [`Signal`](#src-2-signal-ts-signal) | function |
| [`SignalSource`](#src-2-signal-ts-signalsource) | type |
| [`isSignal`](#src-2-signal-ts-issignal) | function |
| [`toSignal`](#src-2-signal-ts-tosignal) | function |
| [`Source$`](#src-2-signal-ts-source) | type |
| [`pipe$`](#src-2-signal-ts-pipe) | function |

### `Signal` {#src-2-signal-ts-signal}

`Signal` is declared at `src/2_Signal.ts:10`.

Create a reactive signal with proxy-based nested access.

```ts
export type Signal<T, Base extends object = object, Depth extends number = 5> = SignalType<T, Base, Depth>

export function Signal<T>(observable: Observable<T>): SignalType<T | undefined>
export function Signal<T>(observable: Observable<T>, defaultState: T): SignalType<T>
export function Signal<T>(memo: () => T): SignalType<T>
export function Signal<T>(scan: ComputeBody<T>, seed: T, options?: ComputedOptions): SignalType<T>
export function Signal<T>(state: T): SignalType<T>
export function Signal<T>(): SignalType<T | undefined>
```

### `SignalSource` {#src-2-signal-ts-signalsource}

`SignalSource` is declared at `src/2_Signal.ts:12`.

```ts
export type SignalSource<T> = SignalType<T> | Observable<T> | (() => T) | T

export function toSignal<T>(source: SignalSource<T>): SignalType<T>
```

### `isSignal` {#src-2-signal-ts-issignal}

`isSignal` is declared at `src/2_Signal.ts:14`.

```ts
isSignal: <T>(value: unknown) => value is Signal<T>
```

### `toSignal` {#src-2-signal-ts-tosignal}

`toSignal` is declared at `src/2_Signal.ts:22`.

Normalize any source accepted by Signal while preserving existing Signals.

```ts
toSignal: <T>(source: SignalSource<T>) => Signal<T>
```

### `Source$` {#src-2-signal-ts-source}

`Source$` is declared at `src/2_Signal.ts:82`.

Anything a pipeline can start from: a live stream or an existing signal node.

```ts
export type Source$<T> = Observable<T> | SignalType<T>

export function pipe$<T, A>(source: Source$<T>, op1: OperatorFunction<T, A>): SignalType<A>
export function pipe$<T, A, B>(source: Source$<T>, op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>): SignalType<B>
export function pipe$<T, A, B, C>(source: Source$<T>, op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>): SignalType<C>
export function pipe$<T, A, B, C, D>(source: Source$<T>, op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>): SignalType<D>
export function pipe$<T, A, B, C, D, E>(source: Source$<T>, op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>): SignalType<E>
export function pipe$<T, A, B, C, D, E, F>(source: Source$<T>, op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>, op6: OperatorFunction<E, F>): SignalType<F>
export function pipe$<T, A, B, C, D, E, F, G>(source: Source$<T>, op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>, op6: OperatorFunction<E, F>, op7: OperatorFunction<F, G>): SignalType<G>
export function pipe$<T, A, B, C, D, E, F, G, H>(source: Source$<T>, op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>, op6: OperatorFunction<E, F>, op7: OperatorFunction<F, G>, op8: OperatorFunction<G, H>): SignalType<H>
export function pipe$<T, A, B, C, D, E, F, G, H, I>(source: Source$<T>, op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>, op6: OperatorFunction<E, F>, op7: OperatorFunction<F, G>, op8: OperatorFunction<G, H>, op9: OperatorFunction<H, I>): SignalType<I>
export function pipe$<T, A, B, C, D, E, F, G, H, I, J>(source: Source$<T>, op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>, op6: OperatorFunction<E, F>, op7: OperatorFunction<F, G>, op8: OperatorFunction<G, H>, op9: OperatorFunction<H, I>, op10: OperatorFunction<I, J>): SignalType<J>
```

### `pipe$` {#src-2-signal-ts-pipe}

`pipe$` is declared at `src/2_Signal.ts:84`.

```ts
export function pipe$<T, A>(source: Source$<T>, op1: OperatorFunction<T, A>): SignalType<A>
export function pipe$<T, A, B>(source: Source$<T>, op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>): SignalType<B>
export function pipe$<T, A, B, C>(source: Source$<T>, op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>): SignalType<C>
export function pipe$<T, A, B, C, D>(source: Source$<T>, op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>): SignalType<D>
export function pipe$<T, A, B, C, D, E>(source: Source$<T>, op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>): SignalType<E>
export function pipe$<T, A, B, C, D, E, F>(source: Source$<T>, op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>, op6: OperatorFunction<E, F>): SignalType<F>
export function pipe$<T, A, B, C, D, E, F, G>(source: Source$<T>, op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>, op6: OperatorFunction<E, F>, op7: OperatorFunction<F, G>): SignalType<G>
export function pipe$<T, A, B, C, D, E, F, G, H>(source: Source$<T>, op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>, op6: OperatorFunction<E, F>, op7: OperatorFunction<F, G>, op8: OperatorFunction<G, H>): SignalType<H>
export function pipe$<T, A, B, C, D, E, F, G, H, I>(source: Source$<T>, op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>, op6: OperatorFunction<E, F>, op7: OperatorFunction<F, G>, op8: OperatorFunction<G, H>, op9: OperatorFunction<H, I>): SignalType<I>
export function pipe$<T, A, B, C, D, E, F, G, H, I, J>(source: Source$<T>, op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>, op6: OperatorFunction<E, F>, op7: OperatorFunction<F, G>, op8: OperatorFunction<G, H>, op9: OperatorFunction<H, I>, op10: OperatorFunction<I, J>): SignalType<J>
```

## src/3_Endpoint.ts

| export | kind |
| --- | --- |
| [`Serializable`](#src-3-endpoint-ts-serializable) | type |
| [`EndpointRequest`](#src-3-endpoint-ts-endpointrequest) | type |
| [`EndpointResponse`](#src-3-endpoint-ts-endpointresponse) | type |
| [`EndpointTransport`](#src-3-endpoint-ts-endpointtransport) | type |
| [`EndpointConfig`](#src-3-endpoint-ts-endpointconfig) | type |
| [`Endpoint`](#src-3-endpoint-ts-endpoint) | class |

### `Serializable` {#src-3-endpoint-ts-serializable}

`Serializable` is declared at `src/3_Endpoint.ts:12`.

```ts
export type Serializable =
```

### `EndpointRequest` {#src-3-endpoint-ts-endpointrequest}

`EndpointRequest` is declared at `src/3_Endpoint.ts:20`.

```ts
export type EndpointRequest = {
  url: string
  method: string
  headers?: Record<string, string>
  body?: Serializable
}
```

### `EndpointResponse` {#src-3-endpoint-ts-endpointresponse}

`EndpointResponse` is declared at `src/3_Endpoint.ts:27`.

```ts
export type EndpointResponse = {
  status: number
  headers?: Record<string, string>
  body?: Serializable
}
```

### `EndpointTransport` {#src-3-endpoint-ts-endpointtransport}

`EndpointTransport` is declared at `src/3_Endpoint.ts:33`.

```ts
export type EndpointTransport = (
  request: EndpointRequest,
) => ObservableInput<EndpointResponse>
```

### `EndpointConfig` {#src-3-endpoint-ts-endpointconfig}

`EndpointConfig` is declared at `src/3_Endpoint.ts:37`.

```ts
export type EndpointConfig<I, O> = {
  request: (input: I) => EndpointRequest
  decode: (response: EndpointResponse) => O
  key?: (input: I) => string
}
```

### `Endpoint` {#src-3-endpoint-ts-endpoint}

`Endpoint` is declared at `src/3_Endpoint.ts:49`.

Declarative request/response boundary bound only by its domain Input/Output.
Generated endpoints can subclass this and pass their static config to super.
The transport remains replaceable (window fetch, service worker, extension
channel, test transport) because requests and responses are serializable.

```ts
Endpoint: typeof Endpoint
```

## src/3_react.ts

React integration for signals.

| export | kind |
| --- | --- |
| [`signalDispatch`](#src-3-react-ts-signaldispatch) | const |
| [`SignalReact`](#src-3-react-ts-signalreact) | function |
| [`Signal$`](#src-3-react-ts-signal) | re-export |
| [`SignalReactMemo`](#src-3-react-ts-signalreactmemo) | const |
| [`useSignal`](#src-3-react-ts-usesignal) | function |
| [`Act`](#src-3-react-ts-act) | re-export |
| [`DepthLimit`](#src-3-react-ts-depthlimit) | re-export |
| [`GetNestedValue`](#src-3-react-ts-getnestedvalue) | re-export |
| [`IsNullish`](#src-3-react-ts-isnullish) | re-export |
| [`IsRecursive`](#src-3-react-ts-isrecursive) | re-export |
| [`SignalCreatorOptions`](#src-3-react-ts-signalcreatoroptions) | re-export |
| [`SignalEvent`](#src-3-react-ts-signalevent) | re-export |

### `signalDispatch` {#src-3-react-ts-signaldispatch}

`signalDispatch` is declared at `src/3_react.ts:19`.

Global dispatch for signal events. Used by Signal.memo() to track dependencies.

```ts
signalDispatch: Subject<SignalEvent<unknown>>
```

### `SignalReact` {#src-3-react-ts-signalreact}

`SignalReact` is declared at `src/3_react.ts:29`.

```ts
SignalReact: <P extends object>(Component: FC<P>) => FC<P>
```

### `Signal$` {#src-3-react-ts-signal}

`Signal$` is declared at `src/3_react.ts:36`.

```ts
Signal$: any
```

### `SignalReactMemo` {#src-3-react-ts-signalreactmemo}

`SignalReactMemo` is declared at `src/3_react.ts:85`.

```ts
SignalReactMemo: <P extends object>(Component: FC<P>) => FC<P>
```

### `useSignal` {#src-3-react-ts-usesignal}

`useSignal` is declared at `src/3_react.ts:91`.

Hook to subscribe to a signal in a component. Returns current value and
re-renders on change.

```ts
useSignal: <T>(signal$: Signal$<T, object>) => T
```

### `Act` {#src-3-react-ts-act}

`Act` is declared at `src/3_react.ts:109`.

```ts
Act: any
```

### `DepthLimit` {#src-3-react-ts-depthlimit}

`DepthLimit` is declared at `src/3_react.ts:110`.

```ts
DepthLimit: any
```

### `GetNestedValue` {#src-3-react-ts-getnestedvalue}

`GetNestedValue` is declared at `src/3_react.ts:111`.

```ts
GetNestedValue: any
```

### `IsNullish` {#src-3-react-ts-isnullish}

`IsNullish` is declared at `src/3_react.ts:112`.

```ts
IsNullish: any
```

### `IsRecursive` {#src-3-react-ts-isrecursive}

`IsRecursive` is declared at `src/3_react.ts:113`.

```ts
IsRecursive: any
```

### `SignalCreatorOptions` {#src-3-react-ts-signalcreatoroptions}

`SignalCreatorOptions` is declared at `src/3_react.ts:115`.

```ts
SignalCreatorOptions: any
```

### `SignalEvent` {#src-3-react-ts-signalevent}

`SignalEvent` is declared at `src/3_react.ts:116`.

```ts
SignalEvent: any
```

## src/4_Query.ts

| export | kind |
| --- | --- |
| [`AsyncStatus`](#src-4-query-ts-asyncstatus) | type |
| [`QueryState`](#src-4-query-ts-querystate) | type |
| [`RefetchInterval`](#src-4-query-ts-refetchinterval) | type |
| [`QueryOptions`](#src-4-query-ts-queryoptions) | type |
| [`Query`](#src-4-query-ts-query) | type |
| [`Mutation`](#src-4-query-ts-mutation) | type |
| [`createQuery`](#src-4-query-ts-createquery) | function |
| [`createMutation`](#src-4-query-ts-createmutation) | function |

### `AsyncStatus` {#src-4-query-ts-asyncstatus}

`AsyncStatus` is declared at `src/4_Query.ts:23`.

```ts
export type AsyncStatus = "idle" | "loading" | "success" | "error"
```

### `QueryState` {#src-4-query-ts-querystate}

`QueryState` is declared at `src/4_Query.ts:25`.

```ts
export type QueryState<T, E = unknown> = {
  data?: T
  error?: E
  status: AsyncStatus
  isLoading: boolean
  isLoadingEmpty: boolean
  isSuccess: boolean
  isError: boolean
  isStale: boolean
  updatedAt?: number
}
```

### `RefetchInterval` {#src-4-query-ts-refetchinterval}

`RefetchInterval` is declared at `src/4_Query.ts:37`.

```ts
export type RefetchInterval<O, E = unknown> =
```

### `QueryOptions` {#src-4-query-ts-queryoptions}

`QueryOptions` is declared at `src/4_Query.ts:42`.

```ts
export type QueryOptions<O = unknown, E = unknown> = {
  staleTime?: number
  cacheTime?: number
  skip?: "clear" | "retain"
  now?: () => number
  /** Poll while subscribed. A tick that lands mid-flight is dropped, never queued. */
  refetchInterval?: RefetchInterval<O, E>
}
```

### `Query` {#src-4-query-ts-query}

`Query` is declared at `src/4_Query.ts:51`.

```ts
export type Query<I, O, E = unknown> = SignalType<QueryState<O, E>> & {
  input: SignalType<I | undefined>
  refetch: () => void
  invalidate: () => void
  clear: () => void
}
```

### `Mutation` {#src-4-query-ts-mutation}

`Mutation` is declared at `src/4_Query.ts:58`.

```ts
export type Mutation<I, O, E = unknown> = SignalType<QueryState<O, E>> & {
  input: SignalType<I | undefined>
  clear: () => void
}
```

### `createQuery` {#src-4-query-ts-createquery}

`createQuery` is declared at `src/4_Query.ts:262`.

```ts
createQuery: <I, O, E = unknown>(endpoint: Endpoint<I, O>, source: SignalSource<I | undefined>, config?: QueryOptions<unknown, unknown>) => Query<I, O, E>
```

### `createMutation` {#src-4-query-ts-createmutation}

`createMutation` is declared at `src/4_Query.ts:300`.

```ts
createMutation: <I, O, E = unknown>(endpoint: Endpoint<I, O>, source?: SignalSource<I | undefined>) => Mutation<I, O, E>
```

## src/5_Route.ts

| export | kind |
| --- | --- |
| [`RouteValue`](#src-5-route-ts-routevalue) | type |
| [`RouteNavigation`](#src-5-route-ts-routenavigation) | type |
| [`RouteSignal`](#src-5-route-ts-routesignal) | type |
| [`Route`](#src-5-route-ts-route) | function |

### `RouteValue` {#src-5-route-ts-routevalue}

`RouteValue` is declared at `src/5_Route.ts:12`.

```ts
export type RouteValue<S extends string> = PathValues<S> & {
  path: string
  matched: boolean
  [query: string]: string | boolean
}
```

### `RouteNavigation` {#src-5-route-ts-routenavigation}

`RouteNavigation` is declared at `src/5_Route.ts:17`.

```ts
export type RouteNavigation<S extends string> =
```

### `RouteSignal` {#src-5-route-ts-routesignal}

`RouteSignal` is declared at `src/5_Route.ts:20`.

```ts
export type RouteSignal<S extends string> = SignalType<RouteValue<S>> & {
  template: S
  href(values: RouteNavigation<S>): string
  navigate(values: RouteNavigation<S>, options?: { replace?: boolean }): void
  back(): void
  forward(): void
}

export function Route<const S extends string>(template: S): RouteSignal<S>
```

### `Route` {#src-5-route-ts-route}

`Route` is declared at `src/5_Route.ts:34`.

```ts
Route: <const S extends string>(template: S) => RouteSignal<S>
```

## src/6_Storage.ts

| export | kind |
| --- | --- |
| [`Storage`](#src-6-storage-ts-storage) | interface |
| [`StorageOptions`](#src-6-storage-ts-storageoptions) | type |
| [`StorageSignal`](#src-6-storage-ts-storagesignal) | function |
| [`storageSignal`](#src-6-storage-ts-storagesignal-2) | function |
| [`localStorageAdapter`](#src-6-storage-ts-localstorageadapter) | function |
| [`urlAdapter`](#src-6-storage-ts-urladapter) | function |
| [`hashAdapter`](#src-6-storage-ts-hashadapter) | function |
| [`historyAdapter`](#src-6-storage-ts-historyadapter) | function |

### `Storage` {#src-6-storage-ts-storage}

`Storage` is declared at `src/6_Storage.ts:7`.

```ts
export interface Storage<T> {
  read: Observable<T>
  write: Observer<T>
}

export function localStorageAdapter(key: string): Storage<string>
```

### `StorageOptions` {#src-6-storage-ts-storageoptions}

`StorageOptions` is declared at `src/6_Storage.ts:12`.

```ts
export type StorageOptions<T> = {
  serialize?: (value: T) => string
  parse?: (value: string) => T
}

export function StorageSignal<T>(key: string, fallback: T, options: StorageOptions<T> = {}): SignalType<T>
```

### `StorageSignal` {#src-6-storage-ts-storagesignal}

`StorageSignal` is declared at `src/6_Storage.ts:23`.

A signal bound to a storage backend. `close()` releases both subscriptions, and with them the
window listener a backend such as `urlAdapter` opens. Without it every call left one live
`popstate` listener whose closure pinned the signal and everything derived from it.

```ts
export type StorageSignal<T> = SignalType<T> & { close: () => void }

export function StorageSignal<T>(key: string, fallback: T, options: StorageOptions<T> = {}): SignalType<T>
```

### `storageSignal` {#src-6-storage-ts-storagesignal-2}

`storageSignal` is declared at `src/6_Storage.ts:25`.

```ts
storageSignal: <T>(backend: Storage<string>, fallback: T, options?: StorageOptions<T>) => StorageSignal<T>
```

### `localStorageAdapter` {#src-6-storage-ts-localstorageadapter}

`localStorageAdapter` is declared at `src/6_Storage.ts:61`.

```ts
localStorageAdapter: (key: string) => Storage<string>
```

### `urlAdapter` {#src-6-storage-ts-urladapter}

`urlAdapter` is declared at `src/6_Storage.ts:77`.

```ts
urlAdapter: (key: string) => Storage<string>
```

### `hashAdapter` {#src-6-storage-ts-hashadapter}

`hashAdapter` is declared at `src/6_Storage.ts:99`.

```ts
hashAdapter: (key: string) => Storage<string>
```

### `historyAdapter` {#src-6-storage-ts-historyadapter}

`historyAdapter` is declared at `src/6_Storage.ts:119`.

```ts
historyAdapter: (key: string) => Storage<string>
```

## src/7_signalMap.ts

| export | kind |
| --- | --- |
| [`signalMap`](#src-7-signalmap-ts-signalmap) | function |

### `signalMap` {#src-7-signalmap-ts-signalmap}

`signalMap` is declared at `src/7_signalMap.ts:7`.

```ts
signalMap: <I, O>(project: (source: I) => O) => OperatorFunction<I, O>
```

## src/8_sync.ts

| export | kind |
| --- | --- |
| [`sync`](#src-8-sync-ts-sync) | function |

### `sync` {#src-8-sync-ts-sync}

`sync` is declared at `src/8_sync.ts:5`.

```ts
sync: <Local, Source>(local: Signal<Local>, source: Signal<Source>, transforms: { to: (local: Local) => Source; from: (source: Source) => Local; }) => { ...; }
```

## src/9_history.ts

| export | kind |
| --- | --- |
| [`SignalHistory`](#src-9-history-ts-signalhistory) | interface |
| [`History`](#src-9-history-ts-history) | re-export |
| [`Location`](#src-9-history-ts-location) | re-export |
| [`signalHistory`](#src-9-history-ts-signalhistory-2) | function |
| [`Action`](#src-9-history-ts-action) | re-export |

### `SignalHistory` {#src-9-history-ts-signalhistory}

`SignalHistory` is declared at `src/9_history.ts:10`.

```ts
export interface SignalHistory {
  location: SignalType<Location>
  action: SignalType<ActionType>
}
```

### `History` {#src-9-history-ts-history}

`History` is declared at `src/9_history.ts:15`.

```ts
History: any
```

### `Location` {#src-9-history-ts-location}

`Location` is declared at `src/9_history.ts:15`.

```ts
Location: any
```

### `signalHistory` {#src-9-history-ts-signalhistory-2}

`signalHistory` is declared at `src/9_history.ts:22`.

```ts
signalHistory: (history$: Observable<History>, initial?: { location: Location; action: Action; }) => SignalHistory
```

### `Action` {#src-9-history-ts-action}

`Action` is declared at `src/9_history.ts:26`.

```ts
Action: typeof Action
```

## src/10_slice.ts

| export | kind |
| --- | --- |
| [`Reducer`](#src-10-slice-ts-reducer) | type |
| [`Epic`](#src-10-slice-ts-epic) | type |
| [`Slice`](#src-10-slice-ts-slice) | type |
| [`SliceConfig`](#src-10-slice-ts-sliceconfig) | type |
| [`createEpic`](#src-10-slice-ts-createepic) | function |
| [`createSlice`](#src-10-slice-ts-createslice) | function |
| [`runEpics`](#src-10-slice-ts-runepics) | function |

### `Reducer` {#src-10-slice-ts-reducer}

`Reducer` is declared at `src/10_slice.ts:5`.

```ts
export type Reducer<S, A> = (state: S, action: A) => S
```

### `Epic` {#src-10-slice-ts-epic}

`Epic` is declared at `src/10_slice.ts:7`.

```ts
export type Epic<A, S, Ctx = unknown> = (
  actions$: Observable<A>,
  state: SignalType<S>,
  ctx: Ctx,
) => Observable<A>

export function createEpic<A, S, Ctx = unknown>(epic: Epic<A, S, Ctx>): Epic<A, S, Ctx>
```

### `Slice` {#src-10-slice-ts-slice}

`Slice` is declared at `src/10_slice.ts:13`.

```ts
export type Slice<S, A> = {
  state: SignalType<S>
  actions$: Observable<A>
  dispatch: (action: A) => void
  // Never emits; subscribed = epics running.
  epics$: Observable<never>
}

export function createSlice<S, A, Ctx = unknown>(config: SliceConfig<S, A, Ctx>): Slice<S, A>
```

### `SliceConfig` {#src-10-slice-ts-sliceconfig}

`SliceConfig` is declared at `src/10_slice.ts:23`.

```ts
export type SliceConfig<S, A, Ctx> = {
  initial: S
  reduce: Reducer<S, A>
  epics?: readonly Epic<A, S, Ctx>[]
  state?: SignalType<S>
} & CtxField<Ctx>

export function createSlice<S, A, Ctx = unknown>(config: SliceConfig<S, A, Ctx>): Slice<S, A>
```

### `createEpic` {#src-10-slice-ts-createepic}

`createEpic` is declared at `src/10_slice.ts:30`.

```ts
createEpic: <A, S, Ctx = unknown>(epic: Epic<A, S, Ctx>) => Epic<A, S, Ctx>
```

### `createSlice` {#src-10-slice-ts-createslice}

`createSlice` is declared at `src/10_slice.ts:34`.

```ts
createSlice: <S, A, Ctx = unknown>(config: SliceConfig<S, A, Ctx>) => Slice<S, A>
```

### `runEpics` {#src-10-slice-ts-runepics}

`runEpics` is declared at `src/10_slice.ts:49`.

```ts
runEpics: <S, A, Ctx>(actions$: Observable<A>, state: Signal<S>, ctx: Ctx, epics: readonly Epic<A, S, Ctx>[], dispatch: (action: A) => void) => Observable<never>
```

## src/index.ts

| export | kind |
| --- | --- |
| [`Act`](#src-index-ts-act) | re-export |
| [`DepthLimit`](#src-index-ts-depthlimit) | re-export |
| [`GetNestedValue`](#src-index-ts-getnestedvalue) | re-export |
| [`IsNullish`](#src-index-ts-isnullish) | re-export |
| [`IsRecursive`](#src-index-ts-isrecursive) | re-export |
| [`Signal$`](#src-index-ts-signal) | re-export |
| [`SignalCreatorOptions`](#src-index-ts-signalcreatoroptions) | re-export |
| [`SignalEvent`](#src-index-ts-signalevent) | re-export |
| [`SignalPath`](#src-index-ts-signalpath) | re-export |
| [`SignalPathValue`](#src-index-ts-signalpathvalue) | re-export |

### `Act` {#src-index-ts-act}

`Act` is declared at `src/index.ts:2`.

```ts
Act: any
```

### `DepthLimit` {#src-index-ts-depthlimit}

`DepthLimit` is declared at `src/index.ts:3`.

```ts
DepthLimit: any
```

### `GetNestedValue` {#src-index-ts-getnestedvalue}

`GetNestedValue` is declared at `src/index.ts:4`.

```ts
GetNestedValue: any
```

### `IsNullish` {#src-index-ts-isnullish}

`IsNullish` is declared at `src/index.ts:5`.

```ts
IsNullish: any
```

### `IsRecursive` {#src-index-ts-isrecursive}

`IsRecursive` is declared at `src/index.ts:6`.

```ts
IsRecursive: any
```

### `Signal$` {#src-index-ts-signal}

`Signal$` is declared at `src/index.ts:7`.

```ts
Signal$: any
```

### `SignalCreatorOptions` {#src-index-ts-signalcreatoroptions}

`SignalCreatorOptions` is declared at `src/index.ts:8`.

```ts
SignalCreatorOptions: any
```

### `SignalEvent` {#src-index-ts-signalevent}

`SignalEvent` is declared at `src/index.ts:9`.

```ts
SignalEvent: any
```

### `SignalPath` {#src-index-ts-signalpath}

`SignalPath` is declared at `src/index.ts:10`.

```ts
SignalPath: any
```

### `SignalPathValue` {#src-index-ts-signalpathvalue}

`SignalPathValue` is declared at `src/index.ts:11`.

```ts
SignalPathValue: any
```

## src/vite-plugin.ts

| export | kind |
| --- | --- |
| [`signalsJsx`](#src-vite-plugin-ts-signalsjsx) | function |

### `signalsJsx` {#src-vite-plugin-ts-signalsjsx}

`signalsJsx` is declared at `src/vite-plugin.ts:6`.

```ts
signalsJsx: () => Plugin<any>
```

