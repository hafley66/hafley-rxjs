# @hafley66/report-shell

Domain-free UI shell for signal-driven HTML report viewers. This package never imports a
domain: every export takes signals, render functions, and callbacks, and renders generic
markup a domain package styles and wires up.

## Contract

A consumer owns the domain model (rows, selection, verdicts, whatever the report is about) and
passes signals plus a handful of callbacks into these components. The shell owns layout tracks,
popovers, truncation, sub-tables, presets storage, pivot chaining, the nav tree renderer, and the
marbler events panel. Row types passed to `NavGrid` and `PivotStack` extend `NavRow`, which fixes
only `id`, `label`, `status`, `durationMs`, `events`, and `children`; a domain adds its own fields
through the generic parameter.

## Exports

| Export | Kind | Contract |
| --- | --- | --- |
| `layout(root, tracks, storage, sizing?)` | function | `{ tracks, unsubscribe }`: one `Signal<number>` per `Track`, persisted through a `Storage<string>`; an optional `SizingStore` records writes and seeds a viewport-appropriate start |
| `ReportShell` | component | header / nav rail + nav + drag gutter / main over `layout()` tracks; `children(tracks)` render prop; tears the layout down on unmount |
| `gutter(el, track, options)` | function | pointer-drag resize handle bound to a track signal, returns `unsubscribe` |
| `createSizingStore(storage)` | function | reusable resize memory for pane tracks, grid columns, nav width; see Sizing below |
| `Truncated` | component | overflow-aware label with a hover/click popover and copy button |
| `SubTable` | component | `columns` + `rows` master/detail grid |
| `GearButton`, `PopoverPanel` | components | gear button + native-popover shell primitives |
| `PresetsMenu<T>` | component | apply/save/reset named `T` snapshots through a `Storage<string>` |
| `PivotStack<T>` | component | breadcrumb + stacked `Grid<T>` pivots, `onPop(count)` callback |
| `NavGrid<T>` | component | tree grid over `Grid<T>`, `onSelect(row)` / `onPivot(row)` callbacks |
| `NavRail` | component | chevron toggle that collapses a nav `Track` signal to a 28px rail |
| `formatAge(ms, now?)`, `formatDuration(ms)` | functions | shared time labels, see Time below |
| `createNavCollapse(track, storage, expandedFallback)` | function | collapse/restore logic behind `NavRail`, usable standalone |
| `NavRow<Extra>`, `PivotEntry` | types | base row/pivot-entry shapes |

### marbler subpath

`@hafley66/report-shell/marbler` exports `EventsPanel`, `defaultEventDetail`, `EventsPanelProps` and `syncMarbler`. They
are the only pieces that import `@hafley66/marbler` (and pixi.js), so the marbler peer is optional: consumers that never
import the subpath never carry pixi.

Import `@hafley66/report-shell/style.css` once for tokens, popover, truncated, sub-table, nav
grid, gutter, pivot, and events-panel styling; a consumer's own stylesheet layers its
domain-specific rules on top.

### spec (section state)

`src/spec/` is the state half of the kit: `Field`/`Spec` with zod derivation, shuffle and pins (`0_spec`), namespaced
query strings `?<section>.<key>=` (`1_url`), named states + autosave + selected over signals `Storage<string>`
(`2_store`), and `createSections(host)` (`3_sections`), which ties a section's values to the URL and to storage.
A host passes `search()`, `write(search, mode)`, an optional `storage(key)` factory (default `localStorageAdapter`),
an optional `transition` wrapper, and a storage `prefix`. `memoryStorage()` is the test host's storage.
Peer: `@hafley66/path`. Dependency: `zod`.

## Sizing

Every resizable thing (pane tracks, grid columns, nav width) can share one `SizingStore` so a
resize made at one viewport size restores sensibly at another.

```ts
export type Sizing = { id: string; px: number; share: number; viewportPx: number; manual: boolean; at: number }
```

`restore(ids, viewportPx, mins, priority?)` computes a full `{ id: px }` map:

1. Manual ids (a record exists and `manual` is true) scale their recorded share to the new
   viewport, `round(share * viewportPx)`, clamped up to at least `mins[id]`. An id with no
   record is never manual here.
2. Auto ids (no record, or a record with `manual: false`) split whatever width the manual ids
   left behind, weighted by each one's last recorded share when it has one, else an equal
   share; each result is clamped up to at least `mins[id]`.
