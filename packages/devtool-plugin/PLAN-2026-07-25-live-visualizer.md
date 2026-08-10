# PLAN 2026-07-25 — live RxJS visualizer

Scope: `packages/devtool-plugin` (`@hafley/rxjs-debugger` 0.1.0).
Fixed constraints: **Tailwind**, **live** view, **Vite 8** (Rolldown-backed).
Status: planning arc. No implementation in this document.

---

## 0. Baseline, measured 2026-07-25 before any change

All three commands are RED. Every milestone below is planned on top of a broken
baseline, and the first milestone exists to fix it.

### `pnpm typecheck` (`tsc --noEmit`) — exit 2, 30 errors

| File | Line | Code | Gist |
|---|---|---|---|
| `src/0_runtime/06_queries.ts` | 22 | TS7053 | symbol index on `Observable<any>` |
| `src/0_runtime/0_store.ts` | 743 | TS6196 | `ArgEntity2` unused |
| `src/0_runtime_hmr/4_module-scope.ts` | 53, 74 | TS6133 | `$`, `fullKey` unused |
| `src/0_runtime_hmr/4_module-scope.ts` | 60, 66 | TS7053 | `___rxjs_hmr_key___` symbol index on `{}` |
| `src/0_runtime_hmr/4_module-scope.ts` | 64 | TS2554 | expected 1 arg, got 0 |
| `src/1_runtime_vite_plugin/0_rxjs_devtool_patch_plugin.ts` | 199 | TS6133 | `env` unused |
| `src/1_runtime_vite_plugin/2_user_transform.ts` | 21 | TS6133 | `compact` unused |
| `.../fixture-kitchen-sink/main.ts` | 88-97 | TS18048 | 10x possibly-undefined on `window.__kitchen_sink__.values.*` |
| `src/2_ui/0_DebuggerGrid.browser.test.tsx` | 7, 8, 9 | TS2307 | imports `../0.types`, `../0_test-utils`, `../01_helpers` — **all three paths do not exist** |
| `src/2_ui/0_DebuggerGrid.tsx` | 126 | TS7053 | `___rxjs_hmr_key___` symbol index |
| `src/app.tsx` | 1 | TS7016 | no types for `@hafley/rxjs-ext` |
| `src/app.tsx` | 73, 133, 135 | TS6133 | `searchTerm$2`, `it`, `bb` unused |
| `src/app.tsx` | 139 | TS2322 | `unknown` not `ReactNode` |
| `src/app.tsx` | 218, 225, 227 | TS2339 | `window.____root` undeclared |
| `src/lib/2_diet_rxjs.ts` | 57 | TS2394 | `pipe` overload incompatible with implementation |

### `pnpm test:run` (`vitest run`) — exit 1

```
Snapshots   6 failed
Test Files  12 failed | 2 passed (14)
Tests        9 failed | 84 passed | 2 skipped (95)
Duration    16.10s
```

Three named failures:

1. `src/lib/2_diet_rxjs.test.ts:236` — `EasierDietBS > reset uses a safe clone, not shared reference`.
   Got `{items:[1,2,3,4]}`, expected `{items:[1,2,3]}`. `reset()` re-emits
   `this.initialValue`, which was itself mutated. `safeInitialClone` (line 380) is
   computed and never read.
2. `src/1_runtime_vite_plugin/__tests__/user-transform.test.ts:241` — inline snapshot
   mismatch. The hoisted `function makeObs() { return __fn$0.apply(...) }` shim now
   emits **before** the `const __fn$0 = ...` binding instead of after, and a `;` was
   added. Statement-ordering change in the transform.
3. `.../hmr-integration/hmr.integration.test.ts:154` — `HMR swap: updates initial value
   and new emissions work` times out at 10000ms.

### `pnpm build` (`vite build`) — exit 1

```
✓ 168 modules transformed.
✗ Build failed in 352ms
[UNRESOLVED_IMPORT] Could not resolve '../pkg' in
  ../../node_modules/.pnpm/lightningcss@1.30.2/node_modules/lightningcss/node/index.js
```

Root cause, from reading `vite.config.ts` + `src/index.ts`:
`src/index.ts` is one line, `export * from "./1_runtime_vite_plugin/1_rxjs_hmr_plugin"`.
That is a **Node-side Vite plugin**. `build.lib.entry` points at it with
`rollupOptions.external: []`, so Rolldown is asked to bundle the entire Node plugin
dependency tree (vite -> lightningcss -> a native `../pkg` require) into a browser ESM
lib. The lightningcss error is a symptom; the defect is `external: []` on a Node entry.

### `pnpm test:browser` — hangs

Playwright is installed and Chromium launches (the run reaches `Port 63315 is in use,
trying another one...`). No summary line is ever printed; killed at both 240s and 300s.
Also emits a hard version warning:

```
Loaded vitest@4.0.16 and @vitest/browser@4.0.17.
Running mixed versions is not supported and may lead into bugs
```

`src/2_ui/0_DebuggerGrid.browser.test.tsx` is 921 lines and imports three modules that
do not exist (TS2307 above), so it cannot be the thing that hangs; it cannot even load.

---

## 1. Corrections to the receipts I was handed

| Claim in the brief | What the repo says |
|---|---|
| "what happens to the existing d3 usage in `1_MarbleDiagram.tsx`" | **There is no d3 usage anywhere in `src/`.** `grep -rn "from \"d3\|from 'd3\|d3-" src/` returns zero hits. `d3 ^7.9.0` and `@types/d3 ^7.4.3` are declared in `package.json` and never imported. `1_MarbleDiagram.tsx` is pure React with inline `style` and percentage arithmetic (lines 76-78, 141). The Tailwind question is therefore "what replaces inline `style`", not "what replaces d3". |
| "chat_log ~30 sessions, 2025-12-26 through 2026-01-02" | 56 entries, **2024-12-27 through 2026-02-22**. The newest is `2026-02-22.0.v2-decorator-refactor.md`, which is the governing plan for `0_store_v2.ts`. `chat_log/LATEST.md` is stale: it names `2026-01-13.0.vite-plugin-move-fix.md`. |
| "`src/0_runtime/0_store_v2.ts` holds the store the UI reads" | The UI reads the **older** store. `0_DebuggerGrid.tsx:5` and `1_MarbleDiagram.tsx:1` both import `main` from `../0_runtime/0_store` (`RxJSTracker`, 1030 lines). `0_store_v2.ts` (`Tracer`, 280 lines) has **zero importers outside its own test**. There are two live stores with different schemas. |
| "`Tracer.argRipper` around line 205-247" | Correct: `argRipper` is `0_store_v2.ts:205-247`. `setPath` is 249-251. |
| "37 `.ts`/`.tsx` files under `src`" | 47 files under `src` by `find`, 28 of them `.ts`/`.tsx` non-test. Total 16,730 lines across the non-`__tests__` tree. |
| localforage / uuid are dependencies | Both declared, **neither imported anywhere in `src/`**. Dead deps alongside d3. |
| `package.json` `exports["./hmr"]` | Points at `./src/tracking/v2/hmr/4_module-scope.ts`. **That path does not exist.** The file is `src/0_runtime_hmr/4_module-scope.ts`. The default `hmrImport` in `2_user_transform.ts:645` is `"@hafley/rxjs-debugger/hmr"`, so any consumer outside this repo resolves to nothing. `scripts.dev:test` points at `src/ui/__tests__/browser/vite.config.ts`, also nonexistent. |
| "the `overrides` removal touches the workspace" | Confirmed and larger than stated. Five files: root `package.json` (alias + a `rolldown-vite` entry in `dependencies`), `packages/devtool-plugin/package.json` (`overrides` + devDep), and `"vite": "^7.3.0"` in `json-rx`, `rxjs-ext`, `rxjsx`, `signals`. Plus two source imports (`vite.config.ts`, `0_rxjs_devtool_patch_plugin.ts:14`). |

### One defect the brief did not have

**The debugger UI instruments itself.** `shouldTransformUserCode`
(`2_user_transform.ts:615-638`) excludes `/0_runtime`, `/0_runtime_hmr`,
`/1_runtime_vite_plugin`, and `node_modules`. It does **not** exclude `/2_ui` or
`/lib`, and neither `0_DebuggerGrid.tsx` nor `1_MarbleDiagram.tsx` carries the
`// noRxjs()` marker that `transformUserCode:647` honours. Only three files carry it:
`0_store.ts:5`, `2_diet_rxjs.ts:7`, `4_module-scope.ts:12`.

Consequence once the visualizer subscribes to a live stream: any observable the UI
creates is traced, that trace produces events, those events re-render the UI, which
creates observables. The `DietSubject` layer exists specifically to avoid this loop at
the store level and the loop is left open at the view level. Fix is one regex token,
scheduled in M1.

