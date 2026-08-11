# CanvasKit renderer lab

## Adapter boundary

`bin/render-canvaskit` accepts one `grapht-bench/0` JSON object per input line. The
`input` field may name a `grapht-geometry/0` manifest. When absent, the adapter generates
the deterministic `grid-1k`, `grid-5k`, or `grid-10k` fixture. It emits JSONL samples and
one terminal result and writes a receipt below `outputDirectory`.

## CanvasKit APIs

`CanvasKitInit` loads the official `canvaskit-wasm` distribution. A software surface from
`MakeSWCanvasSurface` provides a `Surface` and Skia `Canvas`; the scene owns both and calls
`surface.flush()` after each frame. Paths and paints are native resources and must be deleted.
The scene keeps camera and selection state in TypeScript, so pointer events only schedule a
draw and do not require a React render.

Paragraph drawing requires a `ParagraphBuilder`, `TextStyle`, and a layout width. The lab
keeps text to the selected node label and disposes the paragraph and builder after drawing.

## Measurements and seams

The shell receipt measures geometry load. Browser integration exposes draw and flush duration,
Wasm heap pages when `HEAPU8` is available, and the pointer camera/pick sequence. Browser
screenshot, trace, frame, and long-task collection belongs to the Playwright runner that hosts
`5_index.html`; the adapter protocol stays independent of that collector.

External geometry remains the seam: CanvasKit receives node IDs, f32 positions, and indexed
edges without depending on a layout algorithm. This lets the same manifest feed Cytoscape,
Sigma, and future renderers.
