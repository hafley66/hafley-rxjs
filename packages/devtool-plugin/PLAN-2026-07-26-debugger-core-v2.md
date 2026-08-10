# PLAN 2026-07-26: debugger core v2

Supersedes **both** prior documents in this directory:

- `PLAN-2026-07-25-live-visualizer.md` (1,132 lines)
- `PLAN-2026-07-25-debugger-core.md` (3,246 lines, whose own trailing
  `SUPERSEDED 2026-07-25 by user ruling` block is the input to this one)

Nobody should need to diff three documents. §0 states exactly which sections of each
survive, which are void, and where the surviving content now lives. Everything not listed
as surviving is void.

Two things changed the shape of the work since 2026-07-25:

1. **The UI state layer is `@hafley66/signals`**, the user's own package. Signals own
   dataflow, React renders. The zustand selection and the tearing analysis behind it are
   void.
2. **This debugger underpins a json-rx debugger.** `@hafley66/json-rx` compiles a JSON
   document into an RxJS graph in TypeScript and into `futures-signals` in Rust. sprefa's
   stated future compile target is json-rx. So the event schema has to describe a json-rx
   program's execution today, without a schema change later. §3 works out what that costs
   and rules on the three schema changes it forces.

Standing laws applied throughout: buy before build with a written candidate table, one
contract header per package with `I`-prefixed interfaces, interface-bound functions,
Tailwind, Vite 8 / Rolldown, async becomes rxjs and sync stays sync, exactly one manual
`.subscribe()` in an app, no `private`, descriptive names.

---

## 0. Supersession map

### From `PLAN-2026-07-25-live-visualizer.md`

| Section | Disposition | Where it lives now |
|---|---|---|
| §0 Baseline (4 RED commands) | **VOID as numbers**, re-measured in §1 | §1 |
| §1 Corrections to the brief (no d3 in `src/`, two stores, dead deps `d3`/`localforage`/`uuid`, broken `exports["./hmr"]`) | **SURVIVES verbatim** | cited by §1.3, §5.3 |
| §2 Non-goals: node_modules parsing OUT, HMR module swap OUT, virtual-module `resolveId 'rxjs' -> \0rxjs` | **SURVIVES** | unchanged |
| §3.1 Transport table | SURVIVES, extended | §4.6 |
| §3.2 Ring buffer verdict (buy `mnemonist`) | **VOID**, reversed twice | §4.7 |
| §3.3 Marble/timeline rendering | **VOID.** The surface is a Network-tab waterfall | §4.4 |
| §3.4 Prior art (rxjs-spy, rxjs-insights, rx-devtools) | **SURVIVES verbatim** | cited by §4.9 |
| §3.5 UI state store (`useSyncExternalStore`, reject zustand) | **VOID.** Signals is the answer and the reasoning is different | §4.5 |
| §3.6 Virtualizer selection | **VOID as a verdict**, the requirement survives | §4.1, §4.2 |
| §3.7 Tailwind on Vite 8 spike (`vite 8.1.5` + `tailwindcss 4.3.3` + `@tailwindcss/vite 4.3.3`, measured, Astro issue does not reproduce) | **SURVIVES verbatim.** Empirically measured, no reason to re-run | §7.6 |
| §4 Tailwind wiring, and the static-vs-runtime class rule | **SURVIVES.** Colour tokens re-scoped | §7.6 |
| §5.1 Projection seam | SURVIVES in substance, renamed and moved | §6.4 |
| §5.2 `RingSink`/`Frame` | SURVIVES in substance, moved | §6.3 |
| §5.3 `FramePump` rAF coalescing | **MOSTLY VOID.** Signals already throttles the render boundary at 16 ms on `animationFrameScheduler`; what survives is a drain scheduler | §6.7 |
| §5.4 `TraceIndex` + `compact` + `RetentionPolicy` | SURVIVES, re-keyed | §6.6 |
| §5.5 `MarbleSurface` swap interface | DEMOTED to one detail tab | §7.3 |
| §5.6, §5.7 lifetimes and storage | SURVIVES, restated for the new type set | §6.10, §6.11 |
| §6 Five-view inventory | **VOID** | §7 |
| §7 Vite 8 migration, all of it including the `minify: "esbuild"` finding and the rxjs dist-path risk | **SURVIVES whole and unchanged** | Phase 3 |
| §8 Milestones M0-M8 | **VOID** | §10 |

### From `PLAN-2026-07-25-debugger-core.md`

| Section | Disposition | Where it lives now |
|---|---|---|
| §1 Phase 0 baseline | **SURVIVES as a plan**, two figures corrected | §1 |
| §2.1 A row is a span; for RxJS a span is a subscription | **SURVIVES**, and generalizes to json-rx with three additions | §2.1, §3 |
| §2.2 One store: delete v2 `Tracer`, demote v1 `RxJSTracker` to an ingestion adapter | **SURVIVES** (explicitly kept by the user ruling) | §2.2 |
| §2.3 Self-instrumentation feedback loop | **SURVIVES** and gets sharper. The `/2_ui` and `/lib` exclusion gap is real and confirmed. The mechanism analysis was incomplete; see §2.3 | §2.3 |
| §3 Package split (four packages) | SURVIVES, becomes five with json-rx as a consumer rather than a package | §5 |
| §4.1 Virtualized row list, verdict `@tanstack/react-virtual` alone, build the table | **VOID.** Buy a table | §4.1 |
| §4.2 Split pane, verdict `react-resizable-panels` | SURVIVES as a candidate table, re-verified | §4.3 |
| §4.3 Waterfall renderer, verdict build | SURVIVES, re-verified | §4.4 |
| §4.4 State store, verdict zustand | **VOID** | §4.5 |
| §4.5 Transport, verdict `ws` + `birpc` + plain JSON | **PARTLY VOID.** `ws` and `birpc` deferred; the JSON verdict survives | §4.6 |
| §4.6 Ring buffer, verdict build ~40 lines | SURVIVES | §4.7 |
| §4.7 Span/trace model, reject OpenTelemetry as the core model | SURVIVES, and §3 adds the json-rx test it did not face | §4.8 |
| §4.8 RxJS instrumentation mechanism (three front-ends) | **SURVIVES verbatim** | §4.9 |
| §5 Contract header `0_types.ts` | SURVIVES in substance. Renamed to the `I` prefix law, plus the three json-rx additions from §3 | §6.0, §6.1 |
| §6 Components | SURVIVES, restated | §6 |
| §7 UI affordance mapping to the Chromium Network tab | **SURVIVES whole.** It is the affordance list and it is unaffected by which table is bought | §7 |
| §8 Serializable boundary, cap, ordering | SURVIVES, one addition for the Rust target | §8 |
| §9 sprefa v6 integration | **CUT.** Not scheduled. See §9 for the one paragraph it gets | §9 |
| §10 Phases 0-8 | Re-cut around the new testing law and the json-rx work | §10 |
| §11 What I could not verify | Re-cut; carried items are re-listed | §11 |

---

## 1. Phase 0: stabilize the baseline. Re-measured 2026-07-26.

Every number below was re-run today. Two of the prior plan's figures were wrong and are
corrected in bold; the rest hold exactly.

### 1.1 `pnpm typecheck`

`exit 2`, **not exit 1** as the prior plan reported. 32 `error TS` lines, which the prior
plan had right.

| Code | Count |
|---|---|
| TS18048 possibly-undefined | 10 |
| TS6133 unused local | 7 |
| TS7053 implicit-any symbol index | 4 |
| TS2339 property does not exist | 3 |
| TS2307 cannot find module | 3 |
| TS7016 no declaration file | 1 |
| TS6196 unused type | 1 |
| TS2554 wrong arg count | 1 |
| TS2394 overload incompatible | 1 |
| TS2322 not assignable | 1 |

Top files: `__tests__/hmr-integration/fixture-kitchen-sink/main.ts` (10), `src/app.tsx`
(8), `src/0_runtime_hmr/4_module-scope.ts` (5),
`src/2_ui/0_DebuggerGrid.browser.test.tsx` (3), then six files at 1 each.

The compiler that runs is TypeScript 5.9.3, resolved from `devtool-plugin`'s own
`dependencies`, while the workspace root pins `6.0.0-dev.20251226`. Two compilers, the
package-local one wins. Fix 8 below removes the local pin and expects the count to move,
because 6.0.0-dev reports TS2882 for unresolvable side-effect imports that 5.9.3 ignores.

**The 921-line browser test and its four broken imports: confirmed exactly.**
`src/2_ui/0_DebuggerGrid.browser.test.tsx`, `wc -l` = 921.

```
line 5:  import "../03_scan-accumulator"                        no such file anywhere in the repo
line 7:  import { state$ } from "../0.types"                    real file: src/0_runtime/0.types.d.ts
line 8:  import { useTrackingTestSetup } from "../0_test-utils"  real file: src/0_runtime/0_test-utils.ts
line 9:  import { setNow } from "../01_helpers"                  no such file anywhere in the repo
```

Line 10's `./0_DebuggerGrid` resolves. Lines 7, 8, 9 produce the three TS2307s; line 5 is
silent under 5.9.3 because it binds nothing.

**Ruling: delete the file.** Three receipts. It has never compiled. `vitest.config.ts`
excludes `**/*.browser.test.{ts,tsx}` so it has never run. It tests `DebuggerGrid`, which
§7 replaces. Transcribe its `describe` titles into a checklist comment at the top of the
first fixture spec in Phase 6 so the coverage intent survives the file. Do not port the
body.

| # | Fix | Removes | Verify |
|---|---|---|---|
| 1 | Delete `src/2_ui/0_DebuggerGrid.browser.test.tsx` | 3 TS2307 | `test ! -f src/2_ui/0_DebuggerGrid.browser.test.tsx` |
| 2 | Add `**/__tests__/hmr-integration/fixture*/**` to `tsconfig.json` `exclude`. Those are standalone apps with their own `vite.config.ts` | 10 TS18048 | `pnpm typecheck 2>&1 \| grep -c TS18048` = 0 |
| 3 | Delete the 7 unused bindings and the unused `ArgEntity2` type at `0_store.ts:743` | 7 TS6133 + 1 TS6196 | `grep -c "TS6133\|TS6196"` = 0 |
| 4 | Declare the two globals once in a new `src/globals.d.ts`: the `___rxjs_hmr_key___` unique symbol as an index-signature interface, and `interface Window { ____root?: unknown }` | 4 TS7053 + 3 TS2339 | `grep -c "TS7053\|TS2339"` = 0 |
| 5 | Add `"references": [{ "path": "../rxjs-ext" }]` and build `rxjs-ext` first. Its `exports.types` points at a `dist/index.d.ts` that does not exist until built | 1 TS7016 | `pnpm --filter @hafley66/rxjs-ext build && pnpm typecheck` |
| 6 | `2_diet_rxjs.ts:57`: the `pipe` overload set is incompatible with the implementation signature | 1 TS2394 | |
| 7 | `app.tsx:139`: an `unknown` rendered as a child | 1 TS2322 | |
| 8 | Remove `"typescript": "^5.9.3"` from `devtool-plugin` `dependencies`. Re-baseline after this step | n/a | `pnpm typecheck` exits 0 |

### 1.2 `pnpm test:run`

`exit 1`. Confirmed exactly:

```
Test Files  12 failed | 2 passed (14)
Tests        9 failed | 84 passed | 2 skipped (95)
```

**Seven collection failures: confirmed.** The prior plan's count was right and its file
list was right.

| Class | File | Cause |
|---|---|---|
| collection | `0_runtime_hmr/01.patch-observable.test.ts` | `Cannot find module './0_test-utils'` |
| collection | `0_runtime_hmr/2_tracked-observable.test.ts` | `Cannot find module '../0_store'` |
| collection | `0_runtime_hmr/4_module-scope.test.ts` | `Cannot find module './0_test-utils'` |
| collection | `0_runtime_hmr/0_runtime.test.ts` | `No test suite found in file` |
| collection | `rxjs-edge-cases/6_plumbing-detection.test.ts` | `Cannot find module '../../../0_runtime/0_test-utils'` |
| collection | `rxjs-edge-cases/share.test.ts` | `Cannot find module '../03_scan-accumulator'` |
| collection | `rxjs-edge-cases/shareReplay.test.ts` | `Cannot find module '../03_scan-accumulator'` |
| runtime | `0_runtime/01.patch-observable.test.ts` | 3 inline-snapshot mismatches |
| runtime | `lib/2_diet_rxjs.test.ts:228,:236` | `reset()` aliases its initial value; `safeInitialClone` is computed and never read |
| runtime | `rxjs-edge-cases/5_react-query-torture.test.ts:115,:153` | a `defer` body runs when it should not |
| runtime | `__tests__/user-transform.test.ts:241` | hoisted-shim statement ordering flipped |
| runtime | `__tests__/hmr-integration/hmr.integration.test.ts:154` | timeout at 10,000 ms |

The two `01.patch-observable.test.ts` copies, under `src/0_runtime/` and
`src/0_runtime_hmr/`, are both 3,769 lines and byte-identical in size. Resolve that before
fixing either.

| # | Fix | Verify |
|---|---|---|
| 1 | Repoint the four missing-helper imports at `src/0_runtime/0_test-utils.ts` and `src/0_runtime/0_store.ts`. Path errors from a directory move | `pnpm test:run 2>&1 \| grep -c "Cannot find module"` = 0 |
| 2 | Delete the `import "../03_scan-accumulator"` line from `share.test.ts:10`, `shareReplay.test.ts:10`, `user-transform.test.ts:967`. No module ever provided it | same |
| 3 | Diff the two 3,769-line copies. Keep one | `find src -name "01.patch-observable.test.ts" \| wc -l` = 1 |
| 4 | `0_runtime_hmr/0_runtime.test.ts` has no `describe`/`test`. Delete or restore | no "No test suite found" |
| 5 | Fix `2_diet_rxjs.ts` `reset()`. Re-clone per reset and use `safeInitialClone`. This is a genuine aliasing bug in a file the whole debugger sits on | those 2 tests pass |
| 6 | Quarantine the remaining 7 runtime failures with `it.fails` / `describe.skip` and a `// BASELINE-RED 2026-07-26` comment naming the receipt | `pnpm test:run` exits 0 |

### 1.3 `pnpm build`

`exit 1`. `dist/` is never created.

**Correction to the prior plan's framing.** It said the build "bundles Node deps into a
browser lib via `external: []`". The build does not produce a polluted bundle; it dies
before emitting anything:

```
[UNRESOLVED_IMPORT] Could not resolve '../pkg' in
  node_modules/.pnpm/lightningcss@1.30.2/node_modules/lightningcss/node/index.js:17:28
```

`lightningcss/node/index.js` does `module.exports = require('../pkg')`, a native-binary
load, and Rolldown was told to inline it. The log also carries a long run of
`Module "X" has been externalized for browser compatibility` warnings for `path`, `fs`,
and `node:*`, which is the symptom the prior plan described, so the characterization was
directionally right and the outcome was wrong.

The cause is confirmed and exact: `packages/devtool-plugin/vite.config.ts` **line 15** is
`external: []`, inside `build.rollupOptions`. The package-local config is what runs
(`vite build` with no `--config`), and it does not import the root helper. The bundler is
`rolldown@1.0.0-beta.53` via `rolldown-vite@7.3.0`, pinned by
`overrides: { "vite": "rolldown-vite" }` in the package manifest.

The fix already exists in the repository and is unused.
`/Users/chrishafley/projects/hafley-rxjs/vite.lib.config.ts` exports `createLibConfig`,
whose `external` (lines 32-42) is a function marking `node_modules` and declared deps
external. Four of six packages use it; `devtool-plugin` hand-rolls an inline lib config.

| # | Fix | Verify |
|---|---|---|
| 1 | Replace the inline `build` block with `createLibConfig(__dirname)`, then re-add the two plugin entries | `pnpm build` exits 0 |
| 2 | Declare `vite`, `oxc-parser`, `magic-string`, `lodash` so `createLibConfig` externalizes them. Today `oxc-parser` is a devDependency and `vite` is absent entirely (only `rolldown-vite` is declared) | `grep -c "lightningcss\|magic-string" dist/index.js` = 0 |
| 3 | After Phase 3 the Node plugin is the only thing this package ships. No second entry is added here | `node -e "import('./dist/index.js')"` resolves |

### 1.4 `pnpm test:browser`

Hangs. `timeout 120 pnpm test:browser` returns **exit 124**. It prints 59 lines and never
reaches a `Test Files` summary. Two causes, both confirmed:

1. Version skew, reported by the runner itself:
   `Loaded vitest@4.0.16 and @vitest/browser@4.0.17. Running mixed versions is not
   supported`. The manifest carets let `@vitest/browser` float.
2. The only file matching `include: ["src/**/*.browser.test.{ts,tsx}"]` is the one being
   deleted in 1.1. After the deletion the glob matches nothing.

| # | Fix | Verify |
|---|---|---|
| 1 | Pin `vitest`, `@vitest/browser`, `@vitest/browser-playwright`, `@vitest/ui` to one exact version, no caret | `pnpm test:browser 2>&1 \| grep -c "mixed versions"` = 0 |
| 2 | Add `passWithNoTests: true` to `vitest.browser.config.ts` | `timeout 60 pnpm test:browser` exits 0 |
| 3 | Add one smoke browser test that asserts `1 === 1`, so the runner is observed to start and stop before anything depends on it | same, with `1 passed` |

If it still hangs with one trivial test, that is a provider problem and it gets its own
investigation. `packages/json-rx` runs the same stack green today
(`vitest.browser.config.ts` with `@vitest/browser-playwright`, chromium, and committed
`__screenshots__` PNGs), so a working reference configuration is one directory away.

### 1.5 Phase 0 exit block

```bash
cd packages/devtool-plugin
pnpm --filter @hafley66/rxjs-ext build
pnpm typecheck                                      # exit 0
pnpm test:run                                       # exit 0
pnpm build && test -f dist/index.js                 # exit 0
grep -c "lightningcss\|magic-string" dist/index.js  # 0
timeout 60 pnpm test:browser                        # exit 0
grep -rn "BASELINE-RED" src | wc -l                 # equals the count recorded in CHANGELOG.md
pnpm test:e2e                                       # exit 0, the empty golden fixture (§10 P0)
```

Nothing in Phases 1-8 starts until this block is green.

---

## 2. Rulings carried forward

### 2.1 A row is a span. For RxJS a span is a subscription.

Kept from the prior plan and not re-argued here. The short form: the Network tab's row is
an HTTP request, and every affordance in that panel rests on a request having a start, an
optional end, a status, an initiator, and content that accumulates over time. Of the three
RxJS candidates, only a subscription has all five. An emission is a point. An Observable
is a blueprint that is never torn down.

Emissions are **events on a span**, drawn as tick marks inside the bar and listed in the
Emissions tab, the same way Chromium draws a chunked response as one bar.

The receipt is in the existing schema rather than in the argument:
`src/0_runtime/0.types.d.ts:84` labels the `subscription` entity "dual timespan: call-time
scope AND async lifespan" and it is the only entity carrying a semantic end field.

§3 tests this ruling against json-rx, which is the first consumer that is not raw RxJS.

### 2.2 One store

Kept from the prior plan, and re-verified today.

| | `0_store.ts` (v1) | `0_store_v2.ts` (v2) |
|---|---|---|
| Class | `RxJSTracker` | `Tracer` |
| Lines | 1,030 | 280 |
| Singleton | `export const main = new RxJSTracker()` at line 676 | none |
| Importers outside its own test | **five files** reference `RxJSTracker` by name: `0_runtime/06_queries.ts`, `0_runtime/0_store.ts`, `0_runtime_hmr/0_runtime.ts`, `0_runtime_hmr/2_tracked-observable.ts`, `0_runtime_hmr/3_tracked-subject.ts`. The two UI files import the `main` singleton rather than the class | **zero.** One match repo-wide, at `0_store_v2.test.ts:2` |
| Has a subscription lifespan | yes | no |

