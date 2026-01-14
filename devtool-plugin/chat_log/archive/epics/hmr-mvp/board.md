# HMR MVP Epic

**Goal**: RxJS Hot Module Replacement that keeps subscriptions alive across code changes

**Branch**: `feature/vite-instrumentation-v2`

---

## Status Overview

| Phase | Status | Tests |
|-------|--------|-------|
| 1. Manual `__$` Validation | ✅ Done | 24 tests |
| 2. Swap Mechanism | ✅ Done | 12 tests |
| 3. Lifecycle Management | ✅ Done | 11 tests |
| 4. Cleanup & Gaps | 🟡 In Progress | 3 skipped |
| 5. Vite AST Transform | ✅ Done | 41 tests |
| 5.1 Hierarchical Paths | ⬜ Planned | 0 tests |
| 5.2 Extended Scope | ⬜ Future | 0 tests |
| 6. E2E Playwright | ⬜ Not Started | 0 tests |

**Current**: 121 passing, 3 skipped

---

## Backlog

### Phase 4: Cleanup & Gaps (Pre-Transform)

| Task | Priority | File |
|------|----------|------|
| Remove dead code (suppressSend$, decorateHigherMap, rel) | P1 | [cleanup-dead-code.md](./tasks/cleanup-dead-code.md) |
| Fix skipped getDanglingSubscriptions tests | P1 | [fix-dangling-tests.md](./tasks/fix-dangling-tests.md) |
| Implement pipe-call handler (currently empty) | P2 | [pipe-call-handler.md](./tasks/pipe-call-handler.md) |
| Add error propagation tests | P2 | [error-propagation-tests.md](./tasks/error-propagation-tests.md) |
| Implement is_sync detection for sync observables | P3 | [is-sync-detection.md](./tasks/is-sync-detection.md) |
| Track per-parent index (all index:0 currently) | P3 | [track-index.md](./tasks/track-index.md) |

### Phase 5: Vite AST Transform ✅

**Files created**:
- `src/vite-plugin/0_user-transform.ts` - Main transform logic (~300 lines)
- `src/vite-plugin/__tests__/user-transform.test.ts` - 36 tests with inline snapshots

| Phase | Description | Status |
|-------|-------------|--------|
| A. Foundation | AST patterns, file detection | ✅ |
| B. Module Wrapper | Inject start/end | ✅ |
| C. Observable Wrapping | __$() for declarations | ✅ |
| D. Subscription Wrapping | __$.sub() for subscribes | ✅ |
| E. Testing | Transform test suite | ✅ |
| F. Test gap fixes | Aliased/namespace imports, class props | ✅ |

**Related docs**:
- [test-gaps.md](./vite-transform/test-gaps.md) - Test coverage analysis
- [nested-scope-design.md](./vite-transform/nested-scope-design.md) - Hierarchical path tracking (planned)

### Phase 5.1: Hierarchical Path Tracking ⬜

**Goal**: Structural paths for nested observables (switchMaps, subscribe callbacks)

**Approach**: Hybrid - transform stays module-scope, runtime derives paths from stack

**Design**: [nested-scope-design.md](./vite-transform/nested-scope-design.md)

| Task | Status |
|------|--------|
| Add schema fields (structural_path, parent_operator) | ⬜ |
| Enhance __$ location derivation in runtime | ⬜ |
| Add structural_path in accumulator track-call-return | ⬜ |
| Add hierarchical path test scenarios | ⬜ |

### Phase 5.2: Extended Scope Detection ⬜ (Future)

**Goal**: Handle class methods, callback-scope observables, repeated keys

**Design**: [nested-scope-design.md](./vite-transform/nested-scope-design.md#future-extended-scope-detection-tbd)

| Task | Status |
|------|--------|
| Add `is_module_scope` flag to track entities | ⬜ |
| Class decoration marking (config or static marker) | ⬜ |
| Callback-scope lifecycle (ephemeral, parent-linked) | ⬜ |
| Handle `this.subscribe()` / `this.pipe()` patterns | ⬜ |

### Phase 6: E2E Validation

| Task | Priority | File |
|------|----------|------|
| Playwright test setup | P1 | [playwright-setup.md](./tasks/playwright-setup.md) |
| HMR swap E2E test | P1 | [hmr-swap-e2e.md](./tasks/hmr-swap-e2e.md) |
| Subscription survival E2E | P1 | [subscription-survival-e2e.md](./tasks/subscription-survival-e2e.md) |

---

## Gaps Identified

### Blocking Phase 5

1. **Empty `pipe-call` handler** - Retrieves pipe entity but does nothing. May need args/index capture for proper tracking.

2. **Dead code pollution** - `suppressSend$`, `__withNoSend`, `decorateHigherMap`, `rel[]` are defined but unused. Clean API surface before adding transforms.

3. **Skipped tests** - `getDanglingSubscriptions` tests skipped due to track context isolation. Need orphan detection verified before transforms rely on it.

### Non-Blocking but Should Fix

4. **`is_sync` never set** - Designed to detect sync observables (of, from) but flag always false. Low priority.

5. **`index: 0` always** - Per-parent ordering not implemented. Only matters for UI display.

6. **No error propagation tests** - tracked-observable tested for next/complete, not error.

7. **Higher-order nesting untested** - switchMap tested 1 level, not 3+ deep.

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│ Vite Plugin (Phase 5)                                   │
│   - Transform user code                                 │
│   - Inject __$ wrappers                                 │
│   - Inject module lifecycle                             │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ HMR Runtime (Phases 1-3) ✅                             │
│   - __$() track creation                                │
│   - trackedObservable/Subject wrappers                  │
│   - Module lifecycle + orphan cleanup                   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Core Tracking (exists)                                  │
│   - Observable/Subscription/Send events                 │
│   - Accumulator state management                        │
│   - Patch observable prototype                          │
└─────────────────────────────────────────────────────────┘
```

---

## Key Files

**HMR Runtime**
- `src/tracking/v2/hmr/0_runtime.ts` - __$, track context
- `src/tracking/v2/hmr/2_tracked-observable.ts` - Cold obs wrapper
- `src/tracking/v2/hmr/3_tracked-subject.ts` - Hot obs bi-sync
- `src/tracking/v2/hmr/4_module-scope.ts` - Module lifecycle

**Core**
- `src/tracking/v2/00.types.ts` - Entity types, state
- `src/tracking/v2/01.patch-observable.ts` - Prototype patching
- `src/tracking/v2/03_scan-accumulator.ts` - Event handlers

**Vite Plugin**
- `src/vite-plugin/v2.ts` - Current transforms (rxjs only)
