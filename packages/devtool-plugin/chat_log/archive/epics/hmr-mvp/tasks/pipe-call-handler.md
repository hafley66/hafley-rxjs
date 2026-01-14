# Task: Implement pipe-call Handler

**Priority**: P2
**Status**: Not Started

---

## Problem

`pipe-call` handler in accumulator is empty:

```typescript
// src/tracking/v2/03_scan-accumulator.ts:89-94
case "pipe-call": {
  const pipeEntity = state.stack.pipe[state.stack.pipe.length - 1]
  if (pipeEntity) {
  }  // <- EMPTY BODY
  break
}
```

The event flow is:
- `pipe-get` → pushes pipe entity to stack
- `pipe-call` → **should capture call info** but does nothing
- `pipe-call-return` → pops and captures output observable

---

## Analysis

Looking at what `pipe-call-return` does (line 96-107):
```typescript
case "pipe-call-return": {
  const pipeEntity = state.stack.pipe.pop()
  if (pipeEntity) {
    pipeEntity.created_at_end = now()
    const obsId = observableIdMap.get(event.observable) ?? "unknown"
    pipeEntity.output_observable_id = obsId
    state.store.pipe[pipeEntity.id] = pipeEntity
  }
  break
}
```

The pipe entity already has `input_observable_id` set during `pipe-get`.

**Question**: What should `pipe-call` capture?
- Operator count? (from args)
- Index in parent? (TODO at line 295)
- Call timestamp?

---

## Options

### Option A: Minimal - Just capture call start time
```typescript
case "pipe-call": {
  const pipeEntity = state.stack.pipe[state.stack.pipe.length - 1]
  if (pipeEntity) {
    pipeEntity.called_at = now()
  }
  break
}
```

### Option B: Remove handler entirely
If we don't need call-time info, remove the empty handler to avoid confusion.

### Option C: Capture operator count
```typescript
case "pipe-call": {
  const pipeEntity = state.stack.pipe[state.stack.pipe.length - 1]
  if (pipeEntity) {
    pipeEntity.called_at = now()
    pipeEntity.operator_count = event.args?.length ?? 0
  }
  break
}
```

**Recommendation**: Option A (minimal) - establishes pattern without over-engineering

---

## Files

- `src/tracking/v2/03_scan-accumulator.ts` (line 89-94)
- `src/tracking/v2/00.types.ts` (add `called_at?: number` to pipe type if needed)

---

## Verification

Existing pipe tests should still pass. No new behavior expected.
