# Flash brief: CanvasKit renderer lab

Implement only the CanvasKit projection adapter in `packages/grapht/adapters/3_render_canvaskit/`.

Read `packages/grapht/README.md`, the root `AGENTS.md`, and
`/Users/chrishafley/projects/hafley-rxjs/packages/grapht/3_implementation_agnostic_bench_plan.md`.

Requirements:

- Use the official Skia CanvasKit Wasm distribution.
- Consume a graph fixture plus external `grapht-geometry/0` positions.
- Implement drawing, camera pan/zoom, picking/selection, and disposal within the adapter.
- Record Wasm bytes, compile/instantiate, scene construction, first render, interaction,
  memory pages, frame samples, and long tasks.
- Produce JSONL samples, screenshot, browser trace, and correctness receipt for 1k, 5k, 10k.
- `LEARNINGS.md` recording CanvasKit APIs, surface lifecycle, text/path handling, Wasm memory,
  measured costs, and integration seams.
- Use author-driven numeric filenames. Run tests/build. Commit all lane changes.

Do not modify CanvasKit or unrelated packages.
