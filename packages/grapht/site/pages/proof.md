# Interactive proof

The large sequence opens in the document renderer. Switch to Cytoscape for native actors,
lifelines, groups, notes, and 125 message edges. SVG geometry is measured during import;
the native sequence retains no full SVG diagram in the DOM. The D2 architecture also has native
bindings: 51 connections, with object IDs and scoped endpoint relations recovered from D2 SVG metadata.
The paired examples exercise the same 3 actors, 4 messages, and 2 nested groups through D2 and Mermaid ingestion.

<iframe
  src="/hafley-rxjs/grapht/proof/index.html"
  style="width: 100%; height: calc(100vh - 10rem); border: 0"
  title="grapht interactive proof"
></iframe>

## Controls

| Gesture or control | Behavior |
| --- | --- |
| Scroll | Pan along wheel/trackpad axes |
| Shift + scroll | Horizontal pan |
| Ctrl/Cmd + scroll or trackpad pinch | Zoom at cursor |
| End wheel gesture | Damped pan/zoom momentum |
| Zoom / momentum settings | Stored sensitivity, momentum on/off, strength, decay, and maximum tail |
| Fit | Fit all, width, height, or readable text; cancels momentum. The chosen mode persists and applies on source load and resize |
| Paired examples | Equivalent D2 / Mermaid sequences, available in both renderers |
| Move actors / edges | Enable horizontal actor-lane dragging and vertical message-row dragging |
| Undo move / Redo move | Traverse the stored movement-event prefix; one drag commits one event |
| Actor ribbon / group headers | Toggle shared screen-space headers; hover uses the represented actor/group ID |
| Floating group + / − | Expand/collapse that group; keyboard Enter or Space also works |
| Hop colors | Switch between one hue with fading (default) and per-hop hues; preference persists |
| Interpolate hop colors | Blend the configurable From / To colors across the chosen hop distance; disable to use indexed palette colors |
| Dark mode (both renderers) | Change shared SVG/canvas/header colors; preference persists |
| Interaction / hover | Neighbors, upstream, downstream, both, or off; configurable depth |
| Relations | Traverse actor links or ordered sequence steps |
| Debug hover | Show logical ID, parent, endpoint IDs, source span, measured anchor, route attachment points, bindings, and incident relations |
| Group actors | Select actors and name a view group; original source stays available |
| Collapse | Hide descendants; sequence fragments compact vertically; expansion restores source geometry |
| Original source | Inspect the retained Mermaid or D2 text |

The document renderer supports text selection while movement is off. With movement enabled,
actor shapes and lifelines move horizontally, keeping message endpoints attached. Message rows
move vertically along the lanes. General architecture nodes move in both axes; dragging an
architecture edge bends its interior route while preserving endpoint anchors. Undo/redo and the
movement list persist in local storage, keyed by a fingerprint of the retained source metadata.
An edited source receives a separate history. View grouping itself is not stored across reloads.

The debug inspector lets pointer gestures pass through while movement mode is enabled.

Camera, source/collapse, movement, and hover state have separate signal dependencies. Hover and
camera changes do not rerun collapse geometry. The active renderer consumes derived frames and
hover paint; renderer switches release the previous effect wiring and resource. SVG primitive
measurement caches retain only revisions used by the current frame.

