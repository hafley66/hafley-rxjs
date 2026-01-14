# Task: Remove Dead Code

**Priority**: P1
**Status**: Not Started
**Blocks**: Phase 5 (clean API before transforms)

---

## Problem

Unused code pollutes the API surface and confuses future readers:

1. **`suppressSend$` + `__withNoSend`** (`00.types.ts:22, 36-44`)
   - BehaviorSubject + wrapper function
   - Exported but never used anywhere
   - Was planned to suppress send-call events but abandoned

2. **`decorateHigherMap`** (`01.patch-observable.ts:328`)
   - Empty function stub: `export const decorateHigherMap = <T extends Function>(operator_fun: T, name = operator_fun.name) => {}`
   - Never called
   - Suggests incomplete higher-order operator tracking

3. **`rel` array** (`00.types.ts:178, 224`)
   - Designed as relational join table
   - Initialized as `rel: []` but never written to
   - Abandoned denormalization idea

---

## Solution

Delete all unused code:

```ts
// 00.types.ts - REMOVE lines 22, 36-44
export const suppressSend$ = new BehaviorSubject(false)
export function __withNoSend<T>(fn: () => T): T { ... }

// 00.types.ts - REMOVE from State type and initial value
rel: ({ [K in keyof Improved as `${K}_id`]: string } & { owner_id: string })[]

// 01.patch-observable.ts - REMOVE line 328
export const decorateHigherMap = ...
```

---

## Files

- `src/tracking/v2/00.types.ts`
- `src/tracking/v2/01.patch-observable.ts`

---

## Verification

```bash
pnpm test:run
# All 85 tests should still pass
```

Grep for any remaining references:
```bash
grep -r "suppressSend" src/
grep -r "decorateHigherMap" src/
grep -r "__withNoSend" src/
```
