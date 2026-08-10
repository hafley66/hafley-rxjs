# PLAN 2026-07-25: debugger core, and a Network-tab UI on top of it

Supersedes parts of `PLAN-2026-07-25-live-visualizer.md` (same day, same package).
Read that document first for the baseline receipts and the library tables it already
established; this document does not repeat them, it cites them.

Two constraints arrived after that plan was written and they change the shape of the
work rather than its order:

1. **The core must be reusable.** `~/projects/sprefa/v6` (two Node-only RxJS packages,
   no bundler, no DOM) has to be able to depend on the debugger without pulling in Vite,
   React, or the browser. The Vite plugin stops being *the* product and becomes one
   ingestion front-end of three.
2. **The UI is modeled on the Chromium DevTools Network tab.** Not a marble diagram with
   a table bolted on. Row list, waterfall column, filter chips, preserve log, clear,
   split detail pane with tabs, summary status bar.

A third standing law applies to every new type in here: any class gets its interface
equivalent declared once, in a contract-header `types.ts`, under the plain domain word.
Section 5 is that header, in full.

---

## 0. What is kept from the previous plan, what is replaced, and why

| Previous plan section | Disposition | Reason |
|---|---|---|
| §0 Baseline (4 RED commands) | **KEPT as receipts, re-verified in §1** | Measured the same day. §1 restates it with a re-run and adds the fix per command. |
| §1 Corrections to the brief (no d3, 56 chat logs, two stores, dead deps, broken `exports["./hmr"]`) | **KEPT verbatim** | All independently re-checked. Nothing contradicted. |
| §2 Non-goals: node_modules parsing OUT, HMR module swap OUT | **KEPT** | Both still out. The virtual-module decision (`resolveId 'rxjs' -> \0rxjs`) stands. |
| §2 Non-goal: "`~/projects/sprefa/v6/dl` as a consumer: OUT, plan no integration" | **REPLACED.** It is now the primary driver. | Constraint 1. §9 is a concrete integration, not a constraint note. |
| §2 Non-goal: "Merging v1 and v2 stores: OUT" | **REPLACED by a ruling.** §2.2 picks one and deletes the other. | You cannot ship a reusable core with two schemas in it. |
| §3.1 Transport (same-page direct subscription behind a serializable Frame) | **KEPT and extended** | The conclusion holds. §8 adds the Node case (a second process, not a second tab), which the old table did not consider. |
| §3.2 Ring buffer (`mnemonist` CircularBuffer, 2.81 kB gzip, root import only) | **REPLACED.** Core ships its own 40-line ring. | Constraint 1. Core must be zero-dependency so `link:`/`node --experimental-transform-types` consumers get no dependency tree. §4.6 re-runs the analysis under the new constraint and the answer flips. |
| §3.3 Marble/timeline rendering (DOM stage 1, canvas stage 2, ECharts escape hatch) | **REPLACED.** The primary surface is a Network-tab waterfall column, not a marble lane strip. | Constraint 2. §4.3 is a fresh candidate list for a per-row waterfall bar. Marble lanes survive as one detail-pane tab, not as the main view. |
| §3.4 Prior art (rxjs-spy, rxjs-insights, rx-devtools) | **KEPT verbatim** | Still the correct landscape. §4.7 adds the trace-model prior art the old plan did not survey. |
| §3.5 UI state store (`useSyncExternalStore`, reject zustand et al.) | **KEPT, with the reasoning re-stated in §4.4** | Old plan gave one-line dismissals for zustand/valtio/jotai, which violates the build-vs-buy law. §4.4 pays that debt. |
| §3.6 Virtualizer (`@tanstack/react-virtual`) and the graph-layout rejection | **KEPT** | §4.1 re-checks React 19 and adds the table-semantics question the old plan did not need. |
| §3.7 Tailwind on Vite 8 spike | **KEPT verbatim** | Empirically verified. No reason to re-run. |
| §4 Tailwind wiring (CSS-first `@theme`, static-vs-runtime split rule) | **KEPT**, colour tokens re-scoped in §7.4 | The six marble colours become status/kind colours. The static-vs-runtime rule is unchanged and is the reason the waterfall works at all. |
| §5.1 Projection seam (`ProjectionBudget`, `classify`, `RipCursor`) | **KEPT in substance, MOVED and renamed** | It moves out of `0_runtime/07_project.ts` into the core package as `3_project.ts`, and the output type becomes the wire type (§8). The cap numbers survive. |
| §5.2 `RingSink` / `Frame` | **KEPT in substance, MOVED to core, dependency dropped** | See §4.6. |
| §5.3 `FramePump` / rAF coalescing / adaptive skip | **KEPT, MOVED to the UI package** | rAF is a DOM API. It cannot live in a package sprefa imports. |
| §5.4 `TraceIndex` + `compact` + `RetentionPolicy` | **KEPT in substance, re-keyed** | The index keyed on `laneOrder`/`sendsBySub`. It is now keyed on `rowOrder`/`eventsBySpan`. Same shape, general names. |
| §5.5 `MarbleSurface` swap interface | **DEMOTED** | Becomes the Emissions detail tab's renderer, not the main surface. The stage-1/stage-2 swap idea moves to the waterfall column (§4.3). |
| §5.6 Instance lifetimes, §5.7 storage/reads/writes/uniqueness | **KEPT and extended** | The `globalThis.__rxjs_debugger_main__` HMR pin is still correct and still required. §6 restates the tables for the new type set. |
| §6 Five-view inventory (stream table, marble lanes, call tree, value inspector, health strip) | **REPLACED by §7** | Five floating panes is not the Network tab. The five views survive as: row list (was A+C merged), waterfall column (new), detail tabs (was B+D), status bar (was E). |
| §7 Vite 8 migration (all of it, including the `minify: "esbuild"` and rxjs-dist-path risks) | **KEPT verbatim** | Nothing in the new constraints touches it. It stays a phase. |
| §8 Milestones M0-M8 | **REPLACED by §10** | Re-cut around the package split. M0/M1/M3 survive nearly intact as Phase 0/1/3. |
| §9 Open questions 1-4 | **KEPT**, question 2 (v1 vs v2) **answered** in §2.2 | |

One thing the previous plan got wrong that is worth naming, because it is the reason
this document exists: it treated `v6/dl` as "one line of relevance: keep `0_runtime/**`
free of DOM imports". That is not sufficient. Keeping DOM out of a directory does not
make a package importable. `@hafley/rxjs-debugger`'s single entry point is a Node Vite
plugin (`src/index.ts`, one line), it declares `d3`, `localforage`, `uuid`, `lodash`,
`react`, and `vite` in one manifest, and its published `exports["./hmr"]` points at a
path that does not exist. A consumer cannot import a tracer out of it at any depth.
The fix is a package boundary, not a directory convention.

---

## 1. Phase 0: stabilize the baseline. Nothing else is planned on top of red.

Re-measured 2026-07-25 in `packages/devtool-plugin`. The previous plan's §0 was close and
wrong in four places; the corrections are marked.

### 1.1 `pnpm typecheck`: exit 1, **32** errors (previous plan said 30)

The compiler that actually runs is **TypeScript 5.9.3**, resolved from
`node_modules/.pnpm/typescript@5.9.3/`, because `packages/devtool-plugin/package.json`
declares `"typescript": "^5.9.3"` in **`dependencies`**. The workspace root pins
`typescript: 6.0.0-dev.20251226`. Two compilers in one repo, and the package-local one
wins. That is correction one and it is not cosmetic: see 1.1.a.

| Code | Count | Files |
|---|---|---|
| TS18048 possibly-undefined | 10 | `__tests__/hmr-integration/fixture-kitchen-sink/main.ts` |
| TS6133 unused local | 7 | `app.tsx` (3), `4_module-scope.ts` (2), `2_user_transform.ts` (1), `0_rxjs_devtool_patch_plugin.ts` (1) |
| TS7053 implicit-any symbol index | 4 | `4_module-scope.ts` (2), `0_DebuggerGrid.tsx` (1), `06_queries.ts` (1) |
| TS2339 property does not exist | 3 | `app.tsx` (`window.____root`) |
| TS2307 cannot find module | 3 | `0_DebuggerGrid.browser.test.tsx` |
| TS7016 no declaration file | 1 | `app.tsx` (`@hafley/rxjs-ext`) |
| TS6196 unused type | 1 | `0_store.ts` (`ArgEntity2`, line 743) |
| TS2554 wrong arg count | 1 | `4_module-scope.ts:64` |
| TS2394 overload incompatible | 1 | `2_diet_rxjs.ts:57` |
| TS2322 not assignable | 1 | `app.tsx:139` |

**1.1.a Correction: there are FOUR broken imports in the browser test, not three.**
`src/2_ui/0_DebuggerGrid.browser.test.tsx` lines 5-9:

```
import "../03_scan-accumulator"        // does not exist anywhere. NO DIAGNOSTIC under 5.9.3.
import { filter, from, ... } from "rxjs"
import { state$ } from "../0.types"    // TS2307. real file: src/0_runtime/0.types.d.ts
import { useTrackingTestSetup } from "../0_test-utils"  // TS2307. real: src/0_runtime/0_test-utils.ts
import { setNow } from "../01_helpers" // TS2307. exists nowhere.
```

TypeScript 5.9.3 silently ignores an unresolvable **side-effect-only** import
(`import "x"` with no bindings). TypeScript 6.0.0-dev reports it as TS2882. So bumping
to the root's compiler *raises* the error count. The same missing
`../03_scan-accumulator` is imported by three more files
(`rxjs-edge-cases/share.test.ts:10`, `rxjs-edge-cases/shareReplay.test.ts:10`,
`__tests__/user-transform.test.ts:967`), all invisible to `tsc` because
`tsconfig.json`'s `exclude: ["**/*.test.ts"]` glob does not match `.tsx`.

**Ordered fixes.**

| # | Fix | Removes | Verify |
|---|---|---|---|
| 1 | Delete `src/2_ui/0_DebuggerGrid.browser.test.tsx` (921 lines). Ruling below. | 3 TS2307 | `test ! -f src/2_ui/0_DebuggerGrid.browser.test.tsx` |
| 2 | Add `"**/__tests__/hmr-integration/fixture*/**"` to `tsconfig.json` `exclude`. Those are standalone fixture apps with their own `vite.config.ts`; they are not library sources. | 10 TS18048 | `pnpm typecheck 2>&1 \| grep -c TS18048` = 0 |
| 3 | Delete the 7 unused bindings (`searchTerm$2`, `it`, `bb` in `app.tsx`; `$`, `fullKey` in `4_module-scope.ts`; `compact` in `2_user_transform.ts`; `env` in `0_rxjs_devtool_patch_plugin.ts`) and the unused type `ArgEntity2` (`0_store.ts:743`). | 7 TS6133 + 1 TS6196 | `grep -c "TS6133\|TS6196"` = 0 |
| 4 | Declare the two globals once, in a new `src/globals.d.ts`: the `___rxjs_hmr_key___` unique symbol as an index-signature-bearing interface, and `interface Window { ____root?: unknown }`. | 4 TS7053 + 3 TS2339 | `grep -c "TS7053\|TS2339"` = 0 |
| 5 | Add `"references": [{ "path": "../rxjs-ext" }]` to `packages/devtool-plugin/tsconfig.json` and build `rxjs-ext` first (`pnpm --filter @hafley/rxjs-ext build`). The package's `exports.types` points at `./dist/index.d.ts`, which does not exist until it is built. | 1 TS7016 | `pnpm --filter @hafley/rxjs-ext build && pnpm typecheck` |
| 6 | Fix `2_diet_rxjs.ts:57`: the `pipe` overload set (lines 56-65) is incompatible with the implementation signature `pipe(...ops: DietOperator<unknown, unknown>[])`. Widen the implementation to `pipe(...ops: DietOperator<any, any>[]): DietObservable<any>` or narrow the overloads. | 1 TS2394 | |
| 7 | Fix `app.tsx:139`: the `unknown` value rendered as a child needs `String(...)` or a type guard. | 1 TS2322 | |
| 8 | Remove `"typescript": "^5.9.3"` from `packages/devtool-plugin` `dependencies`. Let the workspace compiler apply. **Expect the count to move**, because TS 6.0.0-dev adds TS2882 for the side-effect imports and `noUncheckedIndexedAccess` interacts differently. Re-baseline after this step, not before. | n/a | `pnpm typecheck` exits 0 |

**Ruling on the 921-line browser test: delete it.** Three receipts. (a) It imports
`state$` from `../0.types`, a path that has never existed at that depth, and
`setNow` from `../01_helpers`, which exists nowhere in the repository, so the file has
not compiled since it was written. (b) `vitest.config.ts` excludes
`**/*.browser.test.{ts,tsx}`, so it never ran under `test:run` either. (c) It tests
`DebuggerGrid`, which §7 replaces. What it covered is not lost: transcribe its
`describe` titles into a checklist comment at the top of the new
`packages/debug-ui/src/*.browser.test.tsx` in Phase 6, so the coverage intent survives
the file. Do not port the body.

### 1.2 `pnpm test:run`: exit 1. 12 of 14 files fail (previous plan named 3 failures; there are 12)

```
Snapshots  6 failed
Test Files 12 failed | 2 passed (14)
Tests       9 failed | 84 passed | 2 skipped (95)
```

**Correction two: seven of the twelve fail at collection, not at assertion.** The
previous plan named three assertion failures and missed the whole collection class.
A file that fails to import contributes zero to the "9 failed tests" number, which is
why the summary looked milder than it is.

| Failure class | File | Cause |
|---|---|---|
| collection | `0_runtime_hmr/01.patch-observable.test.ts:20` | `Cannot find module './0_test-utils'` |
| collection | `0_runtime_hmr/2_tracked-observable.test.ts:3` | `Cannot find module '../0_store'` |
| collection | `0_runtime_hmr/4_module-scope.test.ts:4` | `Cannot find module './0_test-utils'` |
| collection | `0_runtime_hmr/0_runtime.test.ts` | `No test suite found in file` |
| collection | `rxjs-edge-cases/6_plumbing-detection.test.ts:11` | `Cannot find module '../../../0_runtime/0_test-utils'` |
| collection | `rxjs-edge-cases/share.test.ts:10` | `Cannot find module '../03_scan-accumulator'` |
| collection | `rxjs-edge-cases/shareReplay.test.ts:10` | `Cannot find module '../03_scan-accumulator'` |
| assertion | `0_runtime/01.patch-observable.test.ts` | 3 inline-snapshot mismatches: extra `disable`/`enable` event pairs; received store has extra `arg2`/`call`/`fun` keys and populated `send` entries |
| assertion | `lib/2_diet_rxjs.test.ts:228, :236` | `reset()` does not restore the initial value (`{count:100}` for expected `{count:0}`) and does not defensively clone (`{items:[1,2,3,4]}` for `{items:[1,2,3]}`). `safeInitialClone` is computed and never read. |
| assertion | `rxjs-edge-cases/5_react-query-torture.test.ts:115, :153` | DEFER ordering; a `defer` body runs when it should not |
| assertion | `__tests__/user-transform.test.ts:241` | Hoisted-shim statement ordering flipped, plus a `;` |
| assertion | `__tests__/hmr-integration/hmr.integration.test.ts:154` | timeout at 10000 ms |

**Correction three:** the "6 failed snapshots" are all `toMatchInlineSnapshot`
mismatches. Zero obsolete `.snap` file keys were reported. So `vitest -u` will rewrite
source files, not delete snapshot files, and that is a different review.

Structural note found while reading: `src/0_runtime/01.patch-observable.test.ts` and
`src/0_runtime_hmr/01.patch-observable.test.ts` are both exactly 3,769 lines. Two copies
of the same suite in two directories, one of which cannot resolve its helper. Resolve
that before fixing either.

**Ordered fixes.**

