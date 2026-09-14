# Interactive proof

The large sequence opens in the document renderer. Switch to Cytoscape for native actors,
lifelines, groups, notes, and 125 message edges. SVG geometry is measured during import;
the native sequence retains no full SVG diagram in the DOM. The architecture fixture is
document-only because it has no native graph bindings.

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
| Fit | Restore fitted camera and cancel momentum |
| Actor ribbon / group headers | Toggle shared screen-space headers |
| Dark mode (both renderers) | Change shared SVG/canvas/header colors; preference persists |
| Interaction / hover | Neighbors, upstream, downstream, both, or off; configurable depth |
| Relations | Traverse actor links or ordered sequence steps |
| Debug hover | Show logical ID, parent, endpoint IDs, source span, measured anchor, route attachment points, bindings, and incident relations |
| Group actors | Select actors and name a view group; original source stays available |
| Collapse | Hide descendants; sequence fragments compact vertically; expansion restores source geometry |
| Original source | Inspect the retained Mermaid or D2 text |

The document renderer supports text selection. Native sequence shapes are currently ungrabbable.
Manual movement, undo, and arrangement persistence are not connected in this proof. Hover is transient:
it does not commit selection or history, move the camera, or cancel momentum. Focus and first-hop
neighbors use full intensity; subsequent hops multiply opacity by 0.55, with unrelated context at 0.15.
Parallel branches receive equal step distance and converge at their following event. Actor links and
sequence steps are separate relations because repeated messages between the same actors have distinct order.
Native mobile touch-pinch momentum is unverified.

Actor-group collapse hides incident messages and retains lane spacing; it does not create aggregated
boundary messages. Fragment collapse preserves a header row and compacts vertical space. View groups
and collapsed state survive renderer switches and last until source replacement or page reload.

## Shared styles and layout policy lab

Both renderers accept `applyTheme("light" | "dark" | GraphStyle)`. Presets and caller palettes
feed one Cytoscape-compatible rule set. The SVG adapter maps known Mermaid/D2 primitive paint
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
