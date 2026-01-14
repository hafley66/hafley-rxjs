# hafley-rxjs-debugger - Codebase Atlas

> Architecture reference for LLM sessions. Ingest this instead of re-reading files.
> The file tree IS the prompt - names are chosen for LLM comprehension.

## What This Is

**RxJS observable tracking + HMR debugging library**. Instruments RxJS at:
- **Build-time**: Vite plugin transforms user code, patches Observable class
- **Runtime**: Prototype patching emits events to accumulator

**Core Value**: File reload swaps inner observable while wrapper stays stable = subscriptions survive HMR.

---

## File Tree (Ordered for Dependency + Reading)

```
src/
├── index.ts                           # Library re-exports
├── app.tsx                            # Demo app
│
├── tracking/v2/                       # ══════ CORE ENGINE ══════
│   │
│   │  ┌─ LAYER 0: FOUNDATION ─────────────────────────────────────┐
│   ├── 00.types.ts                    # State shape, ObservableEvent union, state$ container
│   ├── 01_helpers.ts                  # createId(), now(), observableIdMap WeakMap
│   │  └───────────────────────────────────────────────────────────┘
│   │
│   │  ┌─ LAYER 1: INSTRUMENTATION ────────────────────────────────┐
│   ├── 01.patch-observable.ts         # Monkeypatch Observable.prototype (pipe/subscribe)
│   ├── 02_arg-crawler.ts              # Recursive arg→observable discovery, lodash paths
│   │  └───────────────────────────────────────────────────────────┘
│   │
│   │  ┌─ LAYER 2: ACCUMULATION ───────────────────────────────────┐
│   ├── 03_scan-accumulator.ts         # Event→State, ALL mutations here, exports state$$
│   │  └───────────────────────────────────────────────────────────┘
│   │
│   │  ┌─ LAYER 3: DERIVED/QUERY ──────────────────────────────────┐
│   ├── 04.operators.ts                # Decorated RxJS operators re-export
│   ├── 05_render-tree.ts              # Debug: renders observable tree as code
│   ├── 06_queries.ts                  # Pure projections: getRootObservables, getSendsFor
│   │  └───────────────────────────────────────────────────────────┘
│   │
│   ├── 0_test-utils.ts                # useTrackingTestSetup() - deterministic test harness
│   │
│   ├── hmr/                           # ══════ HMR SUBSYSTEM ══════
│   │   │
│   │   │  ┌─ LAYER 4: HMR WRAPPERS ───────────────────────────────┐
│   │   ├── 0_runtime.ts               # __$() API - wraps obs/subject for HMR tracking
│   │   ├── 1_queries.ts               # deriveStructuralPath() - parent chain traversal
│   │   ├── 2_tracked-observable.ts    # Cold wrapper: switches source on HMR
│   │   ├── 3_tracked-subject.ts       # Hot wrapper: bi-directional proxy forwarding
│   │   ├── 4_module-scope.ts          # _rxjs_debugger_module_start() - Vite entry point
│   │   │  └───────────────────────────────────────────────────────┘
│   │   │
│   │   └── 5_react-query-torture.test.ts  # E2E stress test
│   │
│   └── ui/                            # ══════ DEBUGGER UI ══════
│       ├── 0_DebuggerGrid.tsx         # React grid showing observable tree
│       └── 1_MarbleDiagram.tsx        # Marble diagram visualization
│
├── vite-plugin/                       # ══════ BUILD-TIME TRANSFORMS ══════
│   │
│   │  ┌─ LAYER 5: AST TRANSFORMS ─────────────────────────────────┐
│   ├── 0_user-transform.ts            # Wraps user observables in __$(), subs in __$.sub()
│   ├── v2.ts                          # Main Vite plugin: patches Observable.js + operators
│   │  └───────────────────────────────────────────────────────────┘
│   │
│   ├── index.ts                       # Plugin export
│   ├── rxjs-track-plugin.ts           # [LEGACY] Original plugin, superseded
│   └── auto-class-decorate.ts         # [EXPERIMENTAL] Class decorator injection
│
└── ui/                                # ══════ DEMO APP UI ══════
    ├── 0_types.ts                     # UI types
    ├── 1_data/                        # Data transforms (pipe-tree, timeline)
    ├── 2_hooks/                       # React hooks (use$.ts)
    ├── 3_components/                  # Timeline components
    ├── 4_App.tsx                      # App root
    └── 5_mount.ts                     # React mount
```

