# Task: Add Error Propagation Tests

**Priority**: P2
**Status**: Not Started

---

## Problem

`2_tracked-observable.test.ts` tests `next()` and `complete()` but not `error()`:

```typescript
// Tested:
✓ forwards emissions from source
✓ forwards complete from source
✓ complete() propagates before HMR

// Missing:
✗ error() propagation
✗ error during HMR swap
✗ subscriber error handler
```

---

## Tests to Add

```typescript
describe("error handling", () => {
  it("forwards error from source", () => {
    const source$ = new Subject<number>()
    const wrapper$ = trackedObservable("test", () => source$)

    const errors: Error[] = []
    wrapper$.subscribe({ error: e => errors.push(e) })

    source$.error(new Error("boom"))

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe("boom")
  })

  it("error propagates after HMR swap", () => {
    const source1$ = new Subject<number>()
    const source2$ = new Subject<number>()
    let current = source1$

    const wrapper$ = trackedObservable("test", () => current)

    const errors: Error[] = []
    wrapper$.subscribe({ error: e => errors.push(e) })

    // Simulate HMR swap
    current = source2$
    // trigger entity_id change in state

    source2$.error(new Error("after swap"))

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe("after swap")
  })

  it("old source error ignored after swap", () => {
    // Similar to "old source emissions ignored after swap" test
  })
})
```

---

## Also Test in trackedSubject

```typescript
// 3_tracked-subject.ts tests
describe("error bi-sync", () => {
  it("proxy.error() forwards to inner", () => { ... })
  it("inner.error() forwards to proxy subscribers", () => { ... })
})
```

---

## Files

- `src/tracking/v2/hmr/2_tracked-observable.test.ts`
- `src/tracking/v2/hmr/3_tracked-subject.test.ts` (if exists, or add to 0_runtime.test.ts)
