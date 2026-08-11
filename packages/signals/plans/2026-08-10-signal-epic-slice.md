# Signal epic slice: recursive state, event constructors, reducers, and epics

Status: deferred design note

Date: 2026-08-10

## Goal

Allow an existing state signal to declare its event inputs, reducer, and optional RxJS epics in
one operation. The result remains recursively signal-addressable while exposing the event
constructors that drive it.

```text
State signal
  + typed event signals
  + reducer
  + optional RxJS epics
  = SignalEpicSlice<State, Events>
```

This plan records the type and runtime questions. It does not authorize implementation in the
current signals work.

## Proposed surface

Two candidate names carry slightly different emphasis:

```ts
state.scan$(events, reducer)
state.impl$({ events, reduce, epic })
```

`scan$` is the reducer-only form. `impl$` is the complete implementation form and can lower to
the same runtime primitive.

```ts
const counter = Signal({ count: 0 }).scan$({
  increment: Signal.event<number>(),
  reset: Signal.event<void>(),
}, (state, event) => {
  switch (event.type) {
    case "increment":
      return { count: state.count + event.value }
    case "reset":
      return { count: 0 }
  }
})
```

```ts
const counter = Signal({ count: 0 }).impl$({
  events: {
    increment: Signal.event<number>(),
    reset: Signal.event<void>(),
  },

  reduce(state, event) {
    switch (event.type) {
      case "increment":
        return { count: state.count + event.value }
      case "reset":
        return { count: 0 }
    }
  },

  epic(events, state) {
    // Return derived events or effects through ordinary RxJS composition.
  },
})
```

Expected access:

```ts
counter.$()                 // { state, events }
counter.state.count.$()     // recursive signal path
counter.events.increment(1) // typed event input
counter.events.reset()      // typed event input
```

## Type signatures

### Signal-like inputs

```ts
export type SignalInput<T> =
  | T
  | Signal<T>
  | Observable<T>
```

The exact acceptance of `Observable<T>` is an open decision. An observable has no required
current value, so flattening it into current state needs an initial-value law or a distinct
asynchronous representation.

### Events

```ts
export type SignalEventMap = Record<PropertyKey, SignalEvent<unknown>>

export interface SignalEvent<Value> extends Observable<Value> {
  (value: Value): void
  readonly type?: PropertyKey
}

export type EventUnion<Events extends SignalEventMap> = {
  [Kind in keyof Events]: {
    type: Kind
    value: EventValue<Events[Kind]>
  }
}[keyof Events]

export type EventValue<Event> =
  Event extends SignalEvent<infer Value> ? Value : never
```

The `void` event call shape needs an overload so `reset()` does not require an explicit
`undefined` argument.

### Slice

```ts
export interface SignalEpicSliceValue<
  State,
  Events extends SignalEventMap,
> {
  state: State
  events: Events
}

export type SignalEpicSlice<
  State,
  Events extends SignalEventMap,
> = Signal<SignalEpicSliceValue<State, Events>>
```

The runtime result must preserve the library's recursive proxy behavior. `state`, nested state
fields, and event fields remain addressable through the normal signal path machinery.

### Reducer and epic

```ts
export type SignalReducer<
  State,
  Events extends SignalEventMap,
> = (
  state: Readonly<State>,
  event: EventUnion<Events>,
) => State

export interface SignalEpicContext<
  State,
  Events extends SignalEventMap,
> {
  state: Signal<State>
  events: Events
  event$: Observable<EventUnion<Events>>
}

export type SignalEpic<
  State,
  Events extends SignalEventMap,
> = (
  context: SignalEpicContext<State, Events>,
) => Observable<EventUnion<Events>> | Subscription | void

export interface SignalImplementation<
  State,
  Events extends SignalEventMap,
> {
  events: Events
  reduce: SignalReducer<State, Events>
  epic?: SignalEpic<State, Events>
}
```

Candidate methods:

```ts
interface Signal<State> {
  scan$<Events extends SignalEventMap>(
    events: Events,
    reduce: SignalReducer<State, Events>,
  ): SignalEpicSlice<State, Events>

  impl$<Events extends SignalEventMap>(
    implementation: SignalImplementation<State, Events>,
  ): SignalEpicSlice<State, Events>
}
```

## Pseudocode bodies