---

## Key Exports with Important Callsites

### 00.types.ts - State Shape & Containers

| Export | Purpose | Top 3 Callsites |
|--------|---------|-----------------|
| `state$` | BehaviorSubject holding normalized state | `03_scan-accumulator.ts:state$$.pipe()`, `hmr/0_runtime.ts:state$.value`, `06_queries.ts:leftJoin(state$)` |
| `_observableEvents$` | Subject emitting all tracking events | `01.patch-observable.ts:emit()`, `03_scan-accumulator.ts:scan()`, `0_test-utils.ts:resetEvents()` |
| `__withNoTrack(fn)` | Temporarily disable tracking | `hmr/2_tracked-observable.ts:inner subscription`, `hmr/3_tracked-subject.ts:proxy forwarding`, `04.operators.ts:internal ops` |
| `__withNoSend(fn)` | Temporarily disable send tracking | `hmr/2_tracked-observable.ts:watcher sub`, `hmr/3_tracked-subject.ts:bi-sync` |
| `ObservableEvent` | Union of 20+ event types | `03_scan-accumulator.ts:switch(event.type)`, `01.patch-observable.ts:emit()` |
| `State` | Normalized state shape (stack + store) | `03_scan-accumulator.ts:produce()`, `06_queries.ts:all query fns` |

### 01_helpers.ts - ID & Time Utilities

| Export | Purpose | Top 3 Callsites |
|--------|---------|-----------------|
| `createId()` | UUID (prod) or sequential (test) | `v2.ts:__createId__`, `01.patch-observable.ts:pipe/subscribe`, `hmr/0_runtime.ts:track creation` |
| `observableIdMap` | WeakMap<Observable, string> | `v2.ts:constructor patch`, `01.patch-observable.ts:id lookup`, `02_arg-crawler.ts:observable detection` |
| `now()` | Mockable time source | `01.patch-observable.ts:event timestamps`, `03_scan-accumulator.ts:created_at` |
| `decycle()` | JSON with cycle breaking | `02_arg-crawler.ts:arg serialization` |

### 01.patch-observable.ts - Runtime Instrumentation

| Export | Purpose | Top 3 Callsites |
|--------|---------|-----------------|
| `emit(event)` | Central event dispatcher | `v2.ts:constructor-call-return`, `patchObservable():pipe/subscribe`, `decorateOperatorFun()` |
| `patchObservable(Observable)` | Patches prototype methods | `v2.ts:__patchObservable__`, `0_test-utils.ts:ensurePatched()` |
| `decorateOperatorFun(opFn)` | Wraps pipeable operators | `v2.ts:operator file transforms`, `04.operators.ts:all operators` |
| `decorateCreate(factory, name)` | Wraps creation operators | `v2.ts:of/from/interval patches`, `04.operators.ts:creation fns` |
| `bootstrap(subject, getEnabled, getTrack)` | Late-bind emitter | `00.types.ts:module init` |

### 03_scan-accumulator.ts - The Heart

| Export | Purpose | Top 3 Callsites |
|--------|---------|-----------------|
| `state$$` | Hot observable of State snapshots | `hmr/2_tracked-observable.ts:source switching`, `hmr/3_tracked-subject.ts:reconnect`, `ui/0_DebuggerGrid.tsx:render` |

### hmr/0_runtime.ts - HMR Tracking API

| Export | Purpose | Top 3 Callsites |
|--------|---------|-----------------|
| `__$(key, fn)` | Track observable/subject creation | `4_module-scope.ts:baseTrack()`, `0_user-transform.ts:wrap observables` |
| `isTrackedWrapper(obs)` | Check if observable is HMR wrapper | `03_scan-accumulator.ts:TRACKED_MARKER check` |
| `TRACKED_MARKER` | Symbol on wrapper observables | `2_tracked-observable.ts:set`, `3_tracked-subject.ts:set`, `03_scan-accumulator.ts:detect` |

