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
