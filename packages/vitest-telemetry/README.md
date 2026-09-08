# @hafley66/vitest-telemetry

OTel + LogTape telemetry for Vitest: OTLP/HTTP receiver, JSONL timeline, self-contained HTML
report, Chrome trace.

## TOC

1. Install
2. Config
3. `out/` files
4. CI fan-in
5. Reading `report.html`
6. Filters, presets, preferences, layout, and history
7. `pnpm test:e2e`

## 1. Install

```bash
pnpm add -D @hafley66/vitest-telemetry @logtape/logtape @opentelemetry/api
```

| dependency | kind |
| --- | --- |
| `vitest`, `vite` | peer |
| `@logtape/logtape` | peer |
| `@opentelemetry/api` | peer |
| `debug` | optional peer |
| `@logtape/otel`, `@logtape/file`, `@opentelemetry/sdk-*`, `@opentelemetry/exporter-*` | bundled dependency |

## 2. Config

```ts
import { defineConfig } from 'vitest/config'
import { telemetry } from '@hafley66/vitest-telemetry/plugin'
export default defineConfig({ plugins: [telemetry({ root: 'app' })], test: {} })
```

```ts
import { Logger } from '@hafley66/vitest-telemetry'
const log = Logger(import.meta.url) // category = [root, ...repo-relative path segments]
```

| `TelemetryOptions` | default | meaning |
| --- | --- | --- |
| `root` | `'app'` | category root, prefixes every logger and metric name |
| `outDir` | `'out'` | every telemetry artifact lands here |
| `otlp` | `'http://localhost:4318'` | OTLP/HTTP collector base URL |
| `receiver` | `true` | run the built-in receiver; set `false` against a real collector |
| `shard` | `process.env.VITEST_SHARD ?? process.env.LAB_SHARD ?? 'none'` | shard tag on resources and file names |
| `debugNamespaces` | `${root}:*` | debug.js namespaces bridged into LogTape |
| `fileSink` | `true` | node realm jsonl-per-pid file sink |

## 3. `out/` files

| file | written by |
| --- | --- |
| `otlp-traces[-<shard>].jsonl` | receiver, one OTLP batch per line |
| `otlp-logs[-<shard>].jsonl` | receiver |
| `otlp-metrics[-<shard>].jsonl` | receiver |
| `logs-node-<pid>.jsonl` | node realm LogTape file sink |
| `junit[-<shard>].xml` | vitest junit reporter, added by the plugin (`junit` option, `JUNIT_OUT` env); verdicts and failure text in the report come from here |
| `junit-merged.xml` | the plugin under `vitest --merge-reports`; wins over the per-shard files |
| `pw-debug.log` | optional `DEBUG_FILE` (user env) |
| `timeline.jsonl` | `vitest-telemetry report` / `trace` |
| `report.html` | `vitest-telemetry report` |
| `trace.json` | `vitest-telemetry trace` |

```bash
vitest-telemetry report [--out out] [--open]
vitest-telemetry trace  [--out out]
```

## 4. CI fan-in

```yaml
jobs:
  test:
    strategy:
      matrix: { shard: [1, 2, 3, 4] }
    steps:
      - run: VITEST_SHARD=${{ matrix.shard }} vitest run --shard=${{ matrix.shard }}/4
      - uses: actions/upload-artifact@v4
        with: { name: out-${{ matrix.shard }}, path: out/ }

  report:
    needs: test
    steps:
      - uses: actions/download-artifact@v4
        with: { pattern: out-*, path: out, merge-multiple: true }
      - run: vitest run --merge-reports --experimental.openTelemetry.enabled=false
      - run: vitest-telemetry report
      - uses: actions/upload-artifact@v4
        with: { name: report, path: out/report.html }
```

## 5. Reading `report.html`

One rendering path: every view is a React 19 function component wrapped in `SignalReact`
(`@hafley66/signals/react`), reading state through `.$()`. The tree grid comes from
`@hafley66/grid`'s `getSubRows`; the event timeline is `@hafley66/marbler`'s `MarblerPanel`
embedded, fed by `timelineToMarble`.

| component | file | signals it reads | package it uses |
| --- | --- | --- | --- |
| `App` | `components/App.tsx` | `prefs`, layout tracks | `@hafley66/signals`, this package's `layout.ts` |
| `Header` | `components/Header.tsx` | `model.continuous` | `@hafley66/signals/react` |
| `Title` | `components/Title.tsx` | `model.selected`, `model.eventsForSelected`, `model.verdicts` | `@hafley66/signals/react` |
| `Nav` | `components/Nav.tsx` | `model.nav`, `model.hoveredId`, `prefs.compactChains` | `@hafley66/grid`, `@hafley66/grid/react` |
| `Events` | `components/Events.tsx` | `model.marbler.*` | `@hafley66/marbler` |
| `PivotStack` | `components/PivotStack.tsx` | `model.pivotStack` | `@hafley66/grid` (`grid.pivot`) |
| `PrefsMenu` | `components/PrefsMenu.tsx` | `prefs` | `@hafley66/signals/react` |
| `PresetsMenu` | `components/PresetsMenu.tsx` | `model.continuous`, `model.selected`, `prefs.presets` | `@hafley66/signals/react` |
| `SubTable` | `components/SubTable.tsx` | (props only) | reused for attrs, process ancestry, any attr\|value grid |
| `Truncated` | `components/Truncated.tsx` | (props only) | `popover="hint"` cell overflow, everywhere a cell might truncate |