Correction to the prior plan: its table listed v1's importers as the two UI files. A
name-grep finds five more inside `0_runtime*`. Both statements are true about different
things, and the demotion plan is unaffected, but the deletion gates in Phase 5 have to
cover the five.

**Ruling, unchanged.** Neither is the model. The model moves into `@hafley/debug-core` as
`Span` + `SpanEvent`. v2 is deleted, both files. Two things in it are ported rather than
lost: the arg-ripper budget becomes core's `3_project.ts`, and `decoratoPatronus`, the
Proxy that makes an arbitrary function traceable, becomes `traceFunction` in Phase 8. v1
is demoted to an ingestion adapter keeping only what touches real RxJS
(`patchObservable`, `decorateOperatorFun`, `decorateCreate`, the marker symbols, and the
`event$` subject at line 99), and loses its accumulator.

Three accumulators die with the demotion and one is a live defect:

| Member | Line | Fate |
|---|---|---|
| `events$ = new EasierDietBS<ObservableEvent[]>([])` | 100 | delete. Unbounded array |
| `events$$ = this.event$.pipe(this.events$.scanEager((a, b) => a.concat(b)), ...)` | 102-104 | delete. `a.concat(b)` allocates a length-n array per event, so N events cost O(N²) copies. At 10k events that is 50M element copies |
| `state$$` + `lol = this.state$$.subscribe()` | 137, 570 | delete last, in Phase 5, once no UI reads `state$.value.store` |

`src/0_runtime/0.types.d.ts` is deleted and split. Separate defect found while reading it:
**line 55 of that declaration file is a runtime statement**, `console.log("Bootstrapping")`.

### 2.3 The self-instrumentation loop, with a sharper mechanism analysis

The path-exclusion gap is confirmed today. `shouldTransformUserCode`
(`src/1_runtime_vite_plugin/2_user_transform.ts:615`) excludes `node_modules`, `.d.ts`,
`/0_runtime`, `/0_runtime_hmr`, and `/1_runtime_vite_plugin`. It does **not** exclude
`/2_ui` or `/lib`. Only three files carry the `// noRxjs()` marker that
`transformUserCode` honours, and neither UI file is one of them.

The prior plan then said the loop "closes the moment the UI subscribes to a live stream".
Reading `patchObservable` says that is not the mechanism, and getting the mechanism right
changes what the mitigations have to be. `0_store.ts:873-880`:

```ts
proto.subscribe = function patchedSubscribe(...args: any[]) {
  const obs_id = getObsId(this)
  const store = main.state$.value.store
  if (!obs_id || !store?.observable[obs_id]) {
    console.log("oops")
    ...
```

Three findings from those seven lines.

1. **Tracing is gated on registration, not on path.** An observable is traced only if it
   carries an id AND that id is in the accumulator's `observable` table. Ids are minted by
   `decorateCreate` and by the source transform, both of which skip `node_modules`. So the
   UI's own observables, and every observable inside `@hafley66/signals`, are not traced
   even with the prototype patched. That is why the loop is latent rather than live, and it
   is a stronger guarantee than the path exclusion, which cannot help at all here because
   **prototype patching is global**. A path regex on the transform has no reach into a
   dependency's `subscribe` call.
2. **`console.log("oops")` runs on every untracked subscribe in the process.** With the UI
   on signals, `SignalReact` subscribes per component per mount and `createComputedSignal`
   subscribes once per dependency per recompute, so this is a console write on a hot path.
   Blocking defect, delete it. `decorateCreate` at `0_store.ts:1010` carries the same
   pattern with `console.log("NAME: ", name)`.
3. **`main.state$.value.store` is read on every subscribe in the process**, traced or not.
   That is the coupling the demotion in §2.2 severs, and it is also why the gate is not
   free.

The exclusion therefore has to hold at three levels, because each one covers a case the
others cannot:

| Level | Covers | Cannot cover |
|---|---|---|
| Path exclusion: add `/2_ui`, `/lib`, and the whole `packages/debug-ui` and `packages/debug-core` trees to the exclude regex | source in this repo compiled by our own transform | anything in `node_modules`, including signals |
| Marker: `// noRxjs()` at the top of every file in those trees | a file moved out of an excluded directory | the same |
| **Runtime re-entrancy depth counter in `SpanRecorder`** | everything, including a user who imports the panel into their own instrumented `src/` | nothing |

The third is the only one that survives someone embedding the panel in their own page,
which is the first thing that happens when the tool ships.

**One new rail that the signals decision forces.** `@hafley66/signals` exports a
module-level global, `signalDispatch: Subject<SignalEvent>`
(`packages/signals/src/1_SignalCreator.ts:22`), through which every signal `create`,
`get`, `set`, `subscribe`, and `unsubscribe` flows, for every signal in the process.
Ingesting that subject as a trace source would be a genuinely infinite loop the instant the
panel renders a row, because the panel reads signals to render and the read emits a `get`.
**Rule: no adapter in this family ever subscribes to `signalDispatch`.** If a signals
adapter is wanted later it records only signals handed to it explicitly, never the global
dispatch. Enforced by a grep rail in Phase 4.

**The tests that prove it.**

```ts
// Plugin package. Pure function, no runtime needed.
test("the debugger's own UI is never transformed", () => {
  for (const excluded of [
    "/x/packages/debug-ui/src/2_RowList.tsx",
    "/x/packages/debug-core/src/1_recorder.ts",
    "/x/packages/devtool-plugin/src/2_ui/0_DebuggerGrid.tsx",
    "/x/packages/devtool-plugin/src/lib/2_diet_rxjs.ts",
  ]) expect(shouldTransformUserCode(excluded)).toBe(false)
  expect(shouldTransformUserCode("/x/app/src/main.ts")).toBe(true)
})

// Core. This one proves the loop is closed, not merely that a path is excluded.
test("a sink that traces back into the recorder cannot recurse", () => {
  const recorder = new SpanRecorder({ sink: reentrantSink, clock, budget: DEFAULT_BUDGET })
  const spanId = recorder.openSpan({ kind: "test", name: "outer" })
  recorder.addEvent(spanId, "emit", null, 1)
  recorder.closeSpan(spanId, { status: "completed" })
  expect(reentrantSink.records.length).toBe(3)
  expect(recorder.stats.reentrantDrops).toBe(3)
})
```

The counter matters as much as the guard. A silently suppressed recursion is a debugger
lying about what the program did, so `reentrantDrops` renders in the status bar next to
the ring's `dropped` count.

### 2.4 The serializable Frame boundary

Kept. `Frame` is closed under `structuredClone` **and** under `JSON.stringify`/`parse`,
and `TraceRecord` is the only thing that crosses. The Tracer holds `WeakRef`s and live
`Proxy` values that cannot be structured-cloned, so the projector converts them at the
boundary against a capped budget. Detail in §8; §8.5 adds what the Rust target needs.

---

## 3. The json-rx tie-in

This section exists because the debugger has to describe a json-rx program's execution
without a later schema change, and because that is the only real test the span model has
faced. Everything below is read from `packages/json-rx/src`.

### 3.1 json-rx's execution model, read from the source

| Fact | Receipt |
|---|---|
| A document is a JSON object validated by zod: `bindings`, `circuit.{sources,flows,reducers}`, `outputs`. Two contracts exist, `automation.v1` (`1_schema.ts`, compiled by `2_runtime.ts`) and `automation.v2` (`8_v2_schema.ts`, compiled by `9_v2_runtime.ts`) | `8_v2_schema.ts:146-163` |
| **Every expression node carries a globally unique string id, `node`, and uniqueness is enforced at validation time** | `8_v2_schema.ts:198-206`, the `visit` walker with `duplicate node id` |
| A node is one of six shapes: `source`, `host`, `map`, `merge`, `scan`, `shareReplay`. v1 additionally has `logic` (JSONLogic over combineLatest) | `8_v2_schema.ts:60-67`, `2_runtime.ts:79` |
| Compilation is a recursive fold from node to `Observable`. `compileExpression(expression, flowRef)` returns an rxjs Observable built from `defer`, `map`, `concatMap`, `scan`, `shareReplay`, `merge` | `9_v2_runtime.ts:173-266` |
| Flows are memoized per `flowKey(ref, parameters)`, so one flow is one Observable instance shared by every output that names it. Host sources are memoized per host ref | `9_v2_runtime.ts:117-118, 268-277` |
| `map` nodes evaluate one **jsonata expression per output field, per emission**, asynchronously, inside `Promise.all` inside `concatMap` | `9_v2_runtime.ts:203-225` |
| A host port is an effect boundary: `create(context)` or `apply(input$, context)`, with an `AbortSignal`, a declared capability set checked against grants, and zod validation of the input and output schema on every value | `9_v2_runtime.ts:121-171` |
| A trace hook already exists and is narrow: `options.trace?: (entry) => void`, with `phase: "map"` hardcoded and outcomes `passed \| missing \| error`. It carries no lifecycle at all | `9_v2_runtime.ts:55-64` |
| `compileAutomation` returns `canonicalIr`, a `JSON.stringify` of the key-sorted document. It is a ready-made content identity for the program version | `9_v2_runtime.ts:301`, `2_runtime.ts:27-31` |
| **The same IR compiles to Rust.** `6_codegen/5_rust.ts` emits rxjs-shaped Rust; `6_codegen/6_reactiveState.ts` emits `futures_signals::Mutable` plus a `serde` event enum with variants `subscribe \| loading \| next \| error \| complete \| invalidate \| unsubscribe \| finalize` | `6_codegen/6_reactiveState.ts:34-57` |
| Every value on every edge is `JsonValue` by construction | `0_types.ts:1-3` |

### 3.2 What a step and a span are in json-rx

Three candidate units, and two of them are real.

| Candidate | Start | End | Duration | Parent | Cardinality | Verdict |
|---|---|---|---|---|---|---|
| **A subscription to a node's compiled Observable** | the `subscribe` that reaches it | complete / error / unsubscribe | yes, the async lifespan | the downstream subscriber that caused it | one per node per subscription | **a row** |
| **One jsonata field evaluation** | the `jsonata(expr).evaluate(root)` call | the awaited resolution | yes, genuinely async | the `map` node's subscription | fields × emissions | **not a row.** See 3.3 |
| One emission crossing an edge | the `next` | same instant | no | its subscription | emissions | an event, as in RxJS |

So the ruling from §2.1 holds without modification: **a json-rx row is a subscription to a
node**, which is the same thing a raw RxJS row is, because json-rx's runtime *is* RxJS.
Nothing about the span type needs a second kind, and `SpanKind` is already a free string,
so `source`, `host`, `map`, `merge`, `scan`, `shareReplay`, and `logic` become chips
without a core release.

The model needs two additions, and they are additions the RxJS-only design already wanted
and faked.

### 3.3 Change one: a span has a role, `row` or `phase`

The jsonata field evaluation has a start, an end, a status, and a parent. It is a span by
every property the model names. Its cardinality is fields × emissions, and §2.1 rejects
one row per emission, so it must not enter the row list.

The prior plan had no way to say that, so it hardcoded the answer for RxJS:
`WaterfallBar.phases` was a fixed triple, `pending | streaming | draining`, computed by
the layout function. That triple is the same idea with the generality removed. Chromium's
Timing tab is exactly this: a set of sub-intervals of one request that are not rows.

Add one field:

```ts
export type SpanRole = "row" | "phase"
```

- `role: "row"` enters `rowOrder` and gets a waterfall bar.
- `role: "phase"` never enters `rowOrder`. It renders as a segment inside its parent's
  bar and as a line in the parent's Timing tab.

What it buys, in the order the cost shows up:

| Consumer | Today without the role | With the role |
|---|---|---|
| json-rx jsonata field evals | fields × emissions rows, or nothing at all | timed sub-intervals under the `map` node's row |
| json-rx host-port schema validation, in and out | nothing | two phases per host call, which is where a zod parse over a large body will show up |
| RxJS `pending`/`streaming`/`draining` | hardcoded in the layout function | still derived, because they cost nothing to derive and recording them would triple the record rate. See the disagreement in §6.10 |
| sprefa, if it ever lands | 13 zero-duration `sql` rows per fixpoint round as "minimum-width ticks" | phases of the round they belong to |

Retention: `RetentionPolicy` gains `maxPhaseSpansPerSpan`, because a `map` node with four
fields and 100k emissions would otherwise hold 400k phase spans. Default 64, drop-oldest,
counted in `droppedPhaseCount`.

### 3.4 Change two: origin is a union, file position or program address

`SourceOrigin` is `{ file, line, column, symbol }`. For a json-rx node that is not merely
unhelpful, it is wrong: the code at that file position is
`9_v2_runtime.ts:204`, and it is the same position for every `map` node in every document
in the process. Every row would carry the same origin and the Summary tab would be blank
for the only question that matters, which is *which node in which document is this*.

The information exists and only the compiler has it: `automation.id`, the `flowRef`, the
`node` id, and the path through the document. Rename and split:

```ts
export type SpanOrigin = FileOrigin | ProgramOrigin

export interface FileOrigin {
  readonly originKind: "file"
  readonly file: string
  readonly line: number
  readonly column: number
  readonly symbol: string | null
}

export interface ProgramOrigin {
  readonly originKind: "program"
  /** json-rx: automation.id. A compiler that targets json-rx puts its own program id here. */
  readonly programId: string
  /** json-rx: a hash of `canonicalIr`. Two runs of an edited document never share it. */
  readonly programVersion: string
  /** json-rx: the flow ref. The named subgraph the node belongs to. */
  readonly unit: string
  /** json-rx: the `node` id, unique per document by schema. */
  readonly node: string
  /** JSON Pointer into the document, so a click opens the source. Null when unknown. */
  readonly pointer: string | null
}
```

`programVersion` is the field that stops a mid-session document edit from silently mixing
two programs' rows, and the json-rx editor lives in the same package
(`src/3_editor/`), so mid-session edits are the normal case rather than the exotic one.

This is the change that would otherwise be forced later, and forced later it is a wire
break across three packages plus a Rust emitter. Make it now.

### 3.5 Change three, small: one more event kind

json-rx's existing trace outcomes are `passed | missing | error`. `missing` is a jsonata
expression that resolved to `undefined`, and the field is then dropped from the output
object (`9_v2_runtime.ts:210-213`). It is not a failure and not an emission, and with only
`emit | failure | complete | cancel | note` available it would have to be a `note`, which
puts it in the same bucket as arbitrary annotations.

Add `"skip"` to `SpanEventKind`. It generalizes cleanly to RxJS, where "this `filter`
dropped a value and here is the value" is a question the current model cannot answer.

### 3.6 What did NOT need to change, and why that is the result

| Pressure from json-rx | Absorbed by | Cost |
|---|---|---|
| Seven node types instead of one | `SpanKind` is a free string | zero |
| Host-port capabilities, granted set, schema refs | `Span.attributes` is `ProjectedEntry[]` | zero |
| `AbortSignal` abort on host teardown | `SpanStatus: "cancelled"` | zero |
| Values are `JsonValue` by construction | `ProjectedValue`'s `opaque`, `callable`, and `elided(cycle)` arms never fire | zero, they are unused arms |
| One flow shared by two outputs produces two subscriptions | span-per-subscription is already the ruling | zero |
| A Rust process emitting the same records | plain-JSON wire, tagged unions, no `undefined` on the wire | one JSON Schema file and one validation test, §8.5 |

Three additions across a whole second execution model, two of which the first model
already wanted. That is the evidence that span-as-subscription generalizes rather than an
assertion that it does.

### 3.7 Two defects the debugger would surface in json-rx on day one

Recorded because they are the acceptance argument for the json-rx phase, and because both
are unrelated to this plan and should be filed against json-rx either way.

1. **jsonata expressions are compiled per emission.** `9_v2_runtime.ts:209` is
   `await jsonata(source).evaluate(root)` inside the per-field map, so the parse runs once
   per field per emission rather than once per node at compile time. A `map` node with
   four fields at 100 emissions/second compiles 400 expressions/second. With phase spans
   this shows as the dominant segment inside every `map` row.
2. **`compiledFlows` in v1 caches by flow ref while v2 caches by `flowKey(ref, parameters)`**
   (`2_runtime.ts:94-103` against `9_v2_runtime.ts:107-109, 271`). Two parameterizations of
   one v1 flow collide onto one cached Observable. Visible immediately as two outputs whose
   rows share a span id chain that the document says should be distinct.

### 3.8 Does json-rx need its own adapter package?

**No new package. json-rx takes `@hafley/debug-core` and `@hafley/debug-rxjs` as optional
peer dependencies and threads an `IRecorder` through its existing options object.**

Instrumenting the underlying RxJS does not suffice, and this is the part worth defending
because it is the tempting answer.

1. **The compiler owns the only names that exist.** Every node in every document compiles
   through the same handful of source lines. A prototype patch sees `Observable.prototype.subscribe`;
   a Vite source transform sees `concatMap` at `9_v2_runtime.ts:205`. Neither can see
   `expression.node`, which lives in a closure parameter. Instrumenting rxjs yields rows
   named after the compiler's own source positions, identical for every node, which is
   §3.4 restated as a runtime consequence. Only a hook inside `compileExpression` can
   attach the node id.
2. **The Rust target has no RxJS in it.** `6_codegen/5_rust.ts` and
   `6_codegen/6_reactiveState.ts` emit Rust over `futures_signals`. Instrumenting rxjs
   instruments zero percent of that execution. If the goal is describing *a json-rx
   program's* execution, the instrumentation seam has to sit where both targets exist,
   which is the compiler and the IR, not one target's runtime library.
3. **The existing hook proves the seam is already there and is the wrong width.**
   `options.trace` is one callback with `phase: "map"` hardcoded. Widening it is the
   adapter, and it is a change inside json-rx by definition.

Given json-rx must change, a separate `@hafley/debug-json-rx` package would only be a hop:
the instrumentation calls have to be inside `compileExpression`, so json-rx imports
something either way, and a wrapper package that only wraps the source observables and the
root observables can reach exactly two spans per flow and nothing in between.

The counter-argument, stated so it is visibly weighed: a separate package keeps json-rx's
dependency list clean. It does not weigh much. `@hafley/debug-core` has
`"dependencies": {}` by constraint (§5.2) and `@hafley/debug-rxjs` has only a peer on
rxjs, which json-rx already declares. Both are optional peers with a `NULL_RECORDER`
default, so an uninstrumented json-rx build carries one property read per node compile.
json-rx already ships zod, jsonata, json-logic-js, MUI, and rjsf; two zero-runtime optional
peers are not the marginal cost.

**The Rust side is a crate, not an npm package**, and it is out of scope until someone runs
the Rust target under the debugger. What this plan owes it is the JSON Schema for
`TraceRecord` (§8.5) so the crate has something to generate from.

### 3.9 The json-rx edit, concretely

Two insertion points in v2 and two in v1. `compileExpression` already receives everything
needed.

```ts
// packages/json-rx/src/9_v2_runtime.ts, inside compileExpression, wrapping every return.
// Signature unchanged. The wrap is one call at the single exit point after a small refactor
// that collects the six branches into one `compiled` local.
//
//   const compiled = /* the existing six-branch body */
//   return recorder === NULL_RECORDER ? compiled : compiled.pipe(traced(recorder, {
//     kind: nodeKindOf(expression),
//     name: expression.node,
//     origin: { originKind: "program", programId: automation.id,
//               programVersion, unit: flowRef, node: expression.node, pointer },
//   }))
```

