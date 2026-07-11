# Signals are automatic; RxJS is manual with clutch

## Context

This note records the architectural model clarified while evaluating how
`@hafley/signals` could be used in Instant, a Tauri/Dockview/xterm/tmux app.

The initial mistaken reading was that `Signal` was uniformly a convenient
`BehaviorSubject`. It is not. The overload used to construct a signal selects
its reactive semantics.

## `Signal` constructor semantics

### `Signal()`

A bare signal has Subject-like event semantics:

- shared and lazy;
- no replay-one/current initialized value;
- appropriate for intents and events.

### `Signal(data)`

A signal initialized with data has writable current-state semantics:

- initialized immediately with `data`;
- BehaviorSubject/shareReplay-current-value behavior;
- appropriate for application state and durable preferences.

### `Signal(fn)`

A function creates a memo/computed signal, equivalent in role to Solid's
`createMemo`:

- execute the function and synchronously track every signal read;
- subscribe to the discovered dependencies;
- recompute when a dependency changes;
- replace the dependency set when branches change;
- expose the latest computed value as a signal.

It is a dynamic `combineLatest`, so ordinary synchronous expressions replace
most explicit combinator plumbing:

```ts
const visibleRows = Signal(() =>
  focusMode.$()
    ? favoriteRows.$()
    : deriveRows(worktrees.$(), sessions.$(), query.$()),
)
```

The dependencies are the signals actually read by the active branch.

### `Signal(observable$)`

Wrapping a singleton Observable supplies lazy shared replay-one behavior.

- subscription to the source remains lazy;
- the latest source value is shared/replayed;
- without a default, the initial value and type are `T | undefined`.

### `Signal(observable$, defaultValue)`

The second argument supplies an initialized value:

- the source remains lazy and shared;
- the signal is immediately readable;
- the resulting type is exactly `T`, not `T | undefined`.

## Automatic versus manual

The useful shorthand is:

> Signals are automatic. RxJS is manual with clutch.

Signals express current reactive truth. Dependency discovery, graph rewiring,
memoization, and latest-value propagation are automatic:

```ts
const total = Signal(() => price.$() * quantity.$())
```

RxJS exposes the time domain explicitly. The programmer chooses cancellation,
ordering, concurrency, sharing, replay, retry, windows, buffering, and
scheduling:

```ts
query.$.pipe(
  debounceTime(200),
  distinctUntilChanged(),
  switchMap(search),
)
```

Flattening operators are concurrency policies, not convenience helpers:

- `switchMap`: newest work supersedes stale work;
- `concatMap`: preserve transactional order;
- `exhaustMap`: reject re-entry while work is active;
- `mergeMap`: allow independent concurrent work.

Signals provide the automatic transmission for the common case. Every signal's
`$` remains RxJS, so the clutch is available without crossing into another state
system when time becomes relevant.

## React and Solid interpretation

React is usefully understood as a specialized reactive system with a pinned DOM
output. Its surrounding APIs reconstruct fragments of FRP through classes,
HOCs, hooks, dependency arrays, cleanup functions, and scheduler conventions.

Solid's `createEffect`/`createMemo` model is closer to the natural signal graph:
execute a function, observe synchronous reactive reads, and dynamically replace
the dependency graph on rerun. `Signal(fn)` has those memo semantics.

`SignalReactMemo` applies the same idea at the React boundary:

1. begin tracking;
2. execute the component;
3. observe synchronous signal reads;
4. subscribe to those signals;
5. rerender when they emit.

React can therefore remain the pinned output/reconciler while signals and RxJS
own state and time.

It is also valid to map directly into JSX. JSX is a value and can be the output
of a memo or Observable; there is no inherent requirement for intermediate
mutable constants, effects, or framework-owned state.

## Purity and resource boundaries

Global Observables and signals are the default. Constructors and explicit
`new Observable(...)` adapters are justified when there is a real producer or
independently owned resource lifecycle, for example:

- an xterm instance;
- a PTY connection;
- a CDP browser tab;
- a Dockview host;
- a filesystem watcher;
- a Tauri listener that requires teardown.

This concedes the impure boundary without making the application itself an
object graph of service classes. Imperative producers and sinks stay at the
edges; the application remains a graph of global reactive values.

## Application to Instant

Instant is unusually suitable for this architecture because most of its hard
problems already live in time:

- PTY byte streams;
- Tauri events;
- tmux session polling;
- Dockview lifecycle and recovery;
- filesystem and SSE updates;
- terminal focus/input/close sequencing;
- capture throttling;
- CDP frames;
- on-disk ledger discovery and message matching.

The intended shape is:

```text
Tauri/DOM/timer producers
          ↓
   global Observables
          ↓
 RxJS temporal policies
          ↓
 @hafley/signals current truth
          ↓
 SignalReactMemo / JSX streams
          ↓
 React + Dockview pinned output
```

Use `Signal(fn)` for synchronous derived truth. Use explicit RxJS operators only
where timing policy is meaningful. Do not manually write `combineLatest` for
ordinary signal derivations.

The safe migration strategy for an existing production-shaped app is
incremental:

1. Introduce signals alongside the existing store.
2. Convert read-oriented streams such as tmux polling or worktree scanning.
3. Temporarily bridge their output back into the old store.
4. Characterize cancellation, error, and lifecycle behavior with tests.
5. Move React consumers to tracked signal reads.
6. Migrate process lifecycle and durable Favorites/ledger behavior last.

The goal is not a framework rewrite. It is to replace scattered callbacks,
timers, mutable registries, and manually synchronized projections with an
explicit graph while preserving working production behavior.

## Summary

Signals are shorthand algebra for current reactive relationships. RxJS is the
jump into explicit temporal calculus. Or, more concretely:

> Signals are automatic. RxJS is manual with clutch.

The important design achievement of `@hafley/signals` is that these are not two
competing systems. They are two driving modes exposed through the same `$`.