```ts
function scan$(state, events, reduce) {
  const event$ = mergeTaggedEvents(events)

  const subscription = event$.subscribe(event => {
    const previous = state.$()
    const next = reduce(previous, event)
    state.$(next)
  })

  return attachSliceProxy({ state, events, subscription })
}
```

```ts
function impl$(state, implementation) {
  const slice = scan$(state, implementation.events, implementation.reduce)

  const epicSubscription = implementation.epic?.({
    state: slice.state,
    events: slice.events,
    event$: mergeTaggedEvents(slice.events),
  })

  return attachLifetime(slice, epicSubscription)
}
```

The pseudocode names behavior rather than final utilities. It does not require wrapper methods
around ordinary array or RxJS operations.

## Instance timeline and lifetimes

```text
construction
  -> existing State signal is retained
  -> event signals are created or accepted
  -> event streams merge into a tagged union
  -> reducer subscription starts
  -> optional epic subscription starts

event call
  -> event signal emits payload
  -> tagged event enters reducer
  -> reducer reads one State snapshot
  -> reducer returns next State
  -> State signal publishes once
  -> recursive child signal readers receive their relevant change
  -> epics may emit later typed events

disposal
  -> reducer subscription stops
  -> epic subscriptions stop
  -> external event producers detach
  -> state snapshot remains readable according to the base Signal lifetime law
```

The slice needs an explicit ownership rule. Candidate laws:

1. The slice owns subscriptions created by `scan$` and `impl$`.
2. User-supplied event signals remain externally usable and are not completed by slice disposal.
3. Event signals created inline by the slice may share the slice lifetime.
4. A React component never owns the application slice merely because it reads it.

## Storage, reads, writes, and uniqueness

### Storage

- State is stored once in the original `Signal<State>`.
- Events are transient stream values unless another operator explicitly retains them.
- Epics own no second state snapshot by default.
- Recursive signal paths are views over the root state rather than denormalized copies.
- Subscriptions are owned by the slice lifetime, outside React component state.

### Read sequence

1. Reducer reads the current root state once per event.
2. Recursive accessors read their path from that root snapshot.
3. Epics receive the same state signal and merged event stream.
4. JSX auto-tracking subscribes only to recursive paths read during render.

### Write sequence

1. An event constructor emits one typed payload.
2. The tagged event stream identifies its event key.
3. The reducer calculates one next root state.
4. The root signal writes once.
5. Existing recursive signal invalidation determines which readers observe a change.

### Uniqueness

- One event key maps to one event constructor within a slice.
- One event occurrence receives one tagged union value.
- One event occurrence causes at most one reducer state write.
- Event constructors retain stable identity for the slice lifetime.
- Recursive signal path identity follows the existing Signal proxy cache law.

## Awaited-style signal flattening

The desired type operation recursively unwraps signal-like values in the same spirit as
`Awaited<T>`:

```ts
export type Unsignal<T> =
  T extends Signal<infer Value> ? Unsignal<Value> :
  T extends Observable<infer Value> ? Unsignal<Value> :
  T extends readonly unknown[] ? { [Key in keyof T]: Unsignal<T[Key]> } :
  T extends object ? { [Key in keyof T]: Unsignal<T[Key]> } :
  T
```

Questions that must be answered before implementation:

- whether `Signal<T>` and `Signal$<T>` unwrap identically;
- whether a plain `Observable<T>` can participate without an initial value;
- whether functions, dates, maps, sets, branded primitives, and class instances are leaves;
- how optional and readonly fields survive recursion;
- where recursion-depth limits prevent TypeScript instantiation blowups;
- whether tuples retain tuple identity;
- whether event constructors remain callable instead of being structurally flattened;
- whether nested signals are adopted by reference or mirrored into the root state;
- how runtime flattening corresponds exactly to type flattening.

Candidate guarded form:

```ts
export type Unsignal<T, Depth extends number = 8> =
  Depth extends 0 ? T :
  T extends Signal<infer Value> ? Unsignal<Value, Prev<Depth>> :
  T extends SignalEvent<unknown> ? T :
  T extends (...args: any[]) => unknown ? T :
  T extends readonly unknown[] ? { [Key in keyof T]: Unsignal<T[Key], Prev<Depth>> } :
  T extends object ? { [Key in keyof T]: Unsignal<T[Key], Prev<Depth>> } :
  T
```

