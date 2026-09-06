# report app on the hafley stack

Package: `packages/vitest-telemetry`. Viewer: `src/report-app/`. Goal: replace hand-rolled routing, delegation, and history with `@hafley66/signals`, `@hafley66/xdom`, `@hafley66/path`, `@hafley66/rxjs-ext`; add master/detail row expansion; add the process tree data.

## TOC
1. Lanes and ownership
2. Lane A: stack refactor + master/detail
3. Lane B: process tree data
4. Later: process pane, perf results into skill, commit

## 1. Lanes and ownership

| lane | owns | must not touch |
| --- | --- | --- |
| A | `packages/signals/src/6_Storage.ts`, `packages/signals/src/6_Storage.test.ts`, `packages/vitest-telemetry/src/report-app/**`, `packages/vitest-telemetry/src/report/html.ts`, `packages/vitest-telemetry/package.json`, `packages/vitest-telemetry/README.md` | `src/report/timeline.ts`, `src/otel.*`, `src/cli.ts`, `src/plugin.ts`, fixtures |
| B | `packages/vitest-telemetry/src/otel.node.ts`, `src/cli.ts`, `src/report/timeline.ts`, `src/report/index.ts`, `src/plugin.ts`, `fixtures/vitest.config.ts` | everything lane A owns |

## 2. Lane A

| step | change |
| --- | --- |
| A1 | `signals/6_Storage.ts`: add `hashAdapter(key)` (same `Storage<string>` shape as `urlAdapter`, reads/writes `location.hash` params, `hashchange` + `popstate` emit) and `historyAdapter(key)` (pushState on differing value, popstate emit) with tests |
| A2 | delete `report-app/history-adapter.ts`; `selected` and `closedGroups` -> `storageSignal(historyAdapter('s'))`, `storageSignal(historyAdapter('g'))`; `continuous` stays on `urlAdapter('q')` |
| A3 | nav and table clicks -> `Dom('/nav/:file/:test').$.click`, `Dom('/row/:id').$.click`, `Dom('/act/:name').$.click`; rows carry `data-file`, `data-test`, `data-id`, `data-name`; no `closest()` in app code |
| A4 | model derived streams use `rxjs-ext` `shareLatest` / `scanEager` where a `Signal(() => ...)` is not enough |
| A5 | master/detail: span rows render as `<details name="detail" class="row">`; summary = the master row on `grid-template-columns: subgrid`; content = a detail grid with its own `--cols` (attr | value, then child logs with t | level | message); inset margin, `--depth` via `color-mix()` background, contrasting small-caps header; `::details-content` + `interpolate-size` slide, degrades to instant; open state persisted through the `g`-style history signal |
| A6 | validation: build, typecheck, test, releaseCheck, 0 external refs, playwright: select A then B then Back shows A; open detail then Back closes it; two drags leave `history.length` unchanged; detail grid columns differ from outer; screenshot read |

## 3. Lane B

| step | change |
| --- | --- |
| B1 | `otel.node.ts` resource: `process.parent_pid`, `process.command_line`, `process.ancestry` (array of `pid ppid command` from `ps -o pid=,ppid=,command= -p` walked to pid 1, one call per hop, cap 12) |
| B2 | `cli.ts run -- <vitest args>`: mint traceId, export root span `cli <argv>` from the wrapper via OTLP to the receiver url, set `TRACEPARENT` for children, run the given command, end span with exit code |
| B3 | `timeline.ts`: emit `kind: 'process'` rows (one per resource: pid, ppid, command, shard, project guess, span count, first/last t) and add `pid` to every span/log row |
| B4 | fixtures `test` script uses `vitest-telemetry run -- vitest run ...` for both shards and the merge |
| B5 | validation: build, typecheck, test; node one-liner: count process rows = 8 or 9, every process row has ppid, root span `cli` present with children `vitest.start` in both shards under one traceId |

## 4. Later
- process pane in report-app (tree by ppid, bars, span counts), after A lands
- `labs/grid-resize-perf/RESULTS.md` into `skills/modern-css` Houdini rows
- commit `packages/vitest-telemetry`, plans, lockfile; check the unrelated `grapht_layout_wasm.wasm` diff first

## 5. Lane C: one rendering path, React + signals + grid + marbler (user call 2026-09-05)

Decision: stop hand-rolling innerHTML renderers. Every view is a React component bound to signals through `SignalReact`; tree data renders through `@hafley66/grid`; the event table + waterfall + overview is `@hafley66/marbler` embedded; lodash for grouping and sorting; rxjs (via `@hafley66/xdom` `Dom()` streams) for DOM events. Native primitives (details, popover, anchor positioning, light-dark) stay, inside JSX.

| step | change |
| --- | --- |
| C1 | marbler generalization: `PhaseSchema.kind: string` + `phaseStyles: Record<string,{label,color}>` option on `createMarbler`; `FrameSchema.kind: string` + `severity: 'info'|'warn'|'error'|'done'` drives variant/color; filter chips derived from distinct `type` values (or a `filters` option); existing marbler tests stay green |
| C2 | `report-app/adapter/timelineToMarble.ts`: `Event[] -> MarbleEvent[]`: one row per `run.test` (id=testId, name=test, status 200/500/0 from verdict, type=project, initiator=realm, size=`${logs} logs`, start/duration), children = spans nested by `parentId` (containment), phases = hook spans (beforeEach/callback/afterEach/cleanup) keyed by name suffix, frames = logs (kind=level, severity by level) and pw lines; detached events get a frame kind `detach` at `detachedAt` |
| C3 | `<Nav>`: `@hafley66/grid` tree via `getSubRows`, rows shard > project > file > test with columns name/status/ms/events aggregated; selection writes the `selected` history signal |
| C4 | `<Events>`: `MarblerPanel` embedded mode fed by `timelineToMarble(eventsForSelected)`; selecting a marbler row shows its details pane (attrs + frames table = the master/detail) |
| C5 | header, prefs popover, presets, help popover, theme: React components, same signals, native `popover` + anchor positioning in JSX |
| C6 | delete `table.ts`, `nav.ts`, `overview.ts` string renderers and `grid.tsx`; `renderer` pref removed |
| C7 | validation: marbler tests, build, typecheck, test, releaseCheck, 0 external refs, playwright: Back undo, preset reload, theme toggle, nav select shows the marbler waterfall for that test, red failure row, detail pane on click; screenshots read |