3. If the total now exceeds `viewportPx`, shrink ids in priority order, lowest priority first
   (`priority` lists highest priority first; ids missing from it are lowest priority), never
   below `mins`, and never touch a manual id until every auto id is already at its min. If the
   total is under `viewportPx`, hand the leftover to the highest priority auto id, or the
   highest priority id overall when there is no auto id.
4. The result has exactly one px entry per id in `ids`, computed the same way for the same
   inputs every time.

```ts
import { layout, createSizingStore, type Track } from '@hafley66/report-shell'
import { localStorageAdapter } from '@hafley66/signals'

const sizing = createSizingStore(localStorageAdapter('app.sizing'))
const tracks: Track[] = [{ name: 'nav', min: 160, max: 480, fallback: 240, axis: 'x' }]
const { tracks: signals, unsubscribe } = layout(document.documentElement, tracks, localStorageAdapter('app.layout'), sizing)
```

## NavGrid is deprecated

`NavGrid` is superseded by `@hafley66/grid`'s own `TreeTable` (sortable headers, sticky header,
virtualization, column sizing); see that package's README, "TreeTable" section. `vitest-telemetry`
has already moved its sidebar onto `TreeTable` directly; `NavGrid` stays exported and working here
only because `boop-adapters` still imports it. Do not build new nav trees on `NavGrid`.

## Hover tiers

`NavGrid` rows carry exactly three color-changing classes, applied in this cascade order so
later ones win a tie:

| Class | Meaning | Style |
| --- | --- | --- |
| `ancestor` | row is on the hovered row's parent chain | one `--accent` outline, no background |
| `hovered` | row is the one under the pointer / `hoveredId` | the same outline plus a brighter background |
| `selected` | row is the domain's current selection | `--sel` background, always wins over hover |

The old `sameScope` sibling tint is gone; `sameScope` is still accepted on `NavGridProps` for
callers that pass it (e.g. `boop-adapters`), but it no longer changes any row's color.

## Nav collapse

`NavRail` collapses a `layout()` track to a 28px (`NAV_RAIL_PX`) rail and restores the width it
had before collapsing. It owns no row rendering, only the track: place it as a sibling of
`NavGrid` inside your own `<nav>`, the same way `gutter`'s div sits beside it.

```tsx
import { NavRail, layout, type Track } from '@hafley66/report-shell'
import { localStorageAdapter } from '@hafley66/signals'

const tracks = layout(document.documentElement, [{ name: 'nav', min: 28, max: 720, fallback: 380, axis: 'x' }], localStorageAdapter('app.tracks'))

function Nav() {
  return (
    <nav>
      <NavRail track={tracks.nav} storage={localStorageAdapter('app.tracks.nav.collapsed')} expandedFallback={380} />
      {/* <NavGrid ... /> */}
    </nav>
  )
}
```

A `Track`'s `min` must be at or below `NAV_RAIL_PX` for the rail width to actually render; a
higher `min` clamps the collapse back open (see `layout.ts`'s `clampToTrack`). `NavRail` sets
`data-nav-collapsed` on its closest `<nav>` ancestor; `style.css` hides `.nav-grid` under that
attribute. `collapsed` is a derived `Signal` read straight off `track`, so a manual gutter drag
down to the rail width flips it too, not only the toggle button.

`NavGrid` was left alone (no `collapsible` prop): it never receives a track signal today, and
adding one just to host a toggle button would mix an unrelated concern (track ownership, the
same boundary `gutter` already sits on the far side of) into the row-tree component.

## Time

`formatAge(ms, now = Date.now())` and `formatDuration(ms)` in `src/lib/time.ts` are the shared
labels for "when" and "how long": `formatAge` reads a timestamp against `now` ("14s ago", "2m
ago", "1h 4m ago", "3d ago"); `formatDuration` reads a span ("14ms", "1.2s", "14s", "2m 10s",
"1h 4m", "2d 3h"). `NavGrid`'s `ms` column renders through `formatDuration`.

## Usage

```tsx
import { NavGrid, type NavRow } from '@hafley66/report-shell'
import '@hafley66/report-shell/style.css'

type Row = NavRow<{ kind: 'file' | 'test'; file?: string }>

function Tree({ grid, hoveredId }: { grid: Grid<Row>; hoveredId: Signal<string | null> }) {
  return (
    <NavGrid
      grid={grid}
      hoveredId={hoveredId}
      rowClassName={(row) => row.kind}
      onSelect={(row) => console.log('selected', row.id)}
      onPivot={(row) => console.log('pivot on', row.status)}
    />
  )
}
```
