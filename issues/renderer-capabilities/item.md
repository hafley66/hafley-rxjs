---
created: 2026-08-25
updated: 2026-08-25
type: epic
owner: sol-high
status: done
priority: high
epic: grapht-renderer-platform
labels:
- model:sol-high
- size:large
- lane:research
size: L
lane: research
collision: [packages-grapht]
closed: 2026-08-25
---

# Reconcile renderer capability lowerings

## Description

## Scope

Define capability and fallback contracts for Cytoscape and Pixi over one canonical topology and visual frame. Keep the Grapht trait surface mappable to React Flow and yEd-style rich graph editing. Sigma, Graphviz, and additional algorithm providers are deferred capability entries.

## Contract evidence

Hollow signatures live in `packages/grapht/src/29_rendererCapabilities.ts`.
`RendererCapabilityContract` is immutable data selected by renderer `kind`.
`RendererCapabilityReceipt` records each degraded, unsupported, or deferred
projection with its affected canonical IDs and fallback action.

### Capability matrix

| Renderer | Delivery | Hierarchy | Ports | Arbitrary visuals | Interaction | Layout | Rich selection | Viewport | High count |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cytoscape | first | supported through compound topology projection | degraded to resolved attachment geometry | degraded to supported native shapes or an overlay | supported and normalized | supported by Cytoscape layout adapters | degraded for text ranges through an overlay | supported and normalized | supported subject to measured adapter limits |
| Pixi | second | supported through retained containers | supported from resolved port geometry | supported by retained display objects | supported through federated events | unsupported; consumes precomputed `GraphGeometry` | degraded for text ranges through an overlay | supported and normalized | supported subject to measured adapter limits |
| React Flow | compatibility | supported through `parentId` and node extent | supported through handles | supported through custom node and edge components | supported and normalized | unsupported; consumes precomputed positions | degraded when selection addresses text inside a visual part | supported and normalized | degraded by DOM cardinality |
| yEd-style | compatibility | supported through nested groups | supported through path-relative port candidates | supported through graph visuals and labels | supported by the compatibility event map | supported as an external geometry producer | supported when the adapter preserves label and part identity | supported and normalized | deferred to an adapter measurement |
| Sigma | deferred | unsupported in the initial flat projection | unsupported in the initial projection | degraded to Sigma programs | supported for its native event set | degraded to external Graphology layouts | unsupported for text ranges | supported and normalized | supported subject to measured adapter limits |
| Graphviz | tertiary | degraded from clusters into explicit hierarchy | degraded from Graphviz port syntax into `PortLocation` | degraded to semantically bound SVG parts | unsupported in layout output | supported as an external geometry producer | unsupported until semantic SVG binding exists | unsupported in ingestion output | deferred to ingestion and binding measurements |

`supported`, `degraded`, `unsupported`, and `deferred` are data values. A
lowering emits a receipt for every matrix cell used in a frame whose value is
not `supported`. An unsupported item uses `omit`, `precompute`, `overlay`, or
`reject`; silent omission is outside the contract.

### Canonical and renderer-owned state

| Canonical state | Renderer-owned state |
| --- | --- |
| `GraphologyDocument.topology` and identity maps | Native Cytoscape elements, Pixi display objects, or compatibility handles keyed by canonical ID |
| Grapht hierarchy, visuals, ports, and layout participation | Host element and renderer resource ID |
| `GraphFrame.geometry` and presentation | Measured native bounds used as input to a later canonical geometry write |
| `viewport` | Last applied frame revision, native camera cache, and paint internals |
| `focus` | Ephemeral native hover and pointer-capture identity |
| `selection` | Native highlight handles derived from canonical selection |
| `translate` | Native transform handles derived from canonical translation |

Renderer-owned fields may cache the last applied canonical value. They do not
become a second authority. A native interaction emits `viewport`, `focus`,
`selection`, or `translate`; the reducer writes canonical state; the next frame
projects that state back to the active renderer.

### React Flow compatibility

- A React Flow node maps to a canonical topology node plus one `GraphVisual`.
- Source and target handles map to `GraphPort` values. Handle placement lowers
  from `PortLocation`; handle IDs remain renderer handles rather than graph IDs.
- `parentId` maps to `GraphHierarchy.parentById`. Parent extent and containment
  map to `LayoutParticipation` and resolved group bounds.
- Custom node and edge component parts map to `GraphVisual.parts`.
- viewport changes emit `kind: "viewport"`; focus changes emit `kind: "focus"`;
  selection changes emit `kind: "selection"`; position changes emit
  `kind: "translate"`.
- React Flow does not add fields to the canonical graph. Adapter-specific
  handles and component instances remain in `RendererOwnedState`.

