# Task: Fix Skipped getDanglingSubscriptions Tests

**Priority**: P1
**Status**: Not Started
**Blocks**: Orphan detection must work before transforms rely on it

---

## Problem

3 tests skipped in `0_runtime.test.ts:526-557`:

```typescript
describe.skip("getDanglingSubscriptions", () => {
  // NOTE: getDanglingSubscriptions requires subscriptions to be tracked.
  // Subscriptions are only tracked when inside a __$ scope (track context required by shouldEmit).
  // These tests are skipped pending investigation of track context isolation between tests.
```

**Root cause**: Subscriptions only tracked when `shouldEmit()` returns true, which requires active track context. Tests create subscriptions outside `__$` scope.

---

## Current Test Structure

```typescript
it("subscription to current tracked entity is not dangling", () => {
  let subj: Subject<number>
  __$("tracked", () => (subj = new Subject<number>()))
  subj!.subscribe()  // <-- OUTSIDE __$ scope, not tracked!
  expect(getDanglingSubscriptions(state$.value.store)).toMatchInlineSnapshot(`[]`)
})
```

---

## Solution Options

### Option A: Wrap subscription in __$.sub()
```typescript
it("subscription to current tracked entity is not dangling", () => {
  const scope = _rxjs_debugger_module_start("test://dangling")
  let subj: Subject<number>
  scope("tracked", () => (subj = new Subject<number>()))
  scope.sub("sub1", () => subj!.subscribe())  // Tracked!
  scope.end()
  expect(getDanglingSubscriptions(state$.value.store)).toMatchInlineSnapshot(`[]`)
})
```

### Option B: Subscribe inside __$ scope
```typescript
it("subscription to current tracked entity is not dangling", () => {
  let subj: Subject<number>
  __$("tracked", () => {
    subj = new Subject<number>()
    subj.subscribe()  // Inside scope, tracked
  })
  expect(getDanglingSubscriptions(state$.value.store)).toMatchInlineSnapshot(`[]`)
})
```

**Recommendation**: Option A - uses the intended API pattern

---

## Files

- `src/tracking/v2/hmr/0_runtime.test.ts` (lines 526-557)

---

## Verification

```bash
pnpm test:run src/tracking/v2/hmr/0_runtime.test.ts
# 24 tests should pass (21 current + 3 unskipped)
```