## Interaction with the JSX shim

```tsx
function Counter() {
  return (
    <section>
      <output>{counter.state.count.$()}</output>
      <button onClick={() => counter.events.increment(1)}>+</button>
      <button onClick={() => counter.events.reset()}>reset</button>
    </section>
  )
}
```

The signals JSX runtime tracks `counter.state.count.$()` automatically. Event calls do not
create React state. The slice, reducer, and epics outlive any individual renderer component.

## Open design questions

1. Does `SignalEpicSlice.$()` return `{ state: State, events: Events }`, or should event
   constructors exist only as properties outside the current-value snapshot?
2. Does `scan$` return a new root proxy or augment the existing state proxy?
3. What explicit disposal API owns reducer and epic subscriptions?
4. Can an epic synchronously emit another event, and what bounds reentrant event chains?
5. Are reducer writes scheduled immediately, queued on a microtask, or delegated to a supplied
   RxJS scheduler?
6. How are reducer exceptions represented: thrown, error event, diagnostic stream, or slice
   terminal state?
7. Does one event batch produce one root write when multiple synchronous events arrive?
8. How are event history and replay attached without making every slice retain all events?
9. Which names survive after comparing `impl$`, `scan$`, `reduce$`, and an explicit constructor?

## Typed state-machine layer

The slice can carry a state machine whose authored unit reads directly as:

```text
state X -> event XY -> state Y
```

### Compact transition tuples

```ts
const events = {
  start: Signal.event<{ command: string }>(),
  succeed: Signal.event<{ output: string }>(),
  fail: Signal.event<{ error: Error }>(),
  retry: Signal.event<void>(),
}

const task = Signal({
  state: "idle" as const,
}).machine$(events, [
  ["idle", events.start, "running"],
  ["running", events.succeed, "done"],
  ["running", events.fail, "failed"],
  ["failed", events.retry, "running"],
] as const)
```

This form records topology and can supply a default transition that only changes the state tag.
State payload changes use a fourth tuple member:

```ts
const task = Signal<TaskState>({ state: "idle" }).machine$(events, [
  ["idle", events.start, "running", ({ event }) => ({
    state: "running",
    command: event.command,
    startedAt: performance.now(),
  })],

  ["running", events.succeed, "done", ({ state, event }) => ({
    state: "done",
    command: state.command,
    output: event.output,
  })],

  ["running", events.fail, "failed", ({ state, event }) => ({
    state: "failed",
    command: state.command,
    error: event.error,
  })],
] as const)
```

### State union

```ts
type TaskState =
  | { state: "idle" }
  | { state: "running"; command: string; startedAt: number }
  | { state: "done"; command: string; output: string }
  | { state: "failed"; command: string; error: Error }
```

The discriminant name should be configurable while defaulting to `state`:

```ts
type StateTag<MachineState> =
  MachineState extends { state: infer Tag extends PropertyKey } ? Tag : never

type InState<MachineState, Tag extends StateTag<MachineState>> =
  Extract<MachineState, { state: Tag }>
```

### Transition type

```ts
export type Transition<
  MachineState extends { state: PropertyKey },
  Events extends SignalEventMap,
  From extends StateTag<MachineState>,
  EventKey extends keyof Events,
  To extends StateTag<MachineState>,
> = readonly [
  from: From,
  event: Events[EventKey],
  to: To,
  reduce?: (input: {
    state: InState<MachineState, From>
    event: EventValue<Events[EventKey]>
  }) => InState<MachineState, To>,
]
```

The type checks:

- `from` is a member of the state union;
- `to` is a member of the state union;
- the reducer receives the narrowed `from` state;
- the reducer receives the selected event payload;
- the reducer returns the narrowed `to` state;
- a tuple without a reducer is accepted only when changing the discriminant produces a valid
  target state without additional required fields.

### Named transition helper

TypeScript inference across a heterogeneous tuple array may require a helper at each row. The
helper retains the visual transition form:

```ts
const t = defineTransitions<TaskState, typeof events>()

const transitions = [
  t("idle", events.start, "running", ({ event }) => ({
    state: "running",
    command: event.command,
    startedAt: performance.now(),
  })),
  t("running", events.succeed, "done", ({ state, event }) => ({
    state: "done",
    command: state.command,
    output: event.output,
  })),
] as const
```

