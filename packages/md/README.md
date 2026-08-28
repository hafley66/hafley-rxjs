# @hafley66/md

`@hafley66/md` is the Markdown viewer extracted from Instant. It is a React
Dockview panel with document navigation, heading and list folding, a file
explorer, Streamdown rendering, Mermaid and D2 diagrams, and an SVG lightbox.

The package began as Instant's `src/mdview` feature. Before extraction, that
feature directly imported Instant's filesystem commands, Dockview helpers,
plugin registry, application store, persisted plugin state, TreeTable file
browser, zoom system, diagnostics, and pan/zoom viewport. The extraction moved
the renderer and its state into this package and replaced those application
imports with the `MdviewHost` interface in `src/ports.ts`.

The resulting package still implements an Instant-shaped viewer. It does not
provide filesystem access, a dock manager, a file table, or application theme
state. A host application supplies those facilities.

## Runtime structure

| Layer | Implementation | Responsibility |
| --- | --- | --- |
| Panel UI | React | Toolbar, explorer, folded sections, rendered body, diagrams, and lightbox |
| Panel registration | Dockview types plus `MdviewHost` | Register and open `md:<path>` panel instances |
| Reactive state | `@hafley66/signals` | Document cache, current path, folding, explorer visibility, and split layouts |
| Document structure | Unified plus `remark-parse` | Parse headings and list source ranges into the viewer model |
| Markdown rendering | Streamdown | Render the original Markdown slices as React elements |
| Code highlighting | `@streamdown/code` | Render fenced code with Shiki |
| Mermaid diagrams | `mermaid` | Render `mermaid` fences to SVG |
| D2 diagrams | `@terrastruct/d2` | Compile and render `d2` fences to SVG |
| Split layout | `react-resizable-panels` | Resize the explorer and content panels |
| Diagram viewing | Package React components | Display SVG with pan, zoom, source data, and diagram history |

## End-to-end sequence

```text
openMarkdownPanel(path)
  -> MdviewHost.openMdPanel(path, title)
  -> Dockview mounts the registered md:<path> panel
  -> pathSignalFor(panelId, path) supplies the panel's current path
  -> loadMdDoc(path) calls MdviewHost.readText(path)
  -> parseMdSections(text) builds the heading and list-fold model
  -> MdPanel renders the section tree
  -> each expanded section passes its original source slice to Streamdown
  -> ordinary Markdown becomes React elements
  -> mermaid and d2 fences use the package's custom diagram renderers
  -> clicking a rendered SVG opens DiagramLightbox
```

## Why the package accesses Instant state

It does not import Instant state modules. `MdPanel` calls
`MdviewHost.useAppState()`, whose return type is the two values the panel reads:

```ts
interface MdviewAppState {
  dark: boolean;
  panelZoom: Record<string, number>;
}
```

Instant installs a host implementation whose `useAppState` method subscribes
to Instant's store. The package uses `dark` to select Mermaid, D2, and code
themes. It uses `panelZoom[panelId]` to apply Instant's per-tab zoom setting.

This indirection exists because those values were already application-owned
when the viewer lived inside Instant. Moving another store into the package
would create separate theme and zoom state. The host interface keeps Instant's
existing store authoritative while removing source imports from the package
back into the application.

The same extraction rule applies to the rest of `MdviewHost`:

| Host member | Why it remains host-owned |
| --- | --- |
| `readText`, `readImage`, `listDir` | Instant performs native filesystem operations through Tauri |
| `watchFile` | Instant owns watcher sharing and teardown |
| `FileTree` | Instant supplies its canonical TreeTable file browser |
| `PanZoomViewport` | Instant supplies its shared media viewport |
| `openMdPanel`, `mdPanelId` | Instant owns the Dockview layout and panel identifiers |
| `registerPlugin` | Instant owns plugin discovery and routes |
| `registerZoomKind`, `resetPanelZoom` | Instant owns keyboard zoom and per-panel zoom state |
| `readPluginState`, `savePluginState` | Instant owns persisted plugin settings |
| diagnostic hooks | Instant owns render, lifecycle, and operation probes |

## Installing the host

