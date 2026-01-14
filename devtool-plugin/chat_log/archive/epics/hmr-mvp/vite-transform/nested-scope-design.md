# Hierarchical Path Tracking for Nested Observables

**Date**: 2026-01-03
**Status**: Planned (not implemented)

## Goal
Add structural path tracking for nested observables (switchMaps, subscribe callbacks, etc.) using a hybrid approach: transform stays module-scope only, runtime derives hierarchical paths from stack context.

## Approach
- **Transform**: No changes to `shouldSkip()` - continues wrapping module-level only
- **Runtime**: Derives structural paths from existing stack (operator_fun, arg_call, subscription)
- **Storage**: New `structural_path` field on `hmr_track` entities

## Path Format

```
{parentTrack}/{operator}[{index}].{callbackArg}:{varName}:{hash}
```

**Examples:**
```typescript
// Simple module-level
const data$ = of(1)
// Path: "data$"

// Nested in switchMap
source$.pipe(switchMap(x => __$("inner", () => of(x))))
// Path: "source$/switchMap[0].0:inner"

// Two switchMaps at same level
source$.pipe(
  switchMap(x => __$("a", () => of(x))),  // "source$/switchMap[0].0:a"
  switchMap(y => __$("b", () => of(y)))   // "source$/switchMap[1].0:b"
)

// Deep nesting (>5 levels)
// "root/switchMap[0].0/mergeMap[0].0/concatMap[0].0:deep"
```

---

## Implementation

### 1. Schema Changes (`src/tracking/v2/00.types.ts`)

Add fields to `hmr_track`:

```typescript
hmr_track: {
  // ... existing fields ...
  structural_path?: string   // Full hierarchical path
  parent_operator?: string   // e.g., "switchMap", "defer"
  parent_callback?: string   // e.g., "$args.0" or "project"
}
```

### 2. Runtime Changes (`src/tracking/v2/hmr/0_runtime.ts`)

Enhance effective location in `__$` (around line 47):

```typescript
// Current:
`$ref[${observableContext}]:subscription[${subscriptionContext}]:${location}`

// Enhanced - derive from stack:
const operatorFun = state$.value.stack.operator_fun.at(-1)
const operator = state$.value.stack.operator.at(-1)
const argCall = state$.value.stack.arg_call.at(-1)
const parentTrack = state$.value.stack.hmr_track.at(-1)

const operatorContext = operatorFun
  ? `${operatorFun.name}[${operator?.index ?? 0}]`
  : ''
const callbackPath = argCall?.path?.replace('$args.', '') ?? '0'

// Build hierarchical path
const parentPath = parentTrack?.structural_path ?? parentTrack?.id ?? ''
const structuralPath = parentPath
  ? `${parentPath}/${operatorContext}.${callbackPath}:${location}`
  : location
```

### 3. Accumulator Changes (`src/tracking/v2/03_scan-accumulator.ts`)

In `track-call-return` handler, derive and store structural_path:

```typescript
case "track-call-return": {
  const entity = state.stack.hmr_track.pop()
  if (!entity || !entity.entity_id) break

  // Derive structural path from current stack
  const parentTrack = state.store.hmr_track[entity.parent_track_id ?? '']
  const opFun = state.stack.operator_fun.at(-1)
  const argCall = state.stack.arg_call.at(-1)

  entity.structural_path = deriveStructuralPath(parentTrack, opFun, argCall, entity.id)
  entity.parent_operator = opFun?.name
  entity.parent_callback = argCall?.path

  // ... rest of existing logic ...
}

// Helper function
function deriveStructuralPath(
  parentTrack: HmrTrack | undefined,
  opFun: OperatorFun | undefined,
  argCall: ArgCall | undefined,
  trackId: string
): string {
  const parentPath = parentTrack?.structural_path ?? ''

  if (!opFun) {
    return parentPath ? `${parentPath}:${trackId}` : trackId
  }

  const operatorPart = `${opFun.name}[${opFun.index ?? 0}]`
  const callbackPart = argCall?.path?.replace('$args.', '') ?? '0'

  return parentPath
    ? `${parentPath}/${operatorPart}.${callbackPart}:${trackId}`
    : `${operatorPart}.${callbackPart}:${trackId}`
}
```

---

## Test Scenarios