### hmr/4_module-scope.ts - Vite Integration Point

| Export | Purpose | Top 3 Callsites |
|--------|---------|-----------------|
| `_rxjs_debugger_module_start(url)` | Creates module context | `0_user-transform.ts:injected import`, `v2.ts:hmrModulePath resolution` |
| `ModuleScope.__$()` | Track with hierarchical keys | User code after transform |
| `ModuleScope.__$.sub()` | Track subscriptions | User code after transform |
| `ModuleScope.__$.end()` | Signal module load complete | User code after transform |

### vite-plugin/0_user-transform.ts - AST Transform

| Export | Purpose | Top 3 Callsites |
|--------|---------|-----------------|
| `transformUserCode(code, id, parseSync, opts)` | AST transform for HMR wrapping | `v2.ts:transform hook` |
| `shouldTransformUserCode(id, opts)` | File detection predicate | `v2.ts:transform hook gate` |

---

## Refactor Plan: Two-Phase Plugin Architecture

The current structure conflates two distinct Vite plugin responsibilities:
1. **RxJS Patching** - Modify Observable.js, operators (build-time, library code)
2. **HMR Transform** - Wrap user code with `__$()` (build-time, user code)

### Target Architecture (Execution Order)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 0: BUILD-TIME RXJS PATCHING                                           │
│ Vite plugin patches rxjs/Observable.js and operators before app loads       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: RUNTIME TRACKING ENGINE                                            │
│ Patched RxJS emits events → Accumulator processes → State updated           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: BUILD-TIME HMR TRANSFORM                                           │
│ Vite plugin wraps user observables in __$() for HMR stability               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: UI DEMO                                                            │
│ React app consuming tracking state for visualization                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Target File Structure

```
src/
├── index.ts
├── app.tsx
│
├── 0_vite_plugin_rxjs_patch/                          # ══ PHASE 0: PATCH RXJS ══
│   ├── 0_plugin_transform_observable_operators.ts     # Vite plugin entry
│   ├── 1_transform_observable_constructor_emit.ts     # Patches Observable class
│   ├── 2_transform_operators_decorate_wrap.ts         # Wraps operators with decorateOp
│   └── index.ts
│
├── 1_tracking_runtime_events/                         # ══ PHASE 1: TRACKING ENGINE ══
│   ├── 00_types_state_events_stack_store.ts           # State shape, events, stack+store
│   ├── 01_helpers_createid_now_weakmap.ts             # ID gen, time, observable→id
│   ├── 02_patch_observable_pipe_subscribe.ts          # Monkeypatch prototype methods
│   ├── 03_arg_crawler_recursive_lodash_paths.ts       # Crawl args, find observables
│   ├── 04_accumulator_events_to_state_scan.ts         # THE HEART: events→state
│   ├── 05_operators_decorated_reexport.ts             # Re-export wrapped operators
│   ├── 06_render_tree_debug_output.ts                 # Debug tree visualization
│   ├── 07_queries_projections_traversal.ts            # Pure state queries
│   ├── 99_test_utils_setup_teardown.ts                # Test harness
│   │
│   └── 1_debugger_ui_components/                      # Debugger visualization
│       ├── 0_Grid_observable_tree.tsx
│       └── 1_MarbleDiagram_timeline.tsx
│
├── 2_vite_plugin_hmr_transform/                       # ══ PHASE 2: HMR TRANSFORM ══
│   ├── 0_plugin_usercode_ast_wrap.ts                  # Vite plugin: user code only
│   ├── 1_ast_transform_oxc_magicstring.ts             # AST parsing + code gen
│   ├── 2_module_scope_start_end_track.ts              # Module lifecycle wrapper
│   │
│   └── 1_hmr_wrappers_stable_identity/                # Runtime wrappers
│       ├── 0_track_api_wrap_observable_subject.ts     # __$() function
│       ├── 1_queries_derive_structural_path.ts        # Parent chain traversal
│       ├── 2_wrapper_observable_cold_switchsource.ts  # Cold: switches source on HMR
│       └── 3_wrapper_subject_hot_bidirectional.ts     # Hot: proxy forwarding
│
└── 3_ui_demo_app/                                     # ══ PHASE 3: DEMO APP ══
    ├── 0_types.ts
    ├── 1_data_transforms/
    ├── 2_hooks_rxjs/
    ├── 3_components_timeline/
    ├── 4_App.tsx
    └── 5_mount.ts
```

