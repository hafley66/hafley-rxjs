# Renderers

- [The adapter contract](#the-adapter-contract)
- [Which adapters exist](#which-adapters-exist)
- [The render receipt](#the-render-receipt)
- [Document renderer gestures](#document-renderer-gestures)

## The adapter contract

A renderer is a `GraphFrameResource`: one `render(frame, receipt)` call plus an `unsubscribe`.
Declared at `packages/grapht/src/2_graph/10_renderer.ts:15`.

```ts
type GraphFrameResource<NodeData, EdgeData> = {
  render(frame: GraphFrame<NodeData, EdgeData>, receipt: GraphRenderReceipt): void
  unsubscribe(): void
}
```

The adapter owns no lifetime beyond this pair. `render` is pure projection of the current frame; the
resource is torn down through `unsubscribe` when the stream ends. `graphRenderer` wraps an acquire
function into an RxJS operator (`src/2_graph/10_renderer.ts:39`): it calls `acquire(host)` once per subscription
and `resource.unsubscribe()` in `finalize`.

## Which adapters exist

Every adapter is an interchangeable implementation over the same fixture graph, so their receipts
are directly comparable.

| directory | package | lane |
| --- | --- | --- |
| `adapters/2_render_cytoscape` | `@hafley66/grapht-render-cytoscape` | render |
| `adapters/3_render_canvaskit` | `@hafley66/grapht-render-canvaskit` | render |
| `adapters/4_render_sigma` | `@hafley66/grapht-render-sigma` | render |
| `adapters/5_render_vello_wgpu` | `@hafley66/grapht-render-vello-chromium` | render |
| `adapters/6_render_pixijs` | `@hafley66/grapht-render-pixijs` | render |
| `adapters/7_render_threejs` | `@hafley66/grapht-render-threejs` | render |

Layout adapters (`0_layout_grid_worker`, `1_layout_grid_wasm`) fill `LayoutParticipation: managed`
geometry rather than projecting a frame, so they sit beside, not behind, this contract.

## The render receipt

`GraphRenderReceipt` tells the adapter what changed since the last frame
(`src/2_graph/10_renderer.ts:8`), so an adapter can update in place instead of re-rendering the world.

| field | content |
| --- | --- |
| `enterIds` | ids in the new frame that were absent before |
| `updateIds` | ids present in both frames |
| `exitIds` | ids in the previous frame now gone |

`graphRenderReceipt` computes these from the sorted id sets (`src/2_graph/10_renderer.ts:25`). The caller keeps
`previousIds` across frames and feeds it back on the next call, which is why the same resource
moves a diagram forward frame by frame.

## Document renderer gestures

The document renderer answers a fixed set of gestures, named in `DOCUMENT_GESTURES`
(`packages/grapht/src/2_graph/14_gestureLegend.ts:9`), in the order a reader tries them.

| gesture | action |
| --- | --- |
| scroll | pan up and down |
| shift + scroll | pan left and right |
| cmd + scroll | zoom at the cursor |
| pinch | zoom at the cursor |
| drag | pan |
| drag on text | select text |

`createGestureLegend(host, hints)` renders a corner legend for these
(`src/2_graph/14_gestureLegend.ts:52`). It returns an element, a `setOpen` switch, a `toggled$` Observable that
the application runs at its own boundary, and a `remove` handle.