| # | Location | Span |
|---|---|---|
| 1 | `9_v2_runtime.ts` `compileExpression` exit | one span per node per subscription, `role: "row"` |
| 2 | `9_v2_runtime.ts:207-219`, the per-field jsonata evaluation | one span per field per emission, `role: "phase"`, parent = the `map` node's span, status from the existing `passed`/`missing`/`error` outcome mapped to `completed`/`skip` event/`errored` |
| 3 | `9_v2_runtime.ts:138-141` `validate` | one `role: "phase"` span per host input and output validation |
| 4 | `2_runtime.ts` `apply` and `source` | the v1 equivalents of 1 and 2 |

`options.trace` stays and keeps working. Where a recorder is present, the existing
`AutomationTrace` entries are additionally forwarded as span events, so no consumer of the
old hook breaks.

Estimated size: under 90 lines across the two runtime files plus a `programVersion` helper
that hashes `canonicalIr`. Flagged in §11 as an estimate from reading, not from writing the
patch.

---

## 4. Build-vs-buy

Every figure below is from `registry.npmjs.org`, `api.npmjs.org/downloads/point/last-week`,
and the vendor's own documentation, retrieved 2026-07-25/26. Sizes are **unpacked tarball
bytes** from the registry manifest, not gzip: the prior plan quoted gzip figures from
bundlephobia and six of them returned HTTP 429, so this pass uses the number that can
actually be retrieved for every package. Unpacked and gzip are not comparable; do not mix
the two documents' numbers.

Two constraints decide most of these and both are hard:

- **`@hafley66/debug-core` has zero runtime dependencies.** Anything bought can only land
  in `debug-ui` or `devtool-plugin`.
- **Tailwind styles every pixel.** A component whose cells are canvas, shadow DOM, or a
  vendor stylesheet cannot be reached by a utility class. That is a constraint violation,
  not a matter of taste, and it eliminates most of the batteries-included grids below.

### 4.1 The table. The prior plan's build verdict is void; this is the purchase.

Requirement: 10k to 1M rows, virtual scrolling, column resize, sort, filter, sticky header,
row selection, keyboard navigation, and a row height that changes with the Big Rows
setting.

| Package | Latest | Published | Weekly DL | License | Unpacked | Virtual scroll | Col resize | Sort | Filter | Styling |
|---|---|---|---|---|---|---|---|---|---|---|
| `@tanstack/react-table` + `@tanstack/table-core` | 8.21.3 | 2026-07-24 | 17,381,922 / 18,558,217 | MIT | 761,890 B / 3,296,952 B | **no**, pair with a virtualizer | state machine, no handle UI | yes, logic | yes, logic | **none. Headless by design** |
| `@tanstack/react-virtual` | 3.14.8 | 2026-07-22 | 19,599,827 | MIT | 56,556 B | yes | n/a | n/a | n/a | none |
| `ag-grid-community` | 36.0.2 | 2026-07-22 | 3,160,640 | MIT | 20,024,028 B | yes, no licence gate | yes, Community | yes, incl. multi-sort | text/number/date/quick free; **Set, Multi, Advanced are Enterprise** | own theme system (Quartz). No documented unstyled mode |
| `tabulator-tables` | 6.5.2 | 2026-06-23 | 170,338 | MIT | 29,398,866 B | yes, virtual DOM mode | yes | yes | yes | ships `tabulator.css` plus alt themes. No headless mode |
| `@revolist/revogrid` (+ `@revolist/react-datagrid`) | 4.23.24 | 2026-07-23 | 28,801 / 7,319 | MIT | 6,906,536 B | yes, default on | yes, free | yes, free | text/number/custom free; **selection, slider, date, header-input, multi-filter are Pro** | Stencil web component, 5 bundled themes |
| `@slickgrid-universal/common` | 10.8.3 | 2026-07-04 | 39,943 | MIT text; GitHub API `spdx_id` = `NOASSERTION` | 8,877,537 B | yes | yes | yes | yes | own CSS themes |
| `@mui/x-data-grid` | 9.10.1 | 2026-07-23 | 3,103,810 | MIT core, Pro/Premium commercial | 5,182,533 B | **capped at 100 rows in Community** | drag-resize free | single-column free, **multi-sort is Pro** | single + quick free, **multi-filter and header filters are Pro** | MUI theme over emotion |
| `@glideapps/glide-data-grid` | 6.0.3 | 2026-06-24 | 301,181 | MIT | 3,662,455 B | yes, canvas | yes | **DIY** | **DIY** | canvas. No DOM cells at all |
| `datatables.net` | 3.0.0 | 2026-07-24 | 744,253 | MIT | 1,313,113 B | via the `scroller` extension | **no drag-resize**; `columns.width` is static | yes | yes | own stylesheet, Bootstrap/Bulma integrations |
| `gridjs` (+ `gridjs-react`) | 6.2.0 | approx. | 72,508 / 9,510 | MIT | 1,367,287 B | **none documented anywhere** | **no**, `TColumn` has static `width` only | yes | **global search only** | inconclusive |
| `@silevis/reactgrid` | 4.1.17 | 2025-04-16 | 71,141 | MIT | 1,546,305 B | no API; blog claims internal scroll to 100k cells | docs say **Pro only**, pricing page says free. Contradiction unresolved | **not built in, by vendor's stated design** | **not built in** | own `styles.css` |
| `handsontable` | 18.0.0 | 2026-07-24 | 291,575 | **not MIT** | 29,468,518 B | yes | yes | yes | yes | own theme |

**Disqualified with a cited fact, so none of these is a one-line dismissal.**

- `handsontable`: `LICENSE.txt` for 18.0.0 is dual licensing, free only for "strictly
  personal or solely for evaluation purposes", commercial use requires a paid agreement,
  and it bars building a competitive product. Fails the licence requirement outright.
- `@mui/x-data-grid`: the Community virtualization page states "Row virtualization is
  limited to 100 rows in the Data Grid component". A 100-row cap fails the first
  requirement on the list. Multi-sort and multi-filter are additionally Pro.
- `gridjs`: three of the four required features are absent. No virtualization option exists
  in the docs (pagination is the documented answer for large data), `TColumn` exposes only
  a static `width`, and search is global rather than per-column.