The helper only provides contextual inference and returns the tuple unchanged.

### Object-table form

An alternative removes repeated `from` values:

```ts
const task = Signal<TaskState>({ state: "idle" }).machine$({
  events,
  states: {
    idle: {
      start: transition.to("running", ({ event }) => ({
        state: "running",
        command: event.command,
        startedAt: performance.now(),
      })),
    },
    running: {
      succeed: transition.to("done", ({ state, event }) => ({
        state: "done",
        command: state.command,
        output: event.output,
      })),
      fail: transition.to("failed", ({ state, event }) => ({
        state: "failed",
        command: state.command,
        error: event.error,
      })),
    },
    failed: {
      retry: transition.to("running", ({ state }) => ({
        state: "running",
        command: state.command,
        startedAt: performance.now(),
      })),
    },
    done: {},
  },
})
```

This form enables exhaustive state keys and direct `(state, event)` lookup. The tuple form is
better suited to graph projection, D2 emission, transition filtering, and source ordering. Both
can lower to one normalized transition array.

### Resulting slice

```ts
export interface SignalMachineSlice<
  MachineState extends { state: PropertyKey },
  Events extends SignalEventMap,
  Transitions extends readonly TransitionRow[],
> extends SignalEpicSlice<MachineState, Events> {
  readonly transitions: Transitions
  readonly transition$: Observable<TransitionOccurrence<MachineState, Events>>
  can<EventKey extends keyof Events>(event: EventKey): boolean
  send<EventKey extends keyof Events>(
    event: EventKey,
    value: EventValue<Events[EventKey]>,
  ): TransitionResult
}
```

Direct event calls remain available:

```ts
task.events.start({ command: "cargo test" })
```

`send()` is the inspected form when a caller needs `accepted`, `rejected`, or transition
metadata:

```ts
const result = task.send("start", { command: "cargo test" })
```

### Runtime transition occurrence

```ts
export interface TransitionOccurrence<
  MachineState,
  Events extends SignalEventMap,
> {
  sequence: number
  at: number
  from: StateTag<MachineState>
  event: EventUnion<Events>
  to: StateTag<MachineState>
  previous: MachineState
  next: MachineState
}
```

The occurrence is an RxJS event. Current machine state remains in the signal. History is opt-in
through the existing history primitives rather than retained automatically by every machine.

### Machine instance timeline

```text
construction
  -> normalize tuple or object transitions
  -> index transitions by (from state, event identity)
  -> subscribe once to the merged event stream

event
  -> read current discriminant
  -> look up (current state, event)
  -> reject or report an absent transition
  -> narrow the current state to the authored from-state
  -> run the transition reducer
  -> verify or assert the authored to-state in development
  -> write the next root state once
  -> emit one TransitionOccurrence

epic
  -> observe events, state, or transition occurrences
  -> emit another typed event when required

disposal
  -> remove event and epic subscriptions
  -> stop transition occurrences
```

### State-specific event typing after narrowing

The machine can expose legal event keys for a known state snapshot:

```ts
type EventsFrom<
  Transitions,
  From,
> = Transitions extends readonly [From, infer Event, PropertyKey, ...unknown[]]
  ? Event
  : never
```

Runtime state cannot make `task.events` change its static type between statements. A narrowed
handle can:

```ts
task.when("running", running => {
  running.state        // InState<TaskState, "running">
  running.events.fail  // present
  running.events.start // type error
})
```

Candidate signature:

```ts
when<Tag extends StateTag<MachineState>, Result>(
  tag: Tag,
  run: (machine: MachineAt<MachineState, Events, Transitions, Tag>) => Result,
): Result | undefined
```

### Machine topology as data

The normalized transition array is directly reusable:

```text
typed transition table
  -> runtime lookup
  -> test matrix
  -> D2 state diagram
  -> grapht projection
  -> transition coverage report
  -> allowed-event UI controls
```

No renderer or graph dependency enters the signals package. Consumers read the transition data
and project it independently.

### Machine open questions

1. Whether invalid events are ignored, returned as `rejected`, emitted to diagnostics, or throw
   in development.
2. Whether direct event constructor calls expose rejection results or remain `void` stream
   inputs.