The host must be installed before calling `registerMdview()` or mounting a
viewer component:

```ts
import {
  installMdviewHost,
  registerMdview,
  type MdviewHost,
} from "@hafley66/md";

const host: MdviewHost = {
  // Application implementations for filesystem, Dockview, state, TreeTable,
  // pan/zoom, persistence, zoom, routing, and diagnostics.
};

installMdviewHost(host);
registerMdview();
```

`getMdviewHost()` throws when a component reads the host before installation.

## Parsing and rendering

The viewer performs structural parsing and visual rendering as separate
operations.

`parseMdSections(text)` uses `remark-parse` to produce an mdast tree. It derives
an `MdDoc` containing:

- heading sections and parent-child relationships;
- stable heading IDs;
- source offsets for each section;
- list and long-item folding ranges.

The offsets let `MdPanel` pass the original, unmodified source slice for each
expanded section to Streamdown. Streamdown handles paragraphs, inline markup,
links, lists, tables, images, and code blocks. The structural model controls
which source slices exist in the React tree at a given time.

Links are intercepted by package React components. Fragment links expand the
required heading chain. Relative Markdown links resolve against the current
document and navigate the existing panel. Other links are delegated to
`MdviewHost.openHref`.

## Diagram rendering

`0_Streamdown.tsx` registers custom fence renderers for `mermaid` and `d2`.

Mermaid rendering initializes Mermaid with the current light or dark palette,
renders the source to SVG, and inserts the SVG into a clickable React
component.

D2 rendering dynamically imports `@terrastruct/d2` on the first D2 block,
creates one cached D2 instance, compiles the source, and renders the compiled
diagram to SVG. The dynamic import keeps the D2 renderer out of the initial
viewer execution path.

Both renderers use `DiagramLightbox`. The lightbox is a React portal mounted
under `document.body`; it rewrites the SVG `viewBox` for pointer pan and wheel
zoom. Instant's terminal diagram overlay also imports this lightbox, the shared
diagram palettes, and `renderD2` from this package.

## State and lifetime

| State | Storage | Lifetime |
| --- | --- | --- |
| Fold defaults and explorer visibility | `mdUi` signal plus host plugin persistence | Application sessions |
| Split layouts | `mdUi.layouts[panelId]` plus host plugin persistence | Application sessions |
| Current document path | Signal keyed by Dockview panel ID | Open panel |
| Loaded text and parsed `MdDoc` | `mdDocs[path]` signal | Cached document |
| Collapsed headings | Signal keyed by document path | Open document session |
| Folded list blocks | Signal keyed by document path | Open document session |
| Mermaid component result | React state | Mounted diagram |
| D2 renderer instance | Module-level cached promise and instance | JavaScript runtime |
| Open lightbox | React state | Mounted diagram or terminal overlay |

Filesystem watches call `reloadMdDoc(path)`, replacing the cached text and
parsed model. Signal subscriptions cause the mounted panel to render the new
document.

## Styling contract

Package components emit selectors including:

```text
.mdview-root
.mdview-content
.mdview-head
.mdview-streamdown
.mdview-mermaid
.mdview-d2
.diagram-lightbox
```

The package stylesheet owns Markdown layout, Streamdown/Shiki corrections,
fold controls, diagram surfaces, and lightbox layout. Its rules consume host
theme variables when available:

```css
var(--panel-bg)
var(--panel-fg)
var(--frame)
var(--row-hover)
var(--term-bg)
```

Instant defines those variables through its active skin. This makes the viewer
inherit panel colors and borders without importing Instant's stylesheet.
Mermaid and D2 use explicit paired palettes selected from the host's `dark`
state.

The package exports its generated stylesheet as `@hafley66/md/style.css`.
Hosts import that stylesheet once from their composition root.

## Public exports

```ts
installMdviewHost
getMdviewHost
registerMdview
openMarkdownPanel
parseMdSections
preloadD2
renderD2
DiagramLightbox
diagramSvgMarkup
diagramPalette
mermaidTheme
d2ThemeId
```

The package exports `MdviewHost` and `DiagramLightboxEntry` as types.
