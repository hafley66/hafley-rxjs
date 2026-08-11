# Sigma projection adapter learnings

## Boundary

`src/3_protocol_adapter.ts` accepts one `grapht-bench/0` JSONL request on stdin and emits
JSONL samples plus one terminal result. It reads only a `grapht-geometry/0` manifest and
its referenced node, edge, and little-endian `f32` position files. The browser adapter
uses the same fixture files and `src/2_projection.ts`; no layout is run in this package.

## Sigma and Graphology

- Graphology stores node attributes for `x`, `y`, `size`, `label`, and `color`.
- `Sigma` receives the Graphology instance and a container and owns WebGL canvas layers,
  camera transforms, viewport refresh, picking, and pointer interaction.
- `preset` geometry is represented by Graphology node attributes, so an external layout
  can be substituted by changing only the manifest input.
- `getNodeDisplayData`, `graphToViewport`, `viewRectangle`, and camera `getState` expose
  the readback needed for selection, visible counts, and correctness receipts.
- `kill()` disposes Sigma's renderers and event resources. The adapter keeps durable graph
  data outside the Sigma instance and treats the Sigma object as a browser lifetime handle.

## Measurement

The shell receipt measures manifest load and Graphology import. The browser lab exercises
first render, zoom, pan, camera readback, visible-node count, WebGL canvas discovery, and
disposal. Playwright records screenshots and traces. Browser heap and long-task counters
remain environment-dependent and belong in the browser harness when exposed.

## Integration seams

The only durable input is `grapht-geometry/0`. Cytoscape, CanvasKit, Sigma, and future
renderers can consume the same manifest. Camera and selection are projection state. A
placement journal can persist their values without serializing Sigma or Graphology.