### yEd-style editing compatibility

- Nested group nodes map to `GraphHierarchy.parentById` and explicit layout
  participation.
- Node, edge, and group labels are `GraphVisual.parts` bound to one canonical
  `graphId`.
- Node-boundary, side, and path-relative port candidates map to the five
  `PortLocation` forms. yEd path ratios and lengths retain their unit.
- Edge bends map to `GraphGeometry.routesById`; endpoint candidates map to
  ports before the route is lowered.
- Multiple relations with equal endpoints remain distinct through
  `GraphologyIdentity.edgeByGraphId` and unique physical edge keys.
- Label selection and editing address `(graphId, partId)` so selection does not
  depend on SVG parent traversal.

### Graphviz tertiary boundary

Graphviz ingestion produces a `GraphologyDocument`; layout output produces
`GraphGeometry`. SVG output is accepted for rich visual reuse only after the
adapter supplies an element-ID-to-graph-ID semantic binding table. DOM order,
SVG ancestry, generated class names, and title text are not semantic bindings.
Clusters, Graphviz ports, labels, splines, and parallel edges require explicit
import receipts. Graphviz interaction and raw SVG event inference remain
tertiary work.

### Instance timeline and lifetime

1. A renderer `kind` selects one immutable capability contract for the resource
   acquisition attempt.
2. One renderer resource is acquired for one host. Its `RendererOwnedState`
   begins empty and lives until renderer replacement or application teardown.
3. Each canonical frame is lowered against retained native handles. One
   `RendererProjectionReceipt` is emitted after the frame mutation boundary.
4. Native events write only normalized canonical interactions. The next frame
   is the sole path back into renderer projection.
5. `switchMap` replacement unsubscribes the active resource before acquiring
   the next `kind`. Its handles, measurements, hover, and pointer capture end
   with that resource.

Capability contracts have module lifetime. Receipts are immutable per-frame
values. Native handles and measurements have renderer-resource lifetime.

### Storage, read/write sequence, uniqueness, and cardinality

- There is one capability contract per renderer `kind`, one active renderer
  resource per host, and one native handle map per active resource.
- `nativeByGraphId` has at most one primary native handle per canonical graph
  ID. A renderer may own internal child handles, but they remain under that
  primary visual identity.
- A frame read resolves topology, hierarchy, visuals, ports, geometry,
  viewport, focus, selection, and translate in canonical order, then reads the
  capability cell for each requested feature.
- Supported work writes native handles and enters the applied-ID receipt.
  Degraded, unsupported, and deferred work also appends one capability receipt
  per `(renderer, frameRevisionId, capability, graphId)`.
- Native measurements return as values keyed by canonical ID. A later geometry
  reducer decides whether to write them; the renderer cannot write canonical
  geometry directly.
- Receipt IDs are sorted before serialization. The same frame and capability
  contract therefore produce deterministic receipt ordering.

### Counterexamples and stop conditions

- Treating a Cytoscape compound parent or React Flow `parentId` as canonical
  hierarchy creates renderer-specific graph semantics.
- Treating a React Flow handle ID as a graph ID aliases port identity with node
  or edge identity.
- Letting Pixi display-object coordinates become canonical geometry causes a
  renderer switch to lose movement state.
- Omitting an unsupported visual without a receipt makes fixture parity
  untestable.
- A text-range selection reduced to a graph-ID set loses `partId`, anchor, and
  focus offsets.
- Graphviz SVG without semantic binding stops at an artifact boundary; it is
  not traversed for inferred ownership.
- Projection stops on duplicate native primary handles, unknown graph IDs,
  an unlisted fallback, a receipt with unsorted or duplicate IDs, or a
  capability contract missing any matrix axis.

## Acceptance Criteria

- [x] Capability matrix covers hierarchy, ports, arbitrary visuals, interaction, layout, rich selection, viewport, and high-count rendering.
- [x] Unsupported and degraded behavior produces explicit receipts.
- [x] Renderer-owned state and canonical state boundaries are named.
- [x] React Flow handles and nested nodes map to Grapht traits without changing the canonical model.
- [x] yEd-style path ports, group nesting, labels, bends, and multi-edges map to Grapht traits.
- [x] Graphviz ingestion and SVG semantic-binding requirements are recorded as tertiary work.

## Tests Run

- [x] Targeted TypeScript 7 `--noEmit` check passes for `28_graphologyContract.ts` and `29_rendererCapabilities.ts` against current workspace sources.
- [x] `git diff --check` reports no whitespace errors for the issue diff.

## Implementation Notes

- Added only declarations, type exports, and issue evidence. Renderer
  implementations and call sites are unchanged.