Add to `src/tracking/v2/hmr/0_runtime.test.ts`:

```typescript
describe("Hierarchical path tracking", () => {
  it("tracks module-level observable path", () => {
    const outer$ = __$("outer", () => of(1))
    // track.structural_path = "outer"
  })

  it("tracks nested observable in switchMap callback", () => {
    __$("outer", () => of(1)).pipe(
      switchMap(x => __$("inner", () => of(x)))
    ).subscribe()
    // inner track.structural_path = "outer/switchMap[0].0:inner"
  })

  it("differentiates two switchMaps at same level", () => {
    __$("result", () => of(1).pipe(
      switchMap(x => __$("a", () => of(x))),
      switchMap(y => __$("b", () => of(y)))
    ))
    // a: "result/switchMap[0].0:a"
    // b: "result/switchMap[1].0:b"
  })

  it("tracks deeply nested (>5 levels)", () => {
    // Verify path doesn't truncate, builds full chain
  })

  it("handles subscribe callback nesting", () => {
    __$("source", () => of(1)).subscribe(x => {
      __$("handler", () => of(x)).subscribe()
    })
    // handler: "source/subscribe.0:handler" or similar
  })
})
```

---

## Edge Cases

| Scenario | Path Format | Notes |
|----------|-------------|-------|
| Two identical switchMaps | Differentiated by index: `[0]` vs `[1]` | Operator index in pipe chain |
| Dynamic per-call observables | Each subscription gets unique context | subscription_id differentiates |
| Depth > 5 levels | Path extends naturally | No truncation |
| Same key different positions | structural_path distinguishes | Even if hash matches |

---

## Files to Modify

1. **`src/tracking/v2/00.types.ts`** - Add schema fields
2. **`src/tracking/v2/hmr/0_runtime.ts`** - Enhance `__$` location derivation
3. **`src/tracking/v2/03_scan-accumulator.ts`** - Add structural_path in track-call-return
4. **`src/tracking/v2/hmr/0_runtime.test.ts`** - Add test scenarios

## Files NOT Modified

- **`src/vite-plugin/0_user-transform.ts`** - No changes (stays module-scope only)

---

## Future: Extended Scope Detection (TBD)

### Problem
Current transform only wraps module-scope. But real codebases have:
1. **Extended Subject classes** (`class EasierBS extends BehaviorSubject`) with `this.subscribe()`, `this.pipe()`
2. **Callbacks with `__$`** - not at module load time, but at subscription time
3. **Nested rxjs inside non-decorated functions**

### Proposed Solutions

#### 1. Class Decoration Marking
Mark classes as "rxjs-using" so their methods get auto-decorated:

```typescript
// Option A: Decorator
@rxjsClass
class EasierBS extends BehaviorSubject<T> {
  use$() { this.subscribe(...) }  // auto-wrapped
}

// Option B: Static marker
class EasierBS extends BehaviorSubject<T> {
  static __rxjs__ = true  // transform detects this
}

// Option C: Config
// vite.config.ts
rxjsDebuggerPlugin({
  decorateClasses: ['EasierBS', /.*Store$/]
})
```

#### 2. Module Scope vs Callback Scope Detection
Flag whether `__$` is called at module-load time vs subscription-callback time:

```typescript
// Track context
interface TrackCall {
  // ... existing fields ...
  is_module_scope: boolean  // true if called during initial module execution
}

// In runtime:
const isModuleScope = !state$.value.stack.send.length &&
                       !state$.value.stack.subscription.length
```

**Why this matters:**
- **Module scope**: Observable created once, lives for module lifetime, orphan on HMR
- **Callback scope**: Observable created per-emit, may repeat with same key, needs different cleanup

#### 3. Callback-Scope Observable Lifecycle

For observables created inside callbacks (same key repeats):
- Track as "ephemeral" - not orphaned on HMR, but on parent unsubscribe
- Link to parent subscription for cleanup
- Don't warn about "duplicate key" - expected behavior

```typescript
hmr_track: {
  // ... existing fields ...
  is_module_scope: boolean
  parent_subscription_id?: string  // for callback-scope tracks
}
```

### Open Questions
- Should callback-scope tracks share keys or get unique keys per invocation?
- How to handle `defer(() => of(1))` which is lazy but module-level?
- Should we track prototype method decorations separately from instance methods?
