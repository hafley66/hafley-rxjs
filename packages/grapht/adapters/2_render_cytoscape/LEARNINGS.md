# Cytoscape renderer lab

## Adapter boundary

`bin/grapht-adapter-render-cytoscape.ts` accepts one `grapht-bench/0` JSON object per
input line. `input` may point to a `grapht-geometry/0` manifest. Without it, the adapter
generates deterministic `grid-1k`, `grid-5k`, or `grid-10k` geometry. It emits one sample
and one terminal result and writes a JSON receipt, SVG screenshot artifact, and trace JSON.

## Cytoscape APIs exercised

The adapter creates elements with `cytoscape`, applies external positions through the `preset`
layout, and keeps layout out of the projection. `fit`, `pan`, and `zoom` exercise viewport
state. `node.select`, `:selected`, `cy.pan`, and `cy.zoom` provide selection and camera
readback. `cy.destroy` is the disposal boundary. The same projection object works headless in
the shell receipt and mounted in the browser lab.

The interaction sequence is deterministic: fit, pan, zoom around a rendered point, select
`n0_0`, read camera and selection, then dispose. The shell process records phase durations;
browser screenshot, trace, frame, heap, DOM, and long-task collection can wrap `index.html`
without changing the adapter protocol.

## Integration seam

Geometry IDs and indexed f32 positions are external inputs. Cytoscape receives only nodes,
edges, and positions, so a worker or Wasm layout adapter can generate the manifest without
the renderer importing that implementation.

## GPU explorer rendering

`createCytoscapeGraphFrameResource(host, interactions, undefined, { gpu: true })`
requests WebGL2, with Canvas fallback when context creation is unavailable.
The boop2 types explorer enables it. Other callers keep Canvas by default.

`5b_gpu.ts` hooks the pinned Cytoscape 3.34 drawing methods. It caches element
bounds until add/remove/position/style/data/bounds events, and skips submissions
outside the viewport plus 64 screen pixels. Bounds include labels and crossing
edges. It keeps all elements and original picking indexes; the minimap uses its own cached schematic overview. Segment routes submit straight spans because
3.34 otherwise interprets their bends as Bezier controls. Recheck these hooks
when upgrading Cytoscape. This is viewport culling, without overlap occlusion.
The renderer still visits the element list each frame.

Camera-only frames with unchanged immutable graph, geometry and presentation
parts skip definitions and element mutations when there are no DOM overlays.
The 200x150 minimap compresses X/Y independently so tall trees remain visible.
Navigator handles click/drag input; the overview and viewport share the same axis
scales. It renders node boxes and edge spans without labels.
Minimap snapshots refresh on content changes, resize, drag completion and theme;
pan/zoom only moves the viewport rectangle. Keep per-frame counters in memory:
writing host attributes triggers Cytoscape's mutation observer and resize work.

Measured with 2,920 expanded TypeSpec nodes, 1400x900 Chromium: 65 submitted,
8,683 culled (including invisible anchors). Software WebGL (SwiftShader) used
2,959ms main-thread time in the pan workload, versus 2,489ms Canvas; hardware GPU
performance remains unmeasured. Both cached-minimap paths produced zero pan/zoom
PNG snapshots. Tests live in `18_tree.e2e.test.ts` and `19_gpu.e2e.test.ts`.
