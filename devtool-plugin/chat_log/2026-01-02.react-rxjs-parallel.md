# React ↔ RxJS Architectural Parallels

Date: 2026-01-04

## The Core Insight

We're building **React Fiber for RxJS**. The mental model maps almost 1:1.

---

## Entity Mapping

| React | RxJS | Notes |
|-------|------|-------|
| Component | Observable | Declarative definition |
| Component instance (Fiber) | Observable instance | What gets tracked |
| HOC / wrapper component | pipe() | Wraps and transforms |
| Render props / children | Operators (map, switchMap) | Transform data flow |
| ReactDOM.render() | .subscribe() | **Activation point** |
| Fiber tree | Subscription chain | Live instance graph |
| React.memo / forwardRef | trackedObservable | Stable identity wrapper |
| Fast Refresh | Our HMR swap | Hot code replacement |

---

## Key Insight: Subscribe IS Render

```typescript
// React: components are inert until rendered
const App = () => <div>Hello</div>  // just a function
ReactDOM.render(<App />, root)       // NOW it's alive

// RxJS: observables are inert until subscribed
const data$ = of(1, 2, 3)            // just a definition
data$.subscribe(console.log)          // NOW it's alive
```

**Subscribe is the mount point.** That's when the "fiber tree" (subscription chain) gets created.

---

## Key Insight: Pipe IS HOC

```typescript
// React HOC
const Enhanced = withLogging(withAuth(BaseComponent))
// Each HOC wraps the previous, creates new component ID

// RxJS pipe
const enhanced$ = source$.pipe(map(...), filter(...), switchMap(...))
// Each operator wraps the previous, creates new observable ID
```

**Each operator in a pipe is like a HOC wrapper.** Each has its own identity.

---

## What We Track (Component IDs, not Instances)

React tracks component *definitions* (via source location) for Fast Refresh, not instances.

We track observable *creation sites* (via __$ keys), not subscription instances.

```
observable ID  ≈  component definition
subscription   ≈  mounted instance (fiber)
```

But for HMR, identity is at the **definition level**:
- Same source location = same component = can hot swap
- Same __$ key = same observable = can hot swap

---

## The JSX Advantage (We Don't Have)

React's cheat code: JSX is syntactically distinct.

```jsx
<Component />     // compiler KNOWS this is a component boundary
myFunction()      // compiler knows this is NOT
```

RxJS has no syntax marker:

```typescript
of(1)             // is this rxjs? must check imports
myFactory()       // returns Observable? can't know statically
source$.pipe()    // ok this one we can detect
```

We rely on **import analysis** + **known patterns** instead of syntax.

---

## Identity: Rules of Hooks vs ???

React Fast Refresh can use hook **ordering** as identity because of Rules of Hooks:
- Hooks must be called in same order every render
- Same order = same hook slot
- Hook signature (types + order) = component signature

RxJS has no ordering constraint:
- Observables can be created anywhere
- Conditionally, in loops, lazily
- No "Rules of Observables"

Our solution: **variable name + source location** as identity.

```typescript
const fetch$ = __$("fetch$:hash", () => ...)
//                  ^^^^^^
//             This is our "hook slot"
```

---

## Hash vs Name Identity

**Content-based hash (current):**
```
Key = "fetch$:abc123" where abc123 = hash(AST)
```
- Pro: Detects exact code changes
- Con: Any edit = new key = orphan old track = lose subscriptions

**Name-only identity (alternative):**
```
Key = "fetch$"
```
- Pro: Edits don't orphan, subs persist
- Con: Can't distinguish "same name, different code"

**React's approach:** Signature-based. If hook signature changes → full remount. If same → preserve state.

**Our equivalent:** If structural shape changes → orphan. If only implementation → swap.

---

## The trackedObservable Pattern = React.memo

```typescript
// React: stable reference wrapper
const Memoized = React.memo(Component)
// Props can change, but identity stable

// RxJS: stable reference wrapper
const data$ = trackedObservable(trackId)
// Inner can swap, but wrapper identity stable
```

External code holds reference to wrapper. Wrapper internally swaps to new implementation on HMR.

---

## HMR Flow Comparison

**React Fast Refresh:**
1. File changes
2. New component function created
3. React finds existing fiber by source location
4. Swaps component function, keeps state
5. Re-renders with new code

**Our RxJS HMR:**
1. File changes
2. New observable created
3. Runtime finds existing track by key
4. Returns same trackedObservable wrapper
5. Wrapper re-subscribes to new inner
6. Existing subscriptions receive new emissions

---

## Vite HMR Mechanics

**Self-accepting module:**
```typescript
if (import.meta.hot) {
  import.meta.hot.accept()  // "I handle my own updates"
}
```
- Only this file re-executes
- Importers keep old references
- trackedObservable wrapper is stable → importers get new values

**Bubble-up (no accept):**
- Change bubbles to importing modules
- They re-execute too
- But our wrappers are keyed in global store → still stable!

**Key insight:** trackedObservable works with EITHER strategy because identity lives in the store, not module scope.

---

## Type Safety During HMR

**The problem:**
```typescript
// V1: Observable<string>
const data$ = of("hello")

// V2: Observable<number>
const data$ = of(123)
```

If we persist subscriptions, type mismatch at runtime.

**React's answer:** Full remount if signature changes.

**Our options:**
1. Orphan on hash change (current) - safe but loses state
2. Persist always - fast but type-unsafe
3. Structural detection - detect type-changing edits, orphan those

---

## The Unification Opportunity

```typescript
// operator_fun: 2 calls to get Observable
map(fn)           → (source) → Observable

// factory: 1 call to get Observable
of(1, 2, 3)       → Observable

// Unified model:
tracked_callable: {
  call_depth: 1 | 2
  result_observable_id: string
}
```

Both are "callables that produce Observable" - just different curry depth.

---

## MVP Status Assessment

**Done (~65%):**
- AST transform (import detection, __$ wrapping)
- Runtime tracking (events, state)
- trackedObservable/trackedSubject wrappers
- Orphan detection (prev_keys diff)
- Observable patching

**Missing for 80%:**
- `import.meta.hot.accept()` injection ← **critical**
- Key strategy decision (hash vs name)
- Real Vite integration test
- Basic error handling

**Deferred:**
- Nested lazy observables (defer(() => of()))
- Class method observables
- DevTools UI
- Type-aware structural detection

---

## Open Questions

1. **Key strategy:** Persist subs across edits (name-only) or clean reset (content-hash)?

2. **Nested tracking:** Auto-crawl args at transform time, or require manual `$("inner", ...)` calls?

3. **Bubble vs self-accept:** Default to self-accept, let plain exports bubble?

4. **Type safety:** Trust user on type stability, or try to detect breaking changes?

---

## Summary Mental Model

```
Observable definition     ≈  Component function
__$ wrapper              ≈  React.memo / forwardRef
trackedObservable        ≈  Stable fiber reference
.subscribe()             ≈  ReactDOM.render()
Subscription chain       ≈  Fiber tree
HMR inner swap           ≈  Fast Refresh re-render
Orphan cleanup           ≈  Unmount
pipe()                   ≈  HOC composition
Operator                 ≈  HOC / render prop
```

We're building the reconciler. The observable graph is the virtual DOM. The subscription chain is the fiber tree. Subscribe is render.
