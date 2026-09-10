# Report receipts: fixture snapshots, testid census, blowout probes

Status: plan only. No test code written yet.
Board: `plans/2026-09-09-report-receipts.d2` (3199x710, 11 shapes).

## TOC

1. [What breaks if this is wrong](#1-what-breaks-if-this-is-wrong)
2. [Answer: are signals used correctly](#2-answer-are-signals-used-correctly)
   - [2a. signalsJsx vs explicit SignalReact](#2a-signalsjsx-vs-explicit-signalreact)
3. [Answer: api interception and input assertion](#3-answer-api-interception-and-input-assertion)
4. [Units under test](#4-units-under-test)
5. [The fixture](#5-the-fixture)
6. [testid census](#6-testid-census)
7. [Case table](#7-case-table)
8. [Untested and why](#8-untested-and-why)
9. [Order of work](#9-order-of-work)

---

## 1. What breaks if this is wrong

| break | today's detector | cost |
| --- | --- | --- |
| a cell overflows its column and pushes the grid wider than the viewport | none | the pitch demo scrolls sideways |
| a long test name blows the nav tree past `--track-nav` | none | nav is unusable at any width |
| the flame chart draws bars wider than `plotWidth` | none | bars clip, labels vanish |
| a component root is renamed and every selector in the consumer's e2e breaks | none | silent breakage downstream |
| the report page regresses visually | none | caught by eye, or not at all |
| the e2e suite needs a live `pnpm test` run to have anything to open | `tests/e2eHelpers.ts:12` throws | cannot run the receipts on a clean checkout |

`packages/vitest-telemetry/tests/*.e2e.test.ts` contain **zero** `toMatchSnapshot` and **zero** `toHaveScreenshot`. Every assertion is a text or computed-style read. The two files run on raw `playwright.chromium`, not on `@hafley66/vitest-playwright`.

## 2. Answer: are signals used correctly

Mostly. Reads are `.$()`, writes are `.$(v)`, computeds are `Signal(() => ...)`, and every view that reads at render is wrapped in `SignalReact`. Six defects.

| # | file | defect | why it is wrong |
| --- | --- | --- | --- |
| 1 | `report-shell/src/components/ReportShell.tsx:31` | `useMemo(() => layout(...))` builds RxJS subscriptions during render; teardown is a `useEffect` keyed on the memo result | a render React throws away (StrictMode, a suspended sibling, a concurrent retry) leaks one subscription per track, and each writes `--track-*` on `documentElement` forever |
| 2 | `report-shell/src/components/PresetsMenu.tsx` (`PresetsMenuView`) | `useMemo(() => storageSignal(storage, ...))` with **no** teardown at all | `storageSignal` subscribes `storage.read`; the report-app storage (`report-app/components/PresetsMenu.tsx:10`) subscribes `prefs.$` inside that Observable. Unmount leaves both live |
| 3 | `report-app/components/Nav.tsx:64` | `useSignal(prefs.$)` / `useSignal(model.selected.$)` in a component the rest of the tree reaches through `SignalReact` | `useSignal` throttles 16 ms on `animationFrameScheduler`; `SignalReact` re-renders synchronously. Selection highlight lands a frame after the marbler that reads the same signal. Pick one mechanism. Superseded if §2a lands |
| 4 | `report-app/model.ts` (`createModel`) | returns `unsubscribe` for the `syncMarbler` subscription; `report-app/main.tsx` never calls it | the API states a lifetime nobody owns. Either drop it or own it |
| 5 | `report-shell/src/layout.ts` (`layout`) | `signal.$.subscribe` writes `stored.$({...stored.$(), ...})` per track, per emission | N tracks means N storage writes for one drag release, each serialising the whole blob. Batch them |
| 6 | `report-shell/src/components/EventsPanel.tsx:61` | `overviewTrack.$()` read in a `SignalReact` body that renders `MarblerPanel` (two pixi apps) | safe only because `gutter` defaults to `commit: 'release'`. Any caller passing `commit: 'frame'` re-renders both pixi surfaces per pointermove. The coupling is undocumented |

### 2a. `signalsJsx()` vs explicit `SignalReact`

`packages/signals/src/vite-plugin.ts:13` rewrites `react/jsx-runtime` to `@hafley66/signals/jsx-runtime`, whose `jsx`/`jsxs` route every type through `track()` (`4_jsxAuto.ts:8`), which is `SignalReact` behind a `WeakMap`. Every function component auto-tracks. Explicit wrappers become redundant.

Where it is on today: **2 configs.**

| config | plugin |
| --- | --- |
| `packages/gothic/vite.config.ts` | on |
| `packages/signals/vitest.jsx-e2e.config.ts` | on |
| `packages/vitest-telemetry/vite.report.config.ts` | off |
| `packages/report-shell/vitest.browser.config.ts` | off |
| `packages/marbler/vite.config.ts`, `vitest.browser.config.ts` | off |
| `packages/grid/*` | off |

The transform gates on `/\.[cm]?[tj]sx$/` against the module id. `report-shell` and `marbler` resolve to `dist/*.js` (`report-shell/package.json:14`), JSX already compiled, `react/jsx-runtime` already baked in. **The plugin cannot reach a compiled workspace dep.** So the reach is per-tier:

| tier | plugin reaches it | drop `SignalReact`? |
| --- | --- | --- |
| `report-app/**/*.tsx` (built by `vite.report.config.ts`) | yes, once the plugin is added | yes: `Header.tsx:63`, `Title.tsx:55`, `PrefsMenu.tsx:59` |
| `report-shell` / `marbler` consumed as `dist/*.js` | no | no |
| `report-shell` / `marbler` own browser tests (source `.tsx`) | yes, once added | only if the published build also stops needing them |

Three options, one decision:

| option | what it takes | what it costs |
| --- | --- | --- |
| **A. app tier only** | add `signalsJsx()` to `vite.report.config.ts`; delete the 3 app wrappers | kit packages keep theirs; two mechanisms in one tree, but each is total within its tier |
| **B. everywhere** | kit builds must preserve JSX (emit `.jsx`, `esbuild.jsx: 'preserve'`) and the plugin becomes a documented peer requirement of `@hafley66/report-shell` | a consumer who forgets the plugin gets a component that **never re-renders, with no error**. Silent, not loud |
| **C. status quo + plugin on** | add the plugin, keep every wrapper | double wrap: outer `SignalReact` collects nothing (the inner one swaps `activeCollector` and restores), inner drives the update. Correct, one extra fiber + one extra effect per component |

Untested today: the double-wrap path. `4_jsxAuto.test.ts` covers `track()` caching, `5_jsx.jsx-e2e.test.tsx` covers plain components under the plugin. Nothing covers `SignalReact(SignalReact(f))`. That case gets a test before option A or C lands, since both produce it during the migration.

Silent failure is the deciding fact for a published kit: without the plugin there is no error, only a component that stops updating.

Not defects, checked and cleared: dynamic dep sets across the `Title.tsx:8` early return; the deliberate omission of `selected` from `model.ts` `nav`; `FsTree.tsx` reading `rows.$()` only inside a subscription callback; `initialExpanded` snapshotting at grid construction.

## 3. Answer: api interception and input assertion

No. `@hafley66/vitest-playwright` records network traffic and lets you reach `page.route`. It has no uniform interception surface and cannot assert what the app sent.

| capability | state | evidence |
| --- | --- | --- |
| stub a browser request | raw `pw:page.route` | `tests/3_route_clock.test.ts:6` |
| stub a node-realm `fetch` | none | `src/5_streams.ts` observes undici, never intercepts |
| one handler table for both realms | none | - |
| record request url / method / status | yes | `NetEvent`, `src/6_roots.ts:24` |
| record request **headers** | no | `NetEvent` has no header field |
| record request **body** / `postData` | no | same |
| record response body | no | same |
| assert on what was sent | none | 30 matchers, all `pw:Locator` / `Page` (`src/3_matchers.ts`) |
| replay a recorded session | `har.routeFromHAR` | `0_options.ts:60`, config-level only, no per-test control |

`log.$().net` is the only outbound record, and it is a url/method/status/ms tuple. Input testing is impossible on it today.

### Build vs buy for the gap

| candidate | covers both realms | handler table | request assertions | cost here |
| --- | --- | --- | --- | --- |
| **msw** | yes: `setupServer` (node, undici interceptors) + `setupWorker` / `page.route` bridge | yes, one `http.*` handler list, `onUnhandledRequest: 'error'` gives the strict default | yes, `server.events.on('request:start')` yields the full `Request`, body included | adds a dep and its own interceptor stack next to the undici channels already tapped in `5_streams.ts` |
| playwright `routeFromHAR` | browser only | HAR file, not code | replay only | already wired, does not solve node realm or assertions |
| nock | node only | yes | yes | half the problem |
| undici `MockAgent` | node only | yes | partial | half the problem, but it is already the realm `5_streams.ts` taps |
| bespoke in-kit | both | would have to be written | would have to be written | full ownership of an interceptor stack |

Recommendation to decide, not decided: msw for the handler table plus the existing `NetEvent` stream widened with `headers` / `postData` behind `log.net: { bodies: true }`, and two matchers over the attempt log:

```ts
await expect($log).toHaveRequested({ method: "POST", url: /\/api\/save/, body: { id: 7 } })
expect(redact($log.$().net)).toMatchSnapshot()   // every call the app made, as one receipt
```

The snapshot form is the input test the user is after: the whole outbound surface of a test, frozen.

## 4. Units under test

- `report-shell`: `ReportShell`, `NavTabs`, `Section`, `SpecPanel`, `StateCombo`, `SubTable`, `Truncated`, `PivotStack`, `EventsPanel`, `FsTree`
- `marbler`: `MarblerPanel` table view, `MarblerPanel` flame view, `FlameChart`, `TimeNavigatorPixi`, `WaterfallPixi`
- `vitest-telemetry/report-app`: `App`, `Header`, `Nav`, `Title`, `PrefsMenu`, `PresetsMenu`, `NavStatusLegend`
- `vitest-playwright`: `toHaveScreenshot` / `toMatchSnapshot` under `serve: { kind: "vite", serve: "file" }` against a static html file

## 5. The fixture

The blocker for every snapshot: today's page is built from a live run, so timings, pids and durations move every time.

```ts
// src/report-app/fixtures/0_gen.ts
export type FixtureSizes = {
  processes: number      // pid roots
  files: number          // test files per process
  testsPerFile: number
  eventsPerTest: number
  maxDepth: number       // nesting depth of spans
  nameLength: number     // characters in the longest test name
  attrsPerEvent: number
  previewBytes: number   // longest single string value
}
export function makeReportFixture(seed: number, sizes: FixtureSizes): Event[]
//   t, tRel, iso  <- derived from a fixed epoch (1_700_000_000_000) + a mulberry32(seed) walk
//   id            <- `${kind}:${index}` so React keys and TanStack keys are stable
//   durationMs    <- quantised to 1 ms so formatDuration never renders a float
//   names         <- padded to `nameLength` with a repeating token, no lorem
//   verdicts      <- exactly 1 fail per 17 tests so the default view always has a target
```

Two committed artefacts:

| artefact | sizes | purpose |
| --- | --- | --- |
| `fixtures/report.small.json` | 2 / 3 / 4 / 20 / 3 / 40 / 6 / 200 | the readable baseline, what the pitch screenshots show |
| `fixtures/report.blowout.json` | 6 / 40 / 30 / 120 / 12 / 240 / 60 / 8192 | ~860k events; every listable thing past its comfortable width |

Both go through the existing `renderReport(events)` (`src/report/html.ts:8`), so the fixture page is byte-for-byte the shipped page with a different data blob. Build target: `out/report.fixture.html` and `out/report.blowout.html`, produced by a `fixtures` script, no test run required.

Rendering 860k events client-side is itself the test: if the nav tree build (`buildProcessNav`, one pass per event) blocks past 3 s, that is a finding, not a broken fixture.

## 6. testid census

27 component roots. 6 carry a `data-testid`. Rule to adopt: **every exported component puts `data-testid` on the element it returns first**, named after the component in kebab-case, and the kit's own `README` states it.

| package | component | export | root element | testid today | add |
| --- | --- | --- | --- | --- | --- |
| report-shell | `ReportShell` | `ReportShell.tsx:20` | fragment: `<nav>`, `<main>` | gutter only | `report-nav`, `report-main` |
| report-shell | `NavRail` | `NavRail.tsx:39` | `button.nav-rail-toggle` | `nav-rail-toggle` | - |
| report-shell | `NavTabs` | `NavTabs.tsx:16` | `header.kit-top` | none | `nav-tabs` |
| report-shell | `Section` | `Section.tsx:105` | `section.kit-section` | none | `section` + `data-section-id` |
| report-shell | `PlainSection` | `Section.tsx:122` | `section.kit-section` | none | `section` + `data-section-id` |
| report-shell | `SpecPanel` | `SpecPanel.tsx:41` | `div.kit-panel` (`:160`) | none | `spec-panel` |
| report-shell | `StateCombo` | `StateCombo.tsx:17` | `div.kit-combo` (`:34`) | none | `state-combo` |
| report-shell | `SubTable` | `SubTable.tsx:14` | `div.subtable` | none | `subtable` |
| report-shell | `Truncated` | `Truncated.tsx:18` | `span.truncated-anchor` | none | `truncated` |
| report-shell | `GearButton` | `Popover.tsx:5` | `button` (`:12`) | id only | `gear-button` |
| report-shell | `PopoverPanel` | `Popover.tsx:19` | `div[popover]` (`:20`) | id only | `popover-panel` |
| report-shell | `PresetsMenu` | `PresetsMenu.tsx:49` | fragment | none | wrap, `presets-menu` |
| report-shell | `PivotStack` | `PivotStack.tsx:97` | `div.pivot-stack` (`:69`) | `pivot-stack` | - |
| report-shell | `EventsPanel` | `EventsPanel.tsx:103` | `section.events-panel` (`:78`) | children only | `events-panel` |
| report-shell | `FsTree` | `FsTree.tsx:101` | grid `TreeTable` | `tree-table` (inherited) | - |
| marbler | `MarblerPanel` | `2_Marbler.tsx:199` | `main.app-shell` (`:119`) | `marbler` | - |
| marbler | `FlameChart` | `1d_FlameChart.tsx:37` | `div.flame-chart` (`:75`) | `flame-chart` | - |
| marbler | `WaterfallPixi` | `1a_WaterfallPixi.tsx:49` | `div.waterfall-pixi` (`:211`) | canvas only (`:179`) | `waterfall` on the host div |
| marbler | `TimeNavigatorPixi` | `1b_TimeNavigatorPixi.tsx:34` | `div.time-navigator` (`:272`) | canvas only (`:175`) | `time-navigator-host` on the div |
| marbler | `TimelineTreeDemo` | `2a_DemoViz.tsx:40` | `div.demo-viz-stack` | `timeline-tree-demo` | - |
| report-app | `App` | `App.tsx:30` | `ReportShell` | none | inherits `report-main` |
| report-app | `Header` | `Header.tsx:63` | `NavTabs` | none | inherits `nav-tabs` |
| report-app | `Nav` | `Nav.tsx:53` | `div.nav-tree-wrap` | none | `nav-tree` |
| report-app | `NavStatusLegend` | `NavStatusLegend.tsx:9` | `div.nav-status-legend` | none | `nav-status-legend` |
| report-app | `PrefsMenu` | `PrefsMenu.tsx:59` | fragment | none | wrap, `prefs-menu` |
| report-app | `PresetsMenu` | `PresetsMenu.tsx:30` | delegates | none | inherits `presets-menu` |
| report-app | `Title` | `Title.tsx:55` | `div.top` | children only | `report-title` |

A census test guards the rule: import every export from each barrel, render it with minimal props, assert the first element has a `data-testid`. New component with no testid fails at once.

## 7. Case table

Every case runs against `out/report.blowout.html` unless the input column says otherwise. Viewport is fixed at 1440x900 for baselines, plus one narrow pass.

### 7a. Blowout probes (assertion, not pixels)

One helper, `noOverflow(page, root)`, walks every element under `root` and collects those where `scrollWidth > clientWidth + 1` **and** the computed `overflow-x` is `visible` or `clip`. It reports `selector, scrollWidth, clientWidth, text.slice(0,60)`, so a failure names the cell.

| case | input | expected | why this case exists |
| --- | --- | --- | --- |
| B1 nav tree, 240-char test names | blowout, nav track at fallback 380px | no overflow; `.nav-name-primary` ellipsises | `style.css:47` sets ellipsis but `td:first-child > span:last-child` needs `min-width:0` on every ancestor; one missing link and the column blows |
| B2 nav tree at min track width | blowout, `--track-nav` dragged to 28px (rail) | no overflow, no horizontal page scrollbar | the collapse path is a different layout branch from B1 |
| B3 marbler table, 12-deep tree | blowout, table view | no overflow; `col-name` padding `9 + depth*18` = 207px at depth 11 stays inside its cell | `2_Marbler.tsx:174` indents with inline padding and no clamp; deep trees are exactly what a real run produces |
| B4 marbler waterfall column | blowout, table view | `waterfallLeft` measured value is inside the scroller | `2_Marbler.tsx:87` falls back to a 690px constant before measurement; if the fallback ships, the canvas sits over the wrong columns |
| B5 flame chart, 12 depth | blowout, flame view | every `rect` has `x + width <= plotWidth` | `1d_FlameChart.tsx:61` clamps x but `width` is `max(1, ...)`, so a zero-width bar at the right edge can exceed the viewBox by 1px per node |
| B6 event drawer, 8 kB preview | blowout, a row with the longest preview selected | `.drawer` stays at `--track-drawer`; `<pre>` scrolls | `2_Marbler.tsx:192` renders raw `<pre>` with no wrap rule in the embedded stylesheet |
| B7 attrs sub-table, 60 attrs | blowout, same row | `.subtable .cell` ellipsises at `max-width: 60ch` | `kit.css:138` sets it, `kit.css:141` removes `max-width` for the truncated anchor; the interaction is untested |
| B8 spec panel, 60 fields | report-shell kit page, 60-field spec | `.kit-panels` scrolls at `max-height: 55vh`, `.kit-row` grid does not blow | `kit.css:286` has a fixed 5-column grid with a `minmax(7ch,10ch)` label; a long field name has nowhere to go |
| B9 narrow viewport | blowout, 720x900 | the `<900px` branch of `kit.css:244` holds; no horizontal page scroll | the sidebar becomes a sheet below 900px, a branch no test currently enters |
| B10 pivot stack 4 deep | blowout, 4 pivots pushed | 4 panels, each `maxHeight` from the track, breadcrumb wraps | `PivotStack.tsx:70` breadcrumb is a plain `nav`, no wrap rule |
| B11 header filter row | blowout, all 4 kind chips + long meta | `#meta` ellipsises, chips do not wrap out of `.kit-top-end` | `style.css:10` and `kit.css:167` (`flex-wrap: nowrap`) disagree about who yields |

### 7b. Page snapshots

`await expect($page).toMatchSnapshot(name)` through `@hafley66/vitest-playwright` (`src/11_screenshot.ts`), baselines at `tests/__screenshots__/<file>/<name>-chromium-darwin.png`.

| case | input | expected | why this case exists |
| --- | --- | --- | --- |
| S1 `default-view` | small fixture, load | first failing test selected, other branches collapsed, hint visible | the single most-seen state of the product; the pitch opens on it |
| S2 `nav-expanded` | small, expand all | full tree, no clipping | catches indent and guide-line regressions the text assertions miss |
| S3 `table-view` | blowout, table | dense grid, ticks, waterfall aligned | the density claim of the product |
| S4 `flame-view` | blowout, flame | flame bars at 12 depth | `2_Flame.browser.test.tsx` covers 2 nodes; nothing covers a real depth |
| S5 `drawer-open` | blowout, longest-preview row | drawer + messages table | the only view with a `<pre>` and a nested table |
| S6 `pivot-4` | blowout, 4 pivots | breadcrumb + 4 panels | the deepest layout nesting in the app |
| S7 `narrow-720` | blowout, 720px | narrow branch | a whole CSS branch with zero coverage |
| S8 `light-theme` | small, `prefs.theme = light` | light palette | `report.shell.e2e.test.ts:22` asserts one background colour; the rest of the palette is unverified |
| S9 `blowout-full` | blowout, load | the whole page under 860k events | the "does it survive real data" receipt |

Each snapshot case first runs its blowout probe, so a pixel diff is never the first signal of an overflow.

### 7c. testid census

| case | input | expected | why this case exists |
| --- | --- | --- | --- |
| T1 | every export of `@hafley66/report-shell`, `@hafley66/marbler`, `report-app/components` | first rendered element has `data-testid` | the rule is worthless if a new component can skip it |
| T2 | the census list | matches a committed `testids.json` | a rename is a diff, not a surprise for a downstream consumer |

## 8. Untested and why

| left out | why |
| --- | --- |
| pixi canvas pixels (`waterfall-pixi`, `time-navigator` canvases) | GPU rasterisation differs per machine; `2_PixiRetained.browser.test.ts` already covers the retained-object counts, which is the real invariant |
| firefox / webkit baselines | the pitch is one browser; three platforms triples the baseline churn for no new class of defect |
| the OTLP receiver and the collector path | orthogonal to the report shell; `fixtures/` already exercises it end to end |
| `toMatchAriaSnapshot` | `vitest-playwright` does not implement it (`README.md` §10) |
| animation timing of `view-timeline` anchors | `animations: "disabled"` is the screenshot default; testing motion needs a different harness |
| the 860k-event fixture in CI | keep it a local receipt until the render budget is measured; a 3 s page build is not a CI-friendly test yet |

## 9. Order of work

| step | deliverable | gate |
| --- | --- | --- |
| 1 | `data-testid` on all 21 missing roots + census test | `pnpm --filter @hafley66/report-shell test` |
| 2 | `makeReportFixture` + two committed JSON fixtures + `fixtures` build script | `out/report.fixture.html` opens with no page error |
| 3 | `noOverflow` helper + the 11 blowout probes | every probe fails loudly first, then each CSS fix lands against its probe |
| 4 | port `tests/*.e2e.test.ts` off raw playwright onto `@hafley66/vitest-playwright` | same assertions pass, `serve: { kind: "url", url: "file://..." }` |
| 5 | the 9 page snapshots | baselines committed, `-u` documented |
| 6 | the §2a plugin decision, then the six signals defects in §2 | double-wrap test in `packages/signals` first; no behaviour change; leak checks in the browser tests |
| 7 | the interception decision in §3, then the `NetEvent` widening and the two matchers | a `toMatchSnapshot` of the outbound call list on one fixture test |

Steps 1-3 are the ones that make the pitch defensible on their own; 4-5 are what make it a demo.