- `@silevis/reactgrid`: sorting and filtering are absent by the vendor's own stated design
  ("why our product does not have sorting, filtering? This is not really a disadvantage, but
  a feature"). Column resize is documented Pro-only on one page and free on the pricing
  page; the contradiction is unresolved and does not need resolving, because two of the
  four features are gone either way.
- `datatables.net`: no drag column resize in core or in any of the ColReorder /
  ColumnControl / FixedColumns extensions. `columns.width` sets a static width.
- `@glideapps/glide-data-grid`: sort and filter are explicitly DIY per the README FAQ, and
  the cells are canvas, so Tailwind cannot reach a single pixel. Two independent failures.
- `@revolist/revogrid`: 28,801 weekly downloads is an order of magnitude below every other
  live candidate, the useful filter UIs are Pro, and a Stencil web component's shadow DOM is
  outside Tailwind's reach. Its React wrapper at 7,319 weekly downloads is the number that
  matters and it is small.
- `tabulator-tables`: fully MIT with all four features and no paid tier, which makes it the
  strongest batteries-included candidate. It loses on two facts. It ships a stylesheet and
  has no headless mode, so the Tailwind constraint is violated at every cell. And it ships
  **no TypeScript types**: the 6.5.2 tarball contains zero `.d.ts` files, and the community
  `@types/tabulator-tables` is pinned at 6.3.6, two minors behind.
- `ag-grid-community`: genuinely MIT, genuinely complete, and the only candidate that ships
  ARIA and keyboard navigation, which are the two things we are most likely to do badly. It
  is rejected on the Tailwind constraint, which it violates structurally through its own
  theme system with no unstyled mode, and secondarily on 20 MB unpacked. If the Tailwind law
  is ever relaxed for cells, this is the thing to take, and taking it would delete most of
  §7's implementation.
- `@slickgrid-universal`: all four features, framework-agnostic core, but its own CSS themes
  and a GitHub-reported licence of `NOASSERTION` against an MIT LICENSE text. 39,943 weekly
  downloads. Held as the runner-up if the pair below turns out to need more glue than
  expected and the Tailwind law is relaxed.

**Re-examining the prior plan's rejection of TanStack Table, which the ruling asked for.**
It rejected react-table on two grounds and both have changed.

1. *"Last publish 2025-04-14, fifteen months ago, a maintenance asymmetry inside one
   family."* **Wrong today.** `@tanstack/react-table@8.21.3` and `@tanstack/table-core@8.21.3`
   were published **2026-07-24**, two days before this document. The asymmetry does not
   exist.
2. *"It would own a second copy of state the core already owns."* **Half right, and the fix
   is ownership rather than duplication.** The filter model has to live in core, because
   `FilterQuery` is what NDJSON export, import, and the filter grammar all share, and
   because the filter must run over 100,000 span ids *before* virtualization rather than
   over a materialized row model. So: **use `getCoreRowModel` and `getSortedRowModel`, the
   column-sizing state machine, and the header drag handle. Do not use
   `getFilteredRowModel`, `columnFilters`, or `globalFilter`.** react-table receives an
   already-filtered `RowView[]` from `RowProjection.build` once per frame. One owner per
   concern, no synchronization seam, and the parts we decline are the parts that would have
   fought core.

**VERDICT: buy `@tanstack/react-table` 8.21.3 with `@tanstack/react-virtual` 3.14.8.**
Together they are 818 kB unpacked, MIT, both published within four days of this document,
17.4M and 19.6M weekly downloads, headless so every pixel is a Tailwind utility class, and
they are the composition TanStack's own virtualization guide documents for large data
("do not come with any virtualization APIs or features built-in"). They cover all four
required features: virtual scroll from `react-virtual`, and column resize, sort, and filter
state from `react-table`, with filtering fed from core.

Runner-up: `ag-grid-community` 36.0.2 if the Tailwind law is relaxed for grid cells.
Second runner-up: `@slickgrid-universal` 10.8.3 under the same relaxation.

### 4.2 Virtual list, considered separately

Recorded because `react-virtual` was chosen above as half of a pair and it deserves the
comparison on its own.

| Package | Latest | Published | Weekly DL | License | Unpacked | Framework |
|---|---|---|---|---|---|---|
| `@tanstack/react-virtual` | 3.14.8 | 2026-07-22 | 19,599,827 | MIT | 56,556 B | React adapter over `@tanstack/virtual-core` (22.9M/wk, 400 kB) |
| `virtua` | 0.50.0 | 2026-07-25 | 816,844 | MIT | 1,361,329 B | one core, React/Vue/Svelte/Solid/Angular peers all optional |
| `react-window` | 2.3.0 | 2026-07-20 | 6,478,464 | MIT | 216,360 B | React only |
| `react-virtuoso` | 4.18.11 | 2026-07-17 | 3,155,821 | MIT | 242,312 B | React only |
| `@lit-labs/virtualizer` | 2.1.1 | 2025-07-11 | 186,269 | BSD-3-Clause | 459,774 B | Lit web component |

`virtua` is the interesting one and is new to this analysis: 0.50.0 published the day of
this research, every framework peer marked optional, one core for all of them. It loses to
`react-virtual` on a specific fit rather than on quality: `react-table` is already being
bought, both are TanStack, and TanStack's own docs pair them, so taking `virtua` means
owning the integration that the vendor otherwise documents. Revisit if the panel is ever
ported off React. `react-window` v2 is the smallest React-only option and is
virtualization-only, so it competes with `react-virtual` rather than with the pair;
`react-virtual`'s `measureElement` dynamic measurement is what the two-line Size cell and
the Big Rows setting need. `react-virtuoso` renders real `<table>` DOM with sticky headers
and `followOutput` stick-to-bottom for free, which is a behaviour the Network tab has; it
loses because a Network-tab row is a CSS grid with a resizable template and a real `<table>`
fights that. `@lit-labs/virtualizer` is BSD-3-Clause rather than MIT and is a Lit component.

### 4.3 Resizable split pane

| Package | Latest | Published | Weekly DL | License | Unpacked | Peers |
|---|---|---|---|---|---|---|
| `react-resizable-panels` | 4.12.2 | 2026-07-12 | 35,641,101 | MIT | 550,224 B | react, react-dom `^18 \|\| ^19` |
| `allotment` | 1.20.5 | 2025-12-19 | 221,529 | MIT | 206,403 B | react, react-dom `^17 \|\| ^18 \|\| ^19` |
| `split.js` | 1.6.5 | 2025-09-04 | 552,687 | MIT | 131,365 B | none, vanilla |
| `splitpanes` | 4.1.2 | 2026-05-26 | 168,667 | MIT | 82,718 B | vue `^3.2.0` |
| `dockview` / `dockview-core` | 7.0.4 | 2026-07-24 | 176,822 / 206,608 | MIT | 3,042,013 B / 10,267,321 B | none for the core |

Correction to the research brief: **there is no `@dockview/core`**. The registry 404s on
that name; the package is `dockview-core`, unscoped, with `dockview` as the React binding.

`react-resizable-panels` at 35.6M weekly downloads is an order of magnitude above
everything else here, largely because shadcn/ui ships it as the default resizable
primitive. It persists layout through a single `autoSaveId` prop plus imperative
`getLayout()`/`setLayout()`, which covers the persistence requirement with no code, and it
is by the same author as `react-window`. `allotment` is modeled on VS Code's own SplitView,
which is arguably the right drag feel for a debugger, and it is the runner-up; it has no
built-in persistence and there is a stale fork `@qwtel/allotment` (last published 2021) that
is easy to install by accident. `split.js` is vanilla and the smallest and does not do
collapse-and-restore or an axis flip on a narrow viewport, both of which the Network tab
does and both of which are built into the two above. `splitpanes` is Vue-only. `dockview`
is a full docking manager with tabs, floating panels, and `toJSON`/`fromJSON` persistence,
which is a superset of one divider at 3 MB; take it if the panel ever grows real docking.

**VERDICT: `react-resizable-panels` 4.12.2.** Runner-up `allotment` 1.20.5.

### 4.4 Waterfall and timeline renderer

| Package | Latest | Published | Weekly DL | License | Unpacked | Can it draw a per-row span bar with ms resolution? |
|---|---|---|---|---|---|---|
| `vis-timeline` | 8.5.2 | 2026-07-15 | 256,041 | Apache-2.0 OR MIT, dual | **77,580,919 B** | yes, natively: ranged items, `group` per row, `zoomable`/`zoomMin`/`zoomMax` in ms |
| `echarts` | 6.1.0 | 2026-05-19 | 4,328,998 | Apache-2.0 | 60,297,703 B | yes, via `custom` series `renderItem` + `dataZoom`, as the official flight-Gantt example does |
| `uPlot` | 1.6.32 | 2025-03-14 | 490,659 | MIT | 545,468 B | with effort: the `timeline-discrete` demo draws lane bars, zoom is native |
| `frappe-gantt` | 1.2.2 | 2026-02-25 | 189,587 | MIT | 249,631 B | **no.** Finest built-in view mode is `Hour`, `step: '1h'`, per `src/defaults.js` |
| `d3-flame-graph` | 5.0.0 | 2026-03-04 | 35,059 | **Apache-2.0**, not MIT | 114,585 B | no. Stacked call-tree flame graph, not a waterfall. Last three commits are dependabot bumps |
| `speedscope` | 1.25.0 | 2025-12-03 | 65,069 | MIT | 987,369 B | not embeddable. `package.json` has no `exports` field; the README documents hosted-app, global CLI, and downloaded-zip usage only |
| `d3-scale` | 4.0.2 | 2023-04-12 | 68,986,257 | ISC | 174,363 B | scale primitive, no chart. Would back hand-drawn divs |
| `@observablehq/plot` | 0.6.17 | 2026-04-06 | 571,426 | ISC | 1,526,486 B | general chart grammar, no waterfall built-in |

Correction to the prior plan on two dates: `d3-scale` 4.0.2 published **2023-04-12**, not
2021-09-24, and `d3-flame-graph` is **Apache-2.0**, not MIT.

**The decisive evidence is still what Chromium itself does**, carried from the prior plan
because it was read from source and nothing has changed:
`ChromeDevTools/devtools-frontend`'s `front_end/panels/network/NetworkWaterfallColumn.ts`
imports zero chart libraries. It calls `getContext('2d')` and hand-writes `drawLayers`,
`drawEventDividers`, `buildSimplifiedBarLayers`, and `decorateRow`. The time-to-pixel math
sits separately in `NetworkTimeCalculator.ts`, whose `computePosition(time)` is a
hand-rolled linear scale. The reference implementation of the exact affordance being cloned
buys nothing here.

`vis-timeline` is the closest in spirit of anything on the list and does natively render
grouped horizontal bars on a zoomable ms-resolution axis. It is rejected on two facts:
**77.6 MB unpacked**, and a hard peer set that includes `moment`, `vis-data`, `vis-util`,
`@egjs/hammerjs`, `xss`, and `keycharm`. Adopting moment.js in 2026 is not a trade worth
making for geometry that is one subtraction and one division. `echarts` and `uPlot` both
lose on data model rather than on quality: each owns one chart's layout and diffing, and
here the layout is owned by the virtualizer and the diffing by React, so putting either
inside a virtualized row re-lays-out the chart on every scroll. `frappe-gantt`,
`d3-flame-graph`, and `speedscope` are disqualified on the cited facts in the table.

`WaterfallLayout.layout` returns fractions, and the arithmetic is
`(time - window.min) / (window.max - window.min)`. Buying `d3-scale` at 174 kB plus five
transitive packages to replace two arithmetic operations is not a trade.

**VERDICT: build the waterfall renderer. Buy at most `ticks()`.**

- Geometry: `WaterfallLayout` in core, zero dependencies, returns fractions.
- Axis nice-tick selection is the one genuinely non-trivial piece, the 1/2/5-times-a-power-
  of-ten boundary choice that makes an axis read `0, 50 ms, 100 ms` rather than
  `0, 47 ms, 94 ms`. It lives in `d3-array`'s `ticks`/`tickIncrement`. **`d3-array`'s
  standalone size and dependency list is still unverified after two research passes** and
  is listed in §11. Fallback: a 25-line nice-number function. Decide by measurement in
  Phase 6.
- Rendering stage 1: DOM. Three phase divs per row plus at most 24 tick divs, Tailwind
  classes with three inline style properties. At 40 visible rows that is at most 1,080
  nodes.
- Rendering stage 2, conditional: one canvas overlaying the whole waterfall column,
  scroll-synced to the virtualizer, drawn in one pass. Literally Chromium's architecture,
  one canvas for the column rather than one per row. Trigger: Phase 6's frame budget failing
  at 500 visible rows. The swap sits behind the unchanged `WaterfallBar` type, so it is one
  file.

### 4.5 UI state

`@hafley66/signals` 0.0.2 is a user directive, so this section records what that decision
buys and what it costs rather than re-running a selection the ruling already made. The
prior plan's zustand verdict and its tearing analysis are void.

| | `@hafley66/signals` 0.0.2 |
|---|---|
| Published | workspace-local, `link:`ed. npm 0.0.2 |
| License | MIT |
| Source size | 2,218 lines across 16 files, of which 764 are tests |
| Runtime deps | `rxjs ^7.8.2`, `lodash ^4.17.21`, `immer ^10.1.1` |
| React | optional peer `>=18`, `SignalReact` is the render boundary |
| Consumes an Observable | `Signal(observable$, default)`, wired through `merge` + `shareReplay({ refCount: true })` at `1_SignalCreator.ts:57-64` |
| Per-field subscription scoping | yes, through the proxy path; a component that reads `panelState.filterText.$()` does not re-render on `panelState.paused` |
| rAF coalescing at the render boundary | already built in, `throttleTime(16, animationFrameScheduler, { leading: true, trailing: true })` at `3_react.ts:108` and `:154` |

Three technical consequences worth stating rather than discovering.

1. **It removes the pump.** `version$` is an Observable and `Signal(version$, 0)` consumes
   it with no glue and no `useSyncExternalStore`, and the render-side rAF throttle the
   prior plan's `FramePump` was going to provide is already inside `SignalReact`. What
   remains is a producer-side drain scheduler, §6.7.
2. **It removes the last manual `.subscribe()` from the app.** The signal owns the
   subscription to `version$`; the render boundary owns its own. §6.7.
3. **It puts real RxJS in the UI, which the prior plan rejected `@hafley66/signals` for.**
   That rejection rested on an incorrect model of the instrumentation (§2.3): tracing is
   gated on registration, not on path, so signals' internal observables are not traced even
   with the prototype patched. The residual risks are the per-subscribe `console.log("oops")`
   and the global `signalDispatch` subject, and §2.3 rules on both.

**Risk, stated plainly:** the UI's state layer is a version-0.0.2 package with 1,454 lines
of non-test source and three runtime dependencies. That is a real dependency risk and the
mitigation is that it is the user's own package in this workspace, so a defect is a fix
rather than an issue filed upstream.

### 4.6 Transport

Three topologies:

| Topology | Producer | Consumer | Has a scheduled consumer in this plan? |
|---|---|---|---|
| A. same page | recorder in the page | panel in the same page | **yes**, the default |
| B. page to page | recorder in the app tab | panel in a second tab | **yes**, `BroadcastChannel` |
| C. Node or Rust process to browser | recorder in a separate process | panel in a browser | **no.** sprefa is cut (§9) and the json-rx Rust target is out of scope (§3.8) |

| Package | Latest | Published | Weekly DL | License | Unpacked | What it is |
|---|---|---|---|---|---|---|
| `birpc` | 4.0.0 | 2025-12-13 | 10,576,553 | MIT | 23,544 B | bidirectional typed RPC over any `post`/`on` pair, zero deps. What Vitest UI uses |
| `partysocket` | 1.3.0 | 2026-06-23 | 2,749,339 | MIT | 210,330 B | reconnecting WebSocket client, react peer optional |
| `comlink` | 4.4.2 | 2024-11-07 | 2,629,599 | Apache-2.0 | 252,242 B | postMessage RPC proxy, includes `windowEndpoint()` for cross-window |
| `superjson` | 2.2.6 | 2025-11-27 | 8,683,452 | MIT | 92,791 B | JSON codec for Date/Map/Set/BigInt/RegExp/undefined/Error/URL |
| `@ungap/structured-clone` | 1.3.3 | 2026-07-10 | 74,669,497 | ISC | 28,655 B | structured-clone polyfill |
| `ws` | 8.21.1 (carried, not re-verified) | 2026-07-14 | 241,560,546 | MIT | n/a | Node WebSocket server |
| `BroadcastChannel`, `MessageChannel` | web standard | n/a | n/a | n/a | 0 | Node global since 18 |
| Vite HMR custom events | in `vite@8.1.5` | n/a | n/a | n/a | 0 | `hot.send(event, data)` client to server, `hot.on(event, cb)` to listen. Buffers if called before the connection opens |

**This verdict reverses the prior plan and removes two dependencies.** The prior plan chose
`ws` + `birpc` for topology C. Topology C now has no scheduled consumer, and for the case
that does exist, a panel in a page served by the Vite dev server, **Vite's own HMR channel
already carries custom events in both directions at zero dependency cost**, documented on
`vite.dev/guide/api-hmr.html` at v8.1.5. Frames go server-to-client and the four control
commands (Record/Stop, Clear, budget preset, Preserve log) go client-to-server, and both
are fire-and-forget, which is exactly what `hot.send`/`hot.on` provide. `birpc`'s value is
typed request/response with a promise table, and there is no request/response traffic here.

**VERDICT (framing): three transports, zero new dependencies.** `InPageTransport` and
`BroadcastChannelTransport` in core; the Vite HMR channel in `devtool-plugin`. `ws` 8.21.1
plus `birpc` 4.0.0 are the answer for topology C and are **deferred until topology C has a
consumer**, at which point this table is the analysis and `partysocket` 1.3.0 is the
conditional reconnect layer.

**VERDICT (serialization): plain `JSON.stringify`/`JSON.parse`, no library.** All three
codecs solve getting `Date`, `Map`, `Set`, `undefined`, `BigInt`, and `Error` through JSON,
and §8.1 designed the problem away: `ProjectedValue` has explicit `undefined`, `bigint`,
`symbol`, and `failure` arms so plain JSON is lossless, and cycles are already collapsed by
the projector, so there is nothing for `devalue`'s cycle handling to preserve. Buying a
serializer would be paying to carry types the projector refuses to emit. `superjson` at
92.8 kB and `@ungap/structured-clone` at 28.7 kB both buy exactly that. Reach for one only
if a future record type needs identity preservation, which would first require overturning
the projector's cycle rule.

### 4.7 Ring buffer

| Package | Latest | Published | Weekly DL | License | Unpacked | Fixed capacity with drop-oldest? |
|---|---|---|---|---|---|---|
| `mnemonist` | 0.40.4 | 2026-04-30 | 13,356,528 | MIT | 384,122 B | yes. `CircularBuffer(ArrayClass, capacity)`, so `new CircularBuffer(Float64Array, 100)` works |
| `denque` | 2.1.0 | 2023-11-14 | 32,122,830 | Apache-2.0 | 30,361 B | **no capacity cap.** A growable plain array, doubling |
| `ring-buffer-ts` | 1.2.0 | 2022-12-14 | 17,980 | MIT | 20,759 B | yes, but last pushed 2022-12-14, 3.9 years stale, 17,980 weekly downloads |
| `@thi.ng/ringbuffer` | n/a | n/a | n/a | n/a | n/a | **does not exist.** The registry 404s and no `@thi.ng` package matches |

`mnemonist`'s `CircularBuffer` is a real fixed-capacity ring with O(1) push, automatic
oldest-eviction, and typed-array backing, published three months ago at 13.4M weekly
downloads. Its deep subpath `mnemonist/circular-buffer` is **CJS-only** (its `exports["./*"]`
declares `require` and `types` with no `import` condition), so a native-ESM deep import
throws `ERR_PACKAGE_PATH_NOT_EXPORTED`; only the root import is safe. `denque` is the deque
inside ioredis, mature rather than abandoned, and has no capacity cap, so buying it means
buying the deque and writing the ring anyway.

**VERDICT: write it, roughly 40 lines, zero dependencies.** This is the one category where
the zero-dependency constraint on core makes building correct. The thing being bought is a
pre-allocated array, a head index, a count, and modulo arithmetic; §6.3 is 20 lines of
pseudo-code. The only real risk is off-by-one in wraparound, and that is what the Phase 1
rail exists for: push 100,000 records into `RingSink(8192)` and assert `dropped === 91808`,
`size === 8192`, and that `drain()` returns exactly the last 8,192 in push order. Runner-up
if the constraint is relaxed: `mnemonist` 0.40.4 by **root import only**.

### 4.8 The span and trace model itself

Carried from the prior plan, which surveyed this properly, plus the json-rx test in §3 that
it did not face.

OpenTelemetry's `Span` interface is close to `IRecorder`, and 13.2 kB gzip for
`@opentelemetry/sdk-trace-web` is not a disqualifying weight. Three facts disqualify it as
the core model:

1. **`OTEL_SPAN_EVENT_COUNT_LIMIT` defaults to 128.** Beyond that the SDK drops events and
   records `droppedEventsCount`. OTel assumes request-scoped spans with sparse marker
   events; §2.1's whole ruling is a long-lived span with a dense emission stream. Raising
   the limit defeats the rail it exists for; restructuring emissions into child spans means
   one row per emission, which §2.1 rejects.
2. **No shipped exporter feeds a live local UI.** `ConsoleSpanExporter` and
   `OTLPTraceExporter` are what ship. A WebSocket exporter is about 20 lines, so this is a
   cost rather than a blocker, but the live path gets written either way.
3. **Browser context propagation wants `zone.js`.** Node has
   `@opentelemetry/context-async-hooks`; the browser recommendation is
   `@opentelemetry/context-zone`, because TC39 `AsyncContext` is unshipped. §6.9's
   synchronous subscribe stack avoids it, and then most of the SDK is unused.

The **User Timing API** is the zero-dependency cross-runtime alternative and is real:
Node's `perf_hooks` conforms to User Timing Level 3 since v16, `detail` runs through
StructuredSerialize which `ProjectedValue` already satisfies, and Chrome 129 shipped a
Performance-panel extensibility API where a `performance.measure` with
`detail.devtools = { dataType: "track-entry", track, trackGroup, color, tooltipText, properties }`
renders as a custom track. It is still not the core model: parenting is by string name, there
is no status field, the global buffer is finite, and decisively it is a
record-then-inspect workflow tied to starting a Performance recording rather than a live
feed into an open panel.

Embeddable viewers were surveyed so that "write a UI" is a conclusion rather than an
assumption. Perfetto UI is embeddable through a documented `window.open` plus PING/PONG
plus `{ perfetto: { buffer, title, fileName } }` postMessage protocol, but its model is
load-one-trace-and-explore rather than live append, and no `@perfetto/trace_processor` npm
package exists. `jaeger-ui` is Apache-2.0 React and is not published to npm as a component.
`zipkin-lens` is not on npm at all.

**VERDICT: our own `Span`/`SpanEvent` model (§6.1), with interop as exports rather than as
an adopted runtime.** Chrome Trace Event Format export in Phase 8 so a trace opens in
`ui.perfetto.dev`; an opt-in `PerformanceMarkSink` mirroring closed spans as
`performance.measure` with the Chrome 129 detail shape; OTLP noted as a possible third
export target and not adopted.

### 4.9 The RxJS instrumentation mechanism

Carried verbatim. Not a package purchase, but the same question.

RxJS `latest` is **7.8.2**. **RxJS 8 is not released**: the newest is `8.0.0-alpha.14`
(2026-01-12) and issue ReactiveX/rxjs#6367 records that 8 is on hold pending TC39
`Observable` standardization. Design against 7.x.

The only hooks RxJS ships are `config.onUnhandledError` and
`config.onStoppedNotification`, both error-path only and both outside the subscription
lifecycle. There is nothing to buy; there are three mechanisms and we have two of them.

| Mechanism | Prior art | Cost | Our use |
|---|---|---|---|
| Runtime prototype patch of `Observable.prototype.subscribe` | `rxjs-spy` (cartant) | global and stateful, conflicts with any other patcher, every subscribe in the process pays interception | keep as `@hafley66/debug-rxjs/patch`, opt-in, browser default |
| Build-time source rewrite | `rxjs-insights` (ksz-ksz), Webpack/ESBuild plugins with `declareConstructor`/`declareCreator`/`declareOperator` | precise source locations and per-call-site opt-in; its own docs warn of "a considerable performance and memory footprint" | keep as `devtool-plugin`'s Vite transform, the same bet, independently corroborated |
| Explicit opt-in operator | none surveyed | requires the instrumented code to name what it wants traced | **new.** `traced()` in §6.9, and it is what json-rx needs |

That third row is why this plan exists. Neither prior-art tool offers a mechanism that
works inside a compiler that generates the graph, and both existing mechanisms in this
repository are browser-and-bundler mechanisms.

### 4.10 Test harness

| Package | Latest | Published | Weekly DL | License | Notes |
|---|---|---|---|---|---|
| `@playwright/test` | 1.62.0 | 2026-07-25 | 48,396,408 | Apache-2.0 | `toHaveScreenshot()` uses pixelmatch, options `maxDiffPixels`, `maxDiffPixelRatio`, `threshold`. `toMatchSnapshot(name)` accepts a `string` or `Buffer`, so a JSON event stream is `toMatchSnapshot('events.json')` over `JSON.stringify(records, null, 2)` |
| `playwright` | 1.57.0 currently in this repo | | | Apache-2.0 | already a devDependency of `devtool-plugin` and `json-rx` |
| `vitest` / `@vitest/browser` | 4.1.10 | | 82.3M / 8.56M | MIT | this repo pins 4.0.16 and has drifted to 4.0.17 for `@vitest/browser` (§1.4). Browser mode with the Playwright provider is the documented recommendation and carries no beta disclaimer |

`packages/json-rx` already runs Vitest browser mode with `@vitest/browser-playwright`,
chromium, and committed `__screenshots__` PNGs named `<name>-chromium-darwin.png`, using
`await expect(page.getByTestId(...)).toMatchScreenshot(name)`. A working reference exists in
this workspace.

**VERDICT: `@playwright/test` 1.62.0 for the golden fixture suite; keep Vitest browser mode
where it already works.** The deciding fact is that the fixtures are **separate real Vite
projects with their own `vite.config.ts` that installs the plugin**, and Vitest browser mode
owns its own Vite server and config, so a fixture's own config never runs under it. Only a
runner with a `webServer` block can start a real fixture app and drive it. Pin `playwright`
and `@playwright/test` to the same 1.62.0 to avoid the class of skew that §1.4 is about.

---

## 5. Package split

### 5.1 The packages, and the scope correction

The repo publishes under **`@hafley66`** (`@hafley66/signals@0.0.2`,
`@hafley66/json-rx@0.1.2`). The `@hafley` scope is carried by three unpublished packages
(`rxjs-debugger`, `rxjs-ext`, `rxjsx`). The prior plan named the new packages
`@hafley/debug-*`, which would put new publishable work on the dead scope. Use
`@hafley66`.

| Directory | Name | Runtime deps | Runs in | Ships |
|---|---|---|---|---|
| `packages/debug-core` | `@hafley66/debug-core` | **none** | Node 20.19+, any browser, any worker | the model, recorder, ring, projector, index, filter, waterfall geometry, in-page and BroadcastChannel transports, the `TraceRecord` JSON Schema |
| `packages/debug-rxjs` | `@hafley66/debug-rxjs` | none. `rxjs` is a peer (`^7.8.0 \|\| ^8`) | anywhere rxjs runs | `traced()`, the synchronous parent scope, `patchObservable`, `decorateCreate`, `decorateOperatorFun`, the `ObservableEvent -> TraceRecord` adapter |
| `packages/devtool-plugin` | `@hafley66/rxjs-debugger` (name unchanged) | `vite`, `oxc-parser`, `magic-string`, `lodash` | Node only | the Vite plugin, the source transform, the dev-server WebSocket transport, the fixture harness |
| `packages/debug-ui` | `@hafley66/debug-ui` | `@hafley66/signals`, `react`, `react-dom`, and whatever §4 buys | browser only | the Network-tab panel |
| `packages/json-rx` | `@hafley66/json-rx` (exists) | unchanged | anywhere | gains two **optional peers** and a `recorder` option. §3.9 |

Dependency direction:

```
debug-core  <-  debug-rxjs  <-  devtool-plugin
    ^               ^
    |               └── json-rx (optional peers)
  debug-ui
```

`debug-ui` depends on `debug-core` and never on `debug-rxjs`, so the §2.3 loop cannot be
re-opened by an import. It does depend on `@hafley66/signals`, which depends on real rxjs;
§2.3 explains why that is survivable and what the three guards are.

Why five and not fewer:

- **core and rxjs split** because json-rx's Rust target and any future non-rxjs consumer
  need the recorder without `Observable.prototype` patching, and because the UI needs the
  model without either.
- **rxjs and the Vite plugin split** because the plugin is Node-only (`oxc-parser`,
  `magic-string`, `vite`) and the operator it injects is browser-side. That they are one
  package today is exactly why `pnpm build` reaches for lightningcss (§1.3).
- **no transport package.** Core ships the two zero-dependency transports (in-page and
  `BroadcastChannel`, a Node global since 18). The one transport with a dependency lives in
  `devtool-plugin`, which already owns a Node process.
- **no json-rx adapter package.** §3.8.

### 5.2 `@hafley66/debug-core` layout and manifest

```
packages/debug-core/
  package.json
  tsconfig.json
  trace-record.schema.json     JSON Schema for TraceRecord. §8.5
  src/
    0_types.ts        contract header, types only, zero runtime code
    1_clock.ts        LogicalClock
    2_ring.ts         RingSink
    3_project.ts      BudgetProjector
    4_recorder.ts     SpanRecorder
    5_index.ts        MapSpanIndex
    6_filter.ts       SpanFilter
    7_waterfall.ts    WaterfallLayout
    transport/
      0_inpage.ts     InPageTransport
      1_broadcast.ts  BroadcastChannelTransport
      2_ndjson.ts     NdjsonCodec
    index.ts
```

```jsonc
{
  "name": "@hafley66/debug-core",
  "version": "0.1.0",
  "type": "module",
  "license": "MIT",
  "sideEffects": false,
  "exports": {
    ".":              { "types": "./dist/index.d.ts",           "import": "./dist/index.js" },
    "./types":        { "types": "./dist/0_types.d.ts",         "import": "./dist/0_types.js" },
    "./transport":    { "types": "./dist/transport/index.d.ts", "import": "./dist/transport/index.js" },
    "./trace-record.schema.json": "./trace-record.schema.json",
    "./package.json": "./package.json"
  },
  "files": ["dist", "src", "trace-record.schema.json"],
  "engines": { "node": "^20.19.0 || >=22.12.0" },
  "dependencies": {},
  "peerDependencies": {},
  "devDependencies": { "typescript": "6.0.0-dev.20251226", "vitest": "4.0.16", "ajv": "^8.20.0" }
}
```

`"dependencies": {}` is a constraint rather than an accident, and every §4 verdict is
decided against it. `./types` is a real subpath that compiles to an empty runtime module,
which is the check that the header stayed a header. No `"browser"` field and no
conditional exports: one ESM build, DOM APIs only inside `transport/1_broadcast.ts`, which
feature-detects.

### 5.3 `@hafley66/debug-rxjs` manifest

```jsonc
{
  "name": "@hafley66/debug-rxjs",
  "version": "0.1.0",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".":       { "types": "./dist/index.d.ts",          "import": "./dist/index.js" },
    "./patch": { "types": "./dist/2_patch.d.ts",        "import": "./dist/2_patch.js" },
    "./hmr":   { "types": "./dist/3_module_scope.d.ts", "import": "./dist/3_module_scope.js" }
  },
  "dependencies": { "@hafley66/debug-core": "workspace:^" },
  "peerDependencies": { "rxjs": "^7.8.0 || ^8" }
}
```

`./hmr` fixes the broken `exports["./hmr"]` in the current manifest, which points at
`./src/tracking/v2/hmr/4_module-scope.ts`, a path that does not exist, while
`2_user_transform.ts:645` emits `"@hafley66/rxjs-debugger/hmr"` as the default import
specifier. Any consumer outside this repository resolves that to nothing today. The
transform's default specifier changes to `"@hafley66/debug-rxjs/hmr"` in the same edit.

Split of `0_store.ts` (1,030 lines):

| Member | Lines | Goes to |
|---|---|---|
| `patchObservable` | 778-975 | `debug-rxjs/src/2_patch.ts`, minus the two `console.log`s (§2.3) |
| `decorateOperatorFun` | 976-1008 | same |
| `decorateCreate` | 1009-1030 | same |
| `event$`, `next()`, `TRACKED_MARKER`, `PATCHED_UNSUB`, `suppressSend$`, `now()`/`setNow()` | 8-134 | `debug-rxjs/src/1_tracker.ts`. `setNow` is the seam the golden fixtures use to pin wall time (§10) |
| `main` singleton + the `globalThis` pin | 676 | `debug-rxjs/src/1_tracker.ts` |
| `state$`, `state$$`, `events$`, `events$$`, `lol` | 65, 100-104, 137, 570 | **deleted** in Phase 5 |
| `__withNoTrack`, `getObsId`, `setObsId`, `autoTrackFile`, `noAutoTrackFile` | 679-702 | `debug-rxjs/src/1_tracker.ts` |
| `06_queries.ts`, 16 exports of `Object.values().filter()` | whole file | **deleted** in Phase 5, replaced by `MapSpanIndex` + `SpanFilter` |
| `05_render-tree.ts` `renderStaticTree` | whole file | `debug-ui`, as the Pipeline tab's label vocabulary |
| `lib/2_diet_rxjs.ts` | 436 lines | `debug-rxjs/src/0_diet.ts`, minus the `lodash` `cloneDeep` import. That import is the only reason `lodash` is in the manifest; replace with a structural clone and fix `reset()` per §1.2 fix 5 |

---

## 6. Contract headers and components

### 6.0 The naming law, applied

Each package owns one header, `src/0_types.ts`. Every class and every module-namespace
const declares its contract there, once, under an `I`-prefixed name. Data records keep
plain names: `Span` is a value, not a contract, and `ISpan` would say nothing.

Correction to the prior plan: it put `Pump` in core's header on the argument that
`debug-ui` should have no type core cannot describe. That is backwards. `Pump` is
`requestAnimationFrame` and an Observable, and core imports neither DOM nor rxjs. Each
package's header covers that package's classes. Three headers, listed below.

| Package header | Contract | Implementation | Class, or why not |
|---|---|---|---|
| `debug-core/src/0_types.ts` | `IClock` | `class LogicalClock` | per-instance counter |
| | `ISink`, `IFrameSource` | `class RingSink` | per-instance buffer and counters |
| | `IProjector` | `const BudgetProjector` | pure functions over an argument budget. No instance state |
| | `IRecorder` | `class SpanRecorder` | per-instance open-span map, counters, re-entrancy depth |
| | `ISpanIndex` | `class MapSpanIndex` | per-instance maps |
| | `ISpanFilter` | `const SpanFilter` | query in, predicate out |
| | `IWaterfallLayout` | `const WaterfallLayout` | span plus window in, bar out |
| | `ITransport` | `class InPageTransport`, `class BroadcastChannelTransport` | per-instance channel and listener set |
| | `INdjsonCodec` | `const NdjsonCodec` | pure |
| `debug-rxjs/src/0_types.ts` | `ITracedOperator` | `const Traced` | pure factory |
| | `IParentScope` | `const SubscribeParentScope` | module-level synchronous stack. §6.9 |
| | `IObservableEventAdapter` | `class ObservableEventAdapter` | per-instance mapping state |
| `debug-ui/src/0_types.ts` | `IFrameDrain` | `class AnimationFrameDrain` | per-instance rAF handle |
| | `IPanelState` | a `Signal<PanelStateValue>` | not a class. §6.8 |
| | `IRowProjection` | `const RowProjection` | index plus filter plus window in, `RowView[]` out. Synchronous, returns an array |

### 6.1 `debug-core/src/0_types.ts`

```ts
// The whole @hafley66/debug-core contract. Types only; compiles to an empty module.
// Layer 0: imports nothing, package-local or otherwise.

export type SpanId = string        // `${sessionId}:${counter}`
export type EventId = string       // `${spanId}#${counter}`
export type SessionId = string

// Monotonic integer from IClock. The ordering key for everything. Wall time is
// recorded alongside and never used for ordering: a Node process and a browser page
// share no epoch, and a backgrounded tab's rAF gap would reorder a wall-time sort.
export type LogicalTime = number
export type WallMillis = number

export type SpanOrigin = FileOrigin | ProgramOrigin

export interface FileOrigin {
  readonly originKind: "file"
  readonly file: string
  readonly line: number
  readonly column: number
  readonly symbol: string | null
}

// A node in a compiled program. json-rx fills every field; see §3.4.
export interface ProgramOrigin {
  readonly originKind: "program"
  readonly programId: string
  readonly programVersion: string
  readonly unit: string
  readonly node: string
  readonly pointer: string | null
}

// Closed under structuredClone AND under JSON. No WeakRef, Proxy, Function, class
// instance, or DOM node crosses. What cannot cross becomes opaque or elided and says so.
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
  | { readonly kind: "elided"; readonly reason: ElisionReason }

export interface ProjectedEntry { readonly key: string; readonly value: ProjectedValue }

export type ElisionReason = "depth" | "width" | "budget" | "cycle" | "disabled"

// One Budget per Recorder, chosen at construction. Per-call override is rejected: an
// instrumented call site has no identity to key a lookup on, and threading a budget
// through the operator signature leaks it into user code.
export interface Budget {
  readonly maxDepth: number          // 3
  readonly maxArrayItems: number     // 16
  readonly maxRecordKeys: number     // 24
  readonly maxTextLength: number     // 256
  readonly maxNodesPerValue: number  // 128, the hard ceiling; every other knob is advisory
}

export interface ProjectionCursor { depth: number; nodes: number; readonly seen: Set<object> }

export interface IProjector {
  project(value: unknown, budget: Budget, cursor: ProjectionCursor): ProjectedValue
  weigh(value: ProjectedValue): number   // byte estimate for the Size column; never serializes
  newCursor(): ProjectionCursor
}

// Free-form domain tag. The Type column and the chip set. Known values, for reference,
// NOT an enum: debug-rxjs emits "subscription" and "call"; json-rx emits "source",
// "host", "map", "merge", "scan", "shareReplay", "logic". A new consumer adds a row type
// without a core release; the cost is that a typo makes a chip instead of a compile error.
export type SpanKind = string

export type SpanStatus = "open" | "completed" | "errored" | "cancelled"

// "row" enters rowOrder and gets a bar. "phase" is a sub-interval of its parent, drawn
// inside the parent's bar and listed in the parent's Timing tab. §3.3.
export type SpanRole = "row" | "phase"

export interface Span {
  readonly spanId: SpanId
  readonly parentSpanId: SpanId | null   // the Initiator column. Causal parent. §6.9
  readonly sessionId: SessionId
  readonly kind: SpanKind
  readonly role: SpanRole
  readonly name: string
  readonly origin: SpanOrigin | null
  readonly startLogical: LogicalTime
  readonly startWall: WallMillis
  readonly endLogical: LogicalTime | null   // null draws to the right edge, like a pending request
  readonly endWall: WallMillis | null
  readonly status: SpanStatus
  readonly failure: ProjectedValue | null
  readonly attributes: readonly ProjectedEntry[]
  readonly eventCount: number               // denormalized by the index, read by the Size column
  readonly byteEstimate: number
  readonly droppedEventCount: number
  readonly droppedPhaseCount: number
}

export type SpanEventKind = "emit" | "skip" | "failure" | "complete" | "cancel" | "note"

export interface SpanEvent {
  readonly eventId: EventId
  readonly spanId: SpanId
  readonly logical: LogicalTime
  readonly wall: WallMillis
  readonly kind: SpanEventKind
  readonly label: string | null
  readonly value: ProjectedValue | null
}

// A vertical line across the waterfall, as DOMContentLoaded and Load are drawn.
export interface Marker {
  readonly markerId: string
  readonly logical: LogicalTime
  readonly wall: WallMillis
  readonly label: string
  readonly tone: string | null   // a theme token name, not a CSS colour
}

// Open and close are separate records: a long-lived subscription has to appear the
// instant it is created, for the same reason the Network tab draws a pending row.
export type TraceRecord =
  | { readonly record: "session";    readonly session: SessionInfo }
  | { readonly record: "span-open";  readonly span: Span }
  | { readonly record: "span-close"; readonly spanId: SpanId; readonly endLogical: LogicalTime; readonly endWall: WallMillis; readonly status: SpanStatus; readonly failure: ProjectedValue | null }
  | { readonly record: "span-event"; readonly event: SpanEvent }
  | { readonly record: "marker";     readonly marker: Marker }

export interface SessionInfo {
  readonly sessionId: SessionId
  readonly startedWall: WallMillis
  readonly host: string   // "browser" | "node" | a consumer label. Shown in the status bar
  readonly labels: readonly ProjectedEntry[]
}

// One drain of the ring. The unit the transport moves and the index folds.
export interface Frame {
  readonly seq: number
  readonly sessionId: SessionId
  readonly firstLogical: LogicalTime
  readonly lastLogical: LogicalTime
  readonly records: readonly TraceRecord[]
  readonly droppedBefore: number   // cumulative ring drops at cut time; never resets
}

export interface IClock { nextLogical(): LogicalTime; wallNow(): WallMillis }

export interface SinkStats {
  readonly capacity: number
  readonly size: number
  readonly pushed: number
  readonly dropped: number        // drop-oldest. A stale head with a discarded tail is the wrong failure
  readonly framesCut: number
  readonly lastDrainWall: WallMillis
}

export interface ISink { push(record: TraceRecord): void; readonly stats: SinkStats }
export interface IFrameSource { drain(): Frame | null; readonly stats: SinkStats }

export interface SpanOpenRequest {
  readonly kind: SpanKind
  readonly name: string
  readonly role?: SpanRole            // default "row"
  readonly parentSpanId?: SpanId | null
  readonly origin?: SpanOrigin | null
  readonly attributes?: Readonly<Record<string, unknown>>   // projected on the way in
}

export interface SpanCloseOutcome { readonly status: Exclude<SpanStatus, "open">; readonly failure?: unknown }

export interface RecorderStats {
  readonly openSpans: number
  readonly spansOpened: number
  readonly spansClosed: number
  readonly eventsRecorded: number
  readonly reentrantDrops: number   // refused because already inside a record. §2.3
  readonly orphanDrops: number      // unknown or already-closed span id
}

// The whole public instrumentation API. Every method is total and never throws: an
// instrument that can crash the program it observes is worse than no instrument.
export interface IRecorder {
  readonly sessionId: SessionId
  readonly enabled: boolean
  readonly sink: ISink
  readonly stats: RecorderStats
  setEnabled(enabled: boolean): void
  openSpan(request: SpanOpenRequest): SpanId
  closeSpan(spanId: SpanId, outcome: SpanCloseOutcome): void
  addEvent(spanId: SpanId, kind: SpanEventKind, label: string | null, rawValue: unknown): void
  mark(label: string, tone?: string | null): void
}

export interface TimeRange {
  readonly minLogical: LogicalTime
  readonly maxLogical: LogicalTime
  readonly minWall: WallMillis
  readonly maxWall: WallMillis
}

export interface RetentionPolicy {
  readonly maxSpans: number
  readonly minSpans: number            // never compact below this, whatever the pressure
  readonly maxEventsPerSpan: number
  readonly maxPhaseSpansPerSpan: number
  readonly minDeadAgeMillis: number
}

// The read model. rowOrder is append-only: a row that jumps position mid-stream is
// unreadable, and re-sorting is O(n log n) per frame. Sorting by a column is a view over
// rowOrder (§7.2), never a mutation of it. Phase spans live in phasesBySpan, not rowOrder.
export interface ISpanIndex {
  readonly rowOrder: readonly SpanId[]
  readonly spans: ReadonlyMap<SpanId, Span>
  readonly eventsBySpan: ReadonlyMap<SpanId, readonly SpanEvent[]>
  readonly phasesBySpan: ReadonlyMap<SpanId, readonly SpanId[]>
  readonly childrenBySpan: ReadonlyMap<SpanId, readonly SpanId[]>
  readonly kinds: ReadonlyMap<SpanKind, number>
  readonly markers: readonly Marker[]
  readonly timeRange: TimeRange
  readonly sessions: ReadonlyMap<SessionId, SessionInfo>
  readonly version: number
  readonly orphanRecords: number
  apply(frame: Frame): number          // returns the new version. O(frame.records), never O(index)
  clear(preserveOpen: boolean): number
  compact(policy: RetentionPolicy): number
}

export interface FilterQuery {
  readonly text: string
  readonly kinds: ReadonlySet<SpanKind>       // empty means All, as Chromium's chips do
  readonly statuses: ReadonlySet<SpanStatus>
  readonly minDurationMillis: number | null
  readonly minEventCount: number | null
  readonly invert: boolean
  readonly window: TimeRange | null           // set by the overview brush; null is the whole range
  readonly hideOrphans: boolean
}

export interface ISpanFilter {
  parse(text: string): FilterQuery
  compile(query: FilterQuery, index: ISpanIndex): (spanId: SpanId) => boolean
}

export interface WaterfallPhase {
  readonly label: string
  readonly startFraction: number
  readonly endFraction: number
  readonly derived: boolean   // true for the three RxJS phases, false for a recorded phase span
}

// Geometry in 0..1 of the visible window. The renderer multiplies by pixel width.
export interface WaterfallBar {
  readonly startFraction: number
  readonly endFraction: number
  readonly phases: readonly WaterfallPhase[]
  readonly ticks: readonly number[]   // event positions, windowed and capped
  readonly hiddenTicks: number        // overflow, so the renderer draws a density shade
  readonly openEnded: boolean
}

export interface IWaterfallLayout {
  layout(
    span: Span,
    events: readonly SpanEvent[],
    phaseSpans: readonly Span[],
    window: TimeRange,
    maxTicks: number,
  ): WaterfallBar
}

export type ColumnId =
  | "name" | "kind" | "status" | "initiator" | "size" | "events"
  | "duration" | "start" | "origin" | "session" | "waterfall"

export interface RowView {
  readonly spanId: SpanId
  readonly depth: number   // from the parent chain, capped by the UI at 8
  readonly name: string
  readonly kind: SpanKind
  readonly status: SpanStatus
  readonly initiatorSpanId: SpanId | null
  readonly initiatorLabel: string | null
  readonly eventCount: number
  readonly byteEstimate: number
  readonly durationMillis: number | null
  readonly startMillis: number
  readonly originLabel: string | null
  readonly waterfall: WaterfallBar
}

export interface ITransport {
  readonly name: string
  readonly connected: boolean
  send(frame: Frame): void
  receive(onFrame: (frame: Frame) => void): () => void   // returns unsubscribe
  close(): void
}

export interface INdjsonCodec {
  encode(records: readonly TraceRecord[]): string
  decode(text: string): readonly TraceRecord[]
}
```

Two deliberate omissions.

**No `Store` type.** `ISpanIndex.spans` and `eventsBySpan` are the only storage. The prior
three-tier layout had the index as a denormalized cache of a store, which forced every
read to decide which to trust and every renderer to tolerate an id resolving to nothing.
Two tiers with one owner removes that class of bug: the ring is a queue, the index is
storage.

**No `Observable` and no DOM type anywhere in this header.** The constraint that lets a
bundler-free Node consumer import it, expressed in the one file that would leak it first.

### 6.2 `LogicalClock`: `debug-core/src/1_clock.ts`

```ts
export class LogicalClock implements IClock {
  counter = 0
  nextLogical(): LogicalTime
  // return ++this.counter
  wallNow(): WallMillis
  // performance.now() where available, else Date.now(). Resolved once at construction
  // into a field, not branched per call: this runs once per record.
}
```

Lifetime: one per recorder, created with it, dies with it, must survive HMR.
Uniqueness: `counter` is strictly increasing and never reused within one clock instance.

### 6.3 `RingSink`: `debug-core/src/2_ring.ts`

```ts
export class RingSink implements ISink, IFrameSource {
  constructor(options: { capacity: number; sessionId: SessionId })
  push(record: TraceRecord): void
  // slots[(head + count) % capacity] = record
  // if count === capacity { head = (head + 1) % capacity; dropped++ } else count++
  // pushed++
  drain(): Frame | null
  // if count === 0 return null
  // walk count slots from head into a fresh array, NULLING each slot as it is read so
  // the ring holds no reference to a drained record. Then head = 0, count = 0,
  // framesCut++, and return the Frame with droppedBefore = dropped.
}
```

Layer disagreement, stated: the type says `Frame.records` is `readonly`, and the drain
allocates a new array per frame rather than exposing the backing store. That allocation is
the price of the ring never handing out a slice a later push can overwrite.

Lifetime: one per recorder. Storage: one pre-allocated array of `capacity`, default 8,192,
plus four integers. Uniqueness: `framesCut` is the `Frame.seq` and is never reused.

### 6.4 `BudgetProjector`: `debug-core/src/3_project.ts`

```ts
export const BudgetProjector: IProjector = {
  newCursor(): ProjectionCursor,
  // { depth: 0, nodes: 0, seen: new Set() }

  project(value, budget, cursor): ProjectedValue,
  // if ++cursor.nodes > budget.maxNodesPerValue return { kind: "elided", reason: "budget" }
  // switch on typeof, in frequency order: string, number, boolean, undefined, object,
  //   function, bigint, symbol.
  // string longer than maxTextLength -> { kind: "text", truncated: true, fullLength }
  // object: null -> primitive null; seen.has -> elided "cycle";
  //   depth >= maxDepth -> elided "depth";
  //   Array -> take maxArrayItems, elide the rest as "width";
  //   Error -> { kind: "failure", name, message, stack };
  //   plain record (constructor === Object or null prototype) -> enumerate own keys,
  //     capped at maxRecordKeys. This DOES invoke own getters and that is accepted,
  //     because refusing makes the Value tab useless;
  //   anything else -> opaque, reading only constructor.name and a short summary,
  //     both inside try, never enumerating. A getter that throws yields
  //     { kind: "opaque", typeName: "?", text: "<threw>" } and never rethrows.

  weigh(projected): number,
  // structural estimate. 8 per primitive node, byteLength of text, recursive over
  // array items and record entries. Never re-serializes.
}
```

Lifetime: none, it is a module namespace. `ProjectionCursor` lives for exactly one
`project()` call and is never shared, which is what makes concurrent projection from two
recorders safe without a lock.

### 6.5 `SpanRecorder`: `debug-core/src/4_recorder.ts`

```ts
export class SpanRecorder implements IRecorder {
  constructor(options: {
    sessionId: SessionId
    clock: IClock
    sink: ISink
    budget: Budget
    projector?: IProjector          // default BudgetProjector
    maxOpenSpans?: number           // default 4096
  })

  openSpanEventCounts = new Map<SpanId, number>()
  depth = 0
  counter = 0

  openSpan(request): SpanId
  // if (!enabled || depth > 0) { if (depth > 0) reentrantDrops++; return "" }
  // if (openSpanEventCounts.size >= maxOpenSpans) { orphanDrops++; return "" }
  // depth++
  // try {
  //   spanId = `${sessionId}:${++counter}`
  //   attributes = project each entry against budget with a fresh cursor
  //   openSpanEventCounts.set(spanId, 0)
  //   sink.push({ record: "span-open", span: { ...request, role: request.role ?? "row",
  //     spanId, startLogical: clock.nextLogical(), startWall: clock.wallNow(),
  //     status: "open", endLogical: null, endWall: null, failure: null,
  //     eventCount: 0, byteEstimate: 0, droppedEventCount: 0, droppedPhaseCount: 0 } })
  //   return spanId
  // } finally { depth-- }

  addEvent(spanId, kind, label, rawValue): void
  // if (!enabled || depth > 0 || spanId === "") { ... same guards ... }
  // const n = openSpanEventCounts.get(spanId); if (n === undefined) { orphanDrops++; return }
  // openSpanEventCounts.set(spanId, n + 1)
  // push { record: "span-event", event: { eventId: `${spanId}#${n}`, ..., value:
  //        rawValue === undefined ? null : project(rawValue, budget, newCursor()) } }

  closeSpan(spanId, outcome): void
  // guards as above. if (!openSpanEventCounts.delete(spanId)) { orphanDrops++; return }
  // push { record: "span-close", ..., failure: outcome.failure === undefined ? null
  //        : project(outcome.failure, budget, newCursor()) }

  mark(label, tone): void
  // push { record: "marker", marker: { markerId: `${sessionId}:m${++counter}`, ... } }
}
```

The `depth` guard is §2.3's third level and it is the only one that survives an embedder.
`maxOpenSpans` is the second bound nobody asked for and everybody needs: without it, a leak
in the observed program becomes an unbounded `Map` in the observer.

Lifetime: one per process or page, pinned to `globalThis` (§6.8). Storage: one
`Map<SpanId, number>` sized by *open* spans, never by total spans. Uniqueness: `SpanId` is
`${sessionId}:${counter}`, unique across merged sessions because the session prefixes it;
`EventId` is `${spanId}#${n}`.

### 6.6 `MapSpanIndex`: `debug-core/src/5_index.ts`

```ts
export class MapSpanIndex implements ISpanIndex {
  apply(frame: Frame): number
  // if (frame.seq <= lastAppliedSeq) { replayedFrames++; return version }
  // lastAppliedSeq = frame.seq
  // for each record, switch on record.record:
  //   session:    sessions.set
  //   span-open:  spans.set; if role === "row" rowOrder.push(spanId)
  //               else phasesBySpan.get(parent).push(spanId), trimmed to
  //               maxPhaseSpansPerSpan with droppedPhaseCount++ on the parent
  //               childrenBySpan.get(parentSpanId).push(spanId)
  //               kinds.set(kind, (kinds.get(kind) ?? 0) + 1)
  //   span-event: const span = spans.get(event.spanId)
  //               if (!span) { orphanRecords++; break }   // never fabricate a span-open
  //               events.push, trim to maxEventsPerSpan with droppedEventCount++
  //               spans.set(id, { ...span, eventCount: +1, byteEstimate: +weigh(value) })
  //   span-close: same guard; spans.set(id, { ...span, endLogical, endWall, status, failure })
  //   marker:     markers.push
  // timeRange widened from frame.firstLogical / lastLogical
  // return ++version

  clear(preserveOpen: boolean): number
  compact(policy: RetentionPolicy): number
  // walk rowOrder from the oldest. Skip a span that is open, that has children, or
  // that closed less than minDeadAgeMillis ago. Stop at minSpans. Evicting a span
  // evicts its events and its phase spans. rowOrder is filtered, never reordered.
}
```

Storage, and the cost of each map:

| Map | Keyed by | Grows with | Bounded by |
|---|---|---|---|
| `spans` | span id | every span, row and phase | `maxSpans` |
| `eventsBySpan` | span id | events | `maxEventsPerSpan` per span |
| `phasesBySpan` | parent span id | phase spans | `maxPhaseSpansPerSpan` per parent |
| `childrenBySpan` | parent span id | row spans with a parent | `maxSpans` |
| `rowOrder` | position | row spans only | `maxSpans` |
| `kinds` | kind string | distinct kinds | the consumer's vocabulary |

Uniqueness: `rowOrder` holds each `SpanId` exactly once and is append-only; `apply` pushes
only on first sight and `compact` filters without reordering.

### 6.7 `AnimationFrameDrain`: `debug-ui/src/1_drain.ts`

This is where signals changes the prior design. `SignalReact` and `useSignal` already
throttle at 16 ms on `animationFrameScheduler`
(`packages/signals/src/3_react.ts:108, 154`), so the render-side rAF coalescing the prior
plan's `FramePump` provided is already bought. What remains is producer-side: do not fold
10,000 frames per second into the index.

```ts
// debug-ui/src/0_types.ts
export interface IFrameDrain {
  /** The index version after each animation-frame batch is folded. Cold and refCounted. */
  readonly version$: Observable<number>
  setPaused(paused: boolean): void
}

// debug-ui/src/1_drain.ts
export class AnimationFrameDrain implements IFrameDrain {
  constructor(source: IFrameSource, index: ISpanIndex, policy: RetentionPolicy)
  // version$ = interval(0, animationFrameScheduler).pipe(
  //   map(() => this.drainOnce()),          // returns index.version, unchanged if paused or empty
  //   distinctUntilChanged(),
  //   shareReplay({ bufferSize: 1, refCount: true }),
  // )
  // drainOnce is a plain synchronous method: drain, apply, compact every 120 applies,
  // record applyCostMillis. It returns a number, so the pipeline carries a value to its
  // consumer instead of ending in a discarded side effect.
}
```

`version$` feeds exactly one `Signal`:

```ts
// debug-ui/src/2_panel_state.ts
export const indexVersion = Signal(drain.version$, 0)
```

`SignalCreator` subscribes the observable through `shareReplay({ refCount: true })`
(`packages/signals/src/1_SignalCreator.ts:57-64`), so **the app has zero manual
`.subscribe()` calls**: the signal owns the only one, and the render boundary owns its own.
The refCount has a consequence worth stating rather than discovering: while nothing reads
`indexVersion`, nothing drains, so the ring fills and drops. That is correct behaviour for
a closed panel and it is why `SinkStats.dropped` renders in the status bar.

### 6.8 The signals rules for this UI

Three rules, each with the receipt that forces it.

1. **The index never goes inside a Signal.** `MapSpanIndex` is mutated in place by
   `apply()`, so a signal holding it would re-emit the same reference and no reader would
   update. The version integer is the change signal; components read `indexVersion.$()` to
   subscribe and then read the index from a module const. A second reason if the first is
   ever engineered around: `SignalCreator`'s nested setter runs `immer.produce` over the
   root value (`1_SignalCreator.ts:96-100`), which on a 100,000-entry `Map` is not a cost
   anyone wants on a click.
2. **Control state is one signal with roughly ten fields**, read through the proxy path so
   each component subscribes only to what it touches:
   ```ts
   export interface PanelStateValue {
     filterText: string
     selectedSpanId: SpanId | null
     detailTab: "summary" | "pipeline" | "emissions" | "value" | "initiator" | "timing"
     columnWidths: Readonly<Record<ColumnId, number>>
     sortColumn: ColumnId
     sortDescending: boolean
     preserveLog: boolean
     paused: boolean
     budgetPreset: "structure" | "normal" | "deep"
     bigRows: boolean
   }
   export const panelState = Signal<PanelStateValue>(PANEL_STATE_DEFAULTS)
   ```
3. **Nothing subscribes to `signalDispatch`.** §2.3. Grep rail in Phase 4.

Row building stays synchronous and returns an array, per the sync-stays-sync law:

```ts
export const RowProjection: IRowProjection = {
  build(index, query, window, maxTicks): RowView[]
  // const keep = SpanFilter.compile(query, index)
  // const rows: RowView[] = []
  // for (const spanId of index.rowOrder) if (keep(spanId)) rows.push(toRowView(spanId))
  // return rows
}
```

No Observable wraps that loop, and it does not end by discarding its own values.

### 6.9 `traced()` and the synchronous parent scope: `debug-rxjs/src/4_traced.ts`

```ts
export interface TracedOptions<Value> {
  readonly kind: SpanKind
  readonly name: string
  readonly role?: SpanRole
  readonly parentSpanId?: SpanId | null   // explicit wins over the ambient scope
  readonly origin?: SpanOrigin | null
  readonly attributes?: Readonly<Record<string, unknown>>
  readonly captureValues?: boolean        // false records the emission, not its value
  readonly label?: (value: Value, index: number) => string | null
}

export interface ITracedOperator {
  traced<Value>(recorder: IRecorder, options: TracedOptions<Value>): MonoTypeOperatorFunction<Value>
}

// pseudo-code:
//   source => new Observable<Value>(subscriber => {
//     const spanId = recorder.openSpan({ ...options,
//       parentSpanId: options.parentSpanId ?? SubscribeParentScope.current() })
//     let index = 0, settled = false
//     const inner = SubscribeParentScope.run(spanId, () => source.subscribe({
//       next:  value => { SubscribeParentScope.run(spanId, () => {
//                recorder.addEvent(spanId, "emit", options.label?.(value, index++) ?? null,
//                  options.captureValues === false ? undefined : value)
//                subscriber.next(value) }) },
//       error: failure => { settled = true
//                recorder.addEvent(spanId, "failure", null, failure)
//                recorder.closeSpan(spanId, { status: "errored", failure })
//                subscriber.error(failure) },
//       complete: () => { settled = true
//                recorder.addEvent(spanId, "complete", null, undefined)
//                recorder.closeSpan(spanId, { status: "completed" })
//                subscriber.complete() },
//     }))
//     return () => {
//       inner.unsubscribe()
//       // Teardown with neither complete nor error is an unsubscribe, which is
//       // "cancelled" and is the shape a leak hunt looks for.
//       if (!settled) recorder.closeSpan(spanId, { status: "cancelled" })
//     }
//   })
```

**`SubscribeParentScope` is the improvement over the prior plan's explicit-only parenting.**
The prior plan required every call site to pass `parentSpanId`, and named the inability to
find an inner subscription's parent as an accepted limitation. It is recoverable for the
common case:

```ts
export interface IParentScope {
  current(): SpanId | null
  run<Result>(spanId: SpanId, body: () => Result): Result
}
// const stack: SpanId[] = []
// current: stack.length ? stack[stack.length - 1] : null
// run: stack.push(spanId); try { return body() } finally { stack.pop() }
```

Why a plain synchronous stack is correct here: RxJS builds a subscription chain
synchronously bottom-up inside the `subscribe()` call, and `mergeMap`/`switchMap` create
their inner subscriptions synchronously inside the outer `next` handler. Both are covered
by wrapping the inner subscribe and the inner `next`.

Where it is wrong, stated rather than discovered:

| Case | Result |
|---|---|
| `subscribeOn(asyncScheduler)` anywhere in the chain | the upstream subscribe happens on a later task and the scope is empty. Parent is null |
| a subscription created in a `setTimeout` or a `.then` in user code | parent is null |
| Node consumers wanting real ambient context | `@hafley66/debug-rxjs/node-context`, a separate subpath over `node:async_hooks` `AsyncLocalStorage`. Core stays zero-dependency because that is a built-in and the browser never imports the subpath. This is the one part of OpenTelemetry's design worth copying (§4.7) |

**Parent direction.** `parentSpanId` is the **causal** parent, the subscriber that caused
this subscription, matching Chromium's Initiator column and matching RxJS reality. Data
flows the other way. For raw RxJS that is all there is. For json-rx the dataflow edges are
in the document and need no span field at all, which is a real advantage of a compiled
program over a traced one and is why the Pipeline tab is exact for json-rx and heuristic
for raw RxJS.

### 6.10 Storage layout, then reads and writes, then uniqueness

**Layout. Two tiers.** The wire (`Frame`) is not a tier; it exists for one `apply` call.

| Tier | Shape | Keyed by | Bounded by | Owner |
|---|---|---|---|---|
| Ring (`RingSink`) | pre-allocated array, head + count | position | `capacity`, default 8,192 | the recorder |
| Index (`MapSpanIndex`) | five maps plus `rowOrder` (§6.6) | span id | `RetentionPolicy` | the drain |

**Write sequence, per instrumented operation.**

1. Call site calls `recorder.openSpan(...)`. Disabled or re-entrant returns `""` with no
   allocation.
2. `SpanRecorder` mints the id, records it in `openSpanEventCounts`, projects the
   attributes with a fresh cursor, pushes one `span-open`.
3. `RingSink.push` lands in a free slot or overwrites the head and increments `dropped`.
4. The call returns. No observer, no subject, no microtask.
5. Each emission repeats 1-4 through `addEvent`, at most `maxNodesPerValue` projection
   nodes.
6. Teardown calls `closeSpan`, which deletes the map entry and pushes `span-close`.

**Read sequence, per animation frame.**

1. `AnimationFrameDrain.drainOnce` calls `source.drain()`, which empties the ring into one
   `Frame` and nulls the slots.
2. `index.apply(frame)` folds records in, O(frame.records).
3. Every 120 applied frames, `index.compact(policy)`.
4. `drainOnce` returns the new version; `distinctUntilChanged` suppresses idle frames;
   `indexVersion` emits.
5. `SignalReact` components that read `indexVersion.$()` re-render, throttled at 16 ms by
   signals.
6. Components read `RowView[]` from `RowProjection.build`. **No component iterates
   `index.spans`.** The review rule is literal: `Object.values(`, `.entries()`, and
   `[...map]` are banned in `packages/debug-ui/src/**` outside `2_rows.ts`.

**Uniqueness conditions.**

| Invariant | Enforced where |
|---|---|
| `SpanId` unique per session: `${sessionId}:${counter}` | `SpanRecorder.openSpan` |
| `SpanId` unique across merged sessions, because `sessionId` prefixes it | `SpanRecorder` constructor takes it; no default |
| `EventId` unique: `${spanId}#${n}` from `openSpanEventCounts` | `SpanRecorder.addEvent` |
| `Frame.seq` strictly increasing per sink, never reused | `RingSink.framesCut` |
| A frame with `seq <= lastAppliedSeq` is counted and dropped | `MapSpanIndex.apply`, first guard |
| `rowOrder` holds each `SpanId` once and is append-only | `apply` pushes on first sight; `compact` filters |
| A `role: "phase"` span never enters `rowOrder` | `apply`, `span-open` arm |
| `compact` never evicts an open span, or one with children | `compact`, first and last clause |
| A `span-event` for an unknown span is counted as `orphanRecords`, never auto-creates a span | `apply`, `span-event` arm |
| `closeSpan` on an already-closed span is a no-op counted in `orphanDrops` | the `Map.delete` return value |

**Where the four layers disagree.** Four real disagreements, each with a reconciliation.

1. **Types say `Span` is `readonly`; storage wants to bump a counter per event.**
   Reconciled by object replacement in `apply` (`spans.set(id, { ...span, ... })`), one
   shallow allocation per event at index rate rather than at trace rate. A mutable `Span`
   would make every render memo wrong; the allocation is the price of the memo working.
2. **Lifetimes say the recorder outlives every viewer; storage says the index is the only
   place spans live.** A viewer that connects late sees nothing that happened before it
   connected, because the recorder retains nothing. That is the choice that caps recorder
   memory at *open* spans. Consequence to accept: there is no replay-from-the-beginning and
   there will not be one until someone asks for a persistent sink. `Preserve log` preserves
   across *clears*, not across *connects*.
3. **The wire says records are idempotent; the ring says drops are permanent.** Both are
   true about different failures. A replayed frame is harmless. A dropped record is a hole,
   and after a hole the index can hold a `span-event` whose `span-open` never arrived.
   `apply` counts those and never fabricates a parent, and the status bar shows the count,
   so a hole reads as a hole.
4. **New with §3.3: `WaterfallBar.phases` has two producers.** The three RxJS phases are
   derived by `WaterfallLayout` from the event stream; json-rx's jsonata phases are
   recorded spans. Rule: `WaterfallLayout` derives the three only when
   `phaseSpans.length === 0`, and sets `derived: true` on what it invents so the Timing tab
   can label a computed row differently from a measured one. A bar never mixes the two.

### 6.11 Instance lifetimes, collected

| Type | Created | Destroyed | Survives HMR | Survives React remount |
|---|---|---|---|---|
| `LogicalClock` | with its recorder | with it | must | yes |
| `RingSink` | with its recorder | with it | must | yes |
| `SpanRecorder` | module eval, pinned to `globalThis` | page unload / process exit | **must** | yes |
| `ProjectionCursor` | per `project()` | end of that call | no | no |
| `Frame` | per `drain()` | after `apply()` | no | no |
| `MapSpanIndex` | with the drain | with the drain | should; rebuilding needs a replay nobody offers | should |
| `AnimationFrameDrain` | once per panel, module scope | page unload | must | yes |
| `indexVersion` / `panelState` signals | module eval | page unload | must | yes |
| the signal's internal subscription to `version$` | first reader | last reader unsubscribes (`refCount`) | n/a | n/a |
| `ITransport` | once per viewer | `close()` | must | yes |

**HMR splits the recorder if it is not pinned**, and the current code has this bug:
`0_store.ts:676` is `export const main = new RxJSTracker()`. Hot-replace that module and a
second tracker is constructed; modules that re-evaluate bind to it, modules that did not
keep the first, and the trace forks in two with no signal. The pin:

```ts
// packages/debug-rxjs/src/1_tracker.ts
declare global { var __hafley_debug_recorder__: IRecorder | undefined }
export const recorder: IRecorder = (globalThis.__hafley_debug_recorder__ ??= new SpanRecorder({
  sessionId: `s${Date.now().toString(36)}`, clock, sink, budget: DEFAULT_BUDGET,
}))
// globalThis rather than import.meta.hot.data: the recorder must also exist under
// `node --test` and `vitest run`, where import.meta.hot is undefined.
```

Fixture 2 asserts the pin by identity across an HMR swap.

---

## 7. The UI: Chromium Network tab, affordance by affordance

The affordance list is taken from `developer.chrome.com/docs/devtools/network/reference`
and carries over from the prior plan whole. Which table is bought (§4.1) changes who
renders a cell, not which cells exist.

### 7.1 The mapping table

| Network tab affordance | Debugger equivalent | Reads |
|---|---|---|
| **Request row** | one span with `role: "row"`. For RxJS, one subscription. For json-rx, one subscription to one node | `RowView` |
| **Name** column | `Span.name`: the observable label, or the json-rx `node` id. Shared across repeat subscriptions exactly as a URL is | `RowView.name` |
| **Status** column | `SpanStatus`. Errored rows red, cancelled dimmed | `RowView.status` |
| **Type** column | `SpanKind`, the free string. `subscription`, `call`, `map`, `scan`, `host`, ... | `RowView.kind` |
| **Initiator** column | `Span.parentSpanId` rendered as the parent's name, click scrolls to and selects. For a root row, `Span.origin` instead: `file:line` for a `FileOrigin`, `programId/unit/node` for a `ProgramOrigin` | `RowView.initiatorSpanId`, `initiatorLabel`, `originLabel` |
| **Size** column | `eventCount` events over `byteEstimate` bytes, two lines like Chromium's. Header says "est." so nobody mistakes it for a wire size | `RowView.eventCount`, `byteEstimate` |
| **Time** column | `durationMillis`, or "pending" | `RowView.durationMillis` |
| **Waterfall** column | a bar on the shared logical-time axis with phase segments and per-emission tick marks. §7.2 | `RowView.waterfall` |
| Waterfall header right-click sort keys | **Start / First emission / End / Total duration / Time to first emission.** Chromium's five, renamed. Sorting is a view over `rowOrder`, never a mutation | `ISpanIndex.rowOrder` plus a comparator |
| **Overview strip** with time brush | events-per-logical-time histogram, drag to narrow, writes `FilterQuery.window` | `timeRange`, bucketed |
| **Type filter chips** | chips built **from `ISpanIndex.kinds`**, a live map, with a count badge. That is what lets json-rx's node kinds appear without a UI release | `ISpanIndex.kinds` |
| **Filter text box** grammar | same grammar, our keys. §7.4 | `SpanFilter.parse` |
| **Invert** checkbox | `FilterQuery.invert` | |
| **Preserve log** | keep rows across a session boundary: page reload, HMR swap, or a new `SessionInfo` in Node. Off, a new session runs `clear(true)`, keeping open spans | `ISpanIndex.clear` |
| **Clear** | `clear(false)`. Does not stop the recorder | |
| **Record / Stop** | `recorder.setEnabled(false)`. Stopping is at the **source**, so a stopped recorder costs one boolean read per instrumented call and allocates nothing | `IRecorder.setEnabled` |
| **Disable cache** slot | reused for **Values off**: swap to `STRUCTURE_ONLY_BUDGET`. Keeps rows and timing, drops payload capture, the single biggest cost lever | `Budget` |
| **Throttling** slot | reused for the capture-depth preset: Structure only / Normal / Deep. Same place, same "slower to see more" model | `Budget` |
| **Import / Export HAR** | NDJSON of `TraceRecord`, plus Chrome Trace Event Format so a trace opens in `ui.perfetto.dev` (§4.7) | `NdjsonCodec` |
| **Search** (Cmd+F) | full text across span names, event labels, and projected values | |
| **Detail pane tabs** | Summary, Pipeline, Emissions, Value, Initiator, Timing. §7.3 | |
| **DOMContentLoaded / Load** lines | `Marker` lines. HMR swap, recorder enable/disable, and whatever a consumer marks | `ISpanIndex.markers` |
| **Status bar** | §7.5 | `SinkStats`, `RecorderStats`, `ISpanIndex` |
| Row right-click | Copy span id / Copy as filter (`parent:<id>`) / Copy projected value as JSON / Filter to this kind / Mute this kind | |
| **Big request rows** | same setting. Not cosmetic: the Size and Name cells both want two lines | `panelState.bigRows` |

### 7.2 The waterfall column

| Chromium phase | Ours | Definition |
|---|---|---|
| Queueing, Stalled, Connect, SSL, Request sent | none | There is no connection setup for a subscription. Collapsing five phases to zero is honest; inventing analogues is decoration |
| **Waiting (TTFB)** | **pending** | `startLogical` to the first `emit`. The most useful single number for a subscription |
| **Content Download** | **streaming** | first `emit` to last `emit` |
| none | **draining** | last `emit` to `endLogical`. Nonzero here is a subscription that stopped producing well before teardown, which is the shape of a leak |
| none | **recorded phases** | `role: "phase"` child spans, drawn in place of the derived three. §3.3, §6.10 disagreement 4 |

An open span has `openEnded: true`, no `draining`, and runs to the right edge with a fade.
A span with zero emissions has only `pending`. A synchronous span draws as a
minimum-width tick, which Chromium also does for sub-millisecond responses.

**Tick marks.** Each `emit` is a 1px mark, capped by `maxTicks` at the column's pixel
width, because more ticks than pixels is a solid rectangle that cost O(events) to draw.
`hiddenTicks` carries the overflow and the renderer draws a density shade. That cap is why
the waterfall is O(pixels) per row rather than O(events) per row, and why a span with
200,000 emissions renders as fast as one with 3.

**Sorting is a view.** The five sort modes produce an index permutation recomputed on sort
change and on filter change, never on frame apply. At 100,000 rows a per-frame re-sort is
1.7M comparisons at 60 Hz, the whole budget; a per-click re-sort is free.

### 7.3 The detail pane

| Tab | Chromium counterpart | Content |
|---|---|---|
| **Summary** | Headers | span id, kind, role, name, status, origin with a click-to-source link, session, parent chain as breadcrumbs, `attributes` as a key/value table |
| **Pipeline** | none, this one is ours | for a `subscription` span, the operator chain, rendered with `renderStaticTree`'s existing `.pipe(` / operator / `-> #id` vocabulary. For a json-rx node, the document subtree at `origin.pointer`, which is exact rather than reconstructed |
| **Emissions** | Response / EventStream | the virtualized event list: logical time, wall delta from the previous emission, kind, label, one-line projected value. This is where the marble diagram survives, as an optional strip above the list |
| **Value** | Preview / Payload | the selected event's `ProjectedValue` as an expandable tree, with `elided` nodes rendered as explicit `... 84 more (width)` rows. A truncated payload must read as truncated |
| **Initiator** | Initiator | the ancestor chain to the root, each row clickable, plus the descendant subtree count |
| **Timing** | Timing | Opened at, Time to first emission, Emission span, Inter-emission max and median, Teardown, Total, then one line per recorded phase span. Plus `droppedEventCount` and `droppedPhaseCount` when nonzero, because a timing table computed over trimmed data is a lie unless it says so |

### 7.4 The filter grammar

Chromium's grammar, our keys. Space-separated terms, `key:value`, `-` negates, bare words
substring-match the name.

```
kind:map                 span kind equals (repeatable, OR within one key)
-kind:shareReplay        negation
status:errored           span status equals
is:open  is:errored      status shorthand
name:pollUsers           substring, case-insensitive, on Span.name
origin:usage.map         substring on FileOrigin.file or ProgramOrigin.node
program:example.usage    exact ProgramOrigin.programId
node:usage.map           exact ProgramOrigin.node
parent:s3:41             exact parent span id. The "show me this subtree" filter
session:s3               exact session id
events>100               eventCount greater than
dur>50                   durationMillis greater than
pollUsers                bare word: substring on name
```

`program:` and `node:` are new and are the json-rx keys. Two behaviours copied from
Chromium deliberately because they are not obvious and are right: an empty chip set means
All rather than None, and the text box and chips are ANDed while repeated instances of one
key are ORed.

### 7.5 The status bar

```
1,284 spans (312 shown) · 2,140 phases · 48,910 events · dropped 0 · re-entrant 0
· orphan 0 · ring 1,204/8,192 · frames 3,918 · apply 1.4 ms · span 8.42 s · Normal · s3 (node)
```

Five of those exist because the corresponding failure is otherwise invisible: `dropped`
(the ring lied), `re-entrant` (§2.3's guard fired), `orphan` (a record arrived for a span
that was never opened or was already evicted), `apply` (the drain is falling behind), and
the budget preset name (a slow session's first suspect).

### 7.6 Layout and Tailwind

```
┌──────────────────────────────────────────────────────────────────────┐
│ ● ⊘  □ Preserve log   [Values: Normal ▾]   🔍   ⬆⬇ export/import  ⚙  │  toolbar
├──────────────────────────────────────────────────────────────────────┤
│ [filter text.....]  □ Invert   All | map | scan | host | ...          │  filter bar
├──────────────────────────────────────────────────────────────────────┤
│ ▁▂▅█▅▂▁▁▃█▇▄▂▁  (overview, drag to narrow)                            │  overview
├────────────────────────────────────────────┬─────────────────────────┤
│ Name  Status Type Init Size Time Waterfall │ Summary Pipeline Emis... │
│ usage.map   open  map  -  412/9k  8.4s ▓▓░ │  detail pane            │
│ ...virtualized rows...                     │                         │
├────────────────────────────────────────────┴─────────────────────────┤
│ 1,284 spans (312 shown) · 48,910 events · dropped 0 · apply 1.4 ms    │  status bar
└──────────────────────────────────────────────────────────────────────┘
```

Tailwind v4 CSS-first, `tailwindcss@^4.3.3` + `@tailwindcss/vite@^4.3.3`, verified against
`vite@8.1.5` in the prior plan's measured spike, which survives whole. No
`tailwind.config.js`. Tokens re-scoped from marble glyphs to status and phase:

```css
/* packages/debug-ui/src/tailwind.css */
/* noRxjs() */
@import "tailwindcss";

@theme {
  --color-status-open:      oklch(0.66 0.17 250);
  --color-status-completed: oklch(0.62 0.02 260);
  --color-status-errored:   oklch(0.68 0.19  25);
  --color-status-cancelled: oklch(0.76 0.15  62);
  --color-phase-pending:    oklch(0.80 0.06 250);
  --color-phase-streaming:  oklch(0.66 0.17 250);
  --color-phase-draining:   oklch(0.72 0.05 260);
  --color-phase-recorded:   oklch(0.70 0.12 190);
  --color-marker:           oklch(0.62 0.24 315);
}
```

**The static-versus-runtime rule is unchanged and is the reason the waterfall works at
all.** Tailwind's scanner reads class strings out of source at build time and never
evaluates a template literal, so ``className={`left-[${percent}%]`}`` produces no CSS.
Colour, border, font, spacing, hover, and dark mode are utility classes. `left`, `width`,
and `transform` are inline `style`, computed per row from `WaterfallBar`. That is exactly
three inline style properties in the whole UI, and it is an acceptance number in Phase 6.

The bought table (§4.1) has to survive that rule. Any candidate whose cells are canvas or
shadow DOM cannot be reached by a utility class, which is a constraint violation rather
than a preference.

---

## 8. The serializable boundary

### 8.1 The contract, in one sentence and one test

**`Frame` is closed under `structuredClone` and under `JSON.stringify`/`JSON.parse`, and
`TraceRecord` is the only thing that ever crosses.**

Two codecs, because both are needed and they fail differently: `structuredClone` for
`BroadcastChannel` and `postMessage`, JSON for NDJSON export and the dev-server WebSocket.
JSON is stricter, so the header is written to survive JSON and `structuredClone` then holds
trivially. That is why `ProjectedValue` has explicit `undefined` and `bigint` arms instead
of carrying the native values.

```ts
test("every Frame survives both codecs", () => {
  const frame = recordEverything()   // one span of every kind and both roles, one event of
                                     // every SpanEventKind, a marker, a session, and a value
                                     // fixture with a WeakRef, a Proxy, a class instance, a
                                     // DOM node, a function, a Symbol, a BigInt, a cycle, a
                                     // 10k-char string, a 5,000-element array, an Error.
  expect(structuredClone(frame)).toEqual(frame)
  expect(JSON.parse(JSON.stringify(frame))).toEqual(frame)
})
```

`toEqual` against the original is the point: a round trip that merely does not throw is not
a round trip. `structuredClone` on a `WeakRef` throws `DataCloneError`, so a leak fails
loudly here rather than quietly at the transport.

### 8.2 How the unserializable things cross

| Runtime value | `ProjectedValue` | UI shows |
|---|---|---|
| `WeakRef<Function>` | `opaque`, typeName `WeakRef` | a `WeakRef` chip, no deref |
| a live `Proxy` | `opaque`, typeName from the target's constructor | the target's type name. A Proxy is transparent to `typeof`, `Array.isArray`, and `instanceof`, so it classifies as whatever it wraps and its traps are never invoked beyond the ones the projector already runs |
| `Function` | `callable` with name and arity | `fn foo(2 args)` |
| a class instance | `opaque` with `ctor.name` | `Subscription { }` |
| a DOM node | `opaque`, typeName `HTMLDivElement` | the tag summary |
| `Map` / `Set` / `Promise` / `Observable` | `opaque` with a size hint where cheap | the type name |
| a cyclic object | `elided`, reason `cycle`, at the back edge | `↺ cycle` |
| an `Error` | `failure` with name, message, stack | the message, stack collapsed |

Two rules make this safe rather than merely typed. **The projector never calls a user
getter it does not have to**: own-enumerable keys on a plain record do invoke getters and
that is accepted, because refusing makes the Value tab useless, but the `opaque` arm reads
only `constructor.name` and a short summary, both inside `try`, and never enumerates.
**`WeakRef` never crosses**, so the prior plan's whole hazard about `deref()` returning
`undefined` between an index read and a render is gone by construction: the UI holds no
live references at all.

### 8.3 The cap

| Knob | Default | Bounds |
|---|---|---|
| `maxDepth` | 3 | recursion depth |
| `maxArrayItems` | 16 | fan-out per array level |
| `maxRecordKeys` | 24 | fan-out per record level |
| `maxTextLength` | 256 | chars retained per string |
| `maxNodesPerValue` | **128** | the hard ceiling. Every other knob is advisory |

Worked bound, both halves, because the first alone reads as safe and is not. Without
`maxNodesPerValue` the shape bound is `24³ = 13,824` nodes for a three-deep record of 24
keys. With it, one emission costs at most 128 allocations and at most `128 × 256 = 32 kB`
of retained string. At 10,000 emissions/second against a ring of 8,192, worst-case ring
residency would be `8,192 × 32 kB = 256 MB`, which is too much, so the second bound is that
`drain` nulls its slots every frame and the drain runs at 60 Hz, capping live residency at
`min(capacity, rate/60)` records: 167 records, roughly 5 MB, at that rate.

| Preset | depth | items | keys | text | nodes |
|---|---|---|---|---|---|
| Structure only | 0 | 0 | 0 | 0 | 1 |
| Normal (default) | 3 | 16 | 24 | 256 | 128 |
| Deep | 6 | 64 | 64 | 2048 | 512 |

Deep is a debugging posture, not a default, and the status bar names the live preset.

### 8.4 Ordering and holes across a transport

1. **`Frame.seq` is monotonic per sink.** `apply` refuses `seq <= lastAppliedSeq` and counts
   it, so a WebSocket reconnect that replays is harmless.
2. **Records within a frame are in push order**, which is `LogicalTime` order, because the
   clock increments inside the recorder before the push. The index never sorts within a
   frame.
3. **A gap in `seq`, or a nonzero `droppedBefore` delta, is a hole.** The index does not
   repair it. It surfaces `orphanRecords` and the affected rows draw a hole glyph.
   Fabricating a `span-open` for an event whose span never arrived would put a row on
   screen that never existed in the program.

### 8.5 What the Rust target adds

json-rx emits Rust (`6_codegen/5_rust.ts`, `6_codegen/6_reactiveState.ts` over
`futures_signals` and `serde`). If a Rust process is ever to feed this panel, the wire has
to be describable by `serde`. It already is, and the constraints that make it so are worth
naming so they are not broken casually:

| Constraint | Why | Serde shape |
|---|---|---|
| Every union carries an explicit string tag | `TraceRecord.record`, `ProjectedValue.kind`, `SpanOrigin.originKind` | `#[serde(tag = "...")]` |
| No field is ever `undefined` on the wire; absent means `null` | JSON drops `undefined` silently and the round-trip test would catch it as an inequality | `Option<T>` with `skip_serializing_if` |
| No `Map`, `Set`, or `Date` crosses | they appear only in the index, which is consumer-side | n/a |
| Field names are camelCase and stable | | `#[serde(rename_all = "camelCase")]` |

**Deliverable, Phase 1: `packages/debug-core/trace-record.schema.json`**, a hand-written
JSON Schema for `TraceRecord`, plus one test that validates every fixture frame against it
with `ajv` as a devDependency. Zero runtime dependencies added. That file is what a Rust
crate generates from later, and it is what makes "no schema change later" checkable rather
than asserted.

Rejected alternative, recorded: declare the record types in TypeSpec and generate both TS
and Rust, which is the toolchain json-rx already runs. It inverts the dependency direction,
making the zero-dependency core depend on json-rx's compiler to build. Revisit only if a
second Rust emitter appears.

---

## 9. sprefa

Cut. The prior plan's §9, a 280-line integration of `~/projects/sprefa/v6/dl` and
`sprefa-store/js`, is not scheduled and no part of it is planned here. The debugging
backbone is not proven yet, and wiring a consumer before it is proven hides the defects the
consumer would have found.

The one thing worth keeping in view: sprefa's stated future compile target is json-rx, so
the work that would make sprefa debuggable is §3, not a sprefa-specific adapter. A dl tick
compiled to a json-rx document gets rows for free through `ProgramOrigin`. Whether that
holds is unproven and is not a commitment.

---

## 10. Testing: golden fixtures, and the phases

### 10.1 The testing law

It works against a real input Vite project or it does not. No spread of unit and
integration tests. Concretely:

- **The primary suite is `@playwright/test` driving real fixture Vite projects.** Each
  fixture is its own directory with its own `index.html`, `main.ts`, and `vite.config.ts`
  that installs `@hafley66/rxjs-debugger` exactly the way a user would. Playwright's
  `webServer` starts it. The test drives the app and captures goldens.
- **`packages/debug-core` gets exactly six unit rails and no more**, listed in Phase 1.
  Core is a pure library with no page to run, and each of the six maps to a named defect in
  this document. Six is the number; adding a seventh needs a named defect.
- Everything else that would have been a unit test is a golden artifact instead.

### 10.2 Determinism, which is what makes goldens usable

A live waterfall is wall-clock dependent, so an unnormalized golden is a flaky golden.
Five rules, all enforced by the harness rather than by discipline:

| Source of nondeterminism | Rule |
|---|---|
| Wall time | Fixtures never use real timers. The harness stubs the recorder's clock through `setNow` (`0_store.ts:8-134`, moving to `debug-rxjs/src/1_tracker.ts`), and the fixture app exposes `window.__fixture__.step(millis)` |
| Emission timing | The test drives every emission through `window.__fixture__.emit(...)`. No `interval`, no `setTimeout`, no network |
| Span ids | The NDJSON normalizer rewrites ids to `s1, s2, ...` in first-appearance order and event ids to `s1#0` form. Logical times are already integers from `LogicalClock` and are kept as-is |
| Waterfall bar widths | The panel reads a pinned `FilterQuery.window` from a URL parameter, so bar geometry does not depend on when the screenshot was taken |
| File paths in `FileOrigin` | rewritten relative to the fixture root |

Golden artifacts per fixture, all committed:

- `events.ndjson`: the normalized `TraceRecord` stream, one record per line, compared with
  `toMatchSnapshot('events.ndjson')`. This is the artifact that catches a schema change.
- `rows.json`: the `RowView[]` the panel rendered, with waterfall fractions rounded to
  three decimals.
- `panel.png`: `toHaveScreenshot()` with `maxDiffPixelRatio: 0.01`.

`events.ndjson` is the one that matters most, and it is the one that would have caught the
`SourceOrigin` problem in §3.4 on the day json-rx was wired up rather than three months
later.

### 10.3 The fixtures

Location: `packages/devtool-plugin/fixtures/<n>_<name>/`.

| # | Fixture | Contents | Goldens | Proves |
|---|---|---|---|---|
| 0 | `0_smoke` | an `index.html` and a `main.ts` that logs one line. The plugin is installed and transforms nothing interesting | none. Asserts the page loads and the runner exits | that Playwright, the fixture layout, and the `webServer` block work at all, before anything depends on them. Lands in Phase 0 |
| 1 | `1_kitchen-sink` | the existing `__tests__/hmr-integration/fixture-kitchen-sink/main.ts`, moved and kept: `BehaviorSubject`, `Subject`, a cold `Observable`, `of`/`from`/`defer`, a `map`+`filter` pipe, `switchMap`, `share`, `merge`, `combineLatest`. Every emission driven from the test | all three | **§2.1's ruling as an executable assertion**: the `share()`d source subscribed twice produces two spans, not one. Also the full kind and event vocabulary in one file |
| 2 | `2_lifecycles` | four subscriptions: one that completes, one that errors, one unsubscribed before completing, one still open at capture time | all three | the four `SpanStatus` values, the open-ended bar, and that a teardown without complete or error reads as `cancelled` rather than `completed` |
| 3 | `3_hmr` | the existing `__tests__/hmr-integration/fixture/` app plus the source edit the current integration test performs | `events.ndjson` before and after the swap, plus one assertion that is not a golden: `globalThis.__hafley_debug_recorder__` is identical across the swap | the §6.11 recorder pin, and `Preserve log` behaviour across a session boundary |
| 4 | `4_self-instrumentation` | an app that imports the debug panel **into its own instrumented `src/`**, which is what an embedder does | `events.ndjson`, plus assertions that `recorder.stats.reentrantDrops` is nonzero and bounded, the record count is constant across ten frames rather than growing, and zero `console.log` lines are emitted by the tracker | **§2.3.** The only rail that catches the loop closing. Not a screenshot |
| 5 | `5_json-rx` | a real `automation.v2` document compiled with `compileAutomationV2`, one host source, one `map` node with three jsonata fields (one of which resolves to `undefined`), one `scan`, one `shareReplay`, two outputs on one flow | all three | **§3.** Every span carries a populated `ProgramOrigin`; the `map` node has `role: "phase"` children with real durations; the `undefined` field is a `skip` event; two outputs on one flow produce two subscription chains. This is the fixture that fails if the schema needed a change |
| 6 | `6_volume` | a driver that pushes 100,000 emissions across 500 spans as fast as the harness allows | not a golden. A JSON of `{ spans, events, dropped, reentrantDrops, orphanRecords, medianFrameMillis }` asserted against ranges | the Phase 6 frame budget and the canvas-swap trigger. Ranges rather than exact values, because throughput is machine dependent |

One smoke plus five real fixtures plus one perf driver. Every phase after Phase 0 adds at
most one.

### 10.4 Phases

```
P0 ── P1 ──┬── P2 ── P3 ── P4 ── P5 ── P6 ── [P8]
           └── P7 (json-rx)  ‖ P3..P6
```

#### Phase 0: stabilize the baseline and stand up the harness

Owns: everything currently in `packages/devtool-plugin`.

§1.1 through §1.4 in order, then fixture 0 and `playwright.config.ts` with its `webServer`
block. Deletes `src/2_ui/0_DebuggerGrid.browser.test.tsx`. Fixes `2_diet_rxjs.ts` `reset()`
for real. Quarantines the rest with `// BASELINE-RED 2026-07-26`.

```bash
cd packages/devtool-plugin
pnpm --filter @hafley66/rxjs-ext build
pnpm typecheck                                      # exit 0
pnpm test:run                                       # exit 0
pnpm build && test -f dist/index.js                 # exit 0
grep -c "lightningcss\|magic-string" dist/index.js  # 0
timeout 60 pnpm test:browser                        # exit 0
pnpm test:e2e                                       # exit 0, fixture 0, under 60s
grep -rn "BASELINE-RED" src | wc -l                 # equals the CHANGELOG.md count
```

#### Phase 1: `@hafley66/debug-core`, greenfield

Owns: `packages/debug-core/**` only. Touches nothing that exists.

Lands `0_types.ts` from §6.1, then `1_clock.ts` through `7_waterfall.ts`, `transport/*`,
`trace-record.schema.json`, and the six rails.

```bash
cd packages/debug-core
pnpm typecheck && pnpm test                                              # exit 0
node -e "import('./dist/0_types.js')"                                    # resolves; the header has no runtime code
node -p "Object.keys(require('./package.json').dependencies||{}).length" # 0
grep -rn "from \"rxjs\"\|requestAnimationFrame\|document\." src/ | grep -v transport/1_broadcast  # 0 hits
```

The six rails, each against a named defect:

| Rail | Asserts |
|---|---|
| ring wraparound | 100,000 pushes into `RingSink(8192)`: `dropped === 91808`, `size === 8192`, `drain()` returns the last 8,192 in push order, heap growth under 5 MB |
| projection budget | a 5-deep object with 200-element arrays at each level projects to ≤128 nodes, contains at least one `elided`, leaves `Object.keys(input)` unchanged, completes under 1 ms |
| projection cycle | a self-referencing object yields `elided` with reason `cycle` and does not recurse |
| serializable boundary (§8.1) | `structuredClone` and JSON both `toEqual` the original, over a fixture containing a `WeakRef`, a `Proxy`, a class instance, a function, a Symbol, a BigInt, and a cycle. Plus `ajv` validation against `trace-record.schema.json` |
| re-entrancy (§2.3) | a sink that calls back into the recorder produces exactly 3 records and `reentrantDrops === 3` |
| index fold and compact | 10,000 `span-event` records through `apply()` under 50 ms; `compact()` on 100,000 spans evicts to `maxSpans`, never evicts an open span or one with children, and never puts a `role: "phase"` span in `rowOrder` |

#### Phase 2: `@hafley66/debug-rxjs`, additive

Owns: `packages/debug-rxjs/**` (new), and **adds to**
`packages/devtool-plugin/src/0_runtime/0_store.ts` without deleting from it.

Lands `traced()` and `SubscribeParentScope` (§6.9), moves `patchObservable`,
`decorateCreate`, `decorateOperatorFun`, and `DietObservable`, writes the
`ObservableEvent -> TraceRecord` adapter over `event$` (`0_store.ts:99`), lands the
`globalThis` recorder pin, and deletes the two hot-path `console.log` calls (§2.3). Nothing
is deleted from the old accumulator, so both run side by side and can be diffed.

Adds **fixture 1**, event stream only. No panel yet.

```bash
cd packages/debug-rxjs && pnpm typecheck && pnpm test    # exit 0
node -p "require('./package.json').peerDependencies.rxjs" # ^7.8.0 || ^8
cd ../devtool-plugin && pnpm test:e2e -g "kitchen sink"   # exit 0
```

Acceptance beyond the golden: the adapter produces the same span count as `RxJSTracker`'s
`state$.value.store.subscription` key count over the existing `01.patch-observable`
fixtures. That is the diff that proves the demotion is lossless before anything is deleted.

#### Phase 3: Vite 8 migration and the package boundary

Owns: all `package.json` files, `vite.config.ts`, `vitest.browser.config.ts`,
`0_rxjs_devtool_patch_plugin.ts`, `2_user_transform.ts`, `pnpm-lock.yaml`,
`playwright.config.ts`.

The prior live-visualizer plan's §7 is adopted whole, including the `minify: "esbuild"`
finding, the `rollupOptions` to `rolldownOptions` rename, and the `resolve.mainFields` risk
to the rxjs dist-path guards. On top: `devtool-plugin` sheds what moved, its default HMR
import specifier changes from `"@hafley66/rxjs-debugger/hmr"` to
`"@hafley66/debug-rxjs/hmr"` (`2_user_transform.ts:645`), and the `/2_ui`, `/lib`, and
whole-package exclusions land in `shouldTransformUserCode`.

```bash
pnpm -r typecheck && pnpm -r build                                     # exit 0
grep -rn "rolldown-vite" packages/ package.json | grep -v pnpm-lock    # 0 hits
grep -c "lightningcss" packages/devtool-plugin/dist/index.js           # 0
cd packages/devtool-plugin && pnpm test:run -t "own UI is never transformed"  # passes
pnpm test:e2e                                                          # fixtures 0 and 1 still green
```

Plus the one check that needs a human eye, carried over because the risk is real and
silent: run `pnpm dev`, load the page, confirm the recorder has spans and that no
`[rxjs-debugger] WARNING: Pattern did not match!` was logged. Vite 8 changed
`resolve.mainFields` handling and `0_rxjs_devtool_patch_plugin.ts:260-320` branches on
`cleanId.includes("/rxjs/dist/esm5/")`. If rxjs resolves elsewhere the patch silently stops
applying.

#### Phase 4: `@hafley66/debug-ui` shell

Owns: `packages/debug-ui/**` (new).

Tailwind v4 CSS-first with the §7.6 tokens, `@tanstack/react-table` +
`@tanstack/react-virtual`, `react-resizable-panels`, `@hafley66/signals`, the
`AnimationFrameDrain`, `panelState`, the toolbar, the filter bar with data-driven chips,
the row list without the waterfall column, and the status bar. Rows render, filter, sort,
and resize. The Waterfall cell renders a placeholder.

Adds the **fixture 1 panel screenshot and `rows.json`**.

```bash
cd packages/debug-ui
pnpm typecheck && pnpm build                                          # exit 0
grep -o -- "--color-status-open:[^;]*" dist/assets/*.css              # non-empty
grep -rn "Object.values(\|\.entries()\|\[\.\.\." src/ | grep -v 2_rows.ts   # 0 hits
grep -rn "signalDispatch" src/                                        # 0 hits (§2.3 rail)
grep -rn "from \"rxjs\"" src/ | grep -v 1_drain.ts                    # 0 hits outside the drain
grep -rLn "noRxjs()" src/**/*.tsx                                     # empty
grep -rn "\.subscribe(" src/                                          # 0 hits: the signal owns the only one
```

#### Phase 5: waterfall, detail pane, and the deletions

Owns: `packages/debug-ui/src/` waterfall and detail files, plus the deletions in
`devtool-plugin`.

Lands the waterfall column (§7.2, DOM stage 1), the six detail tabs, the overview strip
with its brush, and the marker lines. Adds **fixtures 2 and 3**. Then deletes, in this
order, each gated on the grep that proves nothing reads it:

| Delete | Gate |
|---|---|
| `src/0_runtime/0_store_v2.ts` + `0_store_v2.test.ts` | `grep -rn "0_store_v2" packages/*/src \| wc -l` = 0 |
| `RxJSTracker.events$`, `events$$` (`0_store.ts:100-104`) | `grep -rn "events\$\$\?" packages/*/src \| wc -l` = 0 |
| `RxJSTracker.state$$`, `lol` (`0_store.ts:137, 570`) | same for `state\$\$` |
| `src/0_runtime/06_queries.ts` | `grep -rn "06_queries" packages/*/src \| wc -l` = 0 |
| `src/0_runtime/0.types.d.ts`, including its line-55 `console.log` | `grep -rn "0\.types" packages/*/src \| wc -l` = 0 |
| `src/2_ui/0_DebuggerGrid.tsx`, `src/2_ui/1_MarbleDiagram.tsx` | replaced by `debug-ui` |
| the five remaining `RxJSTracker` name importers (§2.2) | `grep -rn "RxJSTracker" packages/*/src \| wc -l` = 1, the class declaration |

```bash
pnpm -r typecheck && pnpm -r test && pnpm test:e2e   # exit 0
git diff --stat                                      # net line count NEGATIVE
```

#### Phase 6: performance acceptance and the conditional canvas swap

Owns: `packages/debug-ui/src/` waterfall files, plus **fixtures 4 and 6**.

Fixture 4 is the self-instrumentation rail and is not optional; it is the executable form
of §2.3 and it is what catches an embedder closing the loop.

| Rows on screen | Total spans | Events/sec | Median frame |
|---|---|---|---|
| 200 | 10,000 | 1,000 | under 16 ms |
| 500 | 100,000 | 10,000 | under 16 ms |
| 500 | 100,000 | 10,000 | **if over 16 ms, swap to the single-canvas waterfall column** |

The swap sits behind the unchanged `WaterfallBar` type, so its acceptance is that the same
fixture passes and no file outside the waterfall directory changed. This phase also resolves
the `d3-array` question (§4.4) by measurement.

#### Phase 7: json-rx instrumentation, parallel with Phases 3 through 6

Owns: `packages/json-rx/src/{2_runtime.ts,9_v2_runtime.ts,0_types.ts,package.json}` and
**fixture 5**. Depends only on Phases 1 and 2, so it does not wait for the UI.

§3.9, in order. `@hafley66/debug-core` and `@hafley66/debug-rxjs` become optional peers; a
`recorder` option joins `trace` on the existing options object; the four insertion points
land; `programVersion` hashes `canonicalIr`.

```bash
cd packages/json-rx && pnpm typecheck && pnpm test && pnpm build   # exit 0
node -p "Object.keys(require('./package.json').dependencies).length"  # unchanged from today
cd ../devtool-plugin && pnpm test:e2e -g "json-rx"                 # exit 0
```

Acceptance is a data assertion over `events.ndjson`, not a screenshot:

1. every span carries `origin.originKind === "program"` with a non-empty `node`,
2. the set of `origin.node` values equals the set of node ids in the document, exactly,
3. the `map` node has one `role: "phase"` child per field per emission, each with a nonzero
   duration,
4. the field whose jsonata resolves to `undefined` produces a `skip` event and no output key,
5. two outputs naming one flow produce two subscription chains, which is §2.1 restated for
   json-rx,
6. `recorder.stats.orphanDrops === 0` and `sink.stats.dropped === 0`.

Second acceptance: run the same document with no recorder and assert the emitted values are
byte-identical to the pre-change baseline. Instrumentation that changes results is not
instrumentation.

#### Phase 8: interop exports. Not scheduled.

`transport/3_chrome_trace.ts` (Chrome Trace Event Format, so a trace opens in
`ui.perfetto.dev`), `transport/4_user_timing.ts` (`PerformanceMarkSink`, opt-in, never on by
default because the global performance buffer is finite), and
`debug-rxjs/src/5_trace_function.ts` (`traceFunction`, the salvage of v2's
`decoratoPatronus`). Deliberately last, and deliberately without a date.

### 10.5 Ownership matrix for concurrent execution

| Phase | Exclusive ownership |
|---|---|
| P0 | `packages/devtool-plugin/**` |
| P1 | `packages/debug-core/**` |
| P2 | `packages/debug-rxjs/**`, plus additions only to `devtool-plugin/src/0_runtime/0_store.ts` |
| P3 | every `package.json`, `vite.config.ts`, `vitest.browser.config.ts`, `playwright.config.ts`, `0_rxjs_devtool_patch_plugin.ts`, `2_user_transform.ts`, `pnpm-lock.yaml` |
| P4, P5, P6 | `packages/debug-ui/**`, the P5 deletion list, fixtures 2, 3, 4, 6 |
| P7 | `packages/json-rx/**` and fixture 5 |
| P8 | three named new files |

P3 and P7 share no file. P4 and P7 share no file. P3 owns `pnpm-lock.yaml` alone; P4's and
P7's dependency additions rebase onto it.

---

## 11. What I could not verify

Everything here is a claim not being stood behind. Check it before depending on it.

### Facts that could not be retrieved

1. **`d3-array`'s standalone version, size, and dependency list.** Two research passes have
   now failed to isolate it, and it is the only module §4.4 wants (`ticks`,
   `tickIncrement`). The verdict names it with a stated fallback for exactly this reason.
2. **`ws@8.21.1`'s figures were carried from the prior plan and not re-verified**, because
   §4.6 defers `ws` entirely. Re-verify before adopting it.
3. **`@revolist/revogrid`'s bundled TypeScript types**, and whether its Stencil component
   uses shadow DOM or light DOM. The Tailwind argument against it assumes shadow DOM, which
   is the Stencil default but was not confirmed for this component. The download count
   disqualifies it independently.
4. **`@glideapps/glide-data-grid`'s peer range.** The registry manifest and the repository
   `package.json` disagree about React 19 support. It is disqualified on canvas rendering
   and DIY sort/filter regardless.
5. **`@silevis/reactgrid`'s column-resize gating.** Its docs page says Pro-only and its
   pricing page says free. Unresolved, and it does not need resolving because sort and
   filter are absent by design.
6. **`gridjs`'s publish date.** The registry `modified` timestamp predates 6.2.0's likely
   release, so the date in §4.1 is approximate.
7. **`datatables.net`'s licence before 3.0.0.** Only the current version was confirmed MIT.
8. **`@ungap/structured-clone`'s README** was not re-read this pass; only registry metadata.
9. **Playwright's `toMatchAriaSnapshot`.** Not found on the SnapshotAssertions or
   GenericAssertions reference pages fetched. Presence unknown. Nothing in §10 depends on it.
10. **OpenTelemetry `startSpan()` throughput.** No published number found; the official
    benchmarks page is a live chart fed by an external `data.js` that could not be resolved.
    §4.8 does not rest on it, but if per-span overhead ever becomes the deciding argument it
    needs a local microbenchmark.
11. **The default mark/measure cap in the global performance timeline.** The 250-entry
    figure is confirmed for the resource-timing buffer specifically. A general cap could not
    be confirmed. §4.8 and Phase 8 treat the buffer as finite without asserting a number.

### Claims resting on reading rather than running

12. **The json-rx edit is "under 90 lines."** Estimated from reading `9_v2_runtime.ts` and
    `2_runtime.ts`, not from writing the patch. `compileExpression` has six branches with
    six separate `return` statements, and collecting them into one exit point is a refactor
    of its own before the wrap is a single call.
13. **`traced()` produces one span per subscription for a `share()`d source.** This follows
    from `traced` being an operator in the pipe and `share`'s multicast being upstream of
    it, but it depends on where in the chain `traced` sits, and above a `share()` it gives
    one span for all subscribers. Fixture 1 exists to pin this down, and the answer may
    require documenting both placements rather than one rule.
14. **`SubscribeParentScope`'s synchronous stack is correct for RxJS's subscribe cascade.**
    This rests on RxJS 7 building the chain synchronously bottom-up inside `subscribe()`,
    and on `mergeMap`/`switchMap` creating inner subscriptions synchronously inside the
    outer `next`. Both are believed true and neither was proven by a test. §6.9 names the two
    cases where it is wrong. Fixture 1 should assert the parent chain explicitly.
15. **`@hafley66/signals`'s `Signal(observable$, default)` refCount behaviour.** Read from
    `1_SignalCreator.ts:57-64`, which merges the source into the state subject under
    `shareReplay({ refCount: true })`. The consequence stated in §6.7, that nothing drains
    while nothing reads `indexVersion`, follows from that read and was not exercised.
16. **The claim that signals' internal observables are never traced.** It rests on
    `patchedSubscribe`'s gate at `0_store.ts:876-880` requiring both an observable id and a
    matching entry in the accumulator's `observable` table, and on ids being minted only by
    `decorateCreate` and the source transform, neither of which touches `node_modules`. If a
    fourth id-minting path exists, this is wrong and §2.3's analysis changes. Fixture 4 is
    the check.
17. **The two 3,769-line `01.patch-observable.test.ts` files were not diffed.** Identical
    line counts and identical byte sizes. Phase 0 fix 3 assumes one is a stale copy; they may
    genuinely differ.
18. **`packages/json-rx` is absent from the root `tsconfig.json` references** while the
    other four are present. Not investigated. It may be deliberate or it may be why
    `pnpm -r typecheck` behaves inconsistently.
19. **Whether Vite's `hot.send`/`hot.on` channel survives a full page reload and a dev-server
    restart cleanly enough to carry a frame stream.** The docs say `hot.send` buffers before
    the connection opens. Throughput at 60 frames/second over that channel was not measured
    and §4.6's verdict depends on it holding.

### Design claims that are judgement, not fact

20. **"Row = subscription" is defended, not proven.** §2.1 argues from the Network tab's
    affordances and from `0.types.d.ts:84`'s own comment, and §3 tests it against a second
    execution model, which is the strongest evidence available short of using the thing.
    An application whose subscriptions are all sub-millisecond will find the waterfall
    useless; the mitigation is Chromium's mitigation for the same problem and may not be
    enough. The fallback is a second row mode grouping by observable, not making emissions
    rows.
21. **`SpanRole` earns its field.** §3.3 argues it from four consumers. The cheaper
    alternative, putting a duration on `SpanEvent`, was rejected because a point event with
    a duration is a lie about the model and cannot nest. That is a judgement.
22. **The retention defaults** (`ring 8192`, `maxSpans`, `maxEventsPerSpan`,
    `maxPhaseSpansPerSpan: 64`, `minDeadAgeMillis`) are sized to a 60 Hz frame budget by
    reasoning rather than measurement. They want Phase 6, not a vote.
23. **The `@tanstack/react-table` split of concerns**, where core owns filtering and
    react-table owns column geometry and sorting, is a design claim. If the glue between
    `RowProjection.build` and `getSortedRowModel` grows past roughly 150 lines, the
    conclusion should be revisited toward letting react-table own sorting entirely or
    toward `ag-grid-community` with the Tailwind law relaxed.
24. **The claim that Playwright is required over Vitest browser mode** rests on Vitest
    browser mode owning its own Vite server and config, so a fixture's own `vite.config.ts`
    never runs. That is how it works to the best of my reading and it was not tested by
    trying to point Vitest browser mode at an external fixture project.