### Migration Tasks

| Task | Current Location | Target Location |
|------|------------------|-----------------|
| Split v2.ts | `vite-plugin/v2.ts` | `0_vite_rxjs_patch/0_plugin.ts` (rxjs patching) + `2_vite_hmr_transform/0_plugin.ts` (user transform) |
| Move tracking core | `tracking/v2/` | `1_tracking/` |
| Move HMR wrappers | `tracking/v2/hmr/` | `2_vite_hmr_transform/1_hmr-wrappers/` |
| Move module-scope | `tracking/v2/hmr/4_module-scope.ts` | `2_vite_hmr_transform/2_module-scope.ts` |
| Move debugger UI | `tracking/v2/ui/` | `1_tracking/1_debugger-ui/` |
| Move demo UI | `ui/` | `3_ui_demo/` |
| Rename files | Mixed `.` and `_` | Consistent `_` separator |
| Fix ordering | `01.patch` vs `01_helpers` | Sequential numbers with no conflicts |

### File Rename Mapping

```
# CURRENT → TARGET (expressive names, 3-5 ideas per file)

# Phase 0: Extract rxjs patching from v2.ts
vite-plugin/v2.ts (rxjs parts)
  → 0_vite_plugin_rxjs_patch/0_plugin_transform_observable_operators.ts

# Phase 1: Tracking core (rename + reorder)
tracking/v2/00.types.ts
  → 1_tracking_runtime_events/00_types_state_events_stack_store.ts
tracking/v2/01_helpers.ts
  → 1_tracking_runtime_events/01_helpers_createid_now_weakmap.ts
tracking/v2/01.patch-observable.ts
  → 1_tracking_runtime_events/02_patch_observable_pipe_subscribe.ts
tracking/v2/02_arg-crawler.ts
  → 1_tracking_runtime_events/03_arg_crawler_recursive_lodash_paths.ts
tracking/v2/03_scan-accumulator.ts
  → 1_tracking_runtime_events/04_accumulator_events_to_state_scan.ts
tracking/v2/04.operators.ts
  → 1_tracking_runtime_events/05_operators_decorated_reexport.ts
tracking/v2/05_render-tree.ts
  → 1_tracking_runtime_events/06_render_tree_debug_output.ts
tracking/v2/06_queries.ts
  → 1_tracking_runtime_events/07_queries_projections_traversal.ts
tracking/v2/0_test-utils.ts
  → 1_tracking_runtime_events/99_test_utils_setup_teardown.ts
tracking/v2/ui/
  → 1_tracking_runtime_events/1_debugger_ui_components/

# Phase 2: HMR transform + wrappers
vite-plugin/v2.ts (user transform)
  → 2_vite_plugin_hmr_transform/0_plugin_usercode_ast_wrap.ts
vite-plugin/0_user-transform.ts
  → 2_vite_plugin_hmr_transform/1_ast_transform_oxc_magicstring.ts
tracking/v2/hmr/4_module-scope.ts
  → 2_vite_plugin_hmr_transform/2_module_scope_start_end_track.ts
tracking/v2/hmr/0_runtime.ts
  → 2_vite_plugin_hmr_transform/1_hmr_wrappers_stable_identity/0_track_api_wrap_observable_subject.ts
tracking/v2/hmr/1_queries.ts
  → 2_vite_plugin_hmr_transform/1_hmr_wrappers_stable_identity/1_queries_derive_structural_path.ts
tracking/v2/hmr/2_tracked-observable.ts
  → 2_vite_plugin_hmr_transform/1_hmr_wrappers_stable_identity/2_wrapper_observable_cold_switchsource.ts
tracking/v2/hmr/3_tracked-subject.ts
  → 2_vite_plugin_hmr_transform/1_hmr_wrappers_stable_identity/3_wrapper_subject_hot_bidirectional.ts

# Phase 3: Demo UI
ui/ → 3_ui_demo_app/
```

