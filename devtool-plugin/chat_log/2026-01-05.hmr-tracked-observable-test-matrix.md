# HMR Tracked Observable Test Matrix

Critical edge case analysis for `trackedObservable`, `trackedSubject`, `trackedBehaviorSubject`, and the `__$` runtime.

## Table of Contents

1. [Instance Invariants](#1-instance-invariants)
2. [Completion Patterns (Sync vs Async)](#2-completion-patterns)
3. [Sync Replay Edge Cases](#3-sync-replay-edge-cases)
4. [Multicasting (share/shareReplay)](#4-multicasting-sharesharereplay)
5. [Arg Patterns](#5-arg-patterns)
6. [Higher-Order Operators](#6-higher-order-operators)
7. [Notifier Timing](#7-notifier-timing)
8. [Async Functions as Args](#8-async-functions-as-args)
9. [HMR Lifecycle](#9-hmr-lifecycle)
10. [Current Test Coverage Matrix](#10-current-test-coverage-matrix)

---

## 1. Instance Invariants

What must ALWAYS hold true for tracked entities:

### trackedObservable Invariants

| Invariant | Description | Risk if violated |
|-----------|-------------|------------------|
| **Stable ID permanence** | `stable_observable_id` never changes across HMR swaps | Subscribers lose reference, dangling subscriptions |
| **Mutable ID updates** | `mutable_observable_id` updates on each HMR swap | Emissions go to wrong source |
| **Single inner subscription** | Only one `innerSub` active at a time | Duplicate emissions, memory leak |
| **Watcher cleanup** | `watchSub` cleaned up on outer unsubscribe | Memory leak, state$$ bloat |
| **Loop detection** | `connectCallCount > 10` throws | Infinite loop crashes app |
| **Context restoration** | Module/track context pushed during inner subscribe | Defer factories lose tracking |
| **Unsub beats all** | JS is single-threaded; unsubscribe cannot be interrupted mid-swap | N/A - architectural reality |
| **Store-first lookup** | tryConnect/watchSub prefer `store.mutable_observable_id` over `initialMutableId` | Late subscribers connect to stale observable (shareReplay buffer bug) |

### trackedSubject Invariants

| Invariant | Description | Risk if violated |
|-----------|-------------|------------------|
| **Bi-directional sync** | proxy.next -> inner.next AND inner.next -> proxy subscribers | Missed emissions |
| **Loop prevention** | `isForwarding` flag prevents proxy->inner->proxy loop | Infinite loop, stack overflow |
| **Teardown chain** | Complete cascades through both proxy and inner | Orphaned subscriptions |

### trackedBehaviorSubject Additional Invariants

| Invariant | Description | Risk if violated |
|-----------|-------------|------------------|
| **Value sync** | `.value` getter returns inner's current value | Stale reads |
| **Initial value forwarding** | First subscriber gets inner's initial value, not proxy's | Wrong initial state |

### Architectural Note: Unified Subject Tracking

Current implementation has nearly identical bodies for `trackedSubject` and `trackedBehaviorSubject`. Future direction:

- **`trackedAnySubject`** - unified tracker for all Subject types
- Instrument every Subject constructor like a factory
- Emit event with constructor args (e.g., `new ReplaySubject(3)` → `{type: 'subject', subtype: 'replay', args: [3]}`)
- Flat data model since all shapes are similar

---

## 2. Completion Patterns

### Matrix: Sync × Termination

| Pattern | Sync/Async | Termination | Current Coverage | Test Needed |
|---------|-----------|-------------|------------------|-------------|
| `of(1,2,3)` | Sync | complete | `4_module-scope.test:274` | |
| `new Subject(); s.complete()` | Sync | complete (no next) | | **YES** |
| `new Subject(); s.next(1); s.complete()` | Sync | complete | `2_tracked-observable.test:118` | |
| `of(1,2,3).pipe(take(1e9))` | Sync | infinite (test timeout) | | **YES** - verify no memory leak |
| `timer(100)` | Async | complete (1 emit) | | **YES** |
| `timer(100).pipe(take(3))` | Async | complete (3 emit) | | **YES** |
| `interval(100)` | Async | infinite | | **YES** - verify cleanup |
| `throwError(() => new Error())` | Sync | error | | **YES** |
| `timer(100).pipe(switchMap(() => throwError))` | Async | error | | **YES** |

### Sync vs Async Emission Timing

**OPEN PROBLEM**: Sync vs async emit handling in tracked wrappers.

When inner observable emits DURING subscribe call (before subscribe-call-return):

```typescript
// Sync: of(1,2,3) - all emits happen synchronously during subscribe
const tracked$ = __$("sync", () => of(1,2,3))
tracked$.subscribe(v => console.log(v)) // 1,2,3 all logged before this returns

// Async: interval - emits after subscribe returns
const tracked$ = __$("async", () => interval(100))
tracked$.subscribe(v => console.log(v)) // returns immediately, logs later
```

**Invariant**: All sync emissions must flow through proxy before `innerSub` assignment completes.

**Key consideration for structural hash changes**: If tracking args like a factory observable to detect structural changes, sync vs async timing affects when we can compute the hash.

---

## 3. Sync Replay Edge Cases

### BehaviorSubject Sync Emit

```typescript
// Danger: Subscribe causes immediate emit which could trigger re-subscribe
const bs$ = __$("bs", () => new BehaviorSubject(0))

// This pattern is safe:
bs$.subscribe(v => console.log(v)) // Logs 0 immediately

// This pattern is DANGEROUS:
bs$.subscribe(v => {
  if (v === 0) bs$.next(1) // Does this cause issues?
})
```

**Tests Needed**:

| Scenario | Risk | Current Coverage |
|----------|------|------------------|
| BS: subscribe triggers immediate replay | Loop if replay triggers new sub | `3_tracked-subject:393` covers `.value` |
| BS: nested subscribe in callback | Potential loop | **NO** |
| BS: next() in subscribe callback | Re-entrancy | **NO** |
| ReplaySubject: buffered replay | Multiple sync emits | **NO** |
| ReplaySubject(3): partial buffer | Edge case in replay count | **NO** |

### Infinite Loop Detection

Current protection: `connectCallCount > 10` in `trackedObservable`.

**Test needed**: Verify protection triggers before stack overflow.

---

## 4. Multicasting (share/shareReplay)

Multicasting operators are particularly tricky because they manage subscription state, replay buffers, and reset behavior. The classic gotcha you just hit (`share()` before `startWith()` eating the initial value for late subscribers) is just the tip of the iceberg.

### share() Configuration

```typescript
share({
  connector: () => new Subject(),      // Default Subject factory
  resetOnError: true,                   // Reset on error? (default: false)
  resetOnComplete: true,                // Reset on complete? (default: false)
  resetOnRefCountZero: true,            // Reset when all unsub? (default: true)
})
```

### shareReplay() Configuration

```typescript
shareReplay({
  bufferSize: 1,                        // How many values to replay
  windowTime: undefined,                // Time window for buffer (ms)
  refCount: false,                      // Reset on refCount zero? (default: false)
})

// Shorthand
shareReplay(1)        // bufferSize=1, refCount=false (NEVER resets!)
shareReplay({refCount: true, bufferSize: 1})  // Resets on zero subscribers
```

### Critical Operator Order Bugs

```typescript
// BUG: share() before startWith - late subscribers miss initial
source$.pipe(share(), startWith(0))  // WRONG

// FIX: startWith before share
source$.pipe(startWith(0), share())  // OK but no replay

// BETTER: shareReplay for late subscribers
source$.pipe(startWith(0), shareReplay(1))  // Late subs get initial
```

### Test Matrix: share()

| Scenario | Config | Current Coverage | Risk |
|----------|--------|------------------|------|
| Basic multicast | default | **NO** | Duplicate emissions |
| Late subscriber | default | **NO** | Missed values |
| `resetOnComplete: false` | complete doesn't reset | **NO** | Stale source |
| `resetOnComplete: true` | complete resets source | **NO** | Re-subscription |
| `resetOnError: false` | error doesn't reset | **NO** | Error stuck |
| `resetOnError: true` | error resets source | **NO** | Silent retry |
| `resetOnRefCountZero: false` | keeps source hot | **NO** | Memory leak |
| `resetOnRefCountZero: true` | cold restart | **NO** | Data loss |
| Custom connector (ReplaySubject) | advanced | **NO** | Replay bugs |
| HMR swap while shared | tracked | **NO** | Subscriber desync |

### Test Matrix: shareReplay()

| Scenario | Config | Current Coverage | Risk |
|----------|--------|------------------|------|
| Basic replay(1) | `shareReplay(1)` | **NO** | - |
| Late subscriber gets replay | `shareReplay(1)` | **NO** | Missed replay |
| `refCount: false` (default) | never resets | **NO** | **Memory leak** - source stays subscribed forever |
| `refCount: true` | resets on zero | **NO** | Replay buffer lost |
| Buffer overflow | `shareReplay(3)` + 5 values | **NO** | Wrong values |
| `windowTime` expiry | `{bufferSize:1, windowTime:100}` | **NO** | Stale data |
| Complete with `refCount:false` | stays complete | **NO** | Dead stream |
| Error with `refCount:false` | stays errored | **NO** | **Stuck error** |
| HMR swap with active replay | tracked | **NO** | Buffer desync |

### HMR-Specific Concerns

```typescript
// Scenario: tracked shared observable
const data$ = __$("data", () =>
  source$.pipe(
    switchMap(id => fetch(`/api/${id}`)),
    shareReplay(1)
  )
)

// On HMR swap:
// 1. Inner source replaced
// 2. But shareReplay's internal ReplaySubject still holds old buffer
// 3. New subscribers get stale cached value before fresh data
```

**Questions**:
- Should HMR swap clear shareReplay buffer?
- How do we track the internal ReplaySubject?
- Does `refCount:true` help (forces cold restart on swap)?

### Operator Composition Gotchas

| Pattern | Problem | Fix |
|---------|---------|-----|
| `share().pipe(startWith(x))` | startWith runs per-subscriber | Move startWith before share |
| `shareReplay(1).pipe(take(1))` | Each sub takes 1 from replay | Usually fine, but confusing |
| `share().pipe(filter(...))` | Filter runs per-subscriber | Move filter before share |
| `shareReplay(1).pipe(distinctUntilChanged())` | Distinct per-sub, not global | Move before shareReplay |
| `switchMap(...).pipe(share())` | Inner cancellation shared | Usually intentional |
| `share().pipe(switchMap(...))` | Each subscriber gets own inner | Probably a bug |

### Priority Tests for Multicasting

**P0 - Will Cause Production Bugs**:
1. `shareReplay(1)` with `refCount:false` memory leak verification
2. `share()` before `startWith()` late subscriber test
3. Error propagation with `resetOnError` variants
4. HMR swap with active shareReplay buffer

**P1 - Common Patterns**:
1. `shareReplay({refCount:true, bufferSize:1})` lifecycle
2. `share()` resetOnRefCountZero behavior
3. Multiple subscribers join/leave timing
4. Complete propagation to all subscribers

**P2 - Edge Cases**:
1. `windowTime` buffer expiry
2. Custom connector factories
3. Nested share (share inside shareReplay)

---

## 5. Arg Patterns

### Existing Infrastructure

The `arg` and `arg_call` entities already exist in the event model for tracking arguments. Current implementation is rough but will be unified later into the flat `Call`/`Arg` model.

Current path convention: `$args.0`, `$args.0.delay.$return`, etc.

### Observable Args to Operators

| Pattern | Operator Type | Arg Position | Current Coverage |
|---------|--------------|--------------|------------------|
| `source$.pipe(mergeWith(other$))` | Pipeable join | `$args.0` | **NO** |
| `source$.pipe(combineLatestWith(a$, b$))` | Pipeable join | `$args.0`, `$args.1` | **NO** |
| `source$.pipe(withLatestFrom(other$))` | Pipeable join | `$args.0` | **NO** |
| `merge(a$, b$, c$)` | Creation | spread args | **NO** |
| `combineLatest([a$, b$])` | Creation | array arg | **NO** |
| `forkJoin({a: a$, b: b$})` | Creation | object arg | **NO** |
| `race([a$, b$])` | Creation | array arg | **NO** |

**Question**: When `other$` is itself a tracked observable, how do we track the relationship?
- We already have arg-call for function args
- Observable args need similar tracking

### Chained Arg Paths

Pattern: `$args.0.someMethod.$return`

```typescript
// Example: repeat with delay
source$.pipe(
  repeat({
    delay: () => timer(1000)  // $args.0.delay.$return = the timer observable
  })
)

// Full path: repeat.$args.0.delay.$return
```

| Pattern | Current Coverage |
|---------|------------------|
| `repeat({ delay: () => timer(n) })` | **NO** |
| `retryWhen(errors$ => errors$.pipe(...))` | **NO** |
| `bufferWhen(() => timer(n))` | **NO** |
| `windowWhen(() => timer(n))` | **NO** |
| `delayWhen(() => timer(n))` | **NO** |

---

## 6. Higher-Order Operators

### Inner Observable Lifecycle

| Operator | Inner Created | Inner Destroyed | Test Priority |
|----------|--------------|-----------------|---------------|
| `switchMap` | Each outer emit | Previous killed on new outer | HIGH |
| `mergeMap` | Each outer emit | On complete/error | HIGH |
| `concatMap` | After prev complete | On complete/error | MEDIUM |
| `exhaustMap` | When not busy | On complete/error | MEDIUM |
| `expand` | Recursive | Accumulates | LOW |

**HMR Concern**: When outer observable HMR swaps, what happens to active inner subscriptions?

```typescript
const trigger$ = __$("trigger", () => new Subject<number>())
const data$ = __$("data", $ =>
  trigger$.pipe(
    switchMap(id => $("fetch", () => fetch(`/api/${id}`)))
  )
)
```

### scan/reduce with Accumulator

```typescript
const scanned$ = __$("scanned", () =>
  source$.pipe(
    scan((acc, val) => {
      // If acc is an observable, it needs tracking
      return acc.pipe(map(a => a + val))
    }, of(0))
  )
)
```

**Tests Needed**:

| Scenario | Complexity | Coverage |
|----------|------------|----------|
| switchMap with tracked inner | High | `5_react-query:58` partial |
| mergeMap with multiple concurrent inners | High | **NO** |
| scan with observable accumulator | High | **NO** |
| expand recursive inner | Very High | **NO** |

---

## 7. Notifier Timing

### Eager vs Lazy Notifiers

| Operator | Notifier Timing | Description |
|----------|-----------------|-------------|
| `takeUntil(notifier$)` | EAGER | Subscribes to notifier immediately at pipe time |
| `skipUntil(notifier$)` | EAGER | Subscribes to notifier immediately |
| `repeat({ delay: () => obs$ })` | LAZY | Only calls factory after complete |
| `retry({ delay: () => obs$ })` | LAZY | Only calls factory after error |
| `bufferWhen(() => obs$)` | LAZY | Calls factory for each buffer |
| `debounce(() => obs$)` | LAZY | Calls factory for each value |

**HMR Implications**:

```typescript
// takeUntil - subscribed BEFORE user subscribe
const limited$ = __$("limited", () =>
  source$.pipe(
    takeUntil(__$("stopper", () => stopper$))
  )
)
// stopper$ subscription exists even before limited$.subscribe()!

// repeat delay - NOT subscribed until first complete
const repeated$ = __$("repeated", () =>
  source$.pipe(
    repeat({
      delay: () => __$("delay", () => timer(1000))
    })
  )
)
// delay timer NOT subscribed until source$ completes
```

**Tests Needed**:

| Scenario | Timing | Coverage |
|----------|--------|----------|
| takeUntil with tracked notifier | Eager | **NO** |
| skipUntil with tracked notifier | Eager | **NO** |
| repeat delay factory | Lazy | **NO** |
| retryWhen handler | Lazy | **NO** |
| debounce selector | Lazy, per value | **NO** |

---

## 8. Async Functions as Args

### Syntax Transform Requirement

**Key insight**: Tracking async functions requires a syntax transform BEFORE every async function inside a decorated `__$` block.

```typescript
// Original user code
const data$ = __$("data", () =>
  trigger$.pipe(
    switchMap(async (id) => {
      const res = await fetch(`/api/${id}`)
      return res.json()
    })
  )
)

// What we'd need to transform to
const data$ = __$("data", () =>
  trigger$.pipe(
    switchMap(__$async("switchMapCallback", async (id) => {
      const res = await fetch(`/api/${id}`)
      return res.json()
    }))
  )
)
```

This is a significant syntax transform complexity - every async function inside `__$` would need wrapping.

### Patterns Requiring Transform

| Pattern | Complexity | Notes |
|---------|------------|-------|
| `from(promiseFactory)` | Medium | Promise factory is async |
| `from(asyncIterable)` | Medium | Async generator |
| `switchMap(async () => ...)` | High | Async callback |
| `tap(async () => ...)` | High | Side-effect async |
| `filter(async () => ...)` | N/A | RxJS doesn't support async predicates |

### Alternative: Track Promise Resolution

Instead of transforming syntax, we could:
1. Detect when a callback returns a Promise
2. Track the Promise resolution as an event
3. Attribute the result to the parent call

This is less precise but requires no syntax changes.

---

## 9. HMR Lifecycle

### Source Swap Timing

| Phase | State | Invariant |
|-------|-------|-----------|
| Module start | Push module context | Module stack has entry |
| Track call | Push track to stack | Track in stack.hmr_track |
| Factory execute | Create inner observable | mutable_observable_id set |
| Track return | Pop track, update store | store.hmr_track updated |
| Module end | Pop module, orphan cleanup | prev_keys processed |

### Orphan Detection

```typescript
// v1: create obs1, obs2
const __$1 = _rxjs_debugger_module_start("file:///a.ts")
__$1("obs1", () => new Subject())
__$1("obs2", () => new Subject())  // Will be orphaned in v2
__$1.end()

// v2: only re-create obs1
const __$2 = _rxjs_debugger_module_start("file:///a.ts")
__$2("obs1", () => new Subject())
// obs2 NOT recreated - it's an orphan
__$2.end()
```

**Tests Needed**:

| Scenario | Current Coverage |
|----------|------------------|
| Orphan detection basic | `4_module-scope:107` |
| Orphan with active subscription | `4_module-scope:149` |
| Orphan with inner subscriptions (switchMap active) | **NO** |
| Orphan with pending async work | **NO** |
| Orphan cleanup ordering (parent before child?) | **NO** |

---

## 10. Current Test Coverage Matrix

### Legend
-  Covered
-  Partial/Weak
-  Not Covered

### Core trackedObservable

| Test Case | Coverage | File:Line |
|-----------|----------|-----------|
| Basic subscribe + emissions |  | `2_tracked-observable:14` |
| HMR source swap |  | `2_tracked-observable:32` |
| Subscription survives swap |  | `2_tracked-observable:65` |
| Cleanup on unsubscribe |  | `2_tracked-observable:87` |
| Hot source with pipe |  | `2_tracked-observable:102` |
| Forward complete |  | `2_tracked-observable:118` |
| Forward complete after swap |  | `2_tracked-observable:136` |
| Forward error |  | - |
| Sync complete (of) |  | `4_module-scope:274` |
| Async complete (timer) |  | - |
| Async infinite (interval) |  | - |

### trackedSubject Bi-Sync

| Test Case | Coverage | File:Line |
|-----------|----------|-----------|
| proxy.next -> inner |  | `0_runtime:272` |
| inner.next -> proxy |  | `0_runtime:304` |
| Bidirectional complete |  | `0_runtime:329` |
| inner.complete -> proxy |  | `0_runtime:351` |
| No infinite loop |  | `0_runtime:366` |

### trackedBehaviorSubject

| Test Case | Coverage | File:Line |
|-----------|----------|-----------|
| getValue returns inner |  | `0_runtime:393` |
| .value returns inner |  | `0_runtime:393` |
| proxy.next updates inner |  | `0_runtime:404` |
| inner.next updates proxy |  | `0_runtime:417` |
| bi-sync next/complete |  | `0_runtime:430` |
| Sync replay on subscribe |  | - |
| Nested subscribe in callback |  | - |

### HMR Module Lifecycle

| Test Case | Coverage | File:Line |
|-----------|----------|-----------|
| Module creates hmr_module |  | `4_module-scope:13` |
| Version increments on reload |  | `4_module-scope:30` |
| module_id stamped on tracks |  | `4_module-scope:54` |
| Nested keys concatenate |  | `4_module-scope:64` |
| prev_keys snapshot on reload |  | `4_module-scope:89` |
| Orphan cleanup - delete track |  | `4_module-scope:107` |
| Orphan cleanup - complete wrapper |  | `4_module-scope:107` |
| Orphan cleanup - unsub via sub_ref |  | `4_module-scope:149` |

### Higher-Order Operators

| Test Case | Coverage | File:Line |
|-----------|----------|-----------|
| switchMap callback |  | `5_react-query:58` |
| defer lazy execution |  | `5_react-query:97` |
| Nested track in defer |  | `5_react-query:131` |
| mergeMap concurrent inners |  | - |
| scan with observable |  | - |

### Arg Patterns

| Test Case | Coverage | File:Line |
|-----------|----------|-----------|
| Observable as mergeWith arg |  | - |
| Observable as takeUntil arg |  | - |
| Factory as repeat delay |  | - |
| Async function as arg |  | - |

### Plumbing Detection

| Test Case | Coverage | File:Line |
|-----------|----------|-----------|
| Wrapper->inner sub skipped |  | `6_plumbing-detection:66` |
| Both stable/mutable IDs set |  | `6_plumbing-detection:126` |
| Subscription stack context |  | `6_plumbing-detection:148` |

---

## Priority Test Additions

### P0 - Must Have (Risk: Infinite Loop / Memory Leak)

1. **BehaviorSubject nested subscribe in callback** - Re-entrancy protection
2. **Infinite sync stream (of with take(1e9))** - Memory pressure
3. **Async interval cleanup** - Timer leak on unsubscribe
4. **Loop detection verification** - Confirm protection triggers

### P1 - Should Have (Core Functionality)

1. **Forward error through wrapper** - Error handling path
2. **mergeMap concurrent inner tracking** - Common pattern
3. **Observable as mergeWith arg** - Arg tracking
4. **takeUntil eager subscription** - Notifier lifecycle

### P2 - Nice to Have (Edge Cases)

1. **ReplaySubject buffered replay**
2. **scan with observable accumulator**
3. **Async function in switchMap** (requires syntax transform decision)
4. **expand recursive patterns**

---

## Open Questions

1. **Sync vs Async emit timing**
   - OPEN PROBLEM: How to uniformly handle sync (of) vs async (interval) emissions?
   - Affects when we can compute structural hash
   - Args might include factory observables

2. **Unified Subject tracking**
   - Current: Separate `trackedSubject`, `trackedBehaviorSubject`
   - Future: `trackedAnySubject` that instruments all Subject constructors
   - Constructor args become trackable (e.g., `new ReplaySubject(3)`)

3. **Async function tracking**
   - Requires syntax transform before every async func in `__$`
   - Alternative: Track Promise resolution without syntax change
   - Decision needed before implementation

4. **Structural hash with factory args**
   - Need to track args like factory observables
   - Hash comparison for detecting structural changes
   - Tied to arg/arg-call unification work