---

## 2. Explicit non-goals for this arc

| Item | In / out | Why |
|---|---|---|
| **node_modules parsing** ("do i just de-op and parse all node modules??") | **OUT** | Already superseded by a decision on record. `chat_log/2026-02-22.0.v2-decorator-refactor.md` Phase 2 (T5/T6) replaces source patching of rxjs with a **virtual module** (`resolveId` `rxjs` -> `\0rxjs`, `load` emits a wrapper that re-exports `decoratoPatronus(_orig.X)`). That plan has its own table of reasons and is unstarted. A live visualizer needs a working event source, and the existing regex patch path in `0_rxjs_devtool_patch_plugin.ts:255-320` already produces one. Do not reopen. |
| **HMR module swap** ("did keys change then prop, else swap is fine") | **OUT** | It is a correctness feature of the instrumentation layer with no view surface. The visualizer must **survive** HMR (see §5 lifetimes: the Tracer pins to `import.meta.hot.data`) and must not **implement** it. `hmr.integration.test.ts` is already red at baseline and stays red; M1 quarantines it rather than fixing it. |
| Chrome DevTools extension panel | OUT of this arc, designed for | §4 transport keeps the frame boundary serializable so a panel is a later adapter, not a rewrite. |
| Merging `0_store.ts` (v1) and `0_store_v2.ts` (v2) | OUT | Two schemas, 1310 lines combined, one governing plan already written for v2 with 6 of 10 tickets open. The visualizer targets **v1** (`RxJSTracker`), because that is the store with subscription and send entities, which is what a marble diagram needs. v2 has `fun`/`call`/`arg` only and no `send`. See §6. |
| `@hafley/rxjs-ext` / `@hafley66/signals` integration | OUT | Both depend on real rxjs. See §3.5. |
| `~/projects/sprefa/v6/dl` as a consumer | OUT, one line of relevance: it is a Node RxJS consumer with no bundler, so it argues for keeping `src/0_runtime/**` free of DOM and bundler imports. Treat that as a constraint on where code lands, and plan no integration. |

---

## 3. Build-vs-buy

Every recommendation below is preceded by the candidate table. Version, publish date,
license, and size figures are from `npm view` and the npm downloads API on 2026-07-25,
or from the local spike in §3.6.

### 3.1 Event transport