3. Whether multiple transitions may share the same `(from, event)` pair with guards.
4. If guards exist, how their priority and exhaustiveness are represented.
5. Whether entry, exit, and transition effects are events or machine callbacks.
6. Whether hierarchical and parallel states belong in the first version.
7. Whether transition reducers may return the same state tag for internal transitions.
8. How reentrant synchronous events queue relative to the current reducer write.
9. Whether state payloads may contain adopted nested signals under the final `Unsignal` law.
10. Whether the normalized transition table receives stable authored IDs for revision diffing.

## Route-native state machines

The machine can treat both states and events as typed URLs. Pathname and route parameters
identify the state. Query parameters carry the serializable machine context. Hash fragments can
carry viewport-local focus without changing the underlying domain state.

### Existing endgame foundations

This design must extend the two existing packages rather than introduce the illustrative
`route.state`, `route.event`, and `param.*` calls used below as design notation.

`@hafley66/path` currently supplies the pure typed route:

```ts
const Changed = route(
  `/panel/${NumberPathParam("id")}/flagged/${BooleanPathParam("on")}`,
  z.object({
    revision: z.coerce.number(),
    view: z.enum(["graph", "table"]).optional(),
  }),
  z.object({
    changed: z.boolean(),
    rows: z.array(z.string()),
  }),
)

Changed.href({
  id: 42,
  on: true,
  revision: 7,
  changed: true,
  rows: ["a"],
})
// /panel/42/flagged/true?revision=7

Changed.match("/panel/42/flagged/true?revision=7")
// typed path and query values; payload is intentionally absent from URL output
```

Its actual contract is:

```ts
export interface PulseRoute<Path extends string, FullInput, FullOutput, UrlOut> {
  readonly path: Path
  readonly schema: z.ZodType<FullOutput, FullInput>
  href(value: FullInput): string
  match(text: string): PathMatch<UrlOut>
}
```

`@hafley66/signals` currently supplies the live browser route signal:

```ts
const repo = Route("/repos/:owner/:repo")

repo.$()
// { owner, repo, query fields, path, matched }

repo.href({ owner: "hafley", repo: "instant", panel: "activity" })
repo.navigate({ owner: "hafley", repo: "instant", panel: "activity" })
repo.back()
repo.forward()
```

Its actual contract is:

```ts
export type RouteSignal<S extends string> = Signal<RouteValue<S>> & {
  template: S
  href(values: RouteNavigation<S>): string
  navigate(values: RouteNavigation<S>, options?: { replace?: boolean }): void
  back(): void
  forward(): void
}
```

The endgame seam is a typed live signal over a `PulseRoute`:

```ts
export interface PulseRouteSignal<Route extends AnyPulseRoute>
  extends Signal<RouteMatchOutput<Route>> {
  readonly route: Route
  href(value: RouteInput<Route>): string
  navigate(value: RouteInput<Route>, options?: { replace?: boolean }): void
  match(url: string): PathMatch<RouteUrlOutput<Route>>
  back(): void
  forward(): void
}

export declare function Route<Route extends AnyPulseRoute>(
  route: Route,
): PulseRouteSignal<Route>
```

This combines:

```text
@hafley66/path
  template parsing
  typed scalar path parameters
  Zod query parsing
  payload parsing
  href and match

@hafley66/signals
  current location signal
  popstate stream
  navigation events
  recursive path and query access
  JSX automatic dependency tracking
```

Route state machines are the next composition over this seam:

```ts
routeMachine({
  states: Record<string, PulseRoute>,
  events: Record<string, PulseRoute>,
  transitions: readonly RouteTransition[],
})
```

State context uses path plus query output. Event URL arguments use path plus query. The existing
payload schema remains available for non-URL values, with the explicit law that payload values
do not survive copy, reload, history traversal, or opening the URL in another process. An event
that must be completely reproducible places its arguments in path or query fields.

```text
URL state X
  -> URL event XY
  -> URL state Y
```

Example:

```text
/tasks/42/idle?attempt=0
  -> /tasks/42/events/start?command=cargo%20test
  -> /tasks/42/running?attempt=1&startedAt=1786377600000
```

### Route state and route event types

```ts
export interface RouteState<
  Name extends string,
  Path,
  Query,
> {
  readonly kind: "state"
  readonly name: Name
  readonly path: Path
  readonly query: Query
  href(input: Path & Query): string
}

export interface RouteEvent<
  Name extends string,
  Path,
  Query,
> extends SignalEvent<Path & Query> {
  readonly kind: "event"
  readonly name: Name
  readonly path: Path
  readonly query: Query
  href(input: Path & Query): string
}
```