Hover is transient: it does not commit selection or movement history. Focus and first-hop
neighbors use full intensity. Fading is the default. With **Hop colors** enabled, the default
interpolation runs from amber to blue over six hops; both endpoints and distance are configurable.
Disable interpolation for the preset indexed palette. Subsequent
hops multiply opacity by 0.55, with unrelated context at 0.15. Edges interpolate their logical
source and target colors and opacity in both modes; arrowheads use their endpoint paint.
SVG uses user-space gradients, including horizontal and reversed paths. Native Cytoscape uses
[source-to-target line gradients](https://js.cytoscape.org/#style/edge-line).
The pinned Cytoscape 3.34.0 patch preserves RGBA stop and arrow alpha in its canvas renderer;
upstream otherwise ignores those alpha components. The patch covers the source, ESM, CJS,
and unminified UMD entries used by this workspace.

Sticky actor names use the same hover origin as their in-diagram labels. Group headers show the
nearest reached member's hop. Collapsed ownership groups are traversal components: their internal
members share a distance, and each boundary crossing consumes one hop. This uses explicit group
membership; it does not infer strongly connected components from arbitrary cycles.
Parallel branches receive equal step distance and converge at their following event. Actor links and
sequence steps are separate relations because repeated messages between the same actors have distinct order.
Native mobile touch-pinch momentum is unverified.

Actor-group collapse hides incident messages and retains lane spacing; it does not create aggregated
boundary messages. Message groups with no remaining visible content disappear recursively, including
their floating headers and controls. Their empty rows compact unless a visible parallel sibling still
occupies them. Groups with surviving messages or notes remain. Expanding actors restores their groups.
Fragment collapse preserves a header row and compacts vertical space. View groups
and collapsed state survive renderer switches and last until source replacement or page reload.

## Shared styles and layout policy lab

Both renderers accept `applyTheme("light" | "dark" | GraphStyle)`. Presets and caller palettes
feed one Cytoscape-compatible rule set. `GraphStyle.hopMode` accepts `"fade"` (default) or `"color"`; `hopColors` customizes the palette. The SVG adapter maps known Mermaid/D2 primitive paint
properties, retaining source geometry and text metrics. Theme changes preserve the camera.

Open **layout policy** to try two draggable groups. Moving a child freezes automatic layout for
its group. Collapse allows automatic placement of the collapsed representation. The **auto layout
on expand** checkbox chooses automatic placement or saved manual positions on expansion. Saved
positions survive either choice, and the other group keeps its own mode. The **auto layout** button
only rearranges groups still in automatic mode. This lab uses Cytoscape's grid layout; it does not
enable manual movement for the large sequence. The lab state lasts until the page ends.

## Performance evidence

The docs-kit widget consumes `@hafley66/trace` frame and memory samples. FPS means animation-frame
callback delivery. Heap is a browser JS estimate; DOM counts cover descendants of the graph host.
The external benchmark uses trace's OS PID RSS collector for resident memory and its Chromium
collector for heap breakdowns. The hosted widget cannot read OS RSS directly.

[Benchmark and raw measurements](https://github.com/hafley66/hafley-rxjs/blob/main/packages/grapht/adapters/2_render_cytoscape/bench/4_report.md).
[Remaining interaction work](./roadmap).

## Stored wheel settings

Open **Interaction / hover → Zoom / momentum settings**. Default zoom sensitivity is 1.2× the
previous response. Momentum defaults remain strength 1, decay 85 ms, and a maximum 500 ms tail.
Changes apply immediately to both renderers and cancel an active tail. Reset restores those defaults.

The proof reuses `StorageSignal`, `storageSignal(urlAdapter("wheel"))`, and `sync` from
`@hafley66/signals`. Local settings survive reloads; the `wheel` URL parameter overrides local settings
when opening a shared URL. Changes replace the URL entry, preserving unrelated parameters and the hash.

## SVG import

**Open SVG** accepts a local `.svg` file and optionally a `.json` file containing `graph` and
`bindings`. Files stay in the browser. The source viewBox (or pixel width/height) sets the initial
camera. Original source is retained. Duplicate element IDs, missing binding targets, and invalid graph
references are rejected. A plain SVG opens in document mode. Native Cytoscape requires explicit
semantic bindings, using the supported primitive roles; arbitrary SVG artwork remains source-rendered.
An inferred frame supplies `shape` and `connector` bindings, so native rendering draws the recovered
routes rather than inventing curves.
The architecture fixture recovers these bindings from D2-generated object and connection identities.

## SVG parse

**svg parse** loads the rendered SVG of the current paired example and recovers a graph from
geometry alone, then scores it against the fixture's authored relations: matched, missed, and extra
rows sit under the panel. The button flips between the source parse and the SVG parse of the same
diagram, so D2, Mermaid, D2-from-SVG, and Mermaid-from-SVG read as one comparison. The scan list
below the score is every step the inferrer took, oldest first, and is readable from the console as
`graphtInfer.steps.$()`. Current score: D2 sequence 3 of 3 authored edges with no extras; Mermaid
3 of 3 with 4 extras; the large sequence 36 of 41 (16 extras are rendered lifelines resolving to
their participants, 7 are generated-id pairs on unlabelled frames).

DOM sequence lifelines keep a one-pixel stroke at fitted zoom. Hop palettes are shared through
`GraphStyle.hopColors`, with separate light/dark defaults and the existing distance opacity.

## Large diagrams and zoom configuration

Fit-all contains the source geometry without changing source orientation. The architecture source
explicitly sets `direction: right` and spans 25,347 × 4,431 source units. **Readable text** uses a
minimum scale of 0.75 and starts at the upper-left when the diagram exceeds the viewport; pan to
inspect the rest. Fit width and fit height expose the other axis choices. Source layout remains
a D2/Mermaid authoring choice, independent of camera fit.

Open **Interaction / hover → Zoom / momentum settings**. Defaults and clamping live in
`src/lib/1_wheelCamera.ts`: sensitivity 1.2, momentum enabled, strength 1, decay 85 ms, maximum
tail 500 ms. The proof stores these through `StorageSignal("grapht.proof.wheel", ...)` and syncs
the `wheel` URL parameter in `adapters/2_render_cytoscape/proof/live.ts`. Both renderers receive
the same settings.

The paired fixture sources are `fixtures/sequence/paired-d2.d2` and
`fixtures/sequence/paired-mermaid.mmd`. Regenerate their measured SVG and graph bindings with
`node scripts/3_generate_sequence_fixture.mjs paired-d2 d2` and
`node scripts/3_generate_sequence_fixture.mjs paired-mermaid mermaid` from the Grapht package.

## Native labels and hover paint

Native D2 architecture labels retain source text positions and line breaks. Their wrapping width
comes from the measured SVG label bounds; container text is no longer repeated at the container center.

Hover input is coalesced once per animation frame and deduplicated by logical focus IDs. Native paint
compares hop/endpoint state and changes only differing style properties. Palette RGB conversion is
cached, avoiding repeated style reads that flush Cytoscape batches. Repeating an unchanged hover
performs zero native style writes; unrelated actor paint remains unchanged.

Local Chromium headless measurement, 90 alternating logical hover transitions with five warm-up
frames excluded, using the same fixtures and default camera/depth:

| Fixture | Native elements | Previous p95 frame | Updated p95 frame | Frames over 32 ms, previous → updated |
| --- | ---: | ---: | ---: | ---: |
| Architecture | 291 | 70.3 ms | 20.9 ms | 85 → 0 |
| Large sequence | 444 | 86.3 ms | 26.4 ms | 85 → 0 |

Timing varies by device. Reproduce with
`node adapters/2_render_cytoscape/proof/3_hoverProbe.mjs <proof-url>` from the Grapht package.
The renderer browser suite checks label placement, wrapping, unchanged-hover writes, and unrelated
actor invalidation independently of timing.

## Ingest and hover coverage

Sequence examples load source-parsed actor/message relations from generated fixture JSON;
SVG supplies measured geometry and bindings. The D2 architecture example instead recovers
endpoint IDs from D2-generated SVG classes. Generic SVG needs a graph and bindings sidecar
for relational hover. Loading arbitrary `.d2` or `.mmd` files is not implemented in this proof.
Sequence group nesting in the proof currently uses measured rectangle containment.

Document hover paints the children of bound D2 shape groups directly so child-level source
and theme strokes cannot override the highlight. Debug inspection passes pointer input through
to the diagram in both editing and viewing modes. The production probe moves a real pointer
between Alice and Archive in both paired source examples and both renderers, with debug
inspection enabled, and checks the resulting distance fading. Browser tests additionally check
computed primitive stroke colors and restoration after hover clears.