| Candidate | Carries `WeakRef` / live proxies? | Latency | Cross-tab | New deps | Cost to build |
|---|---|---|---|---|---|
| Same-page direct subscription (`DietSubject.subscribe`) | **Yes** | zero, synchronous | no | zero | zero, `2_diet_rxjs.ts` already does it |
| `BroadcastChannel` | No. Structured clone throws `DataCloneError` on functions; `WeakRef` is not cloneable | sub-ms, async | yes, same-origin + same storage partition | zero (Baseline since 2022-03) | small adapter |
| `import.meta.hot.send` / `hot.on` + `server.ws.send` | No, JSON over the dev websocket | ms, async, dev-only | via the server | zero | small adapter, but couples the view to `pnpm dev` |
| `postMessage` / `MessageChannel` | No, structured clone | sub-ms | iframe / worker only | zero | medium (port handshake) |
| Chrome DevTools panel (`chrome.devtools.panels.create`) | No | ms, 3 hops | n/a | manifest + build target | large: 3 execution contexts (devtools page, service worker, panel), message glue at each hop, separate release channel |
| `SharedArrayBuffer` + `Atomics` ring | No, only numbers/bytes | lowest possible | worker only | zero, but requires COOP `same-origin` + COEP `require-corp` | large, and COEP breaks the plain Vite dev server (vitejs/vite#16536) |

**Recommendation: same-page direct subscription, behind a serializable `Frame`
boundary.**

One-sentence reason: the Tracer's records hold `WeakRef<Function>` and live `Proxy`
objects (`0_store_v2.ts:8, 24, 132, 235`; `0.types.d.ts:67, 92, 103`) and no
structured-clone transport can carry those, so any out-of-page transport forces a
projection step first, and once that projection exists the in-page transport is free
while the others are an adapter behind it.

Design consequence, and this is the whole point: **the projection that makes the value
transportable is the same projection that caps `argRipper`.** One seam, two jobs.
Ship it in-page first, and `BroadcastChannel` becomes ~40 lines later. The DevTools
panel is deliberately deferred because rxjs-insights already built one (see 3.4) and
the gap in the landscape is the in-page overlay.

Rejected explicitly:
- `import.meta.hot` — makes the visualizer a dev-server feature. The Tracer must work
  in a `vitest run` browser test and in a production-profile page. `hot` is `undefined`
  in both.
- DevTools panel as the *primary* — three contexts and a separate release channel, to
  buy cross-page inspection that nobody has asked for yet.
- SAB — COEP `require-corp` blocks every cross-origin resource lacking CORP, which
  breaks the demo harness in `src/app.tsx` and the dev server both.

### 3.2 Ring buffer / bounded queue

| Package | Version | Last publish | License | ESM | Verdict |
|---|---|---|---|---|---|
| `mnemonist` (`CircularBuffer`) | 0.40.4 | 2026-04-30 | MIT | root import only | **Only maintained candidate.** Measured below. |
| `denque` | 2.1.0 | 2023-11-14 | Apache-2.0 | no `exports` field at all | deque, not a fixed ring; 20 months stale |
| `ringbufferjs` | 2.0.0 | 2022-06-26 | MIT | CJS | 4 years stale |
| `ring-buffer-ts` | 1.2.0 | 2022-12-14 | MIT | yes | 3.5 years stale |
| `@thi.ng/ringbuffer` | — | — | — | — | **does not exist on npm** |

Measured locally under Vite 8.1.5 + Rolldown, entry importing only `CircularBuffer`:

```
✓ 54 modules transformed.
dist-shake/e.js  10.28 kB │ gzip: 2.81 kB
```

Two findings worth recording. The deep subpath is **CJS-only**: `mnemonist`'s
`exports["./*"]` declares `require` and `types` with **no `import` condition**, so
`import CB from "mnemonist/circular-buffer"` throws `ERR_PACKAGE_PATH_NOT_EXPORTED`
under native ESM. The root import (`import { CircularBuffer } from "mnemonist"`)
resolves to `index.mjs` and tree-shakes to 2.81 kB gzip.

**Recommendation: buy `mnemonist`, root import, and wrap it.** 2.81 kB for a
maintained, tested wrap-arithmetic implementation is a fair price, and the CJS subpath
trap is documented above so nobody deep-imports it. The wrapper (`RingSink`, §5.2) owns
sequence numbering, drop accounting, and drain-to-`Frame`, which is domain logic rather
than a data structure.

### 3.3 Marble / timeline rendering

| Candidate | Version | Publish | License | Gzip | Lane model? | Live append? |
|---|---|---|---|---|---|---|
| DOM + inline `style` (status quo) | n/a | n/a | n/a | 0 | native (flex rows) | yes, React reconcile |
| Hand-rolled canvas 2D | n/a | n/a | n/a | 0 | you write it | yes |
| uPlot | 1.6.32 | 2025-03-14 | MIT | ~21.9 kB | no, series | yes, built for it |
| lightweight-charts | 5.2.0 | 2026-04-24 | Apache-2.0 | ~61 kB | no, one series per chart | yes, `update()` tick API |
| ECharts (custom series) | 6.1.0 | 2026-05-19 | Apache-2.0 | ~368 kB tree-shakable | yes, via `custom` series | yes, `appendData` |
| visx | 4.0.0 | 2026-06-11 | MIT | modular | yes, you compose | SVG node count is the ceiling |
| PixiJS | 8.19.0 | 2026-07-13 | MIT | ~251 kB | you write it | yes, batched sprites |
| Observable Plot | 0.6.17 | 2026-04-06 | ISC | — | recompute-all model | poor fit |
| Recharts | 3.10.1 | 2026-07-25 | MIT | ~147 kB | no | re-renders whole tree |
| plotly.js | 3.7.0 | 2026-07-21 | MIT | ~1.39 MB | no | oversized |
| dygraphs | 2.2.1 | 2023-02-16 | MIT | — | no | 3.4 years stale, no React bindings |
| `swirly` | 0.21.0 | 2022-07-03 | — | — | marble-native | **static only**: spec text -> SVG, an authoring tool |
| `rxjs-marbles` | 7.0.1 | 2022-06-26 | — | — | n/a | **name collision**: mocha/jasmine marble *testing* helpers, no rendering |
| `rxviz` (npm) | 0.0.0 | 2022-06-26 | — | — | n/a | stale placeholder package; rxviz.com is a live playground with no embeddable API |
| `marble-diagrams` | — | — | — | — | — | **does not exist on npm** |
| `@rxjs-insights/react` | — | — | — | — | — | **does not exist on npm** |

**Recommendation: two-stage, one interface.**

Stage 1 keeps **DOM + Tailwind + inline `style`** for the runtime-computed offsets. It
is what `1_MarbleDiagram.tsx` already does, it costs zero bytes, it is the only option
where Tailwind styles the glyphs directly, and a hard visible-marble cap (§5.4) keeps
node count bounded by construction rather than by hope.

Stage 2, when the cap bites (acceptance threshold in M6), swaps the marble surface to
**hand-rolled canvas 2D** behind an unchanged `MarbleSurface` prop type (§5.5), so the
swap is one file.

Reasoning for hand-rolled over buy at stage 2, stated rather than assumed: the domain
is four glyphs (`●` next, `|` complete, `✗` error, `⊗` unsubscribe, already enumerated
in `1_MarbleDiagram.tsx:156-157, 187-192`) on N horizontal lanes with a shared monotonic
x-axis. uPlot and lightweight-charts both model *series over a shared axis*, not *lanes
with independent lifespans*, so the lane structure has to be faked with one chart per
lane, which does not reach "hundreds of lanes". PixiJS is 251 kB of scene graph for a
scene with no scene graph. Every RxJS-specific marble package is either static, stale,
or nonexistent.

The one genuine buy option is **ECharts `custom` series**, which does express
lane + glyph + `appendData` directly. Record it as the escape hatch: if stage 2 canvas
exceeds ~300 lines or needs zoom/pan/brush, take ECharts and pay the 368 kB. Do not
reach for it before then.

### 3.4 Prior art (do not re-derive)

| Tool | Last npm | Last push | Stars | Architecture | Live view? |
|---|---|---|---|---|---|
| `rxjs-spy` (cartant) | 8.0.2, 2022-06-26 | 2023-04-18 | 705 | runtime hook on `Observable.prototype.subscribe`, source-side `tag()`, console REPL | no, console only |
| `rxjs-insights` (ksz-ksz) | 0.5.1, 2023-12-04 | 2024-06-12 | 365 | **build-time source instrumentation** (webpack/esbuild plugins) + Chrome/Firefox devtools panel | yes, streams to a panel |
| `rxjs-debugger` | 0.1.7, 2022-05-16 | — | — | monkey-patch `subscribe`, log | no |
| `rx-devtools` (KwintenP) | 0.0.1-alpha.54 | 2018-03-12 | 109 | **archived**: `spy()` operator + Chrome panel | dead |
| Angular DevTools | built-in | — | — | Chrome panel, component tree + CD profiler | no RxJS view at all |
| `@rxjs/devtools` | — | — | — | — | **does not exist on npm** |
| `observable-devtools` | — | — | — | — | **does not exist on npim** |

Two things to take from this. `rxjs-insights` independently arrived at build-time
source instrumentation, which is the same conclusion as this package's Vite transform,
so that bet is corroborated by the only serious competitor. And every one of them
either requires the user to annotate their source (`tag()`, `spy()`, `watch()`) or
ships as a separate DevTools extension. The zero-annotation in-page overlay is the
unoccupied slot, which is the same reason the react-refresh-style parse interception
matters here.

### 3.5 UI state store

| Candidate | Verdict |
|---|---|
| `useSyncExternalStore` (React 19 built-in) | **Recommended.** Zero deps, tearing-safe, and its subscribe/getSnapshot shape is exactly a frame-buffer read. |
| `DietBehaviorSubject` (`src/lib/2_diet_rxjs.ts`) | Stays as the **runtime** event stream. It exists to avoid a circular dependency on real RxJS (file header, line 1-6) and that reason is still valid. Do not promote it to the UI store; `use$` (`src/lib/1_use.ts:9-14`) is a `useEffect`+`useState` bridge with no tearing protection and no bail-out. |
| `@hafley66/signals` (sibling workspace pkg) | **Rejected for this arc.** Its `dependencies` are `rxjs ^7.8.2`, `lodash`, `immer`. Importing real RxJS into the debugger UI puts instrumented code inside the instrument, which is the exact loop `2_diet_rxjs.ts` was written to avoid. Revisit only after `/2_ui` is excluded from the transform **and** the exclusion is covered by a test. |
| zustand / valtio / jotai | Rejected. Each is a general store for app state that changes at human rates. The problem here is a bounded frame queue drained on rAF, which none of them model, and all three would sit between the ring and the renderer adding a copy. |
| Redux + RTK | Rejected. Per-event dispatch at trace rate is the wrong shape, and the reducer would duplicate the accumulator that already exists in `0_store.ts`. |

### 3.6 Virtualized table/grid, and the call tree

| Package | Version | Publish | License | Gzip | React 19 peer | Tailwind |
|---|---|---|---|---|---|---|
| `@tanstack/react-virtual` | 3.14.8 | 2026-07-22 | MIT | ~7.4 kB | `^19.0.0` **confirmed** | headless, zero CSS |
| `react-window` | 2.3.0 | 2026-07-20 | MIT | ~4.5 kB | `^18 \|\| ^19` | headless |
| `react-virtuoso` | 4.18.11 | 2026-07-17 | MIT | — | yes | mostly headless, gives `followOutput` free |
| `@tanstack/react-table` | 8.21.3 | 2026-07-24 | MIT | — | `>=16.8` | headless |
| `@glideapps/glide-data-grid` | 6.0.3 | 2026-06-24 | MIT | ~63.8 kB | **19 NOT in peerDeps** (16.12 \|\| 17 \|\| 18) | canvas, own theme object, Tailwind cannot reach cells |
| `ag-grid-community` | 36.0.2 | 2026-07-22 | MIT | ~346 kB | `^19` | own Sass/theme system, fights Tailwind |
| `@mui/x-data-grid` | 9.10.1 | 2026-07-23 | MIT | ~120 kB + `@mui/material` | `^19` | Emotion, fights Tailwind |

**Recommendation: `@tanstack/react-virtual` 3.14.8**, verified installed and building
under Vite 8.1.5 + React 19.2.8 in the §3.7 spike. Headless means Tailwind owns every
pixel, which is the constraint. Add a ~15-line stick-to-bottom hook rather than taking
`react-virtuoso` for `followOutput` alone; revisit if that hook grows past 40 lines.

`glide-data-grid` is the strongest technical fit for raw append rate (canvas, documented
200+ updates/sec) and is rejected on two counts: React 19 is absent from its peer range,
and canvas cells are unreachable from Tailwind. Both are constraint violations, not
preferences.

**Graph layout libraries are rejected wholesale for the call tree.** Surveyed
`@xyflow/react` 12.11.2, `elkjs` 0.12.0, `@dagrejs/dagre` 3.0.0, `cytoscape.js` 3.34.0,
`d3-hierarchy` 3.1.2, `sigma.js` 3.0.3, `graphology` 0.26.0. All of them solve *layout
of a general graph*. The call tree is not a general graph: `Call.parent_call_id`
(`0_store_v2.ts:15`) and `Subscription.parent_subscription_id` (`0.types.d.ts:90`) are
single parent pointers, so the layout is `indent = depth * 16px`, which
`flattenSubTree` (`06_queries.ts:126-132`) already computes. Rendering a tree costs the
same virtualizer as the table. Note for a later arc: the *observable dependency* view
(`pipe` -> `operator` -> `target_observable_id`) **is** a real DAG, and that is where
`@dagrejs/dagre` or `elkjs` earns its place. None of the seven does incremental layout,
so a growing graph re-lays-out fully on every node either way, which is a reason to
delay that view rather than a reason to hand-roll it.

### 3.7 Tailwind on Vite 8 — verified locally, not assumed

Secondary sources warned that `@tailwindcss/vite` breaks under Rolldown
(withastro/astro#16542, `Missing field 'tsconfigPaths' on
BindingViteResolvePluginConfig.resolveOptions`). That report is against an older
`rolldown` rc. I built a clean spike to check it against current versions.

Installed: `vite 8.1.5`, `tailwindcss 4.3.3`, `@tailwindcss/vite 4.3.3`,
`@vitejs/plugin-react 6.0.4`, `react 19.2.8`, `@tanstack/react-virtual 3.14.8`.
Source used a CSS-first `@theme { --color-marble-next: oklch(0.72 0.19 149) }`, a
`text-marble-next` utility, and a runtime-computed `style={{ left: \`${pct}%\` }}`
alongside Tailwind classes.

```
vite v8.1.5 building client environment for production...
✓ 15 modules transformed.
dist/assets/index-Bh3kHvK1.css    5.09 kB │ gzip: 1.74 kB
dist/assets/index-Bp08mawn.js   190.56 kB │ gzip: 60.06 kB
✓ built in 63ms
```

`grep -o -- "--color-marble-next:[^;]*" dist/assets/*.css` returns
`--color-marble-next:oklch(72% .19 149)`, so the CSS-first `@theme` custom property
compiles through. Dev server also verified:

```
VITE v8.1.5  ready in 175 ms
index=200   css=200 (theme var present)   /@vite/client=200
```

**The Astro issue does not reproduce on 4.3.3 + 8.1.5.** `@tailwindcss/vite@4.3.3`
declares `peerDependencies: { vite: "^5.2.0 || ^6 || ^7 || ^8" }`. Take
`@tailwindcss/vite`. Keep `@tailwindcss/postcss` (same 4.3.3, same
`@tailwindcss/node` + `@tailwindcss/oxide` deps) noted as the fallback if a future
Rolldown bump regresses it.

---

## 4. Tailwind wiring, concretely

Version: **`tailwindcss@^4.3.3` + `@tailwindcss/vite@^4.3.3`**. No `tailwind.config.js`;
v4 is CSS-first.

Three files:

```
packages/devtool-plugin/src/2_ui/tailwind.css      (new)
packages/devtool-plugin/vite.config.ts             (add tailwindcss() to plugins)
packages/devtool-plugin/src/app.tsx                (import "./2_ui/tailwind.css")
```

`src/2_ui/tailwind.css`:

```css
/* noRxjs() */
@import "tailwindcss";

@theme {
  --color-marble-next:     oklch(0.78 0.17 149);  /* was #51cf66 */
  --color-marble-error:    oklch(0.68 0.19  25);  /* was #ff6b6b */
  --color-marble-complete: oklch(0.62 0.02 260);  /* was #868e96 */
  --color-marble-unsub:    oklch(0.76 0.15  62);  /* was #ffa94d */
  --color-marble-dynamic:  oklch(0.62 0.24 315);  /* was #be4bdb */
  --color-lane-active:     oklch(0.66 0.17 250);  /* was #339af0 */
}
```

The six colours are lifted verbatim from `1_MarbleDiagram.tsx:81, 86, 156, 180-192`, so
the swap is mechanical and reviewable.

**Static vs runtime split, and this is the rule for the whole UI.** Tailwind's scanner
reads class *strings* out of source at build time; it does not evaluate template
literals. `className={\`left-[${pct}%\`]}` produces no CSS. So:

| Property | Mechanism |
|---|---|
| colour, font, border, padding, grid/flex, opacity, hover, dark mode | Tailwind utility classes |
| `left`, `width`, `top` computed per marble from `timeRange` | inline `style={{ left: \`${pct}%\` }}` |
| per-lane vertical offset in the virtualized list | inline `style={{ transform: \`translateY(${y}px)\` }}` (what `@tanstack/react-virtual` emits anyway) |

That is not a compromise forced by Tailwind. `1_MarbleDiagram.tsx:76-78, 127, 141`
already computes exactly these three numbers and puts them in `style`. Tailwind
displaces the other ~40 inline style properties in that file and the ~35 in
`0_DebuggerGrid.tsx`, which is where the win is.

Since there is no d3 in `src/`, there is nothing to keep or replace. Recommend removing
`d3`, `@types/d3`, `localforage`, and `uuid` from `package.json` in M1: four declared,
zero imported.

---

## 5. Components — type signatures, pseudo-code, lifetimes, storage

Numeric-prefix layering is preserved. New files continue the existing sequence within
their layer, and nothing under `src/0_runtime/` gains a DOM or bundler import (the
`v6/dl` constraint from §2).

### 5.1 The projection seam — `src/0_runtime/07_project.ts` (new)

This is the answer to "where does the cap go and who owns it". One function, two jobs:
it bounds `argRipper`'s recursion, and its output type is structured-cloneable, which
is what makes every §3.1 transport other than same-page possible later.

```ts
// src/0_runtime/07_project.ts
// noRxjs()

export type ProjectionBudget = {
  maxDepth: number          // recursion depth into arrays/objects.        default 3
  maxArrayLength: number    // elements visited per array.                 default 16
  maxObjectKeys: number     // keys visited per plain object.              default 24
  maxStringLength: number   // chars retained per string.                  default 256
  maxLeavesPerCall: number  // hard emit ceiling for one iso_funk call.    default 128
}

export const DEFAULT_BUDGET: ProjectionBudget

/** Mutable per-call counter. One instance per iso_funk invocation, never shared. */
export type RipCursor = { depth: number; leaves: number }

export type Projected =
  | { kind: "primitive"; value: string | number | boolean | null | undefined }
  | { kind: "string";   value: string; truncated: boolean; fullLength: number }
  | { kind: "array";    length: number; shown: number }
  | { kind: "object";   keys: number;   shown: number }
  | { kind: "function"; fun_id: string }
  | { kind: "ref";      ctor: string; ref_arg_id?: string }
  | { kind: "elided";   reason: "depth" | "width" | "budget" }

/**
 * Classify one value against the budget WITHOUT recursing.
 * Pure. No emit, no mutation of `value`, no WeakRef creation.
 */
export function classify(value: unknown, budget: ProjectionBudget, cursor: RipCursor): Projected
// pseudo-code:
//   if (cursor.leaves >= budget.maxLeavesPerCall) return { kind:"elided", reason:"budget" }
//   if (cursor.depth  >  budget.maxDepth)         return { kind:"elided", reason:"depth"  }
//   if (typeof value === "string")
//       return { kind:"string", value: value.slice(0, budget.maxStringLength),
//                truncated: value.length > budget.maxStringLength, fullLength: value.length }
//   if (value == null || typeof value !== "object" && typeof value !== "function")
//       return { kind:"primitive", value: value as never }
//   if (typeof value === "function") return { kind:"function", fun_id: "" }  // caller fills after decorating
//   if (Array.isArray(value))
//       return { kind:"array",  length: value.length,
//                shown: Math.min(value.length, budget.maxArrayLength) }
//   if (isPlainObject(value)) {
//       const keys = Object.keys(value).length
//       return { kind:"object", keys, shown: Math.min(keys, budget.maxObjectKeys) }
//   }
//   return { kind:"ref", ctor: value.constructor?.name ?? "Object",
//            ref_arg_id: Tracer.getPath(value) }

/** True when classify() says the caller should descend into children. */
export function shouldDescend(p: Projected): boolean
// pseudo-code:
//   return (p.kind === "array" || p.kind === "object") && p.shown > 0
```

**Ownership.** The `Tracer` owns the budget; the caller chooses it at construction.
Per-call override is rejected: `iso_funk` has no call-site identity to key a lookup on,
and threading a budget through the `Proxy` traps would leak into the `apply`/`construct`
signatures.

```ts
// src/0_runtime/0_store_v2.ts  — changed signatures only
export class Tracer {
  constructor(readonly budget: ProjectionBudget = DEFAULT_BUDGET) {}

  iso_funk(args: unknown[], id: string, fun_id: string, yields: Function): unknown
  // pseudo-code (delta from today, 0_store_v2.ts:180-195):
  //   const cursor: RipCursor = { depth: 0, leaves: 0 }   // NEW: one per call
  //   const modArgs = this.argsDo(args, id, cursor)
  //   ...unchanged...
  //   this.argRipper(toReturn, id, "$", getReturn, cursor) // return shares the call budget

  argsDo(rawArgs: unknown[], parentPath: string, cursor: RipCursor): unknown[]

  argRipper(value: unknown, call_id: string, path: string, next: unknown, cursor: RipCursor): void
  // pseudo-code (delta from 0_store_v2.ts:205-247):
  //   const id = `${call_id}/${path}`
  //   const shape = classify(value, this.budget, cursor)
  //   if (shape.kind === "elided") { cursor.leaves++
  //                                  this.next({ type:"arg", id, shape }); return }
  //   if (shape.kind === "function") {
  //       const deco = this.decoratoPatronus(value as Function, id)
  //       set(next, path, deco); cursor.leaves++
  //       this.next({ type:"arg", id, shape:{...shape, fun_id: Tracer.getPath(deco) ?? ""} })
  //       return }
  //   if (shape.kind === "array") {
  //       set(next, path, [])
  //       cursor.depth++
  //       for (let i = 0; i < shape.shown; i++)              // <- CAPPED, was value.length
  //           this.argRipper(value[i], call_id, `${path}.${i}`, next, cursor)
  //       cursor.depth--
  //       if (shape.shown < shape.length) this.next({ type:"arg", id: `${id}.…`,
  //                                                   shape:{kind:"elided", reason:"width"} })
  //       return }
  //   if (shape.kind === "object") { …symmetric, Object.entries().slice(0, shape.shown)… }
  //   // ref | primitive | string
  //   set(next, path, value); cursor.leaves++
  //   this.next({ type: "arg", id, shape,
  //               ...(shape.kind === "ref" ? { ref: new WeakRef(value as object) } : {}) })
}
```

Worked bound with `DEFAULT_BUDGET`: today a 4-level payload with 100-element arrays
emits on the order of `100^4` events. Under the budget, one `iso_funk` call emits at
most `maxLeavesPerCall = 128` `arg` events and performs at most 128 lodash `set()`
calls, independent of payload shape. That is the defect closed.

**`setPath` stops mutating user data.** Today `Tracer.setPath`
(`0_store_v2.ts:249-251`) writes `any["@@path"] = path` onto the traced object, so the
key is enumerable and shows up in the caller's `Object.keys`, spreads, and
`JSON.stringify`.

```ts
export class Tracer {
  static #pathByTarget = new WeakMap<object, string>()

  static setPath(target: object, path: string): void
  // pseudo-code: Tracer.#pathByTarget.set(target, path)

  static getPath(target: unknown): string | undefined
  // pseudo-code:
  //   if (target === null || (typeof target !== "object" && typeof target !== "function"))
  //       return undefined
  //   return Tracer.#pathByTarget.get(target as object)
}
```

Semantics are preserved on both existing call sites: `decoratoPatronus:125` reads it on
the incoming value as an already-decorated guard, and `:176` writes it on the outgoing
proxy, and both are keyed by identity either way. Static WeakMap keeps the current
cross-instance sharing. **Behaviour change to expect:** `getPath` previously returned a
value for a *clone* of a decorated object (the string key copies through spread); the
WeakMap version does not. Snapshot assertions in `0_store_v2.test.ts` that observe
`@@path` will need regeneration; that is scheduled inside M2, not deferred.

### 5.2 The dam — `src/0_runtime/08_ring.ts` (new)

```ts
// src/0_runtime/08_ring.ts
// noRxjs()
import { CircularBuffer } from "mnemonist"   // root import; see §3.2 on the CJS subpath

export type Frame = {
  seq: number            // monotonic frame counter, never reused
  firstLogical: number   // Tracer.date of the oldest event in this frame
  lastLogical: number    // Tracer.date of the newest
  events: TraceEvent[]   // drained in push order
  droppedBefore: number  // cumulative drops at the moment this frame was cut
}

export interface TraceSink   { push(event: TraceEvent): void }
export interface FrameSource { drain(): Frame | null; readonly stats: SinkStats }

export type SinkStats = {
  capacity: number; size: number; pushed: number
  dropped: number; framesCut: number; lastDrainMs: number
}

export class RingSink implements TraceSink, FrameSource {
  constructor(capacity: number /* default 8192 */)

  push(event: TraceEvent): void
  // pseudo-code:
  //   if (this.#buf.size === this.#buf.capacity) { this.#buf.shift(); this.#dropped++ }
  //   this.#buf.push(event); this.#pushed++
  //   // NOTE: drop-OLDEST. A live view showing stale head events while the tail is
  //   //       discarded is the wrong failure. Newest wins.

  drain(): Frame | null
  // pseudo-code:
  //   if (this.#buf.size === 0) return null
  //   const events = this.#buf.toArray(); this.#buf.clear()
  //   this.#framesCut++
  //   return { seq: this.#framesCut, events,
  //            firstLogical: logicalOf(events[0]), lastLogical: logicalOf(events.at(-1)!),
  //            droppedBefore: this.#dropped }
}
```

The drop counter is never silent. `SinkStats.dropped` renders in the health strip
(§6, view E) so the operator can see the instrument lying to them.

### 5.3 The clock — `src/2_ui/2_useFrames.ts` (new)

Coalescing sits **here**, between the ring and React, and nowhere else. The Tracer
pushes at call rate; React reads once per animation frame.

```ts
// src/2_ui/2_useFrames.ts
export type FramePump = {
  subscribe(onFrame: () => void): () => void   // useSyncExternalStore shape
  getSnapshot(): FrameSnapshot
  start(): void
  stop(): void
}

export type FrameSnapshot = {
  version: number      // bumps once per applied frame; the only value React compares
  index: TraceIndex    // §5.4
  stats: SinkStats
}

export function createFramePump(source: FrameSource, index: TraceIndex): FramePump
// pseudo-code:
//   let raf = 0, version = 0
//   const listeners = new Set<() => void>()
//   const tick = () => {
//     const started = performance.now()
//     const frame = source.drain()
//     if (frame) {
//       applyFrame(index, frame)          // §5.4, incremental, no full rescan
//       version++
//       for (const l of listeners) l()    // React schedules one render
//     }
//     // adaptive: if applyFrame cost > 8ms, skip the next rAF rather than
//     //           queueing renders we cannot retire. This is the second dam.
//     const cost = performance.now() - started
//     raf = requestAnimationFrame(cost > 8 ? () => { raf = requestAnimationFrame(tick) }
//                                          : tick)
//   }

export function useFrames(pump: FramePump): FrameSnapshot
// pseudo-code:
//   return useSyncExternalStore(pump.subscribe, pump.getSnapshot, pump.getSnapshot)
```

**Backpressure, named end to end:** bounded ring (drop-oldest, counted) at the
producer, rAF coalescing at the consumer, and a skip-a-frame governor when apply cost
exceeds half a frame budget. Three bounded stages, no unbounded queue anywhere. This is
the push/pull dam shape, with the dam at the ring.

### 5.4 The index — `src/0_runtime/09_index.ts` (new)

The current query layer cannot feed a live view. Every function in `06_queries.ts` is
`Object.values(store.X).filter(...)`, and `0_DebuggerGrid.tsx` calls them *per row*:
`SubCell` (line 196) runs two full `Object.values(...)` scans for every
observable x subscription cell, so a 50-observable, 20-subscription grid is 2,000 full
store scans per render. That is the reason the grid cannot stream.

```ts
// src/0_runtime/09_index.ts
// noRxjs()
export type TraceIndex = {
  rootSubIds:       string[]                 // ordered by created_at
  childSubs:        Map<string, string[]>    // parent_subscription_id -> child ids
  sendsBySub:       Map<string, Send[]>      // subscription_id -> sends, push-ordered
  sendCountByPair:  Map<string, number>      // `${observable_id} ${subscription_id}`
  opsByPipe:        Map<string, Operator[]>  // pipe_id -> operators, index-sorted
  pipesByObs:       Map<string, Pipe[]>      // parent_observable_id -> pipes
  laneOrder:        string[]                 // subscription_id, stable render order
  timeRange:        { min: number; max: number }
}

export function createIndex(): TraceIndex

/** Fold one frame in. O(frame.events), never O(store). */
export function applyFrame(index: TraceIndex, store: Store, frame: Frame): void
// pseudo-code:
//   for (const ev of frame.events) switch (ev.type) {
//     case "subscribe-call-return":
//       if (!ev.parent_subscription_id) index.rootSubIds.push(ev.id)
//       else mapPush(index.childSubs, ev.parent_subscription_id, ev.id)
//       index.laneOrder.push(ev.id)
//       index.sendsBySub.set(ev.id, [])
//       break
//     case "send-call":
//       mapPush(index.sendsBySub, ev.subscription_id, store.send[ev.id]!)
//       bump(index.sendCountByPair, `${ev.observable_id} ${ev.subscription_id}`)
//       index.timeRange.max = Math.max(index.timeRange.max, ev.created_at)
//       break
//     case "operator-call-return": mapPushSorted(index.opsByPipe, ...); break
//     case "pipe-call-return":     mapPush(index.pipesByObs, ...);      break
//     case "unsubscribe-call":     index.timeRange.max = Math.max(...); break
//   }
//   // laneOrder is APPEND-ONLY. Never re-sort: a lane that jumps rows mid-stream
//   // is unreadable, and re-sorting is O(n log n) per frame.

/** Bounded retention. Called from applyFrame when a ceiling trips. */
export function compact(index: TraceIndex, store: Store, keep: RetentionPolicy): number
// pseudo-code:
//   // returns number of entities evicted
//   for (const subId of index.laneOrder) {
//     const sub = store.subscription[subId]
//     if (!sub?.unsubscribed_at) continue                    // never evict a live lane
//     if (index.timeRange.max - sub.unsubscribed_at < keep.minAgeMs) continue
//     if (index.laneOrder.length <= keep.minLanes) break
//     drop sub, its sends, its sendsBySub bucket, its sendCountByPair keys,
//         its entry in laneOrder and childSubs
//   }
//   // sends within a SURVIVING lane are trimmed to keep.maxSendsPerLane,
//   // oldest first, and the lane records `trimmedSends: n` so the marble
//   // renderer can draw a "…" cap glyph at the left edge.

export type RetentionPolicy = {
  maxLanes: number           // default 512
  minLanes: number           // default 64,  never compact below this
  maxSendsPerLane: number    // default 2048
  minAgeMs: number           // default 5000, a lane must be dead this long
}
```

The `Store` in `0_store.ts` has no eviction today and neither does the `Store` in
`0_store_v2.ts` (`S.fun`, `S.call`, `S.arg` are plain `Record`s that only grow). A live
view running for ten minutes is a memory leak with a UI attached. `compact` is where
that stops.

### 5.5 The marble surface interface — the stage-1/stage-2 swap point

```ts
// src/2_ui/3_MarbleSurface.types.ts
export type LaneGlyph = { logical: number; kind: "next" | "error" | "complete" | "unsub" }
export type Lane = {
  subId: string
  depth: number
  label: string
  isDynamic: boolean
  startLogical: number
  endLogical: number | null   // null = still live, draw to the right edge
  state: "active" | "completed" | "unsubscribed" | "errored"
  glyphs: LaneGlyph[]         // already windowed to the visible x-range
  trimmedBefore: number       // >0 draws the "…" cap
}
export type MarbleSurfaceProps = {
  lanes: Lane[]
  timeRange: { min: number; max: number }
  pixelWidth: number
  onGlyphClick: (subId: string, logical: number) => void
}
export type MarbleSurface = (props: MarbleSurfaceProps) => JSX.Element
```

Stage 1 `src/2_ui/3_MarbleSurfaceDom.tsx` and stage 2
`src/2_ui/3_MarbleSurfaceCanvas.tsx` both satisfy `MarbleSurface`. `1_MarbleDiagram.tsx`
imports the type, picks the implementation from one const, and knows nothing else.
Windowing (`glyphs` pre-filtered to the visible range, `trimmedBefore` counted) is done
by the caller in both stages, so the DOM node cap is enforced by the same code path that
the canvas version will use.

### 5.6 Instance lifetimes

These genuinely disagree with the storage layout, and that disagreement is where the
bugs are.

| Type | Created | Destroyed | Survives HMR? | Survives React remount? |
|---|---|---|---|---|
| `Tracer` / `RxJSTracker` (`main`) | module eval of `0_store.ts` | page unload | **must**, see below | yes |
| `RingSink` | with the Tracer, owned by it | page unload | must, same pin | yes |
| `TraceIndex` | with the `FramePump` | with the pump | must (rebuilding costs a full store rescan) | should |
| `FramePump` | once per app, module scope | page unload | must | yes |
| React UI store (`useSyncExternalStore` subscription) | per component mount | unmount | no, and must not care | no |
| `ModuleScope` (`__$`, `4_module-scope.ts:39`) | every module evaluation | superseded on next eval | **no, by design** | n/a |
| `Frame` | per rAF tick | after `applyFrame` | no | no |
| `WeakRef<Function>` in `Fun.ref`, `WeakRef<object>` in `Arg.ref` | at trace time | whenever the GC decides | independent of all of the above | independent |

Two consequences that must be designed for, not discovered.

**HMR splits the Tracer.** `main` is `export const main = new RxJSTracker()`
(`0_store.ts:676`). If Vite hot-replaces `0_store.ts`, a second `RxJSTracker` is
constructed and every module that re-evaluates binds to it while modules that did not
keep the first. The trace silently forks. The pin:

```ts
// src/0_runtime/0_store.ts
declare global { var __rxjs_debugger_main__: RxJSTracker | undefined }
export const main: RxJSTracker =
  globalThis.__rxjs_debugger_main__ ??= new RxJSTracker()
// `globalThis` rather than import.meta.hot.data: the Tracer must also exist under
// `vitest run` (node, no hot) and in a production-profile page.
```

**`WeakRef.deref()` can return `undefined` between the index read and the render.** The
index stores ids, the store stores refs, and the renderer resolves them. Every
`deref()` in a render path needs a fallback label rather than a crash; `RootRows`
(`0_DebuggerGrid.tsx:126`) already reads `obs[___rxjs_hmr_key___] ?? obs.name ??
"Observable"` and that pattern generalizes.

### 5.7 Storage layout, then reads and writes, then uniqueness

**Layout.** Three tiers, deliberately different shapes.

| Tier | Shape | Keyed by | Bounded by |
|---|---|---|---|
| Store (`State["store"]`, `0.types.d.ts:158`) | `Record<entity, Record<id, Row>>` | surrogate string id | `compact()` + `RetentionPolicy` |
| Ring (`RingSink`) | fixed array, head/tail | position | `capacity` (8192) |
| Index (`TraceIndex`) | `Map<string, T[]>` | foreign key | derived from the store, so bounded with it |

The store is a normalized row set; the index is a denormalized adjacency cache; the ring
is a queue. All three describe the same events and none is derivable from another at
render cost, which is the reason there are three.

**Write sequence, per traced call.**

1. `iso_funk` allocates a fresh `RipCursor` (nothing shared with any other call).
2. `argsDo` -> `argRipper` -> `classify` -> `Tracer.next(event)` per surviving leaf,
   at most `maxLeavesPerCall`.
3. `Tracer.next` mutates `state$.value` in place, then `meth.next(event)`.
4. The `RingSink` is subscribed to `meth`; `push` either lands or drops-oldest.
5. Nothing else happens synchronously. The call returns.

**Read sequence, per animation frame.**

1. `FramePump.tick` calls `source.drain()`, which clears the ring in one `toArray()`.
2. `applyFrame(index, store, frame)` folds the events into the index maps.
3. `version++`, listeners fire, React re-renders.
4. Components read **only** through `index` and `store[entity][id]`. No
   `Object.values(...).filter(...)` in any render path, and that becomes a review rule.
5. Virtualizers ask for row `i`; the row resolves `laneOrder[i]` -> `subId` ->
   `sendsBySub.get(subId)`.

**Uniqueness conditions.**

| Invariant | Enforced where |
|---|---|
| `Call.id` is unique: `${fun_path}/${callIndex}` with `callIndex` per-proxy-closure | `decoratoPatronus:139, 166` |
| `Arg.id` is unique: `${call_id}/${path}`, and `path` is unique within a call because it is the traversal path | `argRipper:206` |
| `path` ending `/$` means the return value, never an argument | `Tracer.next:101`, `arg_is_return:278` |
| `Frame.seq` is strictly increasing and never reused | `RingSink.#framesCut` |
| `laneOrder` contains each `subId` exactly once and is append-only | `applyFrame`; `compact` removes by identity, never reorders |
| `compact` never evicts a subscription with `unsubscribed_at === undefined` | `compact` first guard |
| `compact` never evicts a call whose id is on `Tracer.callStack` | `compact`, second guard, mirrors the live-lane rule |
| `sendCountByPair` key uses ` ` as the separator because observable ids and subscription ids are both digit strings and `-` would collide | `09_index.ts` |

**Where the four layers disagree, stated plainly.** The type signatures say `Store` is a
flat `Record` of independent entities. The lifetime layer says the `Tracer` outlives
every UI instance and the WeakRefs inside it outlive nothing in particular. The storage
layer says reads go through an index that is a *cache* of relationships the store
already encodes. Those three cannot all be honoured at once: the index is stale by one
frame relative to the store, the store is stale by up to one drop relative to the
Tracer, and a `WeakRef` can be dead relative to both. The reconciliation rule is that
**the index is the only thing React reads for structure, the store is the only thing it
reads for values, and every value read is optional.** A renderer that assumes an id in
the index resolves to a row in the store is a bug, and it is the specific bug that
`getSubTree` (`06_queries.ts:119`) already has with its non-null assertion.

---

## 6. What "live" means — view inventory

Five panes in one layout. Each grows from a named existing file.

| # | View | Grows out of | Live behaviour | Reads |
|---|---|---|---|---|
| **A** | **Stream table.** Every trace event, one virtualized row, newest at the bottom, stick-to-bottom until the user scrolls up. Columns: logical clock, kind, subscription, observable, projected value. | new; nearest existing is `getAllSends` (`06_queries.ts:68`) | rows append per frame | `frame.events` directly, plus `store` for value lookup |
| **B** | **Marble lanes.** One lane per subscription, virtualized vertically, windowed horizontally. `timeRange.max` advances every frame, so lanes visibly scroll left. Lifespan bar, four glyphs, `…` cap when trimmed. | `src/2_ui/1_MarbleDiagram.tsx` (keep the geometry at lines 76-78, 141; replace the ~40 inline style props with Tailwind; extract the surface per §5.5) | axis advances, glyphs append | `index.laneOrder`, `index.sendsBySub`, `index.timeRange` |
| **C** | **Call / subscription tree.** Indented, virtualized, grows as `subscribe-call-return` events land. Selecting a node filters A and B. | `0_DebuggerGrid.tsx` `RootRows`/`PipeRows`/`OperatorRow` (112-194) and `05_render-tree.ts` `renderStaticTree` (its `.pipe(` / operator / `-> #id` text form is the right label vocabulary) | nodes append; **never re-sort** | `index.rootSubIds`, `index.childSubs`, `index.pipesByObs`, `index.opsByPipe` |
| **D** | **Value inspector.** The selected event's `Projected` tree, showing `elided` markers explicitly so a truncated payload reads as truncated. | new; consumes `07_project.ts` | on selection only, not per frame | `store.arg` |
| **E** | **Health strip.** Events/sec, `SinkStats.dropped`, ring occupancy, `applyFrame` cost in ms, store row counts, last `compact` eviction count. | new | every frame | `SinkStats`, `TraceIndex` sizes |

View E is not decoration. Three of the four defects in this plan (unbounded
`argRipper`, no store eviction, no backpressure) are invisible failures, and a strip
that shows drops and heap growth is what makes them visible the next time.

Layout: Tailwind CSS grid, C left, B centre, A right-bottom, D right-top, E a fixed
footer bar. Panes A, B, C each own a `@tanstack/react-virtual` instance.

---

## 7. Vite 8 migration

Target `vite@^8.1.5` (`latest` on 2026-07-25; `previous` is 7.3.6, beta is 8.2.0-beta.0).
Vite 8.0 shipped 2026-03-12 with Rolldown as the single bundler and no opt-in.
Rolldown itself is at 1.2.0.
Sources: https://vite.dev/blog/announcing-vite8 and https://vite.dev/guide/migration
("For users migrating from `rolldown-vite` to Vite 8, you can undo the dependency
changes in `package.json` and update to Vite 8"; also "only the sections with NRV in the
title are applicable", since rolldown-vite already carried the rest of the v7->v8 delta).

### 7.1 Exact edits

**Manifests (6 files).**

| File | Edit |
|---|---|
| `package.json` (root) | `devDependencies.vite`: `"npm:rolldown-vite@7.3.0"` -> `"^8.1.5"`. Delete `dependencies["rolldown-vite"]`. |
| `packages/devtool-plugin/package.json` | Delete the entire `"overrides": { "vite": "rolldown-vite" }` block. Delete `devDependencies["rolldown-vite"]`. Add `devDependencies.vite: "^8.1.5"`. Bump `@vitejs/plugin-react` `^5.1.2` -> `^6.0.4`. Delete `dependencies["vite-tsconfig-paths"]`, `["d3"]`, `["localforage"]`, `["uuid"]` and `devDependencies["@types/d3"]`. Fix `exports["./hmr"]` -> `./src/0_runtime_hmr/4_module-scope.ts`. Fix `scripts["dev:test"]` or delete it. |
| `packages/json-rx/package.json` | `vite`: `^7.3.0` -> `^8.1.5` |
| `packages/rxjs-ext/package.json` | same |
| `packages/rxjsx/package.json` | same |
| `packages/signals/package.json` | same |

`@vitejs/plugin-react@6.0.4` declares `peerDependencies: { vite: "^8.0.0" }`, so the
bump is forced by the vite bump. Its other two peers, `@rolldown/plugin-babel` and
`babel-plugin-react-compiler`, are both `optional: true` in `peerDependenciesMeta`, so
no extra install is required.

**Source (2 files).**

| File | Line | Edit |
|---|---|---|
| `packages/devtool-plugin/vite.config.ts` | 2 | `from "rolldown-vite"` -> `from "vite"` |
| `packages/devtool-plugin/src/1_runtime_vite_plugin/0_rxjs_devtool_patch_plugin.ts` | 14 | `import type { Plugin, ResolvedConfig } from "rolldown-vite"` -> `from "vite"` |

`1_rxjs_hmr_plugin.ts:11` already imports from `"vite"` and needs no change, which is
the inconsistency that made the alias necessary in the first place.

**Config semantics.**

| Change | Detail |
|---|---|
| Drop `vite-tsconfig-paths` from the plugin array | Verified against the installed v8.1.5 typings: `resolve.tsconfigPaths?: boolean` exists in `vite/dist/node/index.d.ts`. Confirm the `~/*` alias from `tsconfig.json` still resolves before deleting the dep. |
| `build.rollupOptions` -> `build.rolldownOptions` | Both exist in v8.1.5 typings (`rolldownOptions` appears 13 times; `rollupOptions` is typed as `RolldownOptions`). `rollupOptions` still works, so this is a rename to do deliberately rather than a break. |
| `optimizeDeps.esbuildOptions` -> `optimizeDeps.rolldownOptions` | Deprecated. This repo does not use it (`vite.config.ts` sets only `optimizeDeps.exclude`, and `0_rxjs_devtool_patch_plugin.ts:210` appends to `exclude`). No edit needed; recorded so it is not a surprise. |
| **`minify: "esbuild"` now requires a separate esbuild install** | Measured, not read: a v8.1.5 build with `minify: "esbuild"` fails with `Failed to load transformWithEsbuild. It is deprecated and it now requires esbuild to be installed separately... please migrate to transformWithOxc instead`. This repo does not set `minify`, so the default (oxc) applies and nothing breaks. Do not set it. |
| Lightning CSS is now the default CSS minifier and a hard dependency | Roughly 10 MB install. Relevant because the current build already trips over lightningcss (§0) for an unrelated reason. |
| Default browser target moved to Baseline Widely Available 2026-01-01 | Chrome 111, Edge 111, Firefox 114, Safari 16.4. Tailwind 4 needs `@property` and `color-mix()` and lands in the same neighbourhood, so the two floors are compatible. |
| Node floor | `^20.19.0 \|\| >=22.12.0`, unchanged from v7. Local node is v24.15.0. |
| Vitest | `vitest@4` already declares `vite: "^6 || ^7 || ^8"`. Separately, fix the `vitest@4.0.16` / `@vitest/browser@4.0.17` mismatch the browser runner warns about. |
| `vite-plugin-dts` (root devDep) | `peerDependencies` are `{ rollup: ">=3", vite: ">=3" }`. It still peers on **rollup**, which Vite 8 does not ship. Not used by `devtool-plugin`; flag it for the packages that do build with it. |

### 7.2 What actually breaks, ranked

1. **`build.lib` + `rollupOptions.external: []`** — already broken at baseline, and Vite 8
   will not fix it. The fix is independent of the version bump: the published entry is a
   Node Vite plugin and must externalize its Node deps.

   ```ts
   // vite.config.ts
   import { builtinModules } from "node:module"
   build: {
     lib: { entry: "./src/index.ts", formats: ["es"], fileName: () => "index.js" },
     rolldownOptions: {
       external: [
         ...builtinModules, ...builtinModules.map(m => `node:${m}`),
         "vite", "oxc-parser", "magic-string", "lodash",
       ],
     },
   }
   ```

   Better still, split the entry: `src/index.ts` (Node plugin, externalized) and
   `src/browser.ts` (runtime + UI, bundled). The current single entry conflates them,
   which is why a browser lib build reaches for lightningcss at all.

2. **The plugin's `transform` hook** — low risk. Rolldown keeps the Rollup-compatible
   plugin API. One new rule: a `load`/`transform` that converts non-JS content to JS
   must set `moduleType: "js"` on the return. `2_user_transform.ts` returns
   `{ code, map }` for `.ts`/`.tsx` input, so it is unaffected.
3. **`enforce: "pre"`, `configResolved`, `resolveId`** — unchanged signatures in the
   v8 plugin docs. `1_rxjs_hmr_plugin.ts:56, 63, 71` currently uses three
   `@ts-expect-error idk` casts to hand-delegate hooks to a nested plugin object.
   Those casts are how a plugin-API change would slip through silently; they are on the
   M3 checklist to remove.
4. **`import.meta.hot`** — `accept` / `on` / `send` / `off` signatures unchanged.
   Custom HMR events still supported.
5. **CJS default-import interop changed** and `browser`/`module` format sniffing was
   removed (`resolve.mainFields` order is now respected strictly). Watch the rxjs
   `dist/esm` vs `dist/esm5` resolution in `0_rxjs_devtool_patch_plugin.ts:260-320`,
   which branches on the resolved path. If Vite 8 resolves rxjs to a different dist
   directory than Vite 7 did, those `cleanId.includes("/rxjs/dist/esm5/")` guards go
   quiet and the Observable patch silently stops applying, with a
   `[rxjs-debugger] WARNING: Pattern did not match!` as the only signal. **This is the
   highest-risk item in the migration** and gets a dedicated acceptance check in M3.
6. `resolve.alias[].customResolver` removed. Not used here.

### 7.3 Sequencing note

The Vite team recommends v7 -> `rolldown-vite` -> `vite@8` to isolate bundler issues
from API issues. This repo is **already on `rolldown-vite@7.3.0`**, so step one is
complete and M3 is a single hop.

---

## 8. Milestones

Each milestone has one acceptance check that is a command with an expected result.
`‖` marks milestones that can run concurrently with disjoint file ownership.

### M0 — Quarantine the red baseline (blocking, do first)

Do not fix the 9 failing tests. Make the failures explicit so later work has a signal.

- Mark the 3 known-red suites `it.fails` / `describe.skip` with a `// BASELINE-RED
  2026-07-25` comment naming the receipt.
- Write the §0 numbers into `CHANGELOG.md` so the next session does not re-measure.

**Accept:** `pnpm test:run` exits 0 with a skip count of exactly 9 + 2, and
`git diff --stat` touches only test files and `CHANGELOG.md`.

### M1 — Hygiene and the self-instrumentation loop ‖ with M2

Owns: `packages/devtool-plugin/package.json`,
`src/1_runtime_vite_plugin/2_user_transform.ts`, `src/app.tsx`, `src/2_ui/*.tsx`
(marker comments only), `tsconfig.json`.

- `2_user_transform.ts:617`: add `\/2_ui|\/lib` to the `exclude` regex, and add
  `// noRxjs()` to `0_DebuggerGrid.tsx` and `1_MarbleDiagram.tsx` as belt and braces.
- Fix `exports["./hmr"]` to `./src/0_runtime_hmr/4_module-scope.ts`.
- Delete `d3`, `@types/d3`, `localforage`, `uuid` (4 declared, 0 imported).
- Clear the 30 typecheck errors. The three TS2307 imports in
  `0_DebuggerGrid.browser.test.tsx` name files that do not exist; either restore them or
  delete the 921-line suite, and that is a judgement call to surface rather than decide.

**Accept:** `pnpm typecheck` exits 0. A new test asserts
`shouldTransformUserCode("/x/src/2_ui/0_DebuggerGrid.tsx") === false`.

### M2 — Projection seam + Tracer defects ‖ with M1

Owns: `src/0_runtime/07_project.ts` (new), `src/0_runtime/0_store_v2.ts`,
`src/0_runtime/0_store_v2.test.ts`.

- Land `07_project.ts` per §5.1.
- Thread `RipCursor` through `iso_funk` / `argsDo` / `argRipper`.
- Replace `@@path` with the static `WeakMap`; regenerate the affected inline snapshots.

**Accept:** a new test traces a call whose argument is a 5-level-deep object with
200-element arrays at each level, and asserts (a) `arg` event count `<= 128`,
(b) at least one `{kind:"elided"}` event is present, (c)
`Object.keys(theArgument)` is unchanged from before the call, meaning `@@path` is gone.

### M3 — Vite 8 migration (blocking for M5+; needs M1)

Owns: all 6 `package.json` files, `vite.config.ts`, `vitest.browser.config.ts`,
`src/1_runtime_vite_plugin/0_rxjs_devtool_patch_plugin.ts`, `pnpm-lock.yaml`.

Per §7. Includes fixing `rollupOptions.external` and splitting the lib entry.

**Accept, four parts:**
1. `pnpm build` exits 0 and `dist/index.js` does **not** contain the string
   `lightningcss`.
2. `pnpm -r typecheck` exits 0 across all 6 packages.
3. `grep -rn "rolldown-vite" packages/ package.json` returns zero hits outside
   `pnpm-lock.yaml`.
4. **The rxjs patch still fires.** Run `pnpm dev`, load the page, and assert in the
   console that `main.state$.value.store.observable` is non-empty and that no
   `[rxjs-debugger] WARNING: Pattern did not match!` was logged. This is the §7.2 item 5
   risk and it needs a human eye once.

### M4 — Tailwind ‖ with M3 on config, after M3 on lockfile

Owns: `src/2_ui/tailwind.css` (new), `vite.config.ts` plugin array, `src/app.tsx` import.

Per §4. Convert `1_MarbleDiagram.tsx` and `0_DebuggerGrid.tsx` inline styles to
utilities, keeping only `left` / `width` / `transform` inline.

**Accept:** `pnpm build` exits 0; the emitted CSS contains `--color-marble-next`;
`grep -c "style={{" src/2_ui/*.tsx` drops from 36 (20 in `1_MarbleDiagram.tsx`, 16 in
`0_DebuggerGrid.tsx`) to at most 6: four runtime-computed `left`/`width` in the marble
file (lane bar, unsub marker, marble, axis tick) and two runtime-computed grid track
counts in the grid file.

### M5 — Ring, pump, index (needs M2 and M3)

Owns: `src/0_runtime/08_ring.ts` (new), `src/0_runtime/09_index.ts` (new),
`src/2_ui/2_useFrames.ts` (new). Adds `mnemonist` to dependencies.

Per §5.2, §5.3, §5.4.

**Accept:** a node test pushes 100,000 synthetic events into a `RingSink(8192)` and
asserts `stats.dropped === 91808`, `stats.size === 8192`, heap growth under 5 MB, and
that `drain()` returns exactly the last 8,192 in push order. A second test folds 10,000
`send-call` events through `applyFrame` and asserts wall time under 50 ms.

### M6 — Views A/B/C/E on the live pump (needs M4 and M5)

Owns: `src/2_ui/1_MarbleDiagram.tsx`, `src/2_ui/3_MarbleSurface*.tsx` (new),
`src/2_ui/4_StreamTable.tsx` (new), `src/2_ui/5_CallTree.tsx` (new),
`src/2_ui/6_HealthStrip.tsx` (new), `src/2_ui/0_DebuggerGrid.tsx`. Adds
`@tanstack/react-virtual`.

Stage-1 DOM marble surface. Every render path reads the index; the review rule is that
`Object.values(` may not appear in any `src/2_ui/**` file.

**Accept:** `pnpm dev` with `src/app.tsx`'s existing polling demo (`pollUsers$`,
`interval(5000)`, the search `switchMap`) running. Marbles appear on lanes within one
frame of emission, the call tree grows without reordering existing rows, the stream
table sticks to the bottom, and the health strip reports `dropped: 0`. Measured with
Chrome performance profiler: median frame under 16 ms with 200 lanes on screen.
`grep -rn "Object.values(" src/2_ui/` returns zero.

### M7 — View D and retention (needs M6)

Owns: `src/2_ui/7_ValueInspector.tsx` (new), `compact()` in `09_index.ts`.

**Accept:** a 10-minute `pnpm dev` soak with the polling demo running. `performance.memory`
(or a heap snapshot pair) shows flat allocation after minute 3, and the health strip
reports a non-zero `compact` eviction count.

### M8 — Stage-2 canvas surface, conditional

Trigger only if M6's frame budget check fails at 200 lanes. Swap
`3_MarbleSurfaceDom.tsx` for `3_MarbleSurfaceCanvas.tsx` behind the unchanged
`MarbleSurface` type.

**Accept:** the M6 frame check passes at 1,000 lanes, and no other file changes.

### Parallelization summary

```
M0 ──┬── M1 ──┬── M3 ──┬── M4 ──┐
     └── M2 ──┘        └── M5 ──┴── M6 ── M7 ── [M8 conditional]
```

M1 ‖ M2 (disjoint: manifest/transform/UI vs `0_runtime/0_store_v2.ts` + new
`07_project.ts`).
M4 ‖ M5 (disjoint: `2_ui/tailwind.css` + style attributes vs new `08_ring.ts` /
`09_index.ts` / `2_useFrames.ts`), with the caveat that both add a dependency, so one of
them owns `pnpm-lock.yaml` and the other rebases.

---

## 9. Open questions for Chris

1. **`0_DebuggerGrid.browser.test.tsx`** (921 lines, the largest file in the package)
   imports `../0.types`, `../0_test-utils`, `../01_helpers`. Only
   `src/0_runtime/0.types.d.ts` and `src/0_runtime/0_test-utils.ts` exist, at a
   different relative depth, and `01_helpers` exists nowhere. Restore the imports or
   delete the suite?
2. **v1 vs v2 store.** This plan targets `0_store.ts` (`RxJSTracker`) because it is the
   only one with `subscription` and `send` entities, which a marble diagram requires.
   `0_store_v2.ts` (`Tracer`) has an unstarted 6-of-10-ticket plan behind it
   (`chat_log/2026-02-22.0`). M2 fixes the v2 `argRipper` defect regardless, since it is
   a live memory hazard. Confirm the views build on v1 for now.
3. **Retention defaults.** `maxLanes: 512`, `maxSendsPerLane: 2048`, `ring: 8192` are
   guesses sized to fit a 60 Hz frame budget on the `src/app.tsx` demo. They want a
   measurement, not a vote.
4. **`chat_log/LATEST.md`** points at `2026-01-13.0.vite-plugin-move-fix.md` and the
   newest log is `2026-02-22.0.v2-decorator-refactor.md`. Update it or drop the file.