State definitions below use design notation. The lowering target is the existing
`@hafley66/path.route(pathTemplate, querySchema, payloadSchema)` call.

State definitions:

```ts
const states = {
  idle: route.state("/tasks/:task/idle", {
    path: { task: param.string() },
    query: { attempt: param.number().default(0) },
  }),

  running: route.state("/tasks/:task/running", {
    path: { task: param.string() },
    query: {
      attempt: param.number(),
      startedAt: param.number(),
    },
  }),

  done: route.state("/tasks/:task/done", {
    path: { task: param.string() },
    query: { output: param.string().optional() },
  }),
}
```

Event definitions below use the same design notation and lower to ordinary `PulseRoute`
definitions marked as event routes by their machine membership.

Event definitions:

```ts
const events = {
  start: route.event("/tasks/:task/events/start", {
    path: { task: param.string() },
    query: { command: param.string() },
  }),

  succeed: route.event("/tasks/:task/events/succeed", {
    path: { task: param.string() },
    query: { output: param.string() },
  }),

  fail: route.event("/tasks/:task/events/fail", {
    path: { task: param.string() },
    query: { error: param.string() },
  }),
}
```

### Route transition declaration

```ts
const task = route.machine({
  states,
  events,
  initial: states.idle,
  transitions: [
    [states.idle, events.start, states.running],
    [states.running, events.succeed, states.done],
    [states.running, events.fail, states.failed],
  ],
})
```

The route objects replace string state and event names in the transition table. Their object
identity and typed schemas provide the topology keys.

```ts
task.send(events.start, {
  task: "42",
  command: "cargo test",
})

task.href(events.start, {
  task: "42",
  command: "cargo test",
})
```

Both calls describe the same event URL. `href()` only serializes it. `send()` feeds it through
the machine and selected history adapter.

### URL-backed machine snapshot

```ts
export interface RouteMachineSnapshot<
  State extends RouteState<string, unknown, unknown>,
> {
  state: State
  url: URL
  pathname: string
  path: RoutePathOf<State>
  query: RouteQueryOf<State>
  hash: string
  navigation: "push" | "replace" | "pop" | "initial"
}
```

The XState-like context is the typed combination of path parameters and query parameters:

```ts
type RouteContext<State extends RouteState<string, unknown, unknown>> =
  RoutePathOf<State> & RouteQueryOf<State>
```

The machine does not maintain another context object that can diverge from the URL. Non-URL
application data remains in separate signals keyed by route identity.

### Transition reducer

The transition reducer receives decoded source context and decoded event context, then returns
the target route context:

```ts
transition(
  states.idle,
  events.start,
  states.running,
  ({ state, event }) => ({
    task: state.path.task,
    attempt: state.query.attempt + 1,
    startedAt: Date.now(),
  }),
)
```

The type checker verifies the return value can produce the target state URL.

### Browser timeline

```text
initial document URL
  -> parse matching state route
  -> decode path and query context
  -> publish machine snapshot

event link or send()
  -> parse typed event URL
  -> find transition by (current state route, event route)
  -> calculate target route context
  -> serialize target state URL
  -> pushState or replaceState
  -> publish transition occurrence and state snapshot

popstate
  -> parse historical state URL
  -> publish snapshot with navigation = "pop"
  -> suppress command effects by default
  -> retain history as browser-owned machine history
```

Back and forward navigation therefore replay state locations without pretending the original
external effects should execute again.

### Links are event dispatchers

```tsx
function StartTask({ task }: { task: string }) {
  return (
    <a href={machine.href(events.start, { task, command: "cargo test" })}>
      start
    </a>
  )
}
```

The host intercepts same-machine event URLs and calls `machine.sendUrl(url)`. Copying, opening in
another tab, browser status display, and ordinary link inspection retain meaningful URLs.

```ts
machine.sendUrl(new URL(anchor.href))
```

### URL event identity

An event occurrence has two identities:

```ts
export interface RouteEventOccurrence<Event extends RouteEvent<string, unknown, unknown>> {
  definition: Event
  url: URL
  path: RoutePathOf<Event>
  query: RouteQueryOf<Event>
  sequence: number
  at: number
}
```

