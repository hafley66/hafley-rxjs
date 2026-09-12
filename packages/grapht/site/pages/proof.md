# Interactive proof

The rendered-artifact proof app: a sealed SVG diagram (from the `0_rendered_artifact_state_epic.d2`
fixture) panned, zoomed, and selected in both the document and cytoscape renderers.

<iframe
  src="/hafley-rxjs/grapht/proof/index.html"
  style="width: 100%; height: calc(100vh - 10rem); border: 0"
  title="grapht interactive proof"
></iframe>

## Wheel semantics

| gesture | action |
| --- | --- |
| plain scroll | vertical pan |
| shift + scroll | horizontal pan |
| cmd/ctrl + scroll | zoom at the cursor |
| double-click | select under the cursor |
| fit button | re-fit the graph to the viewport |