Nav tree: cli wrapper process (root, from the `process` resource whose ancestry reaches highest,
plus every ancestor parsed out of `process.ancestry`) > child processes by `ppid` > project/file
under each pid's own spans/logs > test. `prefs.compactChains` runs
`compactSingleChildChains` (`@hafley66/grid`) over that tree so ancestry chains like `sh -c ›
node vitest run --shard=1/2` collapse into one row. Alt-click a status dot to `grid.pivot('status',
value)`; the breadcrumb (`all › status=fail`) stacks pivots, newest at the bottom, each push is a
`pivotStack` history entry so Back pops it.

Hover a nav row: its ancestor rows dim-tint (`.ancestor`), and any other row for the same
file/test/kind tints too (`.same-scope`). Selecting a marbler row shows its attrs in a `SubTable`
under the panel; marbler's own drawer renders the frames (= log lines) table.

Nesting fields in `timeline.jsonl`: `id`, `parentId`, `depth`, `detachedAt`. Containment runs per
`realm + file + test` scope over whole milliseconds; an interval closes when its end millisecond is
at or before the next start millisecond, so a boundary tie is a sibling. Instants never parent.

## 6. Filters, presets, preferences, layout, and history

State is split by how it should behave with browser Back/Forward. Every group is a
`storageSignal` from `@hafley66/signals` over one of its `Storage<string>` adapters:

| signal | fields | adapter | URL param | write mode | Back/Forward |
| --- | --- | --- | --- | --- | --- |
| `continuous` | search, kind toggles, min level, failed-only | `urlAdapter` | `?q=` | `history.replaceState` | no history entry (typing does not spam history) |
| `selected` | selected file/test | `historyAdapter` | `&s=` | `history.pushState` | Back returns to the previous selection |
| `pivotStack` | the pushed pivot entries | `historyAdapter` | `&p=` | `history.pushState` | Back pops the last pivot |

The overview zoom window lives on marbler's own `viewport` signal instead of `continuous`, reset
to the full extent on a selection change and reflowed (not reset) on a filter-only change.

The "presets" button saves a named snapshot of `continuous` + `selected` and re-applies both later
(applying is a `selected` write, so it pushes a history entry too); "reset filters" writes the
defaults back to both. Presets live in the `localStorage` prefs object below, since unlike
`continuous`/`selected` they should survive across different report URLs.

`packages/vitest-telemetry/src/report-app/layout.ts` owns every resizable dimension: `layout()`
binds one `Signal<number>` per track to a `--track-<name>` CSS custom property, persisted as one
JSON blob; `gutter()` is a pointer-drag handle, `commit: 'release'` (default) moves only a
transform during the drag and writes the signal once on pointerup.

| track | CSS property | min | max | default | drag handle |
| --- | --- | --- | --- | --- | --- |
| `nav` | `--track-nav` (nav pane width) | 200 | 720 | 380 | `[data-testid=nav-gutter]` |
| `overview` | `--track-overview` (marbler navigator height) | 48 | 480 | 160 | `[data-testid=overview-gutter]` |

| prefs key | values | default |
| --- | --- | --- |
| `density` | `compact`, `cozy` | `compact` |
| `theme` | `auto`, `dark`, `light` | `auto` |
| `columns.realm` / `.category` / `.level` | `true`, `false` | `true` |
| `compactChains` | `true`, `false` | `false` |
| `presets.<name>` | a saved `continuous` + `selected` snapshot | none |

Prefs and tracks are separate `localStorage` keys (`vitest-telemetry.prefs`,
`vitest-telemetry.tracks`); loading an older report's prefs blob ignores unknown/retired keys
(`renderer`, `navWidth`) silently. `theme: auto` leaves `color-scheme: dark light` on `:root` so
the page follows the OS/browser preference; `dark` / `light` force it so every `light-dark()` color
in `style.css` resolves to that side.

## 7. `pnpm test:e2e`

Raw playwright (no `@playwright/test` runner) against the already-built `out/report.html`, chromium
headless: `vitest.e2e.config.ts` defines one project, `report-e2e`, running
`tests/report.e2e.test.ts`. Run `pnpm test` first to build the report, then `pnpm test:e2e`.

| case | asserts |
| --- | --- |
| auto-select | the first failing test is selected on load, its nav row carries `status-fail` |
| nav select then Back | clicking another test changes the selection; Back restores the first |
| theme toggle | switching to light changes `document.body`'s computed background |
| compact chains | toggling the tree pref reduces the visible `.nav-row` count |
| hover ancestors | hovering a test row adds `.ancestor` to its parent rows |
| pivot then Back | alt-click on a status dot shows the pivot stack; Back removes it |
| marbler row detail | clicking a marbler row shows the attrs `SubTable` |
| preset round trip | save, reload, and the saved preset is selectable again |
| truncated popover | clicking a truncated cell shows the full text |
| nav gutter drag | `--track-nav` is unchanged mid-drag, written once on release |
| overview gutter drag | dragging it changes `--track-overview` |
| no page errors | nothing threw during the whole run |