The route definition identifies the event kind. The complete normalized URL identifies its
serializable arguments. Sequence and time identify one runtime occurrence when the same URL is
sent repeatedly.

### Query context laws

- Query schemas supply parsing, serialization, defaults, optionality, and validation.
- Serialization has a canonical key order so equivalent context produces one URL string.
- Defaults may be omitted from the URL while appearing in decoded context.
- Unknown query keys require an explicit preserve, reject, or drop policy.
- Sensitive or large values do not enter query context; state stores a stable reference instead.
- Non-serializable values such as `Error`, functions, subscriptions, and DOM nodes remain outside
  route context.
- Route state is reconstructable from the URL after reload.

### State-machine routing composition

Machines can mount below a parent route:

```ts
const workspace = route.machine("/workspaces/:workspace", {
  path: { workspace: param.string() },
  states: taskStates,
  events: taskEvents,
  transitions,
})
```

Parent parameters flow into state and event URLs without repeating their schemas. Nested machine
composition should follow the existing route and `Param<T>` work rather than introduce another
path-template system.

### Route-machine projections

```text
route states
  -> tabs and dock locations
  -> breadcrumbs
  -> state-machine graph nodes
  -> D2 state diagrams

route events
  -> links and buttons
  -> graph edges
  -> command palette actions
  -> transition coverage

query context
  -> filters
  -> table state
  -> selected entities
  -> camera and revision coordinates where serializable
```

### Route-machine open questions

1. Whether event URLs receive a reserved path segment such as `/events/` or use ordinary route
   definitions with `kind: "event"` metadata.
2. Whether direct navigation to an event URL executes the event, displays an event resource, or
   redirects through its transition.
3. Which events use `pushState`, `replaceState`, or no navigation.
4. How server rendering or deep links resolve an event URL without an in-memory source state.
5. Whether an event URL includes an expected source-state or revision token for stale-event
   rejection.
6. How concurrent tabs coordinate route-backed machines.
7. Which query parameters belong to domain state versus view state.
8. Whether hash fragments are owned by nested selection, source position, or camera focus.
9. How route machine definitions compose with the existing `Param<T>` and route package without
   duplicating runtime parsing.
10. Whether route definitions and transition tables need authored stable IDs for grapht revision
    comparison.

## Deferred tests

- Event map infers a discriminated union without annotations.
- `void` events call with zero arguments.
- Each event causes one reducer call and at most one root write.
- Recursive path readers observe only relevant writes.
- Conditional JSX reads unsubscribe through the existing JSX tracking behavior.
- Dynamic event arguments containing signals flatten according to the final `Unsignal` law.
- Tuples, readonly fields, optionals, branded values, and recursive types retain their intended
  type structure.
- Reentrant events have deterministic ordering and a bounded policy.
- Disposal removes reducer and epic subscriptions.
- Two slice instances share no event constructors or subscriptions unless explicitly supplied.
- Type snapshots cover inference and recursion-depth diagnostics.
- Transition tuples reject unknown from-state and to-state tags.
- Transition reducers receive narrowed source state and event payload types.
- Transition reducers must return the declared target-state member.
- Reducer-free transitions reject target states with required payload fields.
- Illegal events produce the selected deterministic rejection behavior.
- One accepted event produces one state write and one transition occurrence.
- State-specific `when()` handles expose only legal outgoing events.
- Tuple and object-table declarations normalize to the same ordered transition rows.
- Transition topology can be serialized without functions after separating authored metadata
  from reducer implementations.
- State and event route schemas infer their path and query context.
- Route transition reducers return exactly the target route context.
- Canonical serialization produces one URL for equivalent query context.
- Reload reconstructs the same state snapshot from the state URL.
- `popstate` restores state without replaying command effects.
- Same-machine event links dispatch through `sendUrl()` while preserving their ordinary `href`.
- Invalid event URLs and events illegal from the current route state follow the selected
  deterministic rejection behavior.

## Non-goals for this plan

- Implementing the feature during the current UI consolidation thread.
- Moving application state into React.
- Replacing RxJS operators with slice-specific wrapper methods.
- Persisting every event automatically.
- Defining routing, grid, graph, or Instant-specific event vocabularies here.
- Selecting the final method names before type and lifetime tests exist.