### Why This Structure?

1. **FS = Mental Model** - Folder order matches execution/dependency order
2. **Two Vite Plugins** - Separates concerns (patch rxjs vs transform user code)
3. **HMR wrappers near transform** - They're consumed by the transform, not by tracking
4. **Consistent naming** - All `_` separators, sequential numbers
5. **LLM comprehension** - Reading `ls src/` tells you the architecture

---

## Core Concepts

### Event-Driven Architecture
```
Runtime patches emit events → Accumulator processes → State updated → Queries project
```

### State Shape (Relational-Inspired)
```typescript
state$ = {
  stack: {           // Temporal context (push/pop during execution)
    observable: [],  pipe: [],  operator: [],  subscription: [],
    send: [],  track: [],  module: []
  },
  store: {           // Lookup by ID
    observable: Map,  pipe: Map,  operator: Map,  subscription: Map,
    send: Map,  arg: Map,  hmr_track: Map,  hmr_module: Map
  }
}
```

### HMR Wrapper Strategy
```typescript
// User writes:
const data$ = of(1, 2, 3)

// Transform produces:
const data$ = __$("data$:abc123", () => of(1, 2, 3))

// Runtime creates:
// - trackedObservable() wrapper (stable ID, survives HMR)
// - Inner observable (recreated on HMR)
// - Wrapper.subscribe() → subscribes to current inner
// - On HMR: inner swaps, subscribers continue receiving
```

### Vite Plugin Pipeline
```
File → [v2.ts transform]
  ├─ Observable.js? → inject ID + emit + patch
  ├─ operator file? → wrap with decorateOp()
  └─ user code? → transformUserCode()
       ├─ Parse with oxc-parser
       ├─ Collect RxJS imports (aliases, namespaces)
       ├─ Find observable decls + subscriptions
       ├─ Wrap with __$() / __$.sub()
       └─ Inject _rxjs_debugger_module_start
```

---

## Test Infrastructure

**Setup**: `useTrackingTestSetup()` in every test
- Resets ID counter (deterministic)
- Mocks time to 0
- Resets state$ to initial
- Enables tracking
- Optional `fakeTrack: true` for non-HMR tests

**Counts**: 121 passing, 3 skipped

---

## Quick Reference

| To understand... | Read... |
|------------------|---------|
| State shape | `tracking/v2/00.types.ts` |
| How tracking works | `tracking/v2/01.patch-observable.ts` |
| Event→State logic | `tracking/v2/03_scan-accumulator.ts` |
| HMR API | `tracking/v2/hmr/0_runtime.ts` |
| Subject proxy | `tracking/v2/hmr/3_tracked-subject.ts` |
| Observable switch | `tracking/v2/hmr/2_tracked-observable.ts` |
| Vite plugin | `vite-plugin/v2.ts` |
| AST transform | `vite-plugin/0_user-transform.ts` |
| Epic board | `chat_log/epics/hmr-mvp/board.md` |

---

## Conventions (from CLAUDE.md)

1. **Numeric prefixes** - Lower = dependency of higher
2. **Single source of truth** - Use state$.stack/store only
3. **Runtime emits, accumulator mutates** - Thin instrumentation
4. **Call/call-return pairs** - Consistent event pattern
5. **Parent from stack** - Relationships inferred, not passed

### Naming Rule (One Sentence)

> **Name files so `ls` explains the system: `{order}_{what}_{how}_{keyidea}.ts`**

```
Folders: underscores only (polyglot FS)     0_vite_plugin_rxjs_patch/
Files:   underscores + .ext annotations     04_accumulator_events_to_state_scan.test.ts
```

<details>
<summary>Examples: BAD vs GOOD</summary>

```
# BAD - must read file to understand
00_types.ts
01_helpers.ts
02_patch.ts

# GOOD - ls output IS documentation
00_types_state_events_stack_store.ts
01_helpers_createid_now_weakmap.ts
02_patch_observable_pipe_subscribe.ts
04_accumulator_events_to_state_scan.ts    # THE HEART
```
</details>