| # | Fix | Verify |
|---|---|---|
| 1 | Repoint the four missing-helper imports at `src/0_runtime/0_test-utils.ts` and `src/0_runtime/0_store.ts`. These are path errors from a directory move, not missing code. | `pnpm test:run 2>&1 \| grep -c "Cannot find module"` = 0 |
| 2 | Delete the side-effect line `import "../03_scan-accumulator"` from `share.test.ts:10`, `shareReplay.test.ts:10`, `user-transform.test.ts:967`. No module has ever provided it; nothing can depend on its side effect. | same |
| 3 | Diff the two 3,769-line `01.patch-observable.test.ts` copies. Keep one, delete the other, or if they genuinely differ, rename so the difference is visible. | `find src -name "01.patch-observable.test.ts" \| wc -l` = 1 |
| 4 | `0_runtime_hmr/0_runtime.test.ts` has no `describe`/`test`. Either it is all commented out (line 3's `0_store` import is commented) or it is dead. Delete or restore. | no "No test suite found" |
| 5 | Fix `2_diet_rxjs.ts` `reset()` for real, both cases. It is a two-line fix (`this.initialValue` must be re-cloned per reset, and `safeInitialClone` must actually be used) and the failure is a genuine aliasing bug in a file the whole debugger depends on. | those 2 tests pass |
| 6 | Quarantine the remaining 7 assertion failures exactly as the previous plan's M0 said: `it.fails` / `describe.skip` with a `// BASELINE-RED 2026-07-25` comment naming the receipt. Do not chase snapshots that Phase 2/5 will invalidate anyway. | `pnpm test:run` exits 0 |

**Accept for 1.2:** `pnpm test:run` exits 0, `Test Files` shows `14 passed` or
`N passed | M skipped` with M equal to the quarantine count, and `git diff --stat`
touches only test files, `2_diet_rxjs.ts`, and `CHANGELOG.md`.

### 1.3 `pnpm build`: exit 1, `dist/` is never created

```
168 modules transformed.
[UNRESOLVED_IMPORT] Could not resolve '../pkg' in
  node_modules/.pnpm/lightningcss@1.30.2/node_modules/lightningcss/node/index.js:17:28
```

**Correction four:** the bundler is `rolldown@1.0.0-beta.53` (via `rolldown-vite@7.3.0`),
not `rolldown 1.2.0`. `dist/` does not exist after the failure, so the previous plan's
acceptance check "`dist/index.js` does not contain `lightningcss`" cannot even run today.

Root cause is unchanged and correctly diagnosed by the previous plan:
`src/index.ts` is one line, `export * from "./1_runtime_vite_plugin/1_rxjs_hmr_plugin"`,
which is a Node Vite plugin, and `vite.config.ts` sets
`build.rollupOptions.external: []`, so Rolldown is told to inline the entire Vite Node
dependency tree.

**The fix already exists in the repository and is not being used.**
`/Users/chrishafley/projects/hafley-rxjs/vite.lib.config.ts` exports `createLibConfig`,
which computes `external` from the package's own `dependencies` + `peerDependencies` and
externalizes anything under `node_modules`. Four of the six packages use it;
`devtool-plugin` hand-rolls its own inline lib config instead.

| # | Fix | Verify |
|---|---|---|
| 1 | Replace `packages/devtool-plugin/vite.config.ts`'s inline `build` block with `createLibConfig(__dirname)` from the root helper, then re-add the two plugin entries it needs. | `pnpm build` exits 0 |
| 2 | Split the entry, which `createLibConfig` alone does not do. `src/index.ts` stays the Node plugin. A second entry is not added here; after Phase 3 the Node plugin is the *only* thing this package ships, and the runtime and UI live in their own packages with their own builds. That is the structural fix and it is what makes the split worth doing. | `node -e "import('./dist/index.js')"` resolves |
| 3 | Add `"vite"` and `"oxc-parser"` and `"magic-string"` and `"lodash"` to `peerDependencies` or keep them in `dependencies` so `createLibConfig` externalizes them. Today `oxc-parser` is a devDependency and `vite` is absent entirely (only `rolldown-vite` is declared), so the helper's `external` list would miss both. | `grep -c "lightningcss\|magic-string" dist/index.js` = 0 |

### 1.4 `pnpm test:browser`: hangs after Chromium launches

Two independent causes, and the previous plan identified neither completely.

1. **Version skew, which the runner itself reports:**
   `Loaded vitest@4.0.16 and @vitest/browser@4.0.17. Running mixed versions is not
   supported and may lead into bugs`. `package.json` pins `vitest: ^4.0.16`,
   `@vitest/browser: ^4.0.16`, `@vitest/browser-playwright: ^4.0.16`; the caret let
   `@vitest/browser` float to 4.0.17.
2. **The only file matching `include: ["src/**/*.browser.test.{ts,tsx}"]` is the one
   being deleted in 1.1.** After that deletion the glob matches nothing.

| # | Fix | Verify |
|---|---|---|
| 1 | Pin all three vitest packages to one exact version (no caret): `"vitest": "4.0.16"`, `"@vitest/browser": "4.0.16"`, `"@vitest/browser-playwright": "4.0.16"`, `"@vitest/ui": "4.0.16"`. | `pnpm test:browser 2>&1 \| grep -c "mixed versions"` = 0 |
| 2 | Add `passWithNoTests: true` to `vitest.browser.config.ts`'s `test` block so an empty glob is green rather than a hang or a hard fail. | `pnpm test:browser` exits 0 in under 60 s |
| 3 | Add a single smoke browser test that mounts nothing and asserts `1 === 1`, so the runner is proven to start and stop before Phase 6 depends on it. | same, with `1 passed` |

If it still hangs with one trivial test, that is a Playwright/provider problem and it
gets its own investigation. Do not build Phase 6 on a browser runner that has never
been observed to exit.

### 1.5 Phase 0 exit criteria, as one command block

```bash
cd packages/devtool-plugin
pnpm --filter @hafley/rxjs-ext build   # unblocks TS7016
pnpm typecheck        # exit 0
pnpm test:run         # exit 0
pnpm build            # exit 0, dist/index.js exists
pnpm test:browser     # exit 0, under 60s
grep -rn "TODO BASELINE-RED" src | wc -l   # equals the quarantine count, recorded in CHANGELOG.md
```

Nothing in Phases 1-8 starts until this block is green.

---

## 2. Three rulings, made before any design

### 2.1 A row is a **span**, and for RxJS a span is a **subscription**

This is the decision that drives the whole schema, so it gets defended rather than
asserted.

The Network tab's row is an HTTP request. A request has exactly five properties that
every affordance in that panel is built on: it **starts**, it **may end**, it has a
**status**, it has an **initiator**, and it accumulates **bytes over time**. The
waterfall column exists because a request has a duration. The Timing tab exists because
that duration decomposes into phases. The Size column exists because the bytes arrive
progressively. Take away duration and there is no Network tab, there is a log viewer.

Three candidate RxJS rows:

| Candidate | Has a start | Has an end | Has a duration | Has an initiator | Accumulates | Verdict |
|---|---|---|---|---|---|---|
| **Subscription** | `subscribe()` | complete / error / unsubscribe | yes, the async lifespan | the parent subscription that created it (inner subs from `mergeMap`, `switchMap`) | emissions, over time | **chosen** |
| Emission | the `next` call | same instant | no (a point) | its subscription | nothing | rejected |
| Observable instance | construction | never (a blueprint, GC'd) | no | its `pipe` parent | nothing itself; its subscriptions do | rejected |

The receipt for "subscription is the one with a duration" is in the existing schema,
not in an argument. `src/0_runtime/0.types.d.ts:84` labels the `subscription` entity
"dual timespan: call-time scope AND async lifespan", and it is the only entity in `Hmm`
carrying a semantic end field (`unsubscribed_at`, `unsubscribed_at_end`, lines 86-87).
`Improved` (line 149-153) sprays `created_at` / `created_at_end` onto every entity, but
for `observable`, `pipe`, `operator`, and `arg` those two timestamps bracket a
*synchronous constructor call*, which is a duration of roughly zero and is not what a
waterfall is for.

The analogy is tighter than "roughly like a request", and the tightness is worth
spelling out because it is what makes the affordances transfer for free:

| HTTP | RxJS |
|---|---|
| A URL is a template; requesting it produces a request | An Observable is a template; subscribing to it produces a subscription |
| The same URL requested 5 times is 5 rows | The same Observable subscribed 5 times is 5 rows |
| The Name column shows the URL, which is shared across rows | The Name column shows the Observable label, which is shared across rows |
| A streaming response (EventSource, chunked, WS) is **one row** whose body arrives in pieces | A long-lived subscription is **one row** whose emissions arrive in pieces |
| Initiator: the script/parser that caused this request | Initiator: the parent subscription, or the `subscribe()` call site |
| Pending request: bar runs to the right edge | Live subscription: bar runs to the right edge |

The generalization, which is the point of the core package: **a row is a span**, where a
span is anything with a start, an optional end, a status, and a parent. `subscription` is
the RxJS instance of that. A traced function call is another. A sprefa dl tick, a SQLite
transaction, a per-rel write, and one semi-naive fixpoint round are four more (§9).
Emissions are not rows; emissions are **events on a span**, drawn as tick marks inside
that span's waterfall bar, and listed in the Emissions detail tab. Exactly the way
Chromium draws a chunked response as one bar rather than one bar per chunk.

Consequence to accept honestly: an application that creates one short subscription per
click produces short bars, and the waterfall looks empty. That is the same failure the
Network tab has with 200 tiny cached responses, and Chromium's answer is the same as
ours: the overview strip and the time-window brush. Do not solve it by making emissions
rows.

### 2.2 One store. `0_store_v2.ts` is deleted; `0_store.ts` becomes an adapter; the model moves to core

Receipts first.

| | `0_store.ts` (v1) | `0_store_v2.ts` (v2) |
|---|---|---|
| Class | `RxJSTracker` (line 6) | `Tracer` |
| Lines | 1030 | 280 |
| Singleton | `export const main = new RxJSTracker()` (line 676) | none exported |
| Importers outside its own test | `0_DebuggerGrid.tsx:5`, `1_MarbleDiagram.tsx:1` | **zero** |
| Entities | `observable`, `pipe`, `operator`, `operator_fun`, `subscription`, `send`, `arg`, `arg_call`, `hmr_track`, `hmr_module` | `fun`, `call`, `arg2` |
| Has a subscription lifespan | yes | no |
| Has emissions (`send`) | yes | no |
| Governing plan | none | `chat_log/2026-02-22.0.v2-decorator-refactor.md`, 6 of 10 tickets unstarted |

**Ruling.** Neither of them is the model. The model moves into
`@hafley/debug-core` as `Span` + `SpanEvent` (§5). Then:

- **v2 is deleted.** `src/0_runtime/0_store_v2.ts` (280 lines) and
  `src/0_runtime/0_store_v2.test.ts` (341 lines) are removed. Two things in it are worth
  keeping and are named here so they are ported rather than lost:
  1. **the arg-ripper budget idea** (`argRipper`, `argsDo`) becomes core's `3_project.ts`.
     The previous plan's §5.1 already specified it in full; that specification is adopted
     unchanged except for renames.
  2. **`decoratoPatronus`**, the Proxy that wraps an arbitrary function so its calls
     become traceable, becomes a *later* core feature (`traceFunction`, Phase 7,
     explicitly out of Phase 1-6 scope). It is not carried as dead code in the meantime.
- **v1 is demoted to an ingestion adapter.** `RxJSTracker` keeps everything that touches
  real RxJS: `patchObservable` (line 778), `decorateOperatorFun` (976), `decorateCreate`
  (1009), the `TRACKED_MARKER` / `PATCHED_UNSUB` symbols, and the `event$` subject
  (line 99, `DietSubject<ObservableEvent>`). It loses its accumulator. The seam is clean:
  `event$` is a single `DietSubject` that every trace point already calls
  (`this.event$.next(event)`, line 134), so the adapter is one subscription.
- **Three accumulators in v1 die with the demotion**, and one of them is a live defect:

  | Member | Line | Fate |
  |---|---|---|
  | `events$ = new EasierDietBS<ObservableEvent[]>([])` | 100 | delete. Unbounded array. |
  | `events$$ = this.event$.pipe(this.events$.scanEager((a, b) => a.concat(b)), ...)` | 102-104 | delete. `a.concat(b)` allocates a new array of length n on every single event, so accumulating N events is O(N^2) time and O(N^2) total allocation. At 10k events that is 50M element copies. This is a defect independent of everything else in this plan. |
  | `state$$` + `lol = this.state$$.subscribe()` | 137, 570 | delete last, in Phase 5, once no UI reads `state$.value.store`. |

- **`src/0_runtime/0.types.d.ts` is deleted** and its content is split: the entity shapes
  that survive move into the RxJS adapter package, the rest is superseded by core's
  `0_types.ts`. Separate defect found while reading it: **line 55 of that `.d.ts` file is
  a runtime statement**, `console.log("Bootstrapping")`, sitting in a declaration file
  alongside a commented-out `bootstrap(...)` call. A `.d.ts` with executable code in it
  is either being compiled as a module somewhere or is silently dropped; either way it
  goes.

Sequencing, so this is not a big-bang: Phase 2 adds the adapter alongside the existing
accumulator (additive, nothing deleted, both alive). Phase 5 deletes the accumulator once
the UI reads only core. The 921-line browser test is resolved in Phase 0, before any of
this (§1).

### 2.3 The self-instrumentation feedback loop is a blocking defect, and here is the test

`shouldTransformUserCode` (`src/1_runtime_vite_plugin/2_user_transform.ts:615-638`)
excludes `/0_runtime`, `/0_runtime_hmr`, `/1_runtime_vite_plugin`, and `node_modules`.
It does not exclude `/2_ui` or `/lib`. Only three files carry the `// noRxjs()` marker
that `transformUserCode` honours (`0_store.ts:5`, `2_diet_rxjs.ts:7`,
`4_module-scope.ts:12`); neither UI file does.

Today this is latent because the UI reads a snapshot. The moment the UI subscribes to a
live stream it closes: the UI creates an observable, the transform has instrumented it,
the instrument emits an event, the event advances the frame, the frame re-renders the
UI, the UI creates an observable. It does not need to be infinite to be fatal; one
render's worth of amplification per frame compounds per frame.

The exclusion has to hold at **three** levels, because any one of them alone can be
defeated by a refactor:

1. **Path exclusion.** Add `/2_ui` and `/lib` to the exclude regex, and in the new
   layout exclude the whole `packages/debug-ui` and `packages/debug-core` trees.
2. **Marker.** `// noRxjs()` at the top of every file in those trees.
3. **Runtime re-entrancy guard.** A depth counter in the recorder: `SpanRecorder`
   refuses to record while it is already inside a record. This is the only one of the
   three that survives someone importing debugger UI code into an instrumented app,
   which is exactly what happens the first time somebody embeds the panel in their own
   page.

**The test that proves it** (`packages/debug-core/src/1_recorder.test.ts` plus one unit
test in the plugin package):

```ts
// 1. Path exclusion, in the plugin package. Pure function, no runtime needed.
test("the debugger's own UI is never transformed", () => {
  for (const excluded of [
    "/x/packages/debug-ui/src/2_RowList.tsx",
    "/x/packages/debug-core/src/1_recorder.ts",
    "/x/packages/devtool-plugin/src/2_ui/0_DebuggerGrid.tsx",
    "/x/packages/devtool-plugin/src/lib/2_diet_rxjs.ts",
  ]) expect(shouldTransformUserCode(excluded)).toBe(false)
  expect(shouldTransformUserCode("/x/app/src/main.ts")).toBe(true)
})

// 2. Re-entrancy, in core. This is the one that proves the LOOP is closed,
//    not merely that a path is excluded.
test("a sink that traces back into the recorder cannot recurse", () => {
  const recorder = new SpanRecorder({ sink: reentrantSink, clock, budget: DEFAULT_BUDGET })
  // reentrantSink.push() calls recorder.addEvent(...) on every record it receives,
  // which is exactly what a UI observing its own instrumented stream does.
  const spanId = recorder.openSpan({ kind: "test", name: "outer" })
  recorder.addEvent(spanId, "emit", null, 1)
  recorder.closeSpan(spanId, { status: "completed" })
  expect(reentrantSink.records.length).toBe(3)      // open, event, close. Not 3 + N.
  expect(recorder.stats.reentrantDrops).toBe(3)     // and the drops are COUNTED
})
```

The counter matters as much as the guard. A silently-suppressed recursion is a debugger
lying about what the program did, so `reentrantDrops` renders in the status bar next to
the ring's `dropped` count (§7.3).

---

## 3. Package split

### 3.1 The four packages

`pnpm-workspace.yaml` is `packages: ["packages/*"]`, so a new package is a new directory
and nothing else.

| Directory | Name | Runtime deps | Runs in | Ships |
|---|---|---|---|---|
| `packages/debug-core` | `@hafley/debug-core` | **none** | Node 20.19+, any browser, any worker | the data model, the recorder, the ring, the projector, the index, the in-page and BroadcastChannel transports |
| `packages/debug-rxjs` | `@hafley/debug-rxjs` | none. `rxjs` is a **peerDependency** (`^7.8.0 \|\| ^8`) | anywhere rxjs runs | the `traced()` operator, `patchObservable`, `decorateCreate`, `decorateOperatorFun`, the `ObservableEvent -> TraceRecord` adapter |
| `packages/devtool-plugin` | `@hafley/rxjs-debugger` (unchanged name) | `vite`, `oxc-parser`, `magic-string`, `lodash` | Node only | the Vite plugin, the source transform, the dev-server WebSocket transport |
| `packages/debug-ui` | `@hafley/debug-ui` | `react`, `react-dom`, and whatever §4 buys | browser only | the Network-tab panel |

Dependency direction, and it is acyclic in one direction only:

```
debug-core   <- debug-rxjs   <- devtool-plugin
     ^                             (vite plugin injects debug-rxjs into user code)
     |
  debug-ui
```

`debug-ui` depends on `debug-core` for types and the index, and on nothing else in the
family. It never imports `debug-rxjs`, which is what makes §2.3's loop impossible to
re-open by an import: the UI cannot reach the instrumentation even by accident.

Why four and not three or five:

- **core and rxjs must split** because sprefa's `v6/dl` and `v6/sprefa-store` need the
  recorder without the RxJS `Observable.prototype` patching, and because the UI needs the
  model without either.
- **rxjs and the Vite plugin must split** because the plugin is Node-only
  (`oxc-parser`, `magic-string`, `vite`) and the operator it injects is browser-side.
  Today they are one package, which is exactly why `pnpm build` pulls lightningcss into a
  browser lib (§1.3).
- **a fifth transport package is rejected.** Core ships the two zero-dependency
  transports (in-page, `BroadcastChannel`; both are web standards and `BroadcastChannel`
  is a Node global since 18). The one transport with a dependency, the dev-server
  WebSocket pair, lives in `devtool-plugin`, which already depends on Vite and already
  owns a Node process. A separate package would exist only to hold `ws`.

### 3.2 `@hafley/debug-core` file layout and exports map

Numeric-prefix layering per the repo convention: 0 is the base and imports nothing
package-local.

```
packages/debug-core/
  package.json
  tsconfig.json
  src/
    0_types.ts          the contract header. Types only. No runtime code. (§5)
    1_clock.ts          LogicalClock
    2_ring.ts           RingSink
    3_project.ts        Projector (module-namespace const, no class)
    4_recorder.ts       SpanRecorder
    5_index.ts          MapSpanIndex
    6_filter.ts         Filter (module-namespace const): FilterQuery -> predicate
    7_waterfall.ts      Waterfall (module-namespace const): Span -> WaterfallBar
    transport/
      0_inpage.ts       InPageTransport
      1_broadcast.ts    BroadcastChannelTransport
      2_ndjson.ts       NdjsonCodec (module-namespace const) for file export/import
    index.ts            re-export surface
```

```jsonc
{
  "name": "@hafley/debug-core",
  "version": "0.1.0",
  "type": "module",
  "license": "MIT",
  "sideEffects": false,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".":           { "types": "./dist/index.d.ts",              "import": "./dist/index.js" },
    "./types":     { "types": "./dist/0_types.d.ts",            "import": "./dist/0_types.js" },
    "./transport": { "types": "./dist/transport/index.d.ts",    "import": "./dist/transport/index.js" },
    "./package.json": "./package.json"
  },
  "files": ["dist", "src"],
  "engines": { "node": "^20.19.0 || >=22.12.0" },
  "dependencies": {},
  "peerDependencies": {},
  "devDependencies": { "typescript": "6.0.0-dev.20251226", "vitest": "4.0.16" }
}
```

Four deliberate choices in that manifest.

- **`"dependencies": {}` is the constraint, not an accident.** It is what lets sprefa
  `link:` the package into a tree that has no bundler. Every §4 verdict is decided
  against it.
- **`"files": ["dist", "src"]` ships the TypeScript sources too.** sprefa runs
  `node --experimental-transform-types` and imports its sibling package as
  `sprefa-store-engine/src/lower/lowerSql.ts`, that is, by `.ts` path through a `link:`
  dependency. Shipping `src` keeps that door open if the built `dist` turns out to be
  awkward there. Flagged as unverified in §11: I did not confirm that Node's type
  stripping applies to files inside `node_modules` in their setup.
- **`./types` is a real subpath** so a consumer can import only the contract header. It
  compiles to an empty runtime module because `0_types.ts` has no runtime code, which is
  itself the check that the header stayed a header.
- **No `"browser"` field and no conditional exports.** One ESM build, no DOM API used
  anywhere in `src/` except inside `transport/1_broadcast.ts`, which feature-detects.

### 3.3 `@hafley/debug-rxjs` exports map

```jsonc
{
  "name": "@hafley/debug-rxjs",
  "version": "0.1.0",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".":        { "types": "./dist/index.d.ts",           "import": "./dist/index.js" },
    "./patch":  { "types": "./dist/2_patch.d.ts",         "import": "./dist/2_patch.js" },
    "./hmr":    { "types": "./dist/3_module_scope.d.ts",  "import": "./dist/3_module_scope.js" }
  },
  "dependencies": { "@hafley/debug-core": "workspace:^" },
  "peerDependencies": { "rxjs": "^7.8.0 || ^8" },
  "peerDependenciesMeta": { "rxjs": { "optional": false } }
}
```

`./hmr` is the fix for the broken `exports["./hmr"]` in the current manifest, which
points at `./src/tracking/v2/hmr/4_module-scope.ts`, a path that does not exist, while
`2_user_transform.ts:645` emits `"@hafley/rxjs-debugger/hmr"` as the default import
specifier. Any consumer outside this repository resolves that to nothing today. The
transform's default specifier changes to `"@hafley/debug-rxjs/hmr"` in the same edit.

The split of `0_store.ts` (1030 lines) across the two packages:

| Current member | Lines | Goes to |
|---|---|---|
| `patchObservable` | 778-975 | `debug-rxjs/src/2_patch.ts` |
| `decorateOperatorFun` | 976-1008 | `debug-rxjs/src/2_patch.ts` |
| `decorateCreate` | 1009-1030 | `debug-rxjs/src/2_patch.ts` |
| `RxJSTracker.event$`, `next()`, `TRACKED_MARKER`, `PATCHED_UNSUB`, `suppressSend$`, `now()`/`setNow()` | 8-134 | `debug-rxjs/src/1_tracker.ts` |
| `main` singleton + the `globalThis` pin | 676 | `debug-rxjs/src/1_tracker.ts` |
| `state$`, `state$$`, `events$`, `events$$`, `lol` (the accumulators) | 65, 100-104, 137, 570 | **deleted** in Phase 5. Replaced by `MapSpanIndex` in core. |
| `__withNoTrack`, `getObsId`, `setObsId`, `autoTrackFile`, `noAutoTrackFile` | 679-702 | `debug-rxjs/src/1_tracker.ts` |
| `06_queries.ts` (16 exports, all `Object.values().filter()`) | whole file | **deleted** in Phase 5. Replaced by `MapSpanIndex` + `Filter`. |
| `05_render-tree.ts` `renderStaticTree` | whole file | `debug-ui`, as the Pipeline detail tab's label vocabulary |
| `lib/2_diet_rxjs.ts` `DietObservable`/`DietSubject`/`DietBehaviorSubject` | 436 lines | `debug-rxjs/src/0_diet.ts`, minus the `lodash` `cloneDeep` import (core is zero-dep and this file is the reason `lodash` is in the manifest at all; replace with a 15-line structural clone or drop the clone and fix `reset()` per §1.2 fix 5) |

---

## 4. Build-vs-buy

Every figure below is from `registry.npmjs.org`, `api.npmjs.org/downloads`,
`bundlephobia.com/api/size`, and GitHub source reads on 2026-07-25. Where a figure could
not be retrieved it says **unconfirmed** rather than a guess. Six bundlephobia lookups
returned HTTP 429 after three retry rounds and are marked.

The decisive constraint, applied to every category: **`@hafley/debug-core` has zero
runtime dependencies.** A library can only be bought for `debug-ui`, which is browser-only
and already carries React. That constraint did not exist when the previous plan was
written and it reverses one of its verdicts (§4.6).

### 4.1 Virtualized row list and table semantics

Requirement: 10k to 1M rows, live filtering, sticky header, resizable columns, row
selection, keyboard navigation, and a row height that changes with the "Big request rows"
setting.

| Package | Version | Weekly downloads | License | Gzip | Last publish | React 19 |
|---|---|---|---|---|---|---|
| `@tanstack/react-virtual` | 3.14.8 | 19,599,827 | MIT | 7,440 B | 2026-07-22 | yes, `^19.0.0` explicit |
| `@tanstack/react-table` | 8.21.3 | 17,381,922 | MIT | 14,929 B | 2025-04-14 | `>=16.8`, no upper cap |
| `react-window` | 2.3.0 | 6,478,464 | MIT | 4,475 B | 2026-07-20 | yes, `^18 \|\| ^19` |
| `react-virtuoso` | 4.18.11 | 3,155,821 | MIT | 19,041 B | 2026-07-17 | yes |
| `ag-grid-community` | 36.0.2 | 3,160,640 | MIT | 346,122 B | 2026-07-22 | via separate `ag-grid-react` |
| `@glideapps/glide-data-grid` | 6.0.3 | 301,181 | MIT | 63,787 B | 2024-02-03 | **no**, peers capped at `^16.12 \|\| 17 \|\| 18` |

`@tanstack/react-virtual` is headless in the strict sense: it computes the visible range
and the translate offsets and renders nothing. That is what the Tailwind constraint
requires, because every pixel of a row has to be reachable by a utility class. It is
published four days ago, it declares `^19.0.0` in its peer range explicitly rather than
by an open upper bound, and at 7.4 kB it is the smallest thing that does variable row
heights and dynamic measurement. It does not do columns, sorting, selection, or keyboard
navigation.

`@tanstack/react-table` is the mirror image and is the intended partner: full column
model, sorting, filtering, selection, and column sizing, with no virtualization. The
composition of the two is what TanStack's own documentation recommends for large data.
Two things argue against taking it here, and neither is a size argument. First, its last
publish is 2025-04-14, fifteen months ago, against `react-virtual`'s four days; that is
a maintenance asymmetry inside one family. Second and decisively, it would own a second
copy of state the core already owns: `FilterQuery` (§5) is the filter model,
`SpanIndex.rowOrder` is the row model, and §7.2 rules that sorting is a permutation over
`rowOrder`. Adopting `react-table` means either duplicating those into its column
filter/sort state or writing an adapter that keeps two models synchronized every frame at
60 Hz. The parts of it we would actually use are the column-sizing state machine and the
header drag handle, which is about 80 lines against a 14.9 kB dependency plus a
synchronization seam. **Rejected, with the escape hatch named:** if the column set grows
past ten, or grouping or pinning is wanted, take it then and collapse `FilterQuery` into
its model rather than running both.

`react-window` v2 is a complete rewrite by Brian Vaughn, published 2026-07-20, and the
peer range moved from `^15 || ^16 || ^17 || ^18` in v1.8.9 to `^18 || ^19` in v2. It is
the smallest at 4.5 kB. It is also virtualization-only, so it competes with
`react-virtual` and not with the pair, and `react-virtual`'s dynamic measurement
(`measureElement`) is the feature that matters for two-line Size cells and the Big Rows
setting. 3 kB is not worth losing that.

`react-virtuoso` at 19 kB does both: `TableVirtuoso` renders real `<table>` DOM with
sticky headers and grouping, and `followOutput` gives stick-to-bottom for free, which is
a behaviour the Network tab has and which we would otherwise hand-write. The reason to
decline is the real `<table>` DOM: a Network-tab row is a CSS grid with a resizable
template, and a `<table>` fights that. The previous plan reached the same conclusion for
a different reason (it wanted `followOutput` and judged the hook cheaper) and the
conclusion holds.

`ag-grid-community` is the only candidate that ships every requirement with no assembly,
including ARIA and keyboard navigation, which are the two we are most likely to do badly.
It is genuinely MIT for Community. It is rejected on two constraint violations rather
than on taste: 346 kB gzip is 47x `react-window` and larger than the entire rest of this
UI, and it owns its own Sass theme system, so Tailwind cannot reach a cell. The second
one is disqualifying on its own given the styling constraint.

`@glideapps/glide-data-grid` is the strongest raw-throughput fit, canvas-rendered with
documented 200+ updates per second. Two facts kill it. Its npm publish is stale at
2024-02-03 even though the GitHub repository is still receiving pushes (last seen
2026-01-21, 5,273 stars, not archived), so what you can install is two and a half years
old. And React 19 is absent from its peer range; open issue #1021, filed February 2025,
still tracks that gap. Installing it under React 19 produces a peer conflict today.
Canvas cells also cannot be styled by Tailwind, which is the same violation as ag-grid.

**VERDICT: `@tanstack/react-virtual` 3.14.8 alone.** Column sizing, sorting, selection,
and keyboard navigation are hand-written against `RowView` and `SpanIndex.rowOrder`,
which the core already owns. Runner-up `react-virtuoso` 4.18.11 if the hand-written
stick-to-bottom plus column-resize code passes 150 lines combined.

### 4.2 Resizable split pane

Requirement: left row list, right detail pane, draggable divider, collapsible, persisted
across reloads, stacks vertically on a narrow viewport.

| Package | Version | Weekly downloads | License | Gzip | Last publish | React 19 |
|---|---|---|---|---|---|---|
| `react-resizable-panels` | **4.12.2** | 35,641,101 | MIT | 11,032 B | 2026-07-12 | yes, `^18 \|\| ^19` |
| `allotment` | 1.20.5 | 221,529 | MIT | 9,592 B | 2025-12-19 | yes, `^17 \|\| ^18 \|\| ^19` |
| `react-split-pane` | 3.2.0 | 288,960 | MIT | 3,893 B | 2026-02-19 | yes, `^17 \|\| ^18 \|\| ^19` |
| `dockview-react` | 7.0.4 | 100,182 | MIT | 80,519 B | 2026-07-22 | yes, through `^19` |
| `rc-dock` | 4.0.0-alpha.2 | 23,509 | Apache-2.0 | 60,905 B | 2025-09-04 | `>=17`, no upper cap |
| `react-mosaic-component` | 7.0.0 | 88,891 | Apache-2.0 | unconfirmed (429; unpacked 401,498 B) | 2026-07-13 | yes, `"16 - 19"` |

Correction to the question as posed: **`react-resizable-panels` is on v4, not v3.** v4.0.0
shipped 2025-12-16 and dropped React 16 and 17. v3.0.6-alpha (September 2025) already
carried `^19.0.0-rc` in its peer range, so both majors work with React 19, but v3 is no
longer `latest`. Current is 4.12.2. It has 35.6M weekly downloads, an order of magnitude
above everything else here, largely because shadcn/ui ships it as the default resizable
primitive. It persists layout with a single `autoSaveId` prop that writes to
localStorage, plus imperative `getLayout()`/`setLayout()`, which covers the persistence
requirement with no code. Same author as `react-window`.

`allotment` is modeled directly on VS Code's own Grid and SplitView, so the drag feel
matches an editor, which is arguably the right feel for a debugger panel. It is 9.6 kB,
actively maintained at 1.20.5 (December 2025), and supports `^19`. Two marks against it:
no built-in persistence, so you persist sizes yourself through `onChange`, and a stale
fork `@qwtel/allotment` (last published 2021) that surfaces in searches and is easy to
install by accident. Neither is disqualifying; it is the runner-up.

`react-split-pane` v3 is a community revival of the long-stalled `tomkp/react-split-pane`
and is the smallest at 3.9 kB. It handles a two-pane split well and does not do nested
N-way layouts or collapse-to-icon. Since the requirement today is exactly one split, this
is a real contender on size. It loses because the Network tab's detail pane collapses and
restores, and Chromium also flips the split axis on a narrow viewport, and both of those
are built into the two libraries above and would be hand-written here.

`dockview-react`, `rc-dock`, and `react-mosaic-component` are IDE-style docking managers:
tabs, floating panels, popout windows, drag-to-rearrange into a tree. All three are a
superset of what is needed and all three are 60-80 kB. Among them `dockview-react` is
clearly the healthiest (3,292 stars against rc-dock's 812, published three days ago,
zero-dependency core with framework wrappers, `toJSON()`/`fromJSON()` persistence built
in); `rc-dock`'s `latest` dist-tag being a **4.0.0-alpha.2** from September 2025 is a real
flag against depending on it. If the panel later grows into full docking, take
`dockview-react`; taking it today buys 70 kB of tab manager for one divider.

**VERDICT: `react-resizable-panels` 4.12.2.** Runner-up `allotment` 1.20.5 if the VS Code
interaction model turns out to matter more than the free persistence.

### 4.3 Waterfall / timeline renderer

This is the category the whole UI turns on, so it gets the most evidence.

| Package | Version | Weekly downloads | License | Gzip | Last publish | Shape |
|---|---|---|---|---|---|---|
| `d3-scale` | 4.0.2 | 68,986,257 | ISC | 16,023 B | 2021-09-24 | scale math; pulls d3-array, d3-interpolate, d3-format, d3-time, d3-time-format |
| `d3-axis` | 3.0.0 | 16,631,093 | ISC | 1,210 B | 2021-06-09 | tick and label SVG |
| `d3` (full) | 7.9.0 | 16,570,935 | ISC | 92,006 B | 2024-03-12 | 5.7x the two above for modules a waterfall never touches |
| `@visx/scale` | 4.0.0 | 2,923,507 | MIT | 17,525 B | 2026-06-11 | JSX wrapper over d3-scale |
| `@visx/axis` | 4.0.0 | 1,358,623 | MIT | 15,189 B | 2026-06-11 | JSX axis |
| `uPlot` | 1.6.32 | 490,659 | MIT | 21,856 B | 2025-03-14 | canvas time-series, series model |
| `echarts` | 6.1.0 | 4,328,998 | Apache-2.0 | 367,958 B | 2026-05-19 | `custom` series can express lanes |
| `recharts` | 3.10.1 | 54,771,295 | MIT | 147,530 B | 2026-07-25 | declarative SVG chart tree |
| `vis-timeline` | 8.5.2 | 256,041 | Apache-2.0/MIT | 118,503 B | 2026-07-15 | grouped bars on a time axis, zoom/pan |
| `frappe-gantt` | 1.2.2 | 189,587 | MIT | 14,468 B | 2026-02-25 | day/week Gantt |
| `react-flame-graph` | 1.4.0 | 9,131 | MIT | 7,432 B | 2020-02-08 | abandoned, React 15/16 peers only |
| `speedscope` | 1.25.0 | 65,069 | MIT | unconfirmed (bundlephobia InstallError) | 2025-12-03 | standalone application, not a component |

**The decisive evidence is what Chromium itself does.** Read from
`ChromeDevTools/devtools-frontend` on GitHub:
`front_end/panels/network/NetworkWaterfallColumn.ts` imports **zero** chart libraries. It
calls `this.canvas.getContext('2d')` at line 400 and then hand-written `drawLayers`,
`drawEventDividers`, `buildSimplifiedBarLayers`, and `decorateRow` methods draw directly
into `CanvasRenderingContext2D`. The time-to-pixel math lives separately in
`front_end/models/network_time_calculator/NetworkTimeCalculator.ts`, whose
`computePosition(time: number): number` at line 111 is a hand-rolled linear scale,
functionally `d3.scaleLinear()` written from scratch. The reference implementation of the
exact affordance being cloned buys nothing in this category.

That is not by itself a reason to hand-roll; Chromium also has no bundle-size pressure and
a full-time team. So take each candidate on its merits.

`d3-scale` plus `d3-axis` is the honest "buy just the math" option, and it is what
`@visx/*` wraps. For our case the scale is `(time - window.min) / (window.max -
window.min)`, which `Waterfall.layout` already computes and returns as fractions in the
header (§5, `WaterfallBar`). That is one subtraction and one division. `d3-scale` at
16 kB plus five transitive packages, last published 2021-09-24, to replace two arithmetic
operations is not a trade. The part of d3 that is genuinely non-trivial is **nice tick
selection** for the axis: choosing 1/2/5-times-a-power-of-ten boundaries so the axis reads
`0, 50 ms, 100 ms` rather than `0, 47 ms, 94 ms`. That algorithm lives in `d3-array`'s
`ticks()`/`tickIncrement()`, which is a much smaller package than `d3-scale` and is the
only piece worth importing. I could not confirm `d3-array`'s standalone version and gzip
figure in this pass, so it is flagged in §11 and the fallback is stated below.

`@visx/scale` and `@visx/axis` at 17.5 kB and 15.2 kB are React-idiomatic wrappers over
the same d3 math with explicit React 19 peers and a 2026-06-11 publish, so they are
better maintained than the raw d3 modules they wrap. They lose to the same argument: they
are a scale function and an axis renderer, and the scale is two operations. If the axis
grows a log scale or a brushable zoom with animated transitions, revisit; `@visx` is the
right thing to revisit with.

`uPlot` is a genuinely excellent canvas time-series engine, millions of points at 60 fps,
21.9 kB. Its model is one chart rendering N *series* over a shared axis. Our model is N
independent *rows* with independent lifespans, each with its own start and end, inside a
virtualized list that scrolls. Expressing that as series means one uPlot instance per row
or a single instance with one series per row and manual gap handling, and neither reaches
hundreds of rows. Wrong data model, not wrong quality.

`echarts` at 368 kB and `recharts` at 147.5 kB can both technically draw this: echarts via
its `custom` series `renderItem` callback, which is how the published Gantt-via-ECharts
examples work, and recharts via a composed `<BarChart layout="vertical">`. Both are
architected to own one chart's layout and diffing, and here the layout is owned by the
virtualizer and the diffing is owned by React. Putting either inside a virtualized row
means the chart re-lays-out on every scroll. echarts is also larger than ag-grid, which
was disqualified in §4.1 partly on size; the same standard applies. Record echarts as the
escape hatch the previous plan recorded it as: if the waterfall grows brushable zoom,
pan, and a shared crosshair, 368 kB buys a lot of that.

`vis-timeline` is the closest in spirit of anything on this list: it renders grouped
horizontal bars on a zoomable, pannable time axis, which is a waterfall. It is rejected on
its `peerDependencies`, which are hard rather than optional and include `moment`,
`vis-data`, `vis-util`, `@egjs/hammerjs`, `xss`, and `keycharm`. Adopting it means
adopting moment.js in 2026, and the total is 118.5 kB before the peers.

`frappe-gantt` at 14.5 kB is the right size and the wrong resolution: its drag-to-
reschedule interaction and day/week granularity target project management, not
millisecond timing. `react-flame-graph` last published 2020-02-08 with React 15/16 peers
is abandoned. `speedscope` is a standalone application you feed a profile file, not an
installable component, and is a flamegraph rather than a timeline; bundlephobia could not
install it to size it.

**VERDICT: write the waterfall renderer, and buy only `ticks()`.**

- **Geometry**: `Waterfall.layout` in core, zero dependencies, returns fractions. Already
  specified in §5.
- **Axis ticks**: `d3-array`'s `ticks`/`tickIncrement` if the standalone package confirms
  small; otherwise `d3-scale` 4.0.2 at 16 kB, or a 25-line nice-number function. Decide by
  measurement in Phase 6, not now. This is the only open library question in the plan.
- **Rendering, stage 1**: DOM. Three phase `<div>`s per row plus at most 24 tick `<div>`s,
  Tailwind-styled, `left`/`width` inline per §7.6. At 40 visible rows that is at most 1,080
  nodes, which React reconciles comfortably. Over 24 ticks, `WaterfallBar.hiddenTicks`
  drives a density shade instead of marks, so the node count is bounded by construction.
- **Rendering, stage 2, conditional**: one `<canvas>` overlaying the entire waterfall
  column, scroll-synced to the virtualizer, drawn in one pass. This is literally
  Chromium's architecture (one canvas for the column, not one per row). Trigger: Phase 6's
  frame-budget check failing at 500 visible-eligible rows. The swap is behind the
  unchanged `WaterfallBar` type, so it is one file.

Runner-up if hand-rolling is refused outright: `@visx/scale` + `@visx/axis` for the axis
and hand-drawn bars regardless, because no candidate on this list draws a per-row bar
inside someone else's virtualized list.

### 4.4 State store

The previous plan gave zustand, valtio, and jotai a shared one-line dismissal. That
violates the standing law, so here is the analysis, and it changes the answer.

| Package | Version | Weekly downloads | License | Gzip | Last publish | `useSyncExternalStore` |
|---|---|---|---|---|---|---|
| `zustand` | 5.0.14 | 47,290,537 | MIT | 486 B | 2026-05-28 | yes, required peer `use-sync-external-store >=1.2.0` |
| `jotai` | 2.20.2 | 5,522,319 | MIT | 4,068 B | 2026-07-14 | **no**, `useReducer` by deliberate design |
| `valtio` | 2.3.2 | 1,922,022 | MIT | 2,589 B | 2026-05-01 | yes, `src/react.ts:131` |
| `@tanstack/store` + `react-store` | 0.11.0 | 26,346,445 | MIT | 2,225 B | 2026-04-17 | yes, `useSyncExternalStoreWithSelector` |
| `nanostores` + `@nanostores/react` | 1.4.1 / 1.1.0 | 6,834,392 | MIT | unconfirmed (429) | 2026-07-20 | yes |
| `mobx` + `mobx-react-lite` | 6.16.1 | 3,738,416 | MIT | 18,469 B | 2026-06-08 | yes, via shim |
| plain RxJS + `useSyncExternalStore` | 7.8.2 | 98,112,132 | Apache-2.0 | 17,766 B untree-shaken | 2025-02-22 | manual |

The correction that changes the answer: **there are two kinds of state here and they want
different things.**

**Kind one, the frame stream.** 60 Hz, driven by `Pump.getSnapshot()`, one version
integer, one index object. This wants exactly `useSyncExternalStore` and nothing else.
`Pump` in §5 *is* the `useSyncExternalStore` contract, verbatim. Putting any store library
between the ring and React inserts one copy per frame of a structure that is already
identity-stable by design, and none of the seven candidates models a bounded queue drained
on rAF. **No library. This part of the previous plan's verdict was right.**

**Kind two, the UI control state.** Filter query, selected span id, open detail tab,
column widths, sort mode and direction, preserve-log flag, paused flag, budget preset.
Roughly ten fields, changed by human clicks, read by roughly a dozen components at
different depths. Prop drilling ten fields through a toolbar, a filter bar, an overview
strip, a row list, and six detail tabs is the thing a store exists to prevent, and React
context re-renders every consumer on any field change. **This part wants a store, and the
previous plan did not distinguish it from kind one.**

`zustand` at 486 B is the smallest thing that solves kind two, and its own
`peerDependencies` list `use-sync-external-store` as required, which is the direct
confirmation that it is tearing-safe rather than an inference. Selector reads
(`useStore(s => s.filterQuery)`) give per-field re-render scoping with no memo work.
47.3M weekly downloads.

`jotai` is rejected on a specific, sourced fact rather than a preference: `useAtomValue`
uses `useReducer` instead of `useSyncExternalStore`, which is a deliberate choice by its
maintainer to preserve React concurrent time-slicing, at the documented cost of allowing
brief tearing. For app state that is a reasonable trade. For a debugger, a UI that briefly
displays a filter that is not the filter being applied is a bug report about the debugger.

`valtio` at 2.6 kB is confirmed tearing-safe by source read (`pmndrs/valtio/src/react.ts`
line 131 calls `useSyncExternalStore`) and its proxy-mutation API with `proxy-compare`
gives fine-grained scoping without writing selectors. It is a genuine contender and loses
narrowly: proxy-based mutation tracking is a second reactivity system inside a page that
already has one, and the debugger's own §2.3 loop makes "one fewer proxy in the process"
worth something concrete rather than aesthetic.

`@tanstack/store` at 2.2 kB is the closest literal match to the requirement, confirmed by
source read of `TanStack/store/packages/react-store/src/useSelector.ts` calling
`useSyncExternalStoreWithSelector`, the selector-aware variant. It is the runner-up. Its
26.3M weekly downloads is inflated by transitive pulls from TanStack Table and Query
rather than direct adoption, which is worth noting but is not an argument against it.

`nanostores` is framework-agnostic with a confirmed `useSyncExternalStore` React binding
and would matter if `debug-core` needed a reactive layer. It does not: core is a ring and
a map. For a browser-only UI layer the framework-agnostic property buys nothing.

`mobx` at 18.5 kB is tearing-safe through the shim, but it carries an open issue (#4608)
about React Strict Mode calling unsubscribe-then-resubscribe without a snapshot read,
which breaks its reaction lifecycle, and Strict Mode is on in every React 19 dev build.
It is also the heaviest here and a class/decorator model for ten fields.

Plain RxJS wired to `useSyncExternalStore` is legitimate and is close to what
`@tanstack/store` does internally. It is rejected for one reason specific to this project
and it is not a size reason: **importing real RxJS into the debugger UI puts instrumented
code inside the instrument.** `2_diet_rxjs.ts` exists precisely to avoid that
(its header, lines 1-6), and §2.3 makes the loop a blocking defect. This is the same
reason the previous plan rejected `@hafley66/signals` and it applies with more force now.

**VERDICT: no library for the frame stream (`Pump` + `useSyncExternalStore`), and
`zustand` 5.0.14 for the ten fields of UI control state.** Runner-up `@tanstack/store`
0.11.0. `jotai` rejected on a sourced tearing trade-off, RxJS rejected on the
self-instrumentation loop.

### 4.5 Transport

Three distinct topologies, and the previous plan's table only considered the first two.

| Topology | Producer | Consumer | Needs |
|---|---|---|---|
| A. same page | recorder in the page | panel in the same page | nothing, direct call |
| B. page to page | recorder in the app tab | panel in a second tab | structured clone, same origin |
| C. **Node to browser** | recorder in the sprefa process | panel in a browser | a socket, a wire codec, reconnect |

Topology C is new and is why constraint 1 exists.

#### 4.5.a Framing and RPC

| Package | Version | Weekly downloads | License | Gzip | Last publish |
|---|---|---|---|---|---|
| `ws` | 8.21.1 | 241,560,546 | MIT | 226 B | 2026-07-14 |
| `birpc` | 4.0.0 | 10,576,553 | MIT | 1,725 B | 2025-12-13 |
| `partysocket` | 1.3.0 | 2,749,339 | MIT | 4,031 B | 2026-06-23 |
| `socket.io` / `socket.io-client` | 4.8.3 | 16.8M / 13.7M | MIT | unconfirmed (429; client unpacked 1,417,815 B) | 2025-12-23 |
| `BroadcastChannel` / `MessageChannel` | web standard | n/a | n/a | 0 | n/a |
| `node:inspector` / CDP | Node built-in | n/a | n/a | 0 | n/a |

`ws` has the highest weekly download count of any package in this entire research pass at
241.5M, and the evidence that matters is more specific than popularity: the
`TanStack/devtools` `packages/event-bus/package.json`, pushed 2026-07-24, has exactly one
runtime dependency, `"ws": "^8.18.3"`. The most directly comparable tool in this space,
built this month, made this choice.

`birpc` at 1.7 kB is transport-agnostic bidirectional typed RPC over any `post`/`on` pair.
It is what Vitest UI uses between its Node backend and its client, what Vitest's worker
pools use over `MessageChannel` and IPC, and what `@vitejs/devtools-rpc` is built on.
The relevant question is whether we need RPC or only a push feed. We need both: frames go
one way, and Record/Stop, Clear, budget preset, and Preserve log all have to travel back
to the recorder in topology C. That is bidirectional typed RPC, which is exactly the thing
birpc is. Writing it is a message-id map and a promise table, roughly 80 lines, against
1.7 kB from the library Vitest depends on.

`partysocket` at 4 kB is a browser WebSocket wrapper that reconnects with exponential
backoff and nothing else. It does not frame and does not serialize. Reconnect matters more
for a dev tool than it first appears, because the Node process being debugged restarts
constantly. Held as a conditional: take it if hand-written reconnect passes 40 lines.

`socket.io` adds rooms, namespaces, and HTTP long-polling fallback. None of the three is
needed for a localhost dev connection between two processes on the same machine, and the
client is 1.4 MB unpacked. Rejected on scope, not on quality.

`BroadcastChannel` covers topology B at zero cost and is a Node global since 18, so the
same code path also works between two Node processes on one machine. It ships in
`debug-core/transport` because it has no dependency. It cannot cross a process boundary
to a browser, so it does not cover C.

`node:inspector` and CDP are the wrong tool: they carry V8's own protocol events, not our
`Frame`. Relevant only if the goal were to render CDP traces, which it is not. Recorded so
the option is visibly considered rather than missed.

**VERDICT (framing): `ws` 8.21.1 on the Node side, native `WebSocket` in the browser,
`birpc` 4.0.0 for the typed control channel.** Both live in `devtool-plugin`, which
already depends on Node and Vite, so `debug-core` stays at zero dependencies.
`partysocket` conditional on hand-written reconnect exceeding 40 lines.

#### 4.5.b Value serialization

| Package | Version | Weekly downloads | License | Gzip | Last publish |
|---|---|---|---|---|---|
| `devalue` | 5.8.2 | 10,569,050 | MIT | 5,065 B | 2026-07-20 |
| `superjson` | 2.2.6 | 8,683,452 | MIT | unconfirmed (429; unpacked 92,791 B) | 2025-11-27 |
| `@ungap/structured-clone` | 1.3.3 | 74,669,497 | ISC | unconfirmed (429; unpacked 28,655 B) | 2026-07-10 |

All three solve the problem of getting `Date`, `Map`, `Set`, `RegExp`, `undefined`,
`BigInt`, and `Error` through JSON. `devalue` additionally preserves circular references
and repeated-object identity, which `superjson` does not target; it is SvelteKit's own
serializer. `@ungap/structured-clone` polyfills the structured-clone algorithm itself and
is a clone primitive rather than a text codec; its 74.7M weekly downloads are almost
certainly transitive.

**They all buy something `Frame` does not need, because §8.1 designed the problem away.**
`ProjectedValue` has explicit `{ kind: "undefined" }`, `{ kind: "bigint"; text }`,
`{ kind: "symbol"; text }`, and `{ kind: "failure"; name; message; stack }` arms precisely
so that plain JSON is lossless. Cycles are already collapsed to
`{ kind: "elided"; reason: "cycle" }` by the projector, so there is nothing for `devalue`'s
cycle handling to preserve. Buying a serializer here would be paying to carry types the
projector has already refused to emit.

The corroborating evidence is that a comparable tool reached the same place independently:
`TanStack/devtools/packages/event-bus/src/utils/json.ts` does not use any of the three. It
hand-writes a roughly 25-line `JSON.stringify`/`parse` reviver pair special-casing only
`bigint`. We do not need even that, because `bigint` never reaches the wire as a bigint.

**VERDICT (serialization): plain `JSON.stringify` / `JSON.parse`, no library**, guarded by
the round-trip rail in §8.1. Reach for `devalue` 5.8.2 only if a future record type
genuinely needs identity preservation, which would first require overturning the
projector's cycle rule.

### 4.6 Ring buffer

**This verdict reverses the previous plan**, and the reason is the new constraint, not new
information about the packages.

| Package | Version | Weekly downloads | License | Gzip | Last publish |
|---|---|---|---|---|---|
| `mnemonist` (whole) | 0.40.4 | 13,356,528 | MIT | 22,916 B whole package; `circular-buffer` subpath unconfirmed | 2026-04-30 |
| `denque` | 2.1.0 | 32,122,830 | Apache-2.0 | 1,568 B | 2022-07-18 |
| `double-ended-queue` | 2.1.0-0 | 811,278 | MIT | unconfirmed (429) | 2015-01-05 |

`mnemonist`'s `CircularBuffer` is a real fixed-capacity ring with O(1) push and automatic
oldest-eviction, typed-array-backed for numeric capacities, published three months ago,
13.4M weekly downloads. The previous plan measured its root import at 2.81 kB gzip under
Vite 8 with Rolldown tree-shaking and recommended buying it, and also documented that the
deep subpath `mnemonist/circular-buffer` is **CJS-only** (its `exports["./*"]` declares
`require` and `types` with no `import` condition, so a native-ESM deep import throws
`ERR_PACKAGE_PATH_NOT_EXPORTED`). That measurement is still valid and that trap is still
real. The whole-package figure of 22,916 B is the untree-shaken grab-bag of BKTree, Trie,
SuffixArray and dozens of unrelated structures.

`denque` is the deque inside `ioredis`, which explains 32.1M weekly downloads. It is
mature rather than abandoned: unchanged since 2022-07-18 because it is finished. It is a
double-ended queue with O(1) push and shift at both ends and **no capacity cap**, so the
drop-oldest policy is still hand-written on top. Buying it means buying the deque and
writing the ring.

`double-ended-queue` last published 2015-01-05, eleven years ago, 811k weekly downloads,
and denque's own README presents it as the slower predecessor denque was written to
replace. Its `latest` tag is `2.1.0-0`, a prerelease suffix. Superseded.

**What changed since the previous plan.** `RingSink` now lives in `@hafley/debug-core`,
whose manifest is `"dependencies": {}` (§3.2), and that is the property that lets sprefa
`link:` it into a Node tree with no bundler, no tree-shaking, and no ESM/CJS negotiation.
Under Rolldown in a browser bundle, 2.81 kB tree-shaken is a fair price for maintained
wraparound arithmetic. Under `node --experimental-transform-types` with a `link:`
dependency, there is no tree-shaking, the resolved cost is the whole package, and the
CJS-subpath trap becomes a live hazard rather than a documented footnote.

The thing being bought is also small and fully specified: a pre-allocated array, a head
index, a count, and modulo arithmetic. §6.2 is 20 lines of pseudo-code. The part that
carries actual risk is off-by-one in wraparound, and that is what the test suite in
Phase 1 exists for: push 100,000 records into a `RingSink(8192)` and assert
`dropped === 91808`, `size === 8192`, and that `drain()` returns exactly the last 8,192 in
push order.

**VERDICT: write it, roughly 40 lines, zero dependencies.** This is the one category where
the constraint makes building correct. Runner-up if the constraint is ever relaxed:
`mnemonist` 0.40.4 by **root** import only, never the deep subpath.

### 4.7 The span and trace data model itself

The previous plan did not survey this, and it is the largest buy opportunity in the whole
design: the "span with a start, an end, a parent, attributes, and events" model is
standardized.

| Package | Version | Gzip | Direct deps | License | Browser without polyfills |
|---|---|---|---|---|---|
| `@opentelemetry/api` | 1.9.1 | 4,568 B | 0 | Apache-2.0 | yes |
| `@opentelemetry/core` | 2.10.0 | 4,881 B | 1 | Apache-2.0 | yes |
| `@opentelemetry/sdk-trace-base` | 2.10.0 | 9,812 B | 1 | Apache-2.0 | yes |
| `@opentelemetry/sdk-trace-web` | 2.10.0 | 13,241 B | 2 | Apache-2.0 | yes |

OpenTelemetry's `Span` interface is close to what §5 declares:
`spanContext()`, `setAttribute`, `setAttributes`, `addEvent(name, attrs?, startTime?)`,
`addLink`, `setStatus`, `updateName`, `end(endTime?)`, `isRecording()`,
`recordException()`. The dependency weight is not disqualifying: 13.2 kB gzip for the
browser SDK is smaller than the virtualizer plus the split pane. Three specific facts
disqualify it as the **core** model:

1. **`OTEL_SPAN_EVENT_COUNT_LIMIT` defaults to 128.** Beyond that the SDK drops events and
   records `droppedEventsCount`. OTel's model assumes request-scoped spans that start and
   end quickly with events as sparse markers ("cache miss", "retry"), not a long-lived span
   accumulating a dense emission stream. §2.1's whole ruling is that a subscription is a
   long-lived span with a dense event stream. Raising the limit per span defeats the rail
   it exists for; restructuring emissions into child spans means one row per emission,
   which §2.1 rejects.
2. **No shipped exporter feeds a live local UI.** `SpanExporter` is
   `export(spans, callback)` plus `shutdown()`, and the shipped implementations are
   `ConsoleSpanExporter` and `OTLPTraceExporter` (batch to a collector over HTTP or gRPC).
   The interface is genuinely pluggable and a WebSocket exporter is about 20 lines, so this
   is a cost rather than a blocker, but it means the live path is written either way.
3. **Browser context propagation wants `zone.js`.** Node has
   `@opentelemetry/context-async-hooks` over `AsyncLocalStorage`; the browser recommendation
   is `@opentelemetry/context-zone`, because there is no native async-context primitive
   (TC39 `AsyncContext` is unshipped). Explicit span passing avoids it entirely, which is
   what §9.3 does, but then most of what the SDK offers is unused.

I could not obtain a published `startSpan()` throughput number. The official benchmarks
page is a live chart fed by an external `data.js` that could not be resolved to numeric
values, and the spec's `performance-benchmark.md` describes methodology, not results.
Flagged in §11: if per-span overhead becomes the deciding factor, it needs a local
microbenchmark, not a citation.

**The User Timing API** (`performance.mark` / `performance.measure` /
`PerformanceObserver`) is the zero-dependency, cross-runtime alternative, and it is real:
Node's `perf_hooks` has conformed to User Timing Level 3 since v16.0.0. `detail` is typed
`any` in the IDL but the spec runs it through StructuredSerialize, so it is
structured-clone-only, which our `ProjectedValue` already satisfies. And Chrome 129 shipped
a **Performance panel extensibility API**: a `performance.measure` whose
`detail.devtools` is `{ dataType: "track-entry", track, trackGroup, color, tooltipText,
properties: [string, string][] }` renders as a custom track in the Performance panel, with
`console.timeStamp` added later (Chrome 134) as a lower-overhead variant.

That is a genuinely attractive free renderer and it is still not the core model, for four
reasons: parenting is by string name rather than a real parent pointer, there is no status
field, the global performance timeline buffer is finite (the resource-timing buffer
defaults to 250 entries; a general mark/measure cap could not be confirmed and is flagged
in §11) and will silently drop at 10,000 events per second, and decisively the
extensibility API is a **record-then-inspect** workflow tied to starting a Performance
recording, not a live feed into an already-open panel. The requirement is a live
Network-tab waterfall.

**Embeddable viewers** were surveyed so that "write a UI" is a conclusion rather than an
assumption. Perfetto UI is embeddable through a documented `window.open` plus `postMessage`
protocol carrying `{ perfetto: { buffer, title, fileName?, url? } }` after a PING/PONG
handshake (the channel is not buffered, so you poll PING every 50-250 ms until PONG), but
its model is load-one-trace-and-explore, not live append. No `@perfetto/trace_processor`
npm package exists; the WASM engine ships inside the UI, as a Python package, or as an RPC
server. `speedscope` is a flamegraph explorer for CPU profiles, the wrong data shape.
`jaeger-ui` is Apache-2.0 React but is not published to npm as a standalone component, and
is architected for backend distributed traces. `zipkin-lens` is not on npm at all; it ships
inside a Java server distribution. `@grafana/faro-web-sdk` is instrumentation with no local
UI. **`@tanstack/devtools`** is the one structurally aligned candidate: a live event bus
with a plugin architecture, `CustomEvent` dispatch, a WebSocket/SSE server bridge, and
`BroadcastChannel` cross-tab replication. It does not ship a waterfall, so adopting it
means writing the panel anyway, but it means writing the panel against an existing live
transport. It is the runner-up for topology C in §4.5 and is worth a second look if the
`ws` + `birpc` pair turns into more glue than expected.

**VERDICT: our own `Span` / `SpanEvent` model (§5), with two interop exports rather than
an adopted runtime.**

1. **Chrome Trace Event Format** as an export target, so a trace can be dropped into
   `ui.perfetto.dev` through the documented postMessage protocol. Phase 8.
2. **Optional User Timing mirroring**: a `PerformanceMarkSink` implementing `Sink` that
   also emits `performance.measure` with the Chrome 129 `detail.devtools` shape, so spans
   show up in the Performance panel for free. Zero dependencies, opt-in, Phase 8.
3. **OTLP** noted as a future third export target, not adopted as the model.

### 4.8 The RxJS instrumentation mechanism

Not a package purchase, but it is the same question and the previous plan answered it
implicitly.

RxJS `latest` on the registry is **7.8.2**. **RxJS 8 is not released**: the newest is
`8.0.0-alpha.14` (2026-01-12), and issue ReactiveX/rxjs#6367 records that 8 is on hold
pending TC39 `Observable` standardization. Design against 7.x.

The only first-class hooks RxJS ships are `config.onUnhandledError` and
`config.onStoppedNotification`, both error-path only and both explicitly outside the
subscription lifecycle. There is no `Subscriber`-level hook for subscribe, next, or
unsubscribe. So there is nothing to buy; there are three mechanisms and we already have
two of them:

| Mechanism | Prior art | Cost | Our use |
|---|---|---|---|
| Runtime prototype patch of `Observable.prototype.subscribe` | `rxjs-spy` (cartant) | global and stateful; conflicts with any other patcher; every `subscribe` in the process pays interception | keep as `@hafley/debug-rxjs/patch`, opt-in, browser default |
| Build-time source rewrite | `rxjs-insights` (ksz-ksz), via Webpack/ESBuild plugins with `declareConstructor`/`declareCreator`/`declareOperator` | precise source locations and per-call-site opt-in; its own docs warn it has "a considerable performance and memory footprint" and should not be enabled in production | keep as `devtool-plugin`'s Vite transform, which is the same bet, independently corroborated |
| Explicit opt-in operator | none surveyed | requires the instrumented code to name what it wants traced | **new**, and it is the one sprefa needs: `traced()` in §9.3 |

That third row is the whole reason this plan exists. Neither prior-art tool offers a
mechanism that works in a bundler-free Node process at sustained rate, and both of the
existing mechanisms in this repository are browser-and-bundler mechanisms.

### 4.9 Verdict summary

| Category | Verdict | Runner-up | Reverses previous plan |
|---|---|---|---|
| Virtualized row list | `@tanstack/react-virtual` 3.14.8, alone | `react-virtuoso` 4.18.11 | no |
| Table semantics | **build** (column sizing, sort, selection over `RowView`) | `@tanstack/react-table` 8.21.3 | new question |
| Split pane | `react-resizable-panels` 4.12.2 | `allotment` 1.20.5 | new question |
| Waterfall renderer | **build** (Chromium does; canvas stage 2) | `@visx/scale` + `@visx/axis` 4.0.0 | yes, marble-strip design replaced |
| Axis nice-ticks | `d3-array` `ticks()`, version unconfirmed; fallback `d3-scale` 4.0.2 or 25 lines | decide in Phase 6 | new question |
| Frame-stream state | **build** (`Pump` + `useSyncExternalStore`) | none | no |
| UI control state | `zustand` 5.0.14 | `@tanstack/store` 0.11.0 | yes, previous plan rejected all stores |
| Transport framing | `ws` 8.21.1 + native `WebSocket` + `birpc` 4.0.0 | `@tanstack/devtools` event bus | extends |
| Transport reconnect | conditional `partysocket` 1.3.0 | hand-written | new question |
| Serialization | **build** (plain JSON; the type is designed for it) | `devalue` 5.8.2 | no |
| Ring buffer | **build**, ~40 lines | `mnemonist` 0.40.4 root import | **yes** |
| Span/trace model | **build** (§5), export to Chrome Trace Event Format and User Timing | OpenTelemetry as an export target only | new question |
| RxJS hook | three ingestion front-ends, `traced()` is the new one | none available | extends |

Total new runtime dependencies across all four packages:
`@tanstack/react-virtual`, `react-resizable-panels`, `zustand`, possibly `d3-array`, in
`debug-ui` only; `ws` and `birpc` in `devtool-plugin` only; **zero in `debug-core` and
`debug-rxjs`**.

---

## 5. The contract header: `packages/debug-core/src/0_types.ts`, in full

Standing law: every class gets its interface equivalent, declared exactly once, in the
header, under the plain domain word. No `I` prefix, no `export type Foo = SomeFoo`
aliases. A class never shares a name with its interface, because a file that imports the
interface and declares the class would collide; the interface takes the domain word and
the class takes the mechanism.

| Interface (header) | Class or const | File | Why a class, or why not |
|---|---|---|---|
| `Clock` | `class LogicalClock` | `1_clock.ts` | per-instance counter |
| `Sink`, `FrameSource` | `class RingSink` | `2_ring.ts` | per-instance buffer + counters |
| `Projector` | `const BudgetProjector` | `3_project.ts` | **no class.** Pure functions over an argument budget. Module-namespace object. |
| `Recorder` | `class SpanRecorder` | `4_recorder.ts` | per-instance open-span map, sequence counters, re-entrancy depth |
| `SpanIndex` | `class MapSpanIndex` | `5_index.ts` | per-instance maps |
| `Filter` | `const SpanFilter` | `6_filter.ts` | **no class.** Query in, predicate out. |
| `Waterfall` | `const WaterfallLayout` | `7_waterfall.ts` | **no class.** Span + time range in, bar out. |
| `Transport` | `class InPageTransport`, `class BroadcastChannelTransport` | `transport/*.ts` | per-instance channel and listener set |
| `Pump` | `class AnimationFramePump` | `debug-ui/src/1_pump.ts` | per-instance rAF handle and listener set |

Full header:

```ts
/**
 * 0_types.ts: the entire @hafley/debug-core contract in one C-header file. Every
 * other file in this package, and every consumer package, imports its cross-file
 * types from here. Numbering law: 0 is the base, so nothing this file imports may
 * be package-local. Today it imports nothing at all, which is the strongest form
 * of that rule and is worth keeping.
 *
 * This file is types / interfaces / type-aliases ONLY. No runtime code, no classes
 * with bodies, no functions, no const. It compiles to an empty module and the
 * `./types` export subpath exists so a consumer can prove that.
 *
 * Sections mirror the data flow: identity and time -> projected values -> spans and
 * events -> the wire (records and frames) -> production (clock, sink, recorder) ->
 * consumption (index, filter, waterfall, rows) -> transport -> UI pump.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Identity and time.
// ─────────────────────────────────────────────────────────────────────────────

/** Unique within one session. Minted by the Recorder as `${sessionId}:${counter}`. */
export type SpanId = string;
/** Unique within one session. Minted as `${spanId}#${counter}`. */
export type EventId = string;
/** One process, one page load, or one HMR generation. See §6 lifetimes. */
export type SessionId = string;

/**
 * A monotonic integer that only ever increases, minted by the Clock. This is the
 * ordering key for everything. Wall time is recorded alongside it and is NEVER
 * used for ordering: `performance.now()` is monotonic per-context but a Node
 * process and a browser page do not share an epoch, and a paused tab's rAF gap
 * would reorder records under a wall-time sort.
 */
export type LogicalTime = number;

/** Milliseconds, high resolution, for display and duration only. Never for sort. */
export type WallMillis = number;

/** Where in the program this came from. Null when the ingestion front-end cannot say. */
export interface SourceOrigin {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  /** The enclosing function or symbol name, when the transform knows it. */
  readonly symbol: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Projected values: the serializable boundary. See §8.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The one rule this type exists to enforce: a ProjectedValue is closed under
 * structuredClone. No WeakRef, no Proxy, no Function, no class instance, no DOM
 * node ever crosses this boundary. Everything that cannot cross becomes `opaque`
 * or `elided`, and says so on screen rather than silently vanishing.
 */
export type ProjectedValue =
  | { readonly kind: "primitive"; readonly value: string | number | boolean | null }
  | { readonly kind: "undefined" }
  | { readonly kind: "bigint"; readonly text: string }
  | { readonly kind: "symbol"; readonly text: string }
  | { readonly kind: "text"; readonly value: string; readonly truncated: boolean; readonly fullLength: number }
  | { readonly kind: "array"; readonly length: number; readonly items: readonly ProjectedValue[] }
  | { readonly kind: "record"; readonly typeName: string; readonly keyCount: number; readonly entries: readonly ProjectedEntry[] }
  | { readonly kind: "callable"; readonly name: string; readonly arity: number }
  | { readonly kind: "opaque"; readonly typeName: string; readonly text: string }
  | { readonly kind: "failure"; readonly name: string; readonly message: string; readonly stack: string | null }
  | { readonly kind: "elided"; readonly reason: ElisionReason };

export interface ProjectedEntry {
  readonly key: string;
  readonly value: ProjectedValue;
}

export type ElisionReason = "depth" | "width" | "budget" | "cycle" | "disabled";

/**
 * The cap. One Budget per Recorder, chosen at construction. Per-call override is
 * rejected: an instrumented call site has no identity to key a lookup on, and
 * threading a budget through the operator signature leaks it into user code.
 */
export interface Budget {
  /** Recursion depth into arrays and records. Default 3. */
  readonly maxDepth: number;
  /** Elements visited per array. Default 16. */
  readonly maxArrayItems: number;
  /** Keys visited per record. Default 24. */
  readonly maxRecordKeys: number;
  /** Characters retained per string. Default 256. */
  readonly maxTextLength: number;
  /** Hard ceiling on ProjectedValue nodes produced for ONE root value. Default 128. */
  readonly maxNodesPerValue: number;
}

/** Mutable per-projection counter. One per project() call, never shared. */
export interface ProjectionCursor {
  depth: number;
  nodes: number;
  readonly seen: Set<object>;
}

export interface Projector {
  project(value: unknown, budget: Budget, cursor: ProjectionCursor): ProjectedValue;
  /** Cheap size estimate in bytes for the Size column. Never serializes. */
  weigh(value: ProjectedValue): number;
  newCursor(): ProjectionCursor;
}

// ─────────────────────────────────────────────────────────────────────────────
// Spans and events: the row model. See §2.1.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Free-form domain tag, used as the Type column and the filter chip set. The core
 * assigns no meaning to it; the UI colours by it and filters on it. Known values
 * today, for reference only, NOT an enum:
 *   from @hafley/debug-rxjs: "subscription" | "call"
 *   from sprefa v6:          "tick" | "txn" | "rel" | "fixpoint" | "round" | "sql"
 * Keeping this a string is what lets a new consumer add a row type without a core
 * release. The cost is that a typo produces a new chip instead of a compile error,
 * which is a trade this model accepts and the status bar makes visible.
 */
export type SpanKind = string;

export type SpanStatus = "open" | "completed" | "errored" | "cancelled";

export interface Span {
  readonly spanId: SpanId;
  /** The Initiator column. Null for a root row. */
  readonly parentSpanId: SpanId | null;
  readonly sessionId: SessionId;
  readonly kind: SpanKind;
  /** The Name column. For RxJS, the observable label. For sprefa, the rel or rule. */
  readonly name: string;
  readonly origin: SourceOrigin | null;
  readonly startLogical: LogicalTime;
  readonly startWall: WallMillis;
  /** Null while open. A null end draws a bar to the right edge, like a pending request. */
  readonly endLogical: LogicalTime | null;
  readonly endWall: WallMillis | null;
  readonly status: SpanStatus;
  readonly failure: ProjectedValue | null;
  readonly attributes: readonly ProjectedEntry[];
  /** Denormalized counters, maintained by the index, read by the Size column. */
  readonly eventCount: number;
  readonly byteEstimate: number;
  /** Events dropped from this span by the ring or by the per-span cap. */
  readonly droppedEventCount: number;
}

export type SpanEventKind = "emit" | "failure" | "complete" | "cancel" | "note";

export interface SpanEvent {
  readonly eventId: EventId;
  readonly spanId: SpanId;
  readonly logical: LogicalTime;
  readonly wall: WallMillis;
  readonly kind: SpanEventKind;
  /** Short label for the Emissions tab list. Null when the value speaks for itself. */
  readonly label: string | null;
  readonly value: ProjectedValue | null;
}

/**
 * A vertical line across the whole waterfall, the way DOMContentLoaded and Load
 * are drawn in the Network tab. For sprefa: tick boundaries, BEGIN, COMMIT.
 * For a browser page: HMR swap, navigation, recorder enable/disable.
 */
export interface Marker {
  readonly markerId: string;
  readonly logical: LogicalTime;
  readonly wall: WallMillis;
  readonly label: string;
  /** A token name from the UI theme, not a CSS colour. Null takes the default. */
  readonly tone: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// The wire: records and frames. See §8.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Span open and close are separate records on purpose. A long-lived subscription
 * must appear as a row the instant it is created, not when it ends, or the live
 * view shows nothing. This is the same reason the Network tab draws a pending row.
 */
export type TraceRecord =
  | { readonly record: "session"; readonly session: SessionInfo }
  | { readonly record: "span-open"; readonly span: Span }
  | { readonly record: "span-close"; readonly spanId: SpanId; readonly endLogical: LogicalTime; readonly endWall: WallMillis; readonly status: SpanStatus; readonly failure: ProjectedValue | null }
  | { readonly record: "span-event"; readonly event: SpanEvent }
  | { readonly record: "marker"; readonly marker: Marker };

export interface SessionInfo {
  readonly sessionId: SessionId;
  readonly startedWall: WallMillis;
  /** "browser" | "node" | a consumer-chosen label. Shown in the status bar. */
  readonly host: string;
  /** Free-form, e.g. { app: "sprefa-dl", version: "0.0.0" }. */
  readonly labels: readonly ProjectedEntry[];
}

/** One drain of the ring. The unit the transport moves and the index folds. */
export interface Frame {
  readonly seq: number;
  readonly sessionId: SessionId;
  readonly firstLogical: LogicalTime;
  readonly lastLogical: LogicalTime;
  readonly records: readonly TraceRecord[];
  /** Cumulative ring drops at the moment this frame was cut. Never resets. */
  readonly droppedBefore: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Production side: clock, sink, recorder.
// ─────────────────────────────────────────────────────────────────────────────

export interface Clock {
  nextLogical(): LogicalTime;
  wallNow(): WallMillis;
}

export interface SinkStats {
  readonly capacity: number;
  readonly size: number;
  readonly pushed: number;
  /** Drop-oldest count. Newest always wins; a stale head with a discarded tail is the wrong failure. */
  readonly dropped: number;
  readonly framesCut: number;
  readonly lastDrainWall: WallMillis;
}

export interface Sink {
  push(record: TraceRecord): void;
  readonly stats: SinkStats;
}

export interface FrameSource {
  drain(): Frame | null;
  readonly stats: SinkStats;
}

export interface SpanOpenRequest {
  readonly kind: SpanKind;
  readonly name: string;
  readonly parentSpanId?: SpanId | null;
  readonly origin?: SourceOrigin | null;
  /** Raw values. Projected on the way in, against the Recorder's Budget. */
  readonly attributes?: Readonly<Record<string, unknown>>;
}

export interface SpanCloseOutcome {
  readonly status: Exclude<SpanStatus, "open">;
  readonly failure?: unknown;
}

export interface RecorderStats {
  readonly openSpans: number;
  readonly spansOpened: number;
  readonly spansClosed: number;
  readonly eventsRecorded: number;
  /** Calls refused because the recorder was already inside a record. See §2.3. */
  readonly reentrantDrops: number;
  /** Calls refused because the span id was unknown or already closed. */
  readonly orphanDrops: number;
}

/**
 * The whole public instrumentation API. A consumer that has this and 0_types.ts
 * has everything it needs; sprefa imports exactly this plus `traced` from
 * @hafley/debug-rxjs. Every method is total and never throws: an instrument that
 * can crash the program it observes is worse than no instrument.
 */
export interface Recorder {
  readonly sessionId: SessionId;
  readonly enabled: boolean;
  readonly sink: Sink;
  readonly stats: RecorderStats;
  setEnabled(enabled: boolean): void;
  openSpan(request: SpanOpenRequest): SpanId;
  closeSpan(spanId: SpanId, outcome: SpanCloseOutcome): void;
  addEvent(spanId: SpanId, kind: SpanEventKind, label: string | null, rawValue: unknown): void;
  mark(label: string, tone?: string | null): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Consumption side: index, filter, waterfall, rows.
// ─────────────────────────────────────────────────────────────────────────────

export interface TimeRange {
  readonly minLogical: LogicalTime;
  readonly maxLogical: LogicalTime;
  readonly minWall: WallMillis;
  readonly maxWall: WallMillis;
}

export interface RetentionPolicy {
  readonly maxSpans: number;
  /** Never compact below this, whatever the pressure. */
  readonly minSpans: number;
  readonly maxEventsPerSpan: number;
  /** A span must have been closed at least this long before it can be evicted. */
  readonly minDeadAgeMillis: number;
}

/**
 * The read model. Append-only row order: a row that jumps position mid-stream is
 * unreadable, and re-sorting is O(n log n) per frame. Sorting by a column is a
 * VIEW concern (§7.2), computed over rowOrder, never a mutation of it.
 */
export interface SpanIndex {
  readonly rowOrder: readonly SpanId[];
  readonly spans: ReadonlyMap<SpanId, Span>;
  readonly eventsBySpan: ReadonlyMap<SpanId, readonly SpanEvent[]>;
  readonly childrenBySpan: ReadonlyMap<SpanId, readonly SpanId[]>;
  readonly kinds: ReadonlyMap<SpanKind, number>;
  readonly markers: readonly Marker[];
  readonly timeRange: TimeRange;
  readonly sessions: ReadonlyMap<SessionId, SessionInfo>;
  /** Fold one frame. O(frame.records). Never O(index). */
  apply(frame: Frame): void;
  /** The Clear button. `preserveOpen` keeps rows whose span is still open, as the Network tab does. */
  clear(preserveOpen: boolean): void;
  /** Bounded retention. Returns the number of spans evicted. */
  compact(policy: RetentionPolicy): number;
}

export interface FilterQuery {
  /** The free-text box. Matches name, kind, and origin.file, substring, case-insensitive. */
  readonly text: string;
  /** Type chips. Empty set means All. */
  readonly kinds: ReadonlySet<SpanKind>;
  readonly statuses: ReadonlySet<SpanStatus>;
  readonly minDurationMillis: number | null;
  readonly minEventCount: number | null;
  /** The Invert checkbox. */
  readonly invert: boolean;
  /** Set by the overview brush. Null means the whole range. */
  readonly window: TimeRange | null;
  /** Hide rows whose parent is filtered out, rather than reparenting them. */
  readonly hideOrphans: boolean;
}

export interface Filter {
  parse(text: string): FilterQuery;
  /** Compiled once per query change, applied per row. Never allocates per row. */
  compile(query: FilterQuery, index: SpanIndex): (spanId: SpanId) => boolean;
}

export type WaterfallPhaseName = "pending" | "streaming" | "draining";

export interface WaterfallPhase {
  readonly phase: WaterfallPhaseName;
  readonly startFraction: number;
  readonly endFraction: number;
}

/** Geometry in 0..1 of the visible time window. The renderer multiplies by pixel width. */
export interface WaterfallBar {
  readonly startFraction: number;
  readonly endFraction: number;
  readonly phases: readonly WaterfallPhase[];
  /** Event positions as fractions, already windowed and already capped. */
  readonly ticks: readonly number[];
  /** Ticks dropped by the cap, so the renderer can draw a density glyph instead. */
  readonly hiddenTicks: number;
  /** True when the span is still open: draw to the right edge with no end cap. */
  readonly openEnded: boolean;
}

export interface Waterfall {
  layout(span: Span, events: readonly SpanEvent[], window: TimeRange, maxTicks: number): WaterfallBar;
}

export type ColumnId =
  | "name" | "kind" | "status" | "initiator" | "size" | "events"
  | "duration" | "start" | "origin" | "session" | "waterfall";

/** One virtualized row, fully resolved. The renderer reads only this. */
export interface RowView {
  readonly spanId: SpanId;
  /** Indent level from the parent chain, capped by the UI at 8. */
  readonly depth: number;
  readonly name: string;
  readonly kind: SpanKind;
  readonly status: SpanStatus;
  readonly initiatorSpanId: SpanId | null;
  readonly initiatorLabel: string | null;
  readonly eventCount: number;
  readonly byteEstimate: number;
  readonly durationMillis: number | null;
  readonly startMillis: number;
  readonly originLabel: string | null;
  readonly waterfall: WaterfallBar;
}

// ─────────────────────────────────────────────────────────────────────────────
// Transport.
// ─────────────────────────────────────────────────────────────────────────────

export interface Transport {
  readonly name: string;
  readonly connected: boolean;
  send(frame: Frame): void;
  /** Returns an unsubscribe function. */
  receive(onFrame: (frame: Frame) => void): () => void;
  close(): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// UI pump. Declared here so debug-ui has no type of its own that debug-core
// cannot describe; implemented in debug-ui because requestAnimationFrame is DOM.
// ─────────────────────────────────────────────────────────────────────────────

export interface PumpSnapshot {
  /** Bumps once per applied frame. The ONLY value React compares. */
  readonly version: number;
  readonly index: SpanIndex;
  readonly sinkStats: SinkStats;
  readonly recorderStats: RecorderStats | null;
  readonly applyCostMillis: number;
  readonly paused: boolean;
}

export interface Pump {
  /** useSyncExternalStore shape. */
  subscribe(onChange: () => void): () => void;
  getSnapshot(): PumpSnapshot;
  start(): void;
  stop(): void;
  /** The Record/Stop toggle. Paused keeps recording into the ring, stops applying. */
  setPaused(paused: boolean): void;
}
```

### 5.1 Two deliberate omissions, named so they are not mistaken for oversights

**No `Store` type.** The previous plan carried `State["store"]`, a
`Record<entity, Record<id, Row>>`. It is gone. `SpanIndex.spans` and
`SpanIndex.eventsBySpan` are the only storage, and they are the index. The old
three-tier layout (store, ring, index) had the index as a denormalized *cache* of the
store, which meant every read had to decide which one to trust and every renderer had to
tolerate an id in the index that resolves to nothing in the store. Two tiers with one
owner removes that whole class of bug. The ring is a queue and the index is the storage.

**No `Observable` type anywhere in the header.** Core does not know rxjs exists. That is
the constraint from §3.1 expressed in the one file that would leak it first.

---

## 6. Components: signatures, pseudo-code, lifetimes, storage

Planning protocol order throughout. Layer 4 (storage) is collected once at the end,
in §6.7, because the six components share one storage story and repeating it per
component would hide the disagreements.

### 6.1 `LogicalClock`: `packages/debug-core/src/1_clock.ts`

```ts
// noRxjs()
import type { Clock, LogicalTime, WallMillis } from "./0_types.ts"

export class LogicalClock implements Clock {
  counter = 0
  readonly epochWall: WallMillis

  constructor(epochWall: WallMillis)
  // pseudo-code:
  //   this.epochWall = epochWall

  nextLogical(): LogicalTime
  // pseudo-code:
  //   return ++this.counter
  //   // No wrap handling. Number.MAX_SAFE_INTEGER at 10,000 events/second is
  //   // 28,000 years. A wrap check would cost a branch per event to guard nothing.

  wallNow(): WallMillis
  // pseudo-code:
  //   // performance.now() where available (browser, Node >= 16 global), else Date.now().
  //   // Resolved ONCE at module load into a const, not per call: the typeof check
  //   // per event is measurable at trace rate.
  //   return nowFunction()
}

/** Deterministic clock for tests. Same interface, no wall clock at all. */
export class FixedClock implements Clock {
  counter = 0
  wall = 0
  nextLogical(): LogicalTime   // return ++this.counter
  wallNow(): WallMillis        // return this.wall
  advance(millis: number): void // this.wall += millis
}
```

Two classes, one interface, because a deterministic clock is the only way the ring and
index tests can assert exact frame contents. `setNow`/`now()` on the current
`RxJSTracker` (lines 55-58) exist for the same reason and are replaced by this.

**Lifetime.** One `LogicalClock` per `SpanRecorder`, constructed with it, dead with it.
Never shared across sessions: two sessions sharing a counter would make `SpanId`
collide across a transport merge.

### 6.2 `RingSink`: `packages/debug-core/src/2_ring.ts`

```ts
// noRxjs()
import type { Frame, FrameSource, SessionId, Sink, SinkStats, TraceRecord } from "./0_types.ts"

export class RingSink implements Sink, FrameSource {
  readonly buffer: (TraceRecord | undefined)[]
  head = 0
  count = 0
  pushed = 0
  dropped = 0
  framesCut = 0
  lastDrainWall = 0

  constructor(readonly sessionId: SessionId, readonly capacity: number /* default 8192 */)
  // pseudo-code:
  //   this.buffer = new Array(capacity)     // pre-allocated, never grows

  push(record: TraceRecord): void
  // pseudo-code:
  //   const slot = (this.head + this.count) % this.capacity
  //   if (this.count === this.capacity) { this.head = (this.head + 1) % this.capacity
  //                                       this.dropped++ }
  //   else this.count++
  //   this.buffer[slot] = record
  //   this.pushed++
  //   // Drop-OLDEST. A live view showing a stale head while the tail is discarded
  //   // is the wrong failure. Newest wins.

  drain(): Frame | null
  // pseudo-code:
  //   if (this.count === 0) return null
  //   const records = new Array(this.count)
  //   for (let i = 0; i < this.count; i++) records[i] = this.buffer[(this.head + i) % this.capacity]
  //   this.buffer.fill(undefined)          // release references; the ring holds
  //                                        // ProjectedValues, which can be large strings
  //   this.head = 0; this.count = 0; this.framesCut++
  //   this.lastDrainWall = wallNow()
  //   return { seq: this.framesCut, sessionId: this.sessionId, records,
  //            firstLogical: logicalOf(records[0]),
  //            lastLogical:  logicalOf(records[records.length - 1]),
  //            droppedBefore: this.dropped }

  get stats(): SinkStats
  // pseudo-code: return { capacity, size: this.count, pushed, dropped, framesCut, lastDrainWall }
}

/** Fan-out. Used when the same recorder feeds both the in-page index and a WebSocket. */
export class TeeSink implements Sink {
  constructor(readonly sinks: readonly Sink[])
  push(record: TraceRecord): void  // for (const sink of this.sinks) sink.push(record)
  get stats(): SinkStats           // returns the FIRST sink's stats; documented, not merged
}
```

`logicalOf` is a local, not exported: a five-arm switch over `TraceRecord.record`. It is
the only place in core that switches on the record union outside the index, and that is
deliberate; two switch statements over a union that grows is how a new record kind gets
silently mishandled.

**Lifetime.** One `RingSink` per `SpanRecorder`, created with it. Under HMR it must
survive with the recorder (§6.8). A drained `Frame` is owned by whoever drained it and
lives until the index has folded it, which is within the same synchronous turn.

### 6.3 `BudgetProjector`: `packages/debug-core/src/3_project.ts`

No class. Pure functions over an explicit budget and an explicit cursor.

```ts
// noRxjs()
import type { Budget, ProjectedValue, ProjectionCursor, Projector } from "./0_types.ts"

export const DEFAULT_BUDGET: Budget = {
  maxDepth: 3, maxArrayItems: 16, maxRecordKeys: 24,
  maxTextLength: 256, maxNodesPerValue: 128,
}

/** Everything off. For a consumer that only wants structure, never payloads. */
export const STRUCTURE_ONLY_BUDGET: Budget = {
  maxDepth: 0, maxArrayItems: 0, maxRecordKeys: 0,
  maxTextLength: 0, maxNodesPerValue: 1,
}

export const BudgetProjector: Projector = {
  newCursor(): ProjectionCursor,
  // pseudo-code: return { depth: 0, nodes: 0, seen: new Set() }

  project(value: unknown, budget: Budget, cursor: ProjectionCursor): ProjectedValue,
  // pseudo-code:
  //   if (cursor.nodes >= budget.maxNodesPerValue) return elided("budget")
  //   cursor.nodes++
  //   switch (typeof value) {
  //     case "undefined": return { kind: "undefined" }
  //     case "boolean": case "number":       return { kind: "primitive", value }
  //     case "bigint":  return { kind: "bigint", text: value.toString() }
  //     case "symbol":  return { kind: "symbol", text: value.toString() }
  //     case "function": return { kind: "callable", name: value.name || "anonymous",
  //                               arity: value.length }
  //     case "string":  return { kind: "text", value: value.slice(0, budget.maxTextLength),
  //                              truncated: value.length > budget.maxTextLength,
  //                              fullLength: value.length }
  //   }
  //   if (value === null) return { kind: "primitive", value: null }
  //   // object from here down
  //   if (cursor.seen.has(value)) return elided("cycle")
  //   if (cursor.depth >= budget.maxDepth) return elided("depth")
  //   if (value instanceof Error)
  //     return { kind: "failure", name: value.name, message: value.message,
  //              stack: value.stack ?? null }
  //   cursor.seen.add(value); cursor.depth++
  //   try {
  //     if (Array.isArray(value)) {
  //       const shown = Math.min(value.length, budget.maxArrayItems)
  //       const items = []
  //       for (let i = 0; i < shown; i++) items.push(project(value[i], budget, cursor))
  //       if (shown < value.length) items.push(elided("width"))
  //       return { kind: "array", length: value.length, items }
  //     }
  //     if (isPlainRecord(value)) {                       // prototype is Object.prototype or null
  //       const keys = Object.keys(value)
  //       const shown = Math.min(keys.length, budget.maxRecordKeys)
  //       const entries = []
  //       for (let i = 0; i < shown; i++)
  //         entries.push({ key: keys[i], value: project(value[keys[i]], budget, cursor) })
  //       return { kind: "record", typeName: "Object", keyCount: keys.length, entries }
  //     }
  //     // WeakRef, Proxy, class instance, DOM node, Map, Set, Promise, Observable, ...
  //     return { kind: "opaque", typeName: nameOf(value), text: safeSummary(value) }
  //   } finally { cursor.depth--; cursor.seen.delete(value) }

  weigh(value: ProjectedValue): number,
  // pseudo-code:
  //   // Structural estimate for the Size column. Walks the ALREADY-PROJECTED tree,
  //   // which is bounded by maxNodesPerValue, so this is O(128) worst case and can
  //   // never touch user data. Never JSON.stringify: that is unbounded and can throw.
  //   switch (value.kind) {
  //     case "text": return 2 * value.fullLength
  //     case "array": return 8 + sum(value.items.map(weigh))
  //     case "record": return 8 + sum(value.entries.map(e => 2 * e.key.length + weigh(e.value)))
  //     default: return 8
  //   }
}
```

Three things this closes, all of them defects in the current `Tracer.argRipper`
(`0_store_v2.ts:205-247`) that the previous plan already identified and that are restated
here because they now live in a different file.

1. **Unbounded recursion.** A four-level payload with 100-element arrays emits on the
   order of `100^4` events today. Under `DEFAULT_BUDGET` one projection produces at most
   128 nodes, whatever the payload's shape.
2. **`cursor.seen` closes the cycle case**, which the old `argRipper` did not handle at
   all. A self-referencing object was infinite recursion, not a slow trace.
3. **No mutation of user data.** `Tracer.setPath` (`0_store_v2.ts:249-251`) writes
   `value["@@path"] = path` onto the traced object, so the key appears in the caller's
   `Object.keys`, spreads, and `JSON.stringify`. The projector never writes to `value`.
   The identity map that replaces it is a module-scope `WeakMap<object, string>` in
   `debug-rxjs`, not in core, because only the Proxy decorator needs it.

**Lifetime.** `BudgetProjector` is a module singleton with no state. A
`ProjectionCursor` lives for exactly one `project()` call tree and is never shared;
sharing one across two calls would make the node budget leak between unrelated values,
which is the specific bug that makes a budget look like it is not working.

### 6.4 `SpanRecorder`: `packages/debug-core/src/4_recorder.ts`

```ts
// noRxjs()
import type {
  Budget, Clock, ProjectedEntry, Recorder, RecorderStats, Sink,
  SessionId, SpanCloseOutcome, SpanEventKind, SpanId, SpanOpenRequest,
} from "./0_types.ts"

export interface SpanRecorderOptions {
  readonly sessionId: SessionId
  readonly sink: Sink
  readonly clock: Clock
  readonly budget?: Budget
  readonly host?: string
  readonly labels?: Readonly<Record<string, unknown>>
}

export class SpanRecorder implements Recorder {
  readonly sessionId: SessionId
  readonly sink: Sink
  readonly clock: Clock
  readonly budget: Budget
  enabled = true
  /** spanId -> eventCounter. Presence means open. Absence means closed or unknown. */
  readonly openSpanEventCounts = new Map<SpanId, number>()
  spanCounter = 0
  depth = 0
  spansOpened = 0; spansClosed = 0; eventsRecorded = 0
  reentrantDrops = 0; orphanDrops = 0

  constructor(options: SpanRecorderOptions)
  // pseudo-code:
  //   assign fields, budget ??= DEFAULT_BUDGET
  //   this.sink.push({ record: "session", session: {
  //       sessionId, startedWall: clock.wallNow(),
  //       host: options.host ?? detectHost(), labels: projectLabels(options.labels) } })

  setEnabled(enabled: boolean): void
  // pseudo-code:
  //   this.enabled = enabled
  //   this.mark(enabled ? "recording resumed" : "recording paused", "muted")
  //   // Disabling does NOT close open spans. A subscription that outlives a pause
  //   // is still one subscription, and closing it would fabricate a teardown.

  openSpan(request: SpanOpenRequest): SpanId
  // pseudo-code:
  //   if (!this.enabled) return ""            // "" is the null span id. Every method
  //                                           //  short-circuits on it. No allocation
  //                                           //  and no branch at the call site.
  //   if (this.depth > 0) { this.reentrantDrops++; return "" }     // §2.3 guard
  //   this.depth++
  //   try {
  //     const spanId = `${this.sessionId}:${++this.spanCounter}`
  //     this.openSpanEventCounts.set(spanId, 0)
  //     this.spansOpened++
  //     this.sink.push({ record: "span-open", span: {
  //         spanId, parentSpanId: request.parentSpanId ?? null, sessionId: this.sessionId,
  //         kind: request.kind, name: request.name, origin: request.origin ?? null,
  //         startLogical: this.clock.nextLogical(), startWall: this.clock.wallNow(),
  //         endLogical: null, endWall: null, status: "open", failure: null,
  //         attributes: this.projectAttributes(request.attributes),
  //         eventCount: 0, byteEstimate: 0, droppedEventCount: 0 } })
  //     return spanId
  //   } finally { this.depth-- }

  addEvent(spanId: SpanId, kind: SpanEventKind, label: string | null, rawValue: unknown): void
  // pseudo-code:
  //   if (!this.enabled || spanId === "") return
  //   if (this.depth > 0) { this.reentrantDrops++; return }
  //   const seen = this.openSpanEventCounts.get(spanId)
  //   if (seen === undefined) { this.orphanDrops++; return }   // closed or unknown span
  //   this.depth++
  //   try {
  //     this.openSpanEventCounts.set(spanId, seen + 1)
  //     this.eventsRecorded++
  //     const cursor = BudgetProjector.newCursor()
  //     this.sink.push({ record: "span-event", event: {
  //         eventId: `${spanId}#${seen + 1}`, spanId,
  //         logical: this.clock.nextLogical(), wall: this.clock.wallNow(),
  //         kind, label,
  //         value: rawValue === undefined && kind !== "emit"
  //                  ? null
  //                  : BudgetProjector.project(rawValue, this.budget, cursor) } })
  //   } finally { this.depth-- }

  closeSpan(spanId: SpanId, outcome: SpanCloseOutcome): void
  // pseudo-code:
  //   if (!this.enabled || spanId === "") return
  //   if (!this.openSpanEventCounts.delete(spanId)) { this.orphanDrops++; return }
  //   // NOTE: delete happens BEFORE the depth guard, and that is on purpose. A close
  //   // must be idempotent and must not leak the map entry even if the guard trips.
  //   if (this.depth > 0) { this.reentrantDrops++; return }
  //   this.depth++
  //   try {
  //     this.spansClosed++
  //     this.sink.push({ record: "span-close", spanId,
  //       endLogical: this.clock.nextLogical(), endWall: this.clock.wallNow(),
  //       status: outcome.status,
  //       failure: outcome.failure === undefined ? null
  //                : BudgetProjector.project(outcome.failure, this.budget,
  //                                          BudgetProjector.newCursor()) })
  //   } finally { this.depth-- }

  mark(label: string, tone: string | null = null): void
  // pseudo-code:
  //   if (!this.enabled) return
  //   if (this.depth > 0) { this.reentrantDrops++; return }
  //   this.sink.push({ record: "marker", marker: {
  //     markerId: `${this.sessionId}!${++this.spanCounter}`,
  //     logical: this.clock.nextLogical(), wall: this.clock.wallNow(), label, tone } })

  get stats(): RecorderStats
}
```

Four decisions in there that are worth defending because each one is a place a naive
implementation goes wrong.

- **`""` is the null span id.** `openSpan` returning a string always, never
  `SpanId | null`, means a call site is `const spanId = recorder.openSpan(...)` with no
  branch, and `closeSpan("")` is a no-op. That keeps the disabled path free of
  conditionals in *user* code, which is the code we are asking sprefa to accept.
- **The re-entrancy guard is a depth counter, not a boolean.** A boolean would be reset
  by the inner call's `finally` and re-open the loop one level down.
- **`closeSpan` deletes from the map before the guard.** Otherwise a re-entrant close
  leaks the entry and the span stays "open" forever in `openSpanEventCounts`, which is a
  slow memory leak keyed on exactly the pathological case.
- **`openSpanEventCounts` holds a counter, not the Span.** The recorder does not retain
  span objects; it pushes them and forgets. The index retains. That is what keeps
  recorder memory proportional to *open* spans rather than to all spans, and it is the
  reason a Node process can record for an hour.

**Lifetime.** One `SpanRecorder` per session. In a browser page, pinned to `globalThis`
so HMR cannot fork it (§6.8). In a Node process, one per `DlRuntime` (§9), created in
`boot` and released in `dispose`.

### 6.5 `MapSpanIndex`: `packages/debug-core/src/5_index.ts`

```ts
// noRxjs()
export class MapSpanIndex implements SpanIndex {
  rowOrder: SpanId[] = []
  readonly spans = new Map<SpanId, Span>()
  readonly eventsBySpan = new Map<SpanId, SpanEvent[]>()
  readonly childrenBySpan = new Map<SpanId, SpanId[]>()
  readonly kinds = new Map<SpanKind, number>()
  markers: Marker[] = []
  readonly sessions = new Map<SessionId, SessionInfo>()
  timeRange: TimeRange = EMPTY_RANGE
  lastAppliedSeq = -1

  apply(frame: Frame): void
  // pseudo-code:
  //   // Out-of-order frames are possible over a WebSocket. Records are idempotent
  //   // per id, so a replay is safe; a REGRESSION in seq is not, because the ring
  //   // has already been cleared upstream. Count it, do not silently reorder.
  //   if (frame.seq <= this.lastAppliedSeq) { this.staleFrames++; return }
  //   this.lastAppliedSeq = frame.seq
  //   for (const rec of frame.records) switch (rec.record) {
  //     case "session":
  //       this.sessions.set(rec.session.sessionId, rec.session); break
  //     case "span-open": {
  //       const span = rec.span
  //       if (this.spans.has(span.spanId)) break            // idempotent replay
  //       this.spans.set(span.spanId, span)
  //       this.rowOrder.push(span.spanId)                   // APPEND ONLY. Never sort.
  //       this.eventsBySpan.set(span.spanId, [])
  //       if (span.parentSpanId) pushInto(this.childrenBySpan, span.parentSpanId, span.spanId)
  //       this.kinds.set(span.kind, (this.kinds.get(span.kind) ?? 0) + 1)
  //       this.widen(span.startLogical, span.startWall)
  //       break }
  //     case "span-event": {
  //       const list = this.eventsBySpan.get(rec.event.spanId)
  //       if (!list) { this.orphanRecords++; break }        // span evicted by compact
  //       list.push(rec.event)
  //       const span = this.spans.get(rec.event.spanId)!
  //       // Span is `readonly`, so this REPLACES rather than mutates. See the
  //       // disagreement note in §6.7: the type layer says immutable, the storage
  //       // layer wants a counter bump. Replacement is the reconciliation and it
  //       // costs one small object allocation per event.
  //       this.spans.set(span.spanId, { ...span,
  //         eventCount: span.eventCount + 1,
  //         byteEstimate: span.byteEstimate + (rec.event.value
  //                        ? BudgetProjector.weigh(rec.event.value) : 0) })
  //       this.widen(rec.event.logical, rec.event.wall)
  //       break }
  //     case "span-close": {
  //       const span = this.spans.get(rec.spanId)
  //       if (!span) { this.orphanRecords++; break }
  //       this.spans.set(rec.spanId, { ...span, endLogical: rec.endLogical,
  //         endWall: rec.endWall, status: rec.status, failure: rec.failure })
  //       this.widen(rec.endLogical, rec.endWall)
  //       break }
  //     case "marker": this.markers.push(rec.marker)
  //                    this.widen(rec.marker.logical, rec.marker.wall); break
  //   }

  clear(preserveOpen: boolean): void
  // pseudo-code:
  //   // The Clear button. preserveOpen=true is what the Network tab does on
  //   // navigation with Preserve log OFF: in-flight requests survive the clear.
  //   const keep = preserveOpen
  //     ? this.rowOrder.filter(id => this.spans.get(id)!.status === "open")
  //     : []
  //   rebuild every map from `keep`. Reset markers. Reset timeRange from `keep`.
  //   Do NOT reset lastAppliedSeq: frames keep coming and seq keeps rising.

  compact(policy: RetentionPolicy): number
  // pseudo-code:
  //   if (this.rowOrder.length <= policy.maxSpans) return this.trimEvents(policy)
  //   let evicted = 0
  //   const survivors: SpanId[] = []
  //   for (const spanId of this.rowOrder) {              // oldest first
  //     const span = this.spans.get(spanId)!
  //     const evictable =
  //       span.status !== "open" &&
  //       span.endWall !== null &&
  //       this.timeRange.maxWall - span.endWall >= policy.minDeadAgeMillis &&
  //       this.rowOrder.length - evicted > policy.minSpans &&
  //       (this.childrenBySpan.get(spanId)?.length ?? 0) === 0   // never orphan a child
  //     if (!evictable) { survivors.push(spanId); continue }
  //     this.spans.delete(spanId); this.eventsBySpan.delete(spanId)
  //     this.childrenBySpan.delete(spanId)
  //     decrement this.kinds for span.kind, delete the key at zero
  //     detach spanId from its parent's children list
  //     evicted++
  //   }
  //   this.rowOrder = survivors                          // rebuilt, never reordered
  //   return evicted + this.trimEvents(policy)

  trimEvents(policy: RetentionPolicy): number
  // pseudo-code:
  //   // Within a SURVIVING span, keep the newest maxEventsPerSpan and record the
  //   // loss on the span so the waterfall can draw a truncation glyph at its left.
  //   for (const [spanId, list] of this.eventsBySpan) {
  //     if (list.length <= policy.maxEventsPerSpan) continue
  //     const lost = list.length - policy.maxEventsPerSpan
  //     list.splice(0, lost)
  //     const span = this.spans.get(spanId)!
  //     this.spans.set(spanId, { ...span, droppedEventCount: span.droppedEventCount + lost })
  //   }
}
```

**Lifetime.** One `MapSpanIndex` per viewer, owned by the `Pump`. It must survive HMR of
the UI, because rebuilding it means asking the transport to replay, and no transport in
§4.5 replays. It does not survive a page reload, which is correct: a reload is a new
session.

### 6.6 `AnimationFramePump`: `packages/debug-ui/src/1_pump.ts`

```ts
export interface AnimationFramePumpOptions {
  readonly source: FrameSource
  readonly index: SpanIndex
  readonly retention: RetentionPolicy
  /** Apply-cost budget in ms. Above it, skip the next frame. Default 8. */
  readonly costBudgetMillis?: number
  /** Compact every N applied frames. Default 120, about two seconds at 60 Hz. */
  readonly compactEveryFrames?: number
}

export class AnimationFramePump implements Pump {
  version = 0
  paused = false
  applyCostMillis = 0
  rafHandle = 0
  framesSinceCompact = 0
  readonly listeners = new Set<() => void>()
  snapshot: PumpSnapshot

  start(): void   // if (!this.rafHandle) this.rafHandle = requestAnimationFrame(this.tick)
  stop(): void    // cancelAnimationFrame(this.rafHandle); this.rafHandle = 0
  setPaused(paused: boolean): void
  // pseudo-code:
  //   this.paused = paused
  //   // Paused does NOT stop the recorder and does NOT stop draining. It stops
  //   // APPLYING. Records keep flowing into the ring, and the ring keeps dropping
  //   // the oldest, so an operator who pauses to read a row for 30 seconds loses
  //   // the middle of the trace rather than the end. The status bar says so.

  tick = (): void => {}
  // pseudo-code:
  //   const started = performance.now()
  //   if (!this.paused) {
  //     const frame = this.source.drain()
  //     if (frame) {
  //       this.index.apply(frame)
  //       if (++this.framesSinceCompact >= compactEveryFrames) {
  //         this.index.compact(this.retention); this.framesSinceCompact = 0
  //       }
  //       this.version++
  //       this.snapshot = { version: this.version, index: this.index,
  //                         sinkStats: this.source.stats, recorderStats: null,
  //                         applyCostMillis: this.applyCostMillis, paused: false }
  //       for (const listener of this.listeners) listener()
  //     }
  //   }
  //   this.applyCostMillis = performance.now() - started
  //   // The second dam: if applying cost more than half a frame budget, skip one
  //   // rAF rather than queueing renders we cannot retire.
  //   this.rafHandle = this.applyCostMillis > costBudgetMillis
  //     ? requestAnimationFrame(() => { this.rafHandle = requestAnimationFrame(this.tick) })
  //     : requestAnimationFrame(this.tick)

  subscribe(onChange: () => void): () => void
  // pseudo-code: this.listeners.add(onChange); return () => this.listeners.delete(onChange)

  getSnapshot(): PumpSnapshot   // return this.snapshot  (identity-stable between versions)
}
```

`getSnapshot` must return the *same object identity* until `version` changes, or
`useSyncExternalStore` re-renders on every call. That is the single most common way this
hook is misused and it is why `snapshot` is a field rather than a computed getter.

**Backpressure, end to end, three bounded stages and no unbounded queue anywhere:**
drop-oldest ring at the producer (counted), rAF coalescing at the consumer, skip-a-frame
governor when apply cost exceeds half the frame budget. Retention compaction is a fourth
bound on the index itself.

### 6.7 Storage layout, then reads and writes, then uniqueness

**Layout.** Two tiers, not three.

| Tier | Shape | Keyed by | Bounded by | Owner |
|---|---|---|---|---|
| Ring (`RingSink`) | pre-allocated array, head + count | position | `capacity`, default 8192 | the recorder |
| Index (`MapSpanIndex`) | `Map<SpanId, Span>`, `Map<SpanId, SpanEvent[]>`, `Map<SpanId, SpanId[]>`, `SpanId[]` | span id | `RetentionPolicy` | the pump |

The wire (`Frame`) is not a tier. It exists for the duration of one `apply` call.

**Write sequence, per instrumented operation.**

1. Call site calls `recorder.openSpan(...)`. Disabled or re-entrant returns `""` with no
   allocation.
2. `SpanRecorder` mints the id, records it in `openSpanEventCounts`, projects the
   attributes against `Budget` with a fresh `ProjectionCursor`, and pushes one
   `span-open` record.
3. `RingSink.push` either lands in a free slot or overwrites the head and increments
   `dropped`.
4. Nothing else happens synchronously. The call returns. There is no observer, no
   subject, no microtask.
5. Each emission repeats 1-4 with `addEvent`, at most `maxNodesPerValue` projection nodes.
6. Teardown calls `closeSpan`, which removes the map entry and pushes `span-close`.

**Read sequence, per animation frame.**

1. `AnimationFramePump.tick` calls `source.drain()`, which empties the ring into one
   `Frame` and clears the buffer's references.
2. `index.apply(frame)` folds records in, O(frame.records), never O(index).
3. Every 120 applied frames, `index.compact(policy)`.
4. `version++`, listeners fire, React re-renders once.
5. Components read `RowView`s produced by `Filter.compile` over `index.rowOrder`, plus
   `Waterfall.layout` per visible row. **No component ever iterates `index.spans`.**
   The review rule is literal: `Object.values(`, `.entries()`, and `[...map]` are banned
   in `packages/debug-ui/src/**` outside the two files that build the row list.

**Uniqueness conditions.**

| Invariant | Enforced where |
|---|---|
| `SpanId` is unique across a session: `${sessionId}:${counter}` with a per-recorder counter | `SpanRecorder.openSpan` |
| `SpanId` is unique across *merged* sessions, because `sessionId` prefixes it | `SpanRecorder` constructor takes it; no default |
| `EventId` is unique: `${spanId}#${n}` with `n` from `openSpanEventCounts` | `SpanRecorder.addEvent` |
| `Frame.seq` is strictly increasing per sink and never reused | `RingSink.framesCut` |
| A frame with `seq <= lastAppliedSeq` is counted and dropped, never applied twice | `MapSpanIndex.apply` first guard |
| `rowOrder` contains each `SpanId` exactly once and is append-only | `apply` pushes only on first sight; `compact` filters, never reorders |
| `compact` never evicts a span with `status === "open"` | `compact`, first clause |
| `compact` never evicts a span that still has children | `compact`, last clause. Without it the Initiator column points at a hole. |
| A `span-event` for an unknown span is counted as `orphanRecords`, never auto-creates a span | `apply`, `span-event` arm |
| `closeSpan` on an already-closed span is a no-op counted as `orphanDrops` | `SpanRecorder.closeSpan`, the `delete` return value |

**Where the four layers disagree.** Three real disagreements, each with a stated
reconciliation rather than a fudge.

1. **Types say `Span` is `readonly`; storage wants to bump a counter per event.** The
   reconciliation is object replacement in `apply` (`this.spans.set(id, {...span, ...})`),
   which costs one shallow allocation per event at index rate, not at trace rate. The
   alternative, a mutable `Span`, would make every React memo comparison wrong. The
   allocation is the price of the memo working.
2. **Lifetimes say the recorder outlives every viewer; storage says the index is the
   only place spans live.** So a viewer that connects late sees nothing that happened
   before it connected, because the recorder retains nothing. That is a deliberate
   choice and it is what caps recorder memory at *open* spans. The consequence to accept:
   there is no "replay from the beginning" and there will not be one until someone asks
   for a persistent sink. `Preserve log` (§7.1) preserves across *clears*, not across
   *connects*.
3. **The wire says records are idempotent; the ring says drops are permanent.** Both are
   true and they describe different failures. A replayed frame is harmless. A dropped
   record is a hole, and after a hole the index can hold a `span-event` whose
   `span-open` never arrived. The rule is that `apply` counts those as
   `orphanRecords` and never fabricates a parent, and the status bar shows the count, so
   a hole reads as a hole.

### 6.8 Instance lifetimes, collected

| Type | Created | Destroyed | Survives HMR | Survives React remount |
|---|---|---|---|---|
| `LogicalClock` | with its recorder | with its recorder | must | yes |
| `RingSink` | with its recorder | with its recorder | must | yes |
| `SpanRecorder` | module eval, pinned to `globalThis` | page unload / process exit | **must**, see below | yes |
| `ProjectionCursor` | per `project()` call | end of that call | no | no |
| `Frame` | per `drain()` | after `apply()` | no | no |
| `MapSpanIndex` | with the pump | with the pump | should (rebuilding needs a replay nobody offers) | should |
| `AnimationFramePump` | once per app, module scope | page unload | must | yes |
| React subscription via `useSyncExternalStore` | per component mount | unmount | no, and must not care | no |
| `Transport` | once per viewer | on `close()` | must | yes |

**HMR splits the recorder if it is not pinned.** The current code has this bug:
`0_store.ts:676` is `export const main = new RxJSTracker()`. If Vite hot-replaces that
module, a second tracker is constructed, modules that re-evaluate bind to it, modules
that did not keep the first, and the trace silently forks into two. The pin:

```ts
// packages/debug-rxjs/src/1_tracker.ts
declare global { var __hafley_debug_recorder__: Recorder | undefined }
export const recorder: Recorder =
  (globalThis.__hafley_debug_recorder__ ??= new SpanRecorder({
    sessionId: `s${Date.now().toString(36)}`,
    clock, sink, budget: DEFAULT_BUDGET,
  }))
// globalThis rather than import.meta.hot.data: the recorder must also exist under
// `node --test` and `vitest run`, where `import.meta.hot` is undefined.
```

---

## 7. The UI: Chromium Network tab, affordance by affordance

Affordance list taken from `developer.chrome.com/docs/devtools/network/reference`,
fetched 2026-07-25, not from memory.

### 7.1 The mapping table

| Network tab affordance | Chromium behaviour | Debugger equivalent | Reads |
|---|---|---|---|
| **Request row** | one HTTP request | **one span** (§2.1). For RxJS, one subscription. | `RowView` |
| **Name** column | the URL, shared across repeat requests | `Span.name`: the observable label, or the sprefa rel/rule name. Shared across repeat subscriptions, exactly as a URL is. | `RowView.name` |
| **Status** column | HTTP status code, red on failure | `SpanStatus`: `open` / `completed` / `errored` / `cancelled`. Errored rows red, cancelled rows dimmed. | `RowView.status` |
| **Type** column | `xhr`, `script`, `img`, ... | `SpanKind`, the free string tag. `subscription`, `call`, `tick`, `txn`, `rel`, `fixpoint`, `round`, `sql`. | `RowView.kind` |
| **Initiator** column | the script or parser that caused this request, click to jump | `Span.parentSpanId`, rendered as the parent's name, click scrolls to and selects that row. For a root row, `Span.origin` (`file:line`) instead. | `RowView.initiatorSpanId`, `initiatorLabel`, `originLabel` |
| **Size** column | transferred bytes / resource bytes | `eventCount` events / `byteEstimate` bytes, two lines, same as Chromium's two-line size cell. The byte figure is the projector's structural estimate and the column header says "est." so nobody mistakes it for a wire size. | `RowView.eventCount`, `byteEstimate` |
| **Time** column | total duration | `durationMillis`, or "pending" for an open span | `RowView.durationMillis` |
| **Waterfall** column | a bar positioned on a shared time axis, with coloured phase segments | a bar on the shared logical-time axis with three phases and per-emission tick marks. §7.2. | `RowView.waterfall` |
| Waterfall header right-click: **Start Time / Response Time / End Time / Total Duration / Latency** | re-sorts rows by that key | **Start / First emission / End / Total duration / Time to first emission.** Exactly the five, renamed. Sorting is a view over `rowOrder`, never a mutation of it (§6.7). | `SpanIndex.rowOrder` + a comparator |
| **Overview strip** with time brush | requests-over-time mini-map above the table; drag to narrow the window | events-per-logical-time histogram with the same drag-to-narrow, writing `FilterQuery.window` | `SpanIndex.timeRange`, bucketed |
| **Type filter chips**: All, Fetch/XHR, JS, CSS, Img, Media, Font, Doc, WS, Wasm, Manifest, Other | multi-select, All resets | chips built **from `SpanIndex.kinds`**, which is a live `Map<SpanKind, number>`. The chip set is data, not a hard-coded list, which is what lets sprefa's `tick`/`round`/`sql` chips appear without a UI release. Count badge per chip. | `SpanIndex.kinds` |
| **Filter text box** with `domain:`, `method:`, `status-code:`, `larger-than:`, `mime-type:`, `has-response-header:`, `is:running`, `-` negation | key:value grammar, space-separated, `-` negates | same grammar, our keys: `kind:`, `status:`, `name:`, `origin:`, `session:`, `parent:`, `events>`, `dur>`, `is:open`, `is:errored`, `-` negates any of them. Bare words are a substring match on name. §7.4. | `Filter.parse` |
| **Invert** checkbox | negate the whole filter | `FilterQuery.invert` | |
| **Preserve log** checkbox | keep rows across navigation | keep rows across the **session boundary**. A session boundary is: page reload, HMR module swap, or in Node a new `SessionInfo` record. Off, a new session clears the index but keeps open spans (`clear(true)`). | `SpanIndex.clear` |
| **Clear** button | drop all rows | `index.clear(false)`. Does not stop the recorder. | |
| **Record / Stop** toggle | stop capturing | `recorder.setEnabled(false)`. Stopping is at the **source**, so a stopped recorder costs one boolean read per instrumented call and allocates nothing. Distinct from **Pause** below. | `Recorder.setEnabled` |
| **Disable cache** checkbox | n/a to us | slot reused for **Values off**: swap the recorder's budget to `STRUCTURE_ONLY_BUDGET`. Keeps rows and timing, drops payload capture, which is the single biggest cost lever. | `Budget` |
| **Throttling** dropdown | network throttling | slot reused for the **capture depth** preset: Structure only / Normal (`DEFAULT_BUDGET`) / Deep (depth 6, 64 items, 512 nodes). Same place in the toolbar, same "make it slower to see more" mental model. | `Budget` |
| **Import / Export HAR** | save and reload a session | Export / import NDJSON of `TraceRecord`. Plus a second export target, **Chrome Trace Event Format**, so a trace can be dropped into `ui.perfetto.dev` (§4.7). | `NdjsonCodec` |
| **Search** (Cmd+F) | full-text across headers and bodies | full-text across span names, event labels, and projected values. Same shortcut. | |
| **Detail pane tabs**: Headers, Payload, Preview, Response, Initiator, Timing, Cookies, EventStream | opens on row click, splits the panel | **Summary, Pipeline, Emissions, Value, Initiator, Timing.** §7.3. | |
| **Timing tab** phase breakdown: Queueing, Stalled, DNS, Connect, SSL, Request sent, Waiting (TTFB), Content Download | a table of phase durations | Opened at, Time to first emission, Emission span, Inter-emission max/median, Teardown, Total. §7.3. | |
| **DOMContentLoaded / Load** vertical lines in the waterfall | page lifecycle markers | `Marker` lines. For sprefa: tick boundaries, BEGIN, COMMIT, fixpoint start/settled. For a page: HMR swap, recorder enable/disable. | `SpanIndex.markers` |
| **Status bar**: "N requests, X transferred, Y resources, Finish, DOMContentLoaded, Load" | totals under the current filter | "N spans (M shown), E events, D dropped, R re-entrant, O orphan, F frames, apply Xms, span Ys". §7.5. | `SinkStats`, `RecorderStats`, `SpanIndex` |
| Row **right-click**: Copy as fetch / cURL, Block URL | context actions | Copy span id / Copy as filter (`parent:<id>`) / Copy projected value as JSON / Filter to this kind / Mute this kind | |
| Failed rows in **red** | text colour by status | same, driven by `SpanStatus` | |
| **Big request rows** setting | taller rows, two-line cells | same setting, and it is not cosmetic: the Size and Name cells both want two lines. | |

### 7.2 The waterfall column, concretely

Chromium's bar is one row's request decomposed into phases on a shared axis. Ours is one
span decomposed into three phases on a shared **logical-time** axis, with wall time shown
in the tooltip.

| Chromium phase | Our phase | Definition |
|---|---|---|
| Queueing + Stalled + Connect + SSL + Request sent | (none) | There is no connection setup for a subscription. Collapsing five phases to zero is honest; inventing analogues would be decoration. |
| **Waiting (TTFB)** | **pending** | `startLogical` to the first `emit` event. The single most useful number for a subscription: how long before it produced anything. |
| **Content Download** | **streaming** | first `emit` to last `emit`. |
| (none) | **draining** | last `emit` to `endLogical`. The teardown tail. Nonzero here means a subscription that stopped producing well before it was torn down, which is the shape of a leak. |

An open span has `openEnded: true`, no `draining` phase, and the bar runs to the right
edge, drawn with a fade, exactly as Chromium draws a pending request.

A span with zero emissions has only a `pending` phase and no `streaming`. A synchronous
span (a `sql` statement, a traced function call) has `startLogical === endLogical - 1`
and draws as a minimum-width tick, which Chromium also does for sub-millisecond
responses.

**Tick marks.** Each `emit` event is a 1px mark inside the bar. Capped by
`Waterfall.layout(..., maxTicks)` at the column's pixel width, because more ticks than
pixels is a solid rectangle that took O(events) to draw. `WaterfallBar.hiddenTicks`
carries the overflow and the renderer draws a density shade instead of marks. That cap
is the reason the waterfall is O(pixels) per row rather than O(events) per row, and it
is what lets a span with 200,000 emissions render in the same time as one with 3.

**Sorting is a view.** `rowOrder` is append-only (§6.7). The five waterfall sort modes
produce an index permutation array recomputed on sort change and on filter change, never
on frame apply. At 100,000 rows a per-frame re-sort is 1.7M comparisons at 60 Hz, which
is the whole frame budget; a per-sort-change re-sort is free because it happens on a
click.

### 7.3 The detail pane

Split pane, right side, opens on row click, closes on Escape or the X. Layout matches
Chromium: the row list narrows to the Name column plus the waterfall, and the detail pane
takes the rest. On a narrow viewport it stacks vertically instead.

| Tab | Chromium counterpart | Content |
|---|---|---|
| **Summary** | Headers | span id, kind, name, status, origin `file:line:col` with a click-to-source link, session, parent chain as breadcrumbs, `attributes` as a key/value table |
| **Pipeline** | (no counterpart; this one is ours) | for a `subscription` span, the operator chain that produced it, rendered with `renderStaticTree`'s existing `.pipe(` / operator / `-> #id` vocabulary (`05_render-tree.ts`, moved to `debug-ui`). For a sprefa `round` span, the rule being evaluated. |
| **Emissions** | Response / EventStream | the virtualized event list: logical time, wall delta from the previous emission, kind, label, one-line projected value. This is where the old marble diagram survives, as an optional strip above the list rather than as the main view. |
| **Value** | Preview / Payload | the selected event's `ProjectedValue` as an expandable tree, with `elided` nodes rendered as explicit `... 84 more (width)` rows rather than omitted. A truncated payload must read as truncated. |
| **Initiator** | Initiator | the ancestor chain up to the root, each row clickable, plus the descendant subtree count. Chromium's initiator chain, same interaction. |
| **Timing** | Timing | Opened at, Time to first emission, Emission span, Inter-emission max, Inter-emission median, Teardown, Total. Plus `droppedEventCount` if nonzero, because a timing table computed over trimmed events is a lie unless it says so. |

### 7.4 The filter grammar

Chromium's grammar is space-separated terms, `key:value`, `-` prefix negates, bare words
are a substring match on the URL. Ours is the same grammar with our keys.

```
kind:subscription        span kind equals (repeatable, OR within the key)
-kind:sql                negation
status:errored           span status equals
is:open                  status === "open"
is:errored               status === "errored"
name:pollUsers           substring, case-insensitive, on Span.name
origin:3_runtime         substring on Span.origin.file
parent:s3:41             exact parent span id. The "show me this subtree" filter.
session:s3               exact session id
events>100               eventCount greater than
dur>50                   durationMillis greater than
pollUsers                bare word: substring on name
```

`Filter.parse` returns a `FilterQuery`; `Filter.compile` turns it into one closure. The
closure is built once per query change and allocates nothing per row. That matters
because it runs over `rowOrder` on every frame that changes the row set.

Two behaviours copied deliberately from Chromium because they are not obvious and are
right: an empty chip set means All rather than None, and the text box and the chips
are ANDed while repeated instances of the same key are ORed.

### 7.5 The status bar

One line, fixed footer, always visible, and it is the thing that makes the instrument
honest about itself:

```
1,284 spans (312 shown) · 48,910 events · dropped 0 · re-entrant 0 · orphan 0
· ring 1,204/8,192 · frames 3,918 · apply 1.4 ms · span 8.42 s · session s3 (node)
```

Four of those numbers exist because the corresponding failure is otherwise invisible:
`dropped` (the ring lied), `re-entrant` (§2.3's guard fired), `orphan` (a record arrived
for a span that was never opened or was already evicted), and `apply` (the pump is
falling behind). The previous plan's §6 view E made the same argument and it is the one
view that carries over unchanged.

### 7.6 Layout, and Tailwind

```
┌──────────────────────────────────────────────────────────────────────┐
│ ● ⊘  □ Preserve log   [Values: Normal ▾]   🔍   ⬆⬇ export/import  ⚙  │  toolbar
├──────────────────────────────────────────────────────────────────────┤
│ [filter text.....]  □ Invert   All | subscription | tick | sql | ...  │  filter bar
├──────────────────────────────────────────────────────────────────────┤
│ ▁▂▅█▅▂▁▁▃█▇▄▂▁  (overview, drag to narrow)                            │  overview
├────────────────────────────────────────────┬─────────────────────────┤
│ Name  Status Type Init Size Time Waterfall │ Summary Pipeline Emis... │
│ ─────────────────────────────────────────  │ ─────────────────────── │
│ pollUsers$  open  sub  -  412/9k  8.4s ▓▓░ │  detail pane            │
│ ...virtualized rows...                     │                         │
├────────────────────────────────────────────┴─────────────────────────┤
│ 1,284 spans (312 shown) · 48,910 events · dropped 0 · apply 1.4 ms    │  status bar
└──────────────────────────────────────────────────────────────────────┘
```

Tailwind v4 CSS-first per the previous plan's §4, which is kept whole. The colour tokens
change from marble glyph colours to status and phase tokens:

```css
/* packages/debug-ui/src/tailwind.css */
/* noRxjs() */
@import "tailwindcss";

@theme {
  --color-status-open:       oklch(0.66 0.17 250);
  --color-status-completed:  oklch(0.62 0.02 260);
  --color-status-errored:    oklch(0.68 0.19  25);
  --color-status-cancelled:  oklch(0.76 0.15  62);
  --color-phase-pending:     oklch(0.80 0.06 250);
  --color-phase-streaming:   oklch(0.66 0.17 250);
  --color-phase-draining:    oklch(0.72 0.05 260);
  --color-marker:            oklch(0.62 0.24 315);
}
```

The static-versus-runtime rule from the previous plan's §4 is unchanged and is the reason
the waterfall works at all: Tailwind's scanner reads class *strings* out of source at
build time and never evaluates a template literal, so
``className={`left-[${percent}%]`}`` produces no CSS. Colour, border, font, spacing,
hover, and dark mode are utility classes. `left`, `width`, and `transform` are inline
`style`, computed per row from `WaterfallBar`. That is exactly three inline style
properties in the whole UI, which is the acceptance number in Phase 6.

---

## 8. The serializable boundary

### 8.1 The contract, in one sentence and one test

**`Frame` is closed under `structuredClone` and under `JSON.stringify` / `JSON.parse`,
and `TraceRecord` is the only thing that ever crosses.**

Two codecs rather than one because they fail differently and both are needed:
`structuredClone` for `BroadcastChannel` and `postMessage`, JSON for NDJSON export and
the dev-server WebSocket. JSON is the stricter of the two (it loses `undefined`, `Map`,
`Set`, and `bigint`), so the header type is written to survive JSON, and
`structuredClone` then holds trivially. That is why `ProjectedValue` has an explicit
`{ kind: "undefined" }` arm and a `{ kind: "bigint"; text }` arm instead of carrying the
native values.

The test that enforces it, and it is a rail rather than a one-off:

```ts
// packages/debug-core/src/2_ring.test.ts
test("every Frame survives both codecs byte-identically", () => {
  const frame = recordEverything()   // one span of every kind, one event of every
                                     // SpanEventKind, one marker, one session, plus a
                                     // value fixture containing: a WeakRef, a Proxy, a
                                     // class instance, a DOM-ish object, a function, a
                                     // Symbol, a BigInt, a cyclic object, a 10k-char
                                     // string, a 5,000-element array, an Error.
  expect(structuredClone(frame)).toEqual(frame)
  expect(JSON.parse(JSON.stringify(frame))).toEqual(frame)
})
```

`toEqual` against the original is the whole point: a round trip that merely does not
throw is not a round trip. `structuredClone` on a `WeakRef` throws `DataCloneError`, so
if a `WeakRef` ever leaks into a record this test fails loudly at the boundary rather
than quietly at the transport.

### 8.2 How the unserializable things get across

| Runtime value | `ProjectedValue` | What the UI shows |
|---|---|---|
| `WeakRef<Function>` | `{ kind: "opaque", typeName: "WeakRef", text: "WeakRef(...)" }` | `WeakRef` chip, no deref |
| a live `Proxy` | `{ kind: "opaque", typeName: <target ctor name>, text: <safe summary> }` | the target's constructor name. A Proxy is transparent to `typeof`, `Array.isArray`, and `instanceof`, so it is classified as whatever it wraps and its traps are never invoked beyond the ones the projector already runs. |
| `Function` | `{ kind: "callable", name, arity }` | `fn foo(2 args)` |
| a class instance | `{ kind: "opaque", typeName: ctor.name, text }` | `Subscription { }` |
| a DOM node | `{ kind: "opaque", typeName: "HTMLDivElement", text: "<div#app>" }` | the tag summary |
| `Map` / `Set` / `Promise` / `Observable` | `opaque` with `typeName` | the type name and a size hint where cheap |
| a cyclic object | `{ kind: "elided", reason: "cycle" }` at the back edge | `↺ cycle` |
| an `Error` | `{ kind: "failure", name, message, stack }` | the message, stack collapsed |

Two rules make this safe rather than merely typed.

**The projector never calls a user getter it does not have to.** `Object.keys` on a plain
record does invoke getters on the *own enumerable* properties, which can run user code.
That is accepted for plain records, because refusing would make the Value tab useless.
It is *not* accepted for anything else: the `opaque` arm reads `constructor.name` and a
short `safeSummary`, both inside a `try`, and never enumerates. A getter that throws
produces `{ kind: "opaque", typeName: "?", text: "<threw>" }`, never a thrown exception
into the instrumented program.

**`WeakRef` never crosses, so nothing downstream can `deref()`.** The previous plan had a
whole hazard about `deref()` returning `undefined` between an index read and a render.
That hazard is gone by construction: there are no live references on the UI side at all.
Everything the UI holds is a value.

### 8.3 The cap

Same seam, both jobs. The numbers, and the worked bound:

| Knob | Default | Worst case it bounds |
|---|---|---|
| `maxDepth` | 3 | recursion depth |
| `maxArrayItems` | 16 | fan-out per array level |
| `maxRecordKeys` | 24 | fan-out per record level |
| `maxTextLength` | 256 | chars retained per string |
| `maxNodesPerValue` | **128** | the hard ceiling. Every other knob is advisory; this one is absolute. |

Worked bound. Without `maxNodesPerValue`, the shape bound alone is
`24^3 = 13,824` nodes for a three-deep record of 24 keys, which is already too many.
`maxNodesPerValue: 128` makes one emission cost at most 128 `ProjectedValue` allocations
and at most `128 * 256 = 32 kB` of retained string, whatever the payload. At 10,000
emissions per second and a ring of 8,192 records, worst-case ring residency is
`8,192 * 32 kB = 256 MB`, which is too much, so the second bound is that
`RingSink.drain` clears its slots on every drain and the pump drains at 60 Hz, capping
live residency at `min(capacity, rate/60)` records. At 10,000/s that is 167 records,
or about 5 MB. Recording both bounds because the first one alone reads as safe and is
not.

Three presets, wired to the toolbar's throttling slot (§7.1):

| Preset | depth | items | keys | text | nodes |
|---|---|---|---|---|---|
| Structure only | 0 | 0 | 0 | 0 | 1 |
| Normal (default) | 3 | 16 | 24 | 256 | 128 |
| Deep | 6 | 64 | 64 | 2048 | 512 |

Deep is a debugging posture, not a default, and the status bar shows which preset is
live so a slow session has an obvious first suspect.

### 8.4 Ordering and holes across a transport

Three properties the transport must not break, and what happens when it does:

1. **`Frame.seq` is monotonic per sink.** `MapSpanIndex.apply` refuses a frame with
   `seq <= lastAppliedSeq` and counts it. A WebSocket reconnect that replays is
   therefore harmless.
2. **Records within a frame are in push order** and push order is `LogicalTime` order,
   because the clock is incremented inside the recorder before the push. The index never
   sorts within a frame.
3. **A gap in `seq`, or a nonzero `droppedBefore` delta, means a hole.** The index does
   not attempt to repair it. It surfaces `orphanRecords` in the status bar and the
   affected rows show a hole glyph. The alternative, fabricating a `span-open` for an
   event whose span never arrived, would put a row on screen that never existed in the
   program.

---

## 9. sprefa v6 integration

Two packages, both Node-only, both on `rxjs 7.8.2`, both `"type": "module"` with no
`exports` map, connected by `"sprefa-store-engine": "link:../sprefa-store/js"`. There is
no workspace manifest above them; there is a `pnpm-workspace.yaml` inside
`v6/dl/`, which is an unusual place for one. Tests run under
`node --test --experimental-transform-types`; typechecking is `tsgo --noEmit`. No
bundler is involved at any point.

### 9.1 What exists today

| Fact | Receipt |
|---|---|
| `traceStatement?: (sql: string) => void` is declared on `EvalProgram` | `v6/sprefa-store/js/src/lower/types.ts:60-66` |
| It has exactly **one** call site | `lowerSql.ts:446`, inside `makeExec` (442-449) |
| It has **zero** callers. Nobody passes it, including `3_runtime.ts:869` | grep across both `src/` trees |
| Round number is not in scope at the call site. `makeExec` is created once per `evalProgramSql` (line 46); the round lives in `evalRecursiveStratum`'s closures and is never threaded down | `lowerSql.ts:128-159` |
| Rule name and head rel are in scope at `insertNewRows` (167-181) and `evalAcyclicRel` (80-87) but are not passed | same |
| Rows added per rel per round **is computed and then thrown away**: `mergeDeltaIntoFull` returns `Observable<number>` (183-200), and line 148 collapses it to `rowsAdded > 0`, then line 152 OR-folds it, so `expand` at 159 only ever sees a boolean | `lowerSql.ts:143-159` |
| `makeCountRows` (451-456) issues `SELECT count(*)` and increments `stmt_counter` separately, bypassing `traceStatement` entirely | `lowerSql.ts:451-456` |
| No timing exists anywhere in either file. Zero hits for `Date.now`, `performance.now`, `hrtime`, `console.`, `log`, `debug`, `trace` | grep of `3_runtime.ts` and `lowerSql.ts` |
| The tick chain has no single entry function; it is composed inline in the `DlRuntime` constructor | `3_runtime.ts:773-798` |
| The hot path is `async`-free. Every `await` is in `boot` (800-897), `commit` (899), `retractThroughSupport` (931), `rows` (959), `dispose` (970) | grep |

The last row is the one that makes this integration cheap: the whole tick is one
observable chain, so an operator inserted into it sees everything.

### 9.2 Change A: `sprefa-store/js`, widen the trace hook

`traceStatement` has zero callers, so replacing it costs nothing and there is no
back-compat argument to make.

**`v6/sprefa-store/js/src/lower/types.ts`** gains one interface and changes one field.
It is already the contract header for that directory, so this obeys the same law as §5.

```ts
/** What one SQL statement was for. Enough to build a row without parsing SQL. */
export interface StatementLabel {
  readonly phase: "seed" | "round" | "merge" | "count" | "cleanup" | "acyclic" | "ddl";
  /** Head relation the statement writes, or the relation it reads for a count. */
  readonly rel: string | null;
  /** Recursive stratum member list, joined. Null outside a recursive stratum. */
  readonly stratum: string | null;
  /** Semi-naive round, 0 for the seed. Null outside a recursive stratum. */
  readonly round: number | null;
}

export interface EvalTrace {
  /** Fired immediately before every statement, including the count(*) probes. */
  statement(sql: string, label: StatementLabel): void;
  /** Fired after mergeDeltaIntoFull, with the number line 148 currently discards. */
  rowsAdded(rel: string, stratum: string | null, round: number | null, added: number): void;
  /** Fired at each stratum boundary so the UI gets a parent row per stratum. */
  stratumStart(rels: readonly string[], recursive: boolean, order: number): void;
  stratumEnd(rels: readonly string[], rounds: number): void;
}

export type EvalProgram = (
  db: SqliteDb,
  prog: Program,
  tables: RelTables,
  support?: SupportEdges,
  trace?: EvalTrace,          // was: traceStatement?: (sql: string) => void
) => Observable<SupportReport>;
```

**`lowerSql.ts`** edits, all mechanical:

| Line | Edit |
|---|---|
| 38, 46 | `evalProgramSql` signature takes `trace?: EvalTrace`; `makeExec(db, trace)` |
| 442-449 | `Exec` becomes `(sql: string, label: StatementLabel) => Observable<void>`; the body calls `trace?.statement(sql, label)` instead of `traceStatement?.(sql)` |
| 451-456 | `makeCountRows` takes `trace` and emits `statement(sql, {phase:"count", rel, ...})`. This closes the blind spot: the count probes are two statements per rel per round and are currently invisible. |
| 105-106, 128-155 | `evalRecursiveStratum` threads a `round` counter. Today `expand` (159) carries only a boolean; it carries `{ grew: boolean; round: number }` instead, and `round()` takes the round number as a parameter. This is the one non-mechanical edit and it is about six lines. |
| 143-148 | `mergeDeltaIntoFull`'s `rowsAdded` gets a `tap(added => trace?.rowsAdded(relName, stratumKey, round, added))` before the `> 0` collapse. The number already exists; today it is discarded at line 148. |
| 113-126 | `seed` labels its statements `phase: "seed"`, `round: 0` |
| 161 | cleanup drops label `phase: "cleanup"` |
| 80-87 | `evalAcyclicRel` labels `phase: "acyclic"` with its `rel` |
| 202-208 | `createLike` labels `phase: "ddl"` |

Call-site count for the label argument: 6 `exec(...)` sites plus 1 `countRows`.

Nothing in this change depends on `@hafley/debug-core`. `EvalTrace` is a plain
interface owned by sprefa. That is deliberate: the engine package takes on **zero**
dependency and remains testable with a hand-written trace object. Only `dl` binds the
trace to a recorder.

### 9.3 Change B: `dl`, one dependency and five operator insertions

**Dependency.** `v6/dl/package.json` gains
`"@hafley/debug-core": "link:../../../hafley-rxjs/packages/debug-core"` and
`"@hafley/debug-rxjs": "link:../../../hafley-rxjs/packages/debug-rxjs"` during
development, or the published versions once they exist. `debug-core` has no
dependencies, so this adds nothing to the tree. `debug-rxjs` peer-depends on `rxjs`,
which `dl` already has at 7.8.2.

**The operator.** `@hafley/debug-rxjs` exports one thing that does all of this:

```ts
// packages/debug-rxjs/src/4_traced.ts
import type { MonoTypeOperatorFunction } from "rxjs"
import type { Recorder, SourceOrigin, SpanId, SpanKind } from "@hafley/debug-core/types"

export interface TracedOptions<Value> {
  readonly kind: SpanKind
  readonly name: string
  readonly parentSpanId?: SpanId | null
  readonly origin?: SourceOrigin | null
  readonly attributes?: Readonly<Record<string, unknown>>
  /** false records the emission but not its value. Default true. */
  readonly captureValues?: boolean
  /** Short label per emission for the Emissions tab. */
  readonly label?: (value: Value, index: number) => string | null
}

export function traced<Value>(
  recorder: Recorder,
  options: TracedOptions<Value>,
): MonoTypeOperatorFunction<Value>
// pseudo-code:
//   return source => new Observable<Value>(subscriber => {
//     const spanId = recorder.openSpan({ kind: options.kind, name: options.name,
//       parentSpanId: options.parentSpanId ?? null, origin: options.origin ?? null,
//       attributes: options.attributes })
//     let index = 0
//     let settled = false
//     const inner = source.subscribe({
//       next: value => {
//         recorder.addEvent(spanId, "emit", options.label?.(value, index++) ?? null,
//                           options.captureValues === false ? undefined : value)
//         subscriber.next(value)
//       },
//       error: failure => {
//         settled = true
//         recorder.addEvent(spanId, "failure", null, failure)
//         recorder.closeSpan(spanId, { status: "errored", failure })
//         subscriber.error(failure)
//       },
//       complete: () => {
//         settled = true
//         recorder.addEvent(spanId, "complete", null, undefined)
//         recorder.closeSpan(spanId, { status: "completed" })
//         subscriber.complete()
//       },
//     })
//     return () => {
//       inner.unsubscribe()
//       // Teardown without complete or error is an unsubscribe, which is the
//       // "cancelled" status and the shape a leak hunt looks for.
//       if (!settled) recorder.closeSpan(spanId, { status: "cancelled" })
//     }
//   })
```

One span per **subscription**, not per observable, which is §2.1's ruling expressed as
code: a `traced()` operator applied to a `share()`d source that is subscribed three
times produces three rows.

**Parenting.** `traced` takes `parentSpanId` explicitly. There is no ambient current
span in core, and that is a deliberate limitation with a stated cost: an inner
subscription created by `concatMap` after an async boundary cannot find its parent
automatically. Two mitigations, in order of preference:

1. For sprefa, pass it explicitly. The tick chain is five call sites; the parent is in
   scope at every one.
2. For Node consumers who want it ambient, `@hafley/debug-rxjs/node-context` (a separate
   subpath, so it never loads in a browser) wraps `node:async_hooks`
   `AsyncLocalStorage`. Core stays zero-dependency because `node:async_hooks` is a
   built-in, and the browser never imports the subpath. This is the same split
   OpenTelemetry makes with `@opentelemetry/context-async-hooks`, and it is the one part
   of their design worth copying (§4.7).

**The five insertions in `3_runtime.ts`.** `boot`'s config gains
`recorder?: Recorder` and it is stored on `RuntimeState`. Where `recorder` is absent
every call is against a `NULL_RECORDER` whose methods return `""` and do nothing, so the
un-instrumented path costs one property read per stage per tick.

| # | Location | Span |
|---|---|---|
| 1 | `3_runtime.ts:777`, `tick$ = commits$.pipe(concatMap(applyEdbTxn))` | wrap each request in a `kind: "tick"` root span, opened in a `concatMap` before `applyEdbTxn`, closed in `settled$`. Name `tick #<n>`. Parent: null. |
| 2 | inside `applyEdbTxn` (499-550), around the `inTransaction` bracket (290-301) | `kind: "txn"`, name `edb-txn`, parent = the tick span. Two markers, `BEGIN` and `COMMIT`, from `inTransaction` itself. |
| 3 | `3_runtime.ts:514-516`, `from(relNames).pipe(concatMap(applyRelWrite), toArray())` | `kind: "rel"`, one span per rel, name = rel name, parent = the txn span. Attributes: inserted and retracted row counts from `write.inserted.length` / `write.retracted.length` (518-528). |
| 4 | inside `applyDerivedTxn` (677-741), around the `evalProgramSql` call (688) | `kind: "txn"`, name `derived-txn`, parent = the tick span. The `EvalTrace` implementation from 9.2 hangs off this span. |
| 5 | `3_runtime.ts:783-786`, `deltas$` | not a span. One `addEvent(tickSpanId, "emit", relName, event)` per `DeltaEvent`, so the tick row's Size column counts the deltas it produced. |

**The `EvalTrace` implementation**, about 40 lines in a new `v6/dl/src/7_trace.ts`:

```ts
export function recorderEvalTrace(recorder: Recorder, parentSpanId: SpanId): EvalTrace
// pseudo-code:
//   let stratumSpan = ""
//   let roundSpan = ""
//   let currentRound: number | null = null
//   return {
//     stratumStart: (rels, recursive, order) => {
//       stratumSpan = recorder.openSpan({ kind: "fixpoint", parentSpanId,
//         name: `stratum[${rels.join(",")}]`,
//         attributes: { recursive, order, members: rels.length } })
//     },
//     stratumEnd: (rels, rounds) => {
//       if (roundSpan) { recorder.closeSpan(roundSpan, { status: "completed" }); roundSpan = "" }
//       recorder.addEvent(stratumSpan, "note", `${rounds} rounds`, rounds)
//       recorder.closeSpan(stratumSpan, { status: "completed" }); stratumSpan = ""
//     },
//     statement: (sql, label) => {
//       // Round spans open lazily on the first statement of a new round, because
//       // lowerSql has no explicit round-start callback and adding one would be a
//       // sixth edit for no extra information.
//       if (label.round !== null && label.round !== currentRound) {
//         if (roundSpan) recorder.closeSpan(roundSpan, { status: "completed" })
//         currentRound = label.round
//         roundSpan = recorder.openSpan({ kind: "round", parentSpanId: stratumSpan,
//           name: `round ${label.round}` })
//       }
//       const owner = roundSpan || stratumSpan || parentSpanId
//       const sqlSpan = recorder.openSpan({ kind: "sql", parentSpanId: owner,
//         name: `${label.phase} ${label.rel ?? ""}`.trim(),
//         attributes: { sql, phase: label.phase } })
//       // Statements are synchronous from the trace's point of view: the hook fires
//       // before db.execute and there is no completion callback, so the span closes
//       // immediately and its duration is 0. Recorded as a limitation in §11; the fix
//       // is a second hook after `from(db.execute(sql))` settles, which is one more
//       // sprefa edit and is deferred until someone wants per-statement timing.
//       recorder.closeSpan(sqlSpan, { status: "completed" })
//     },
//     rowsAdded: (rel, _stratum, _round, added) => {
//       recorder.addEvent(roundSpan || stratumSpan, "emit", rel, added)
//     },
//   }
```

### 9.4 What the Network tab shows for one dl tick

Take a tick that inserts 400 rows into one EDB rel, over a program with one recursive
stratum `[path, reach]` that reaches fixpoint in 7 rounds, plus 12 derived rels of which
4 change. With all chips on:

| # | Depth | Name | Type | Status | Initiator | Size (events / est.) | Time | Waterfall |
|---|---|---|---|---|---|---|---|---|
| 1 | 0 | `tick #41` | tick | completed | `-` (`3_runtime.ts:907`) | 4 / 6 kB | 84 ms | full width, 3 emission ticks from `deltas$` |
| 2 | 1 | `edb-txn` | txn | completed | `tick #41` | 0 | 11 ms | left 13% |
| 3 | 2 | `file_line` | rel | completed | `edb-txn` | 0 / attrs `inserted:400 retracted:0` | 9 ms | inside the txn bar |
| 4 | 1 | `derived-txn` | txn | completed | `tick #41` | 0 | 71 ms | remaining 85% |
| 5 | 2 | `stratum[path,reach]` | fixpoint | completed | `derived-txn` | 1 note `7 rounds` | 58 ms | the fat bar. This is the row that answers "why is the tick slow". |
| 6 | 3 | `round 0` (seed) | round | completed | `stratum[...]` | 2 / rowsAdded per rel | 14 ms | first and widest |
| 7-12 | 3 | `round 1` .. `round 6` | round | completed | `stratum[...]` | 2 each | narrowing | **the visual signature of a converging fixpoint is a staircase of narrowing bars.** A round that does not narrow is the bug. |
| 13+ | 4 | `merge path`, `count path`, `ddl _dl_next_path`, ... | sql | completed | `round N` | attrs carry the SQL text | 0 ms each | minimum-width ticks, like cached responses |
| ... | 2 | `refresh-fact-plane` | rel | completed | `derived-txn` | one child per declared rel | | |
| ... | 2 | `diff rel_x` × 4 | rel | completed | `derived-txn` | | | |

Markers (vertical lines): `BEGIN`, `COMMIT` × 2, `fixpoint start`, `fixpoint settled`,
`tick #41 start`.

Status bar:
`~90 spans · ~40 events · dropped 0 · ring 130/8192 · apply 0.3 ms · span 84 ms · session dl-s3 (node)`.

Four questions this answers that nothing in sprefa answers today, and the receipt that
it answers nothing today is `3_runtime.ts` having zero timing calls and `stmt_counter`
being a bare global with no per-round tag:

1. **How many fixpoint rounds did this tick take?** Row 5's `7 rounds` note.
   Currently unknowable without instrumentation, and named as unknowable in the
   engine reading.
2. **Which round stopped converging?** The staircase. A flat staircase is a rule that
   keeps producing rows.
3. **How many rows did each rel add per round?** Row 6-12's emission events, the number
   `lowerSql.ts:148` currently discards.
4. **Is the tick dominated by EDB writes or by the fixpoint?** Rows 2 and 4's bars,
   13% versus 85%.

**Filter recipes for the three questions a sprefa operator actually asks:**

```
kind:round events>0 dur>10        which fixpoint rounds are expensive
kind:sql phase:count              how many count(*) probes the fixpoint issued
parent:<tickSpanId>               everything one tick did, and nothing else
kind:rel -events>0                rels that were written but produced no delta
```

### 9.5 Total sprefa diff, estimated

| Package | File | Edit | Size |
|---|---|---|---|
| `sprefa-store/js` | `src/lower/types.ts` | add `StatementLabel`, `EvalTrace`; change one field on `EvalProgram` | +25 lines |
| `sprefa-store/js` | `src/lower/lowerSql.ts` | label 7 call sites, thread a round counter, tap `rowsAdded`, route `countRows` | ~40 lines changed |
| `dl` | `package.json` | 2 link deps | +2 lines |
| `dl` | `src/0_types.ts` | `recorder` on the boot config and on `RuntimeState` | +3 lines |
| `dl` | `src/3_runtime.ts` | 5 `traced()` insertions plus span open/close in the two txn functions | ~45 lines |
| `dl` | `src/7_trace.ts` (new) | `recorderEvalTrace` | ~45 lines |

Under 160 lines across two packages, and `sprefa-store/js` takes on zero dependencies.

---

## 10. Phases

`‖` marks phases that can run concurrently with disjoint file ownership. Every phase has
verification commands with expected results, not descriptions.

```
P0 ── P1 ──┬── P2 ──┬── P3 ── P4 ── P5 ── P6 ── [P8]
           │        └── P7 (sprefa)  ‖ P3..P6
           └── (P1 alone unblocks nothing else)
```

### Phase 0: stabilize the baseline (blocking, §1)

Owns: everything currently in `packages/devtool-plugin`.

Four sub-blocks in the order given in §1.1 through §1.4. Deletes
`src/2_ui/0_DebuggerGrid.browser.test.tsx`. Fixes `2_diet_rxjs.ts` `reset()` for real.
Quarantines the rest with `// BASELINE-RED 2026-07-25`.

```bash
cd packages/devtool-plugin
pnpm --filter @hafley/rxjs-ext build
pnpm typecheck                                     # exit 0
pnpm test:run                                      # exit 0
pnpm build && test -f dist/index.js                # exit 0
grep -c "lightningcss\|magic-string" dist/index.js # 0
timeout 60 pnpm test:browser                       # exit 0
grep -rn "BASELINE-RED" src | wc -l                # equals the count recorded in CHANGELOG.md
```

### Phase 1: `@hafley/debug-core`, greenfield

Owns: `packages/debug-core/**` only. Touches nothing that exists.

Lands `0_types.ts` verbatim from §5, then `1_clock.ts`, `2_ring.ts`, `3_project.ts`,
`4_recorder.ts`, `5_index.ts`, `6_filter.ts`, `7_waterfall.ts`, `transport/*`, plus tests.
No consumer yet. This phase is a library with a test suite and nothing else, which is what
makes it verifiable in isolation.

```bash
cd packages/debug-core
pnpm typecheck                                        # exit 0
pnpm test                                             # exit 0
node -e "import('./dist/0_types.js')"                 # resolves; the header has no runtime code
node -p "Object.keys(require('./package.json').dependencies||{}).length"   # 0
```

Five acceptance tests that must exist and pass, each targeting a defect named in this plan:

| Test | Asserts |
|---|---|
| ring wraparound | 100,000 pushes into `RingSink(8192)`: `dropped === 91808`, `size === 8192`, `drain()` returns the last 8,192 in push order, heap growth under 5 MB |
| projection budget | a 5-deep object with 200-element arrays at each level projects to `<= 128` nodes, contains at least one `{kind:"elided"}`, leaves `Object.keys(input)` unchanged, and completes in under 1 ms |
| projection cycle | a self-referencing object projects without recursing and yields `{kind:"elided", reason:"cycle"}` |
| serializable boundary (§8.1) | `structuredClone(frame)` and `JSON.parse(JSON.stringify(frame))` both `toEqual(frame)`, with a fixture containing a `WeakRef`, a `Proxy`, a class instance, a function, a Symbol, a BigInt, and a cycle |
| re-entrancy (§2.3) | a sink that calls back into the recorder produces exactly 3 records and `stats.reentrantDrops === 3` |
| index fold rate | 10,000 `span-event` records through `apply()` in under 50 ms; `compact()` on 100,000 spans evicts to `maxSpans` and never evicts an open span or a span with children |

### Phase 2: `@hafley/debug-rxjs`, additive ‖ nothing yet

Owns: `packages/debug-rxjs/**` (new), and **adds** to
`packages/devtool-plugin/src/0_runtime/0_store.ts` without deleting from it.

Lands `traced()` (§9.3), moves `patchObservable` / `decorateCreate` /
`decorateOperatorFun` / `DietObservable`, and writes the
`ObservableEvent -> TraceRecord` adapter that subscribes to `RxJSTracker.event$`
(`0_store.ts:99`). The `globalThis` recorder pin (§6.8) lands here. **Nothing is deleted
in this phase**, so both the old accumulator and the new recorder run side by side and
can be diffed against each other.

```bash
cd packages/debug-rxjs
pnpm typecheck && pnpm test                        # exit 0
node -p "require('./package.json').peerDependencies.rxjs"    # ^7.8.0 || ^8
node -p "Object.keys(require('./package.json').dependencies).join()"  # @hafley/debug-core
```

Acceptance: a test subscribes twice to one `share()`d source through `traced()` and
asserts **two** spans, not one. That is §2.1's ruling as an executable assertion. A second
test asserts that an unsubscribe without complete produces `status: "cancelled"`, and a
third asserts the adapter produces the same span count as `RxJSTracker`'s
`state$.value.store.subscription` key count over the existing `01.patch-observable`
fixtures.

### Phase 3: Vite 8 migration and the package boundary

Owns: all six `package.json` files, `vite.config.ts`, `vitest.browser.config.ts`,
`src/1_runtime_vite_plugin/0_rxjs_devtool_patch_plugin.ts`, `pnpm-lock.yaml`.

The previous plan's §7 is adopted **whole and unchanged**, including the
`minify: "esbuild"` warning, the `rollupOptions` to `rolldownOptions` rename, and the
`resolve.mainFields` risk to the rxjs dist-path guards. Added on top: `devtool-plugin`
sheds everything that moved to `debug-rxjs`, its default HMR import specifier changes from
`"@hafley/rxjs-debugger/hmr"` to `"@hafley/debug-rxjs/hmr"` (`2_user_transform.ts:645`),
and the `/2_ui` and `/lib` exclusion plus the whole-package exclusions land in
`shouldTransformUserCode` (§2.3, fix 1).

```bash
pnpm -r typecheck                                  # exit 0 across all packages
pnpm -r build                                      # exit 0
grep -rn "rolldown-vite" packages/ package.json | grep -v pnpm-lock   # 0 hits
grep -c "lightningcss" packages/devtool-plugin/dist/index.js          # 0
cd packages/devtool-plugin && pnpm test:run -t "own UI is never transformed"  # passes
```

Plus the one check that needs a human eye, carried over from the previous plan because the
risk is real and silent: run `pnpm dev`, load the page, confirm the recorder has spans and
that no `[rxjs-debugger] WARNING: Pattern did not match!` was logged. Vite 8 changed
`resolve.mainFields` handling, and `0_rxjs_devtool_patch_plugin.ts:260-320` branches on
`cleanId.includes("/rxjs/dist/esm5/")`. If rxjs resolves to a different dist directory the
patch silently stops applying.

### Phase 4: `@hafley/debug-ui` shell ‖ with Phase 7

Owns: `packages/debug-ui/**` (new).

Tailwind v4 CSS-first per the previous plan's §4 with the §7.6 token set,
`react-resizable-panels`, `@tanstack/react-virtual`, `zustand`, the
`AnimationFramePump`, the toolbar, the filter bar with data-driven chips, the row list
without the waterfall column, and the status bar. Rows render, filter, and sort. The
Waterfall cell renders a placeholder.

```bash
cd packages/debug-ui
pnpm typecheck && pnpm build                       # exit 0
grep -o -- "--color-status-open:[^;]*" dist/assets/*.css   # non-empty
grep -rn "Object.values(\|\.entries()\|\[\.\.\." src/ | grep -v "0_rows.ts"   # 0 hits
grep -rn "from \"rxjs\"\|from 'rxjs'" src/          # 0 hits: the UI never imports rxjs
grep -rLn "noRxjs()" src/**/*.tsx                   # empty: every file carries the marker
```

Acceptance: a browser test feeds 5,000 synthetic frames through the pump and asserts the
row count, that filtering by `kind:` narrows it, that the status bar reports
`dropped: 0`, and that the median frame time is under 16 ms with 200 rows on screen,
measured with `performance.measure` inside the test rather than by eye.

### Phase 5: waterfall, detail pane, and the deletions

Owns: `packages/debug-ui/src/` waterfall and detail-pane files, plus the deletions in
`packages/devtool-plugin`.

Lands the waterfall column (§7.2, DOM stage 1), the six detail tabs (§7.3), the overview
strip with its brush, and the marker lines. Then deletes, in this order, each deletion
gated on the grep that proves nothing reads it:

| Delete | Gate |
|---|---|
| `src/0_runtime/0_store_v2.ts` + `0_store_v2.test.ts` | `grep -rn "0_store_v2" packages/*/src \| wc -l` = 0 |
| `RxJSTracker.events$`, `events$$` (`0_store.ts:100-104`) | `grep -rn "events\$\$\?" packages/*/src \| wc -l` = 0 |
| `RxJSTracker.state$$`, `lol` (`0_store.ts:137, 570`) | same for `state\$\$` |
| `src/0_runtime/06_queries.ts` (16 exports) | `grep -rn "06_queries" packages/*/src \| wc -l` = 0 |
| `src/0_runtime/0.types.d.ts` (including the `console.log` at line 55) | `grep -rn "0\.types" packages/*/src \| wc -l` = 0 |
| `src/2_ui/0_DebuggerGrid.tsx`, `src/2_ui/1_MarbleDiagram.tsx` | replaced by `debug-ui` |

```bash
pnpm -r typecheck && pnpm -r test                  # exit 0
git diff --stat                                    # net line count is NEGATIVE
grep -rn "console.log" packages/devtool-plugin/src/**/*.d.ts | wc -l   # 0
```

### Phase 6: performance acceptance and the conditional canvas swap

Owns: `packages/debug-ui/src/` waterfall files only.

```bash
cd packages/debug-ui && pnpm test:browser -t "frame budget"
```

Three thresholds, and the third one is the trigger:

| Rows on screen | Total spans | Events/sec | Median frame |
|---|---|---|---|
| 200 | 10,000 | 1,000 | under 16 ms |
| 500 | 100,000 | 10,000 | under 16 ms |
| 500 | 100,000 | 10,000 | **if over 16 ms, swap to the single-canvas waterfall column (§4.3 stage 2)** |

The swap is behind the unchanged `WaterfallBar` type, so its acceptance is that the same
test passes and no file outside the waterfall directory changed.

### Phase 7: sprefa integration ‖ with Phases 3 through 6

Owns: `~/projects/sprefa/v6/sprefa-store/js/src/lower/{types.ts,lowerSql.ts}` and
`~/projects/sprefa/v6/dl/src/{0_types.ts,3_runtime.ts,7_trace.ts,package.json}`.
Depends only on Phase 1 and Phase 2, so it does not wait for the UI.

§9.2 and §9.3, in that order.

```bash
cd ~/projects/sprefa/v6/sprefa-store/js && pnpm typecheck && pnpm test    # exit 0
cd ~/projects/sprefa/v6/dl              && pnpm typecheck && pnpm test    # exit 0
grep -c "traceStatement" src/lower/*.ts                                   # 0: fully replaced
node -p "Object.keys(require('./package.json').dependencies).length"      # sprefa-store: unchanged
```

Acceptance, and it is a data assertion rather than a screenshot: run one `commit()` against
a fixture program with a known recursive stratum, drain the ring, and assert from the
records alone that

1. exactly one span has `kind: "tick"` and `parentSpanId === null`,
2. the count of `kind: "round"` spans equals the fixpoint's round count,
3. every `round` span has at least one `emit` event whose value is the per-rel
   `rowsAdded` integer, which is the number `lowerSql.ts:148` discards today,
4. `sum(sql span count)` equals `stmt_counter`'s delta over the tick, which proves the
   `countRows` blind spot is closed,
5. `recorder.stats.orphanDrops === 0` and `sink.stats.dropped === 0`.

A second acceptance: run the same tick with `recorder: undefined` and assert the tick
report is byte-identical to the pre-change baseline. Instrumentation that changes results
is not instrumentation.

### Phase 8: interop exports and the v2 salvage

Owns: `packages/debug-core/src/transport/3_chrome_trace.ts`,
`packages/debug-core/src/transport/4_user_timing.ts`,
`packages/debug-rxjs/src/5_trace_function.ts`.

- **Chrome Trace Event Format** exporter, so a trace opens in `ui.perfetto.dev` through
  the documented `window.open` plus PING/PONG plus
  `{ perfetto: { buffer, title, fileName } }` postMessage protocol (§4.7).
- **`PerformanceMarkSink`** implementing `Sink`, mirroring spans as
  `performance.measure` with the Chrome 129 `detail.devtools` shape
  (`{ dataType, track, trackGroup, color, tooltipText, properties }`), so spans appear in
  the DevTools Performance panel with no extra work. Opt-in; the global performance buffer
  is finite and this must never be on by default.
- **`traceFunction`**, the salvage of v2's `decoratoPatronus` Proxy decorator, ported onto
  the core `Span` model with the projection budget applied at the boundary. This is the
  capability that makes the debugger general beyond RxJS and it is deliberately last.

```bash
cd packages/debug-core && pnpm test -t "chrome trace"      # round-trips through the catapult schema
cd packages/debug-core && pnpm test -t "user timing"       # emits a measure per closed span, none per event
```

### Ownership matrix for concurrent execution

| Phase | Exclusive file ownership |
|---|---|
| P0 | `packages/devtool-plugin/**` |
| P1 | `packages/debug-core/**` |
| P2 | `packages/debug-rxjs/**` + additions only to `devtool-plugin/src/0_runtime/0_store.ts` |
| P3 | all `package.json`, `vite.config.ts`, `vitest.browser.config.ts`, `0_rxjs_devtool_patch_plugin.ts`, `2_user_transform.ts`, `pnpm-lock.yaml` |
| P4, P5, P6 | `packages/debug-ui/**` + the P5 deletion list |
| P7 | `~/projects/sprefa/v6/**` only. Different repository, zero overlap. |
| P8 | three named new files |

P3 and P7 can run at the same time because they share no file and no repository. P4 and P7
likewise. P3 owns `pnpm-lock.yaml` alone; P4's dependency additions rebase onto it.

---

## 11. What I could not verify

Everything in this section is a claim I am not standing behind, listed so it is checked
before it is depended on.

### Facts I could not retrieve

1. **`d3-array` standalone version, gzip size, and dependency list.** The research pass
   sized `d3-scale` (4.0.2, 16,023 B) and `d3-axis` (3.0.0, 1,210 B) but did not isolate
   `d3-array`, which is the only module §4.3 wants (`ticks`, `tickIncrement`). The
   verdict names it with a stated fallback for this reason. Check before adding it.
2. **`mnemonist/circular-buffer` subpath gzip size.** Only the whole-package figure
   (22,916 B) was retrieved. The previous plan measured the **root** import at 2.81 kB
   tree-shaken under Vite 8 + Rolldown, which is a different measurement of a different
   thing. §4.6 does not depend on either number, but do not quote them interchangeably.
3. **`react-mosaic-component`, `socket.io`, `socket.io-client`, `superjson`,
   `@ungap/structured-clone`, `nanostores`, `speedscope` gzip sizes.** Six bundlephobia
   lookups returned HTTP 429 after three retries; `speedscope` returned an InstallError.
   Unpacked sizes are given where available and are not comparable to gzip figures.
4. **OpenTelemetry `startSpan()` throughput.** No published number found. The official
   benchmarks page is a live chart fed by an external `data.js` that could not be
   resolved; the spec's `performance-benchmark.md` is methodology, not results. §4.7 does
   not rest on this number, but if per-span overhead ever becomes the deciding argument it
   needs a local microbenchmark.
5. **The default mark/measure entry cap in the global performance timeline.** The
   250-entry figure is confirmed for the **resource timing** buffer specifically. A
   general cap for `performance.mark`/`measure` entries could not be confirmed from the
   spec or MDN; one search result claimed 150 without a citable source. §4.7 and Phase 8
   treat the buffer as finite without asserting a number.
6. **Whether Node's `perf_hooks` `detail` matches the browser's structured-clone
   behaviour byte for byte.** Node documents conformance to User Timing Level 3 since
   v16.0.0 and the API shape matches. No test proving cloning-edge-case parity was found.

### Claims in this plan that rest on reading rather than running

7. **The sprefa round-counter edit is "about six lines."** That is an estimate from
   reading `lowerSql.ts:105-159`, not from writing the patch. `expand` currently carries a
   bare `boolean` (line 159) and would carry `{ grew, round }`; the seed path (113-126) and
   the `round()` signature both change. It could be twice that.
8. **`traced()` produces one span per subscription for a `share()`d source.** This follows
   from `traced` being an operator in the pipe and `share`'s multicast being upstream of
   it, but it depends on where in the chain `traced` is inserted, and inserting it above a
   `share()` gives one span for all subscribers. Phase 2's acceptance test exists to pin
   this down, and the answer may require documenting both placements rather than one rule.
9. **`sum(sql span count) === stmt_counter` delta** (Phase 7 acceptance 4). This assumes
   every `stmt_counter.incr()` in the fixpoint path is either in `makeExec` (line 445) or
   `makeCountRows` (line 454). `stmt_counter` is declared in
   `sprefa-store/js/src/engine/engine.ts:88` and other files may increment it. Verify the
   full call-site set before making it a hard assertion.
10. **Node type stripping inside `node_modules`.** §3.2 ships `src` alongside `dist`
    partly to keep the `.ts`-through-`link:` door open, because sprefa imports
    `sprefa-store-engine/src/lower/lowerSql.ts` today. Whether
    `node --experimental-transform-types` applies to files resolved inside `node_modules`
    (and whether a `link:` symlink counts) was not confirmed. If it does not, the `dist`
    path is the only path and shipping `src` is dead weight.
11. **The `pnpm-workspace.yaml` inside `v6/dl/`.** Its contents were not read. It sits one
    level below where a workspace root would normally be, above no other package. It may
    change how `link:` resolves, and Phase 7 should read it first.
12. **`with_txn` appears unused in `3_runtime.ts`.** It is destructured at line 41 and no
    usage was found by grep. Not acted on in this plan; flagged because a dead import in a
    file being edited is worth resolving in the same pass.
13. **The two 3,769-line `01.patch-observable.test.ts` files** (`src/0_runtime/` and
    `src/0_runtime_hmr/`) were not diffed. They have identical line counts. Phase 0 fix 3
    assumes one is a stale copy; they may genuinely differ.
14. **`packages/json-rx` is absent from the root `tsconfig.json` references** while the
    other four are present. Not investigated. It may be deliberate or it may be why
    `pnpm -r typecheck` behaves inconsistently.

### Design claims that are judgement, not fact

15. **"Row = subscription" is defended, not proven.** §2.1 argues from the Network tab's
    affordances and from `0.types.d.ts:84`'s own comment. An application whose
    subscriptions are all sub-millisecond will find the waterfall useless, and the stated
    mitigation (overview strip, time brush) is Chromium's mitigation for the same problem
    and may not be enough. If it is not, the fallback is a second row mode grouping by
    observable rather than making emissions rows.
16. **The retention defaults** (`ring 8192`, `maxSpans`, `maxEventsPerSpan`,
    `minDeadAgeMillis`) are sized to a 60 Hz frame budget by reasoning, not measurement.
    The previous plan said the same thing about the same numbers and it is still true.
    They want Phase 6, not a vote.
17. **The estimate that hand-written column sizing, sort, and selection stays under 150
    lines** (§4.1) is the threshold at which `@tanstack/react-table` should be bought
    instead. It is a guess and the phase should measure it rather than defend it.
18. **The claim that `sql` spans have zero duration** (§9.3) is a consequence of
    `traceStatement` firing before `db.execute` with no completion callback. Adding a
    second hook after the observable settles is one more sprefa edit and would give real
    per-statement timing. Deferred, not impossible, and if per-statement timing turns out
    to be the thing an operator wants first, this is the wrong deferral.


---

# SUPERSEDED 2026-07-25 by user ruling

Sections rejected. Do not implement as written.

- **No hand-built table.** Buy one. The `RowView` build verdict is void.
- **No zustand, no TanStack devtools.** UI state is `@hafley66/signals`
  (`~/projects/hafley-rxjs/packages/signals`). It is RxJS-native, React is an optional
  peer, and `SignalReact` is the render boundary: signals own dataflow, React only renders.
  That is what the plugin already needs, and the UI is excluded from instrumentation
  anyway, so the tearing analysis that picked zustand does not apply.
- **No sprefa integration.** Phase 7 is cut entirely. The debugging backbone is not
  proven yet; integrating a consumer before it is proven hides the defects.
- **Testing is Playwright golden snapshots against a real input Vite project.** One
  fixture app, run it, snapshot the page. Not a spread of unit and integration tests.
  Same law as sprefa's conformance.dl: it works against a real input or it does not.
- Phase list collapses to: 0 stabilize baseline, 1 core, 2 rxjs adapter, 3 Vite 8 +
  package split, 4 UI on signals + bought table, 5 waterfall + detail tabs, 6 perf.

Open: which table. Needs virtual scroll, column resize, sort, filter. Candidates to
analyse before any code: AG Grid Community (MIT, vanilla core), Tabulator (MIT, vanilla),
RevoGrid (MIT, web component), Glide Data Grid (React, canvas). Build-vs-buy law applies.
