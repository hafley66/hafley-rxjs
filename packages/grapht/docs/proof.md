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
| Fit | Restore fitted camera and cancel momentum |
| Actor ribbon / group headers | Toggle shared screen-space headers |
| Dark mode (Cytoscape) | Change native canvas and header colors; preference persists |

The document renderer supports text selection. Native sequence shapes are currently ungrabbable.
Manual movement, undo, and arrangement persistence are not connected in this proof. Cytoscape emits
focus/selection inputs, but the proof does not consume them into visible hover or neighborhood
highlights. Hop-gradient highlighting remains planned. Native mobile touch-pinch momentum is unverified.

## Performance evidence

The docs-kit widget consumes `@hafley66/trace` frame and memory samples. FPS means animation-frame
callback delivery. Heap is a browser JS estimate; DOM counts cover descendants of the graph host.
The external benchmark uses trace's OS PID RSS collector for resident memory and its Chromium
collector for heap breakdowns. The hosted widget cannot read OS RSS directly.

[Benchmark and raw measurements](https://github.com/hafley66/hafley-rxjs/blob/main/packages/grapht/adapters/2_render_cytoscape/bench/4_report.md).
[Remaining interaction work](./roadmap).
