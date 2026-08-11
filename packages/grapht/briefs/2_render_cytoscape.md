# Flash brief: Cytoscape renderer lab

Implement only the Cytoscape projection adapter in `packages/grapht/adapters/2_render_cytoscape/`.

Read `packages/grapht/README.md`, the root `AGENTS.md`, and
`/Users/chrishafley/projects/hafley-rxjs/packages/grapht/3_implementation_agnostic_bench_plan.md`.

Requirements:

- Consume a graph fixture plus external `grapht-geometry/0` positions through Cytoscape's
  preset layout.
- Exercise first render, pan, zoom, picking/selection, camera readback, and disposal.
- Produce JSONL samples, screenshot, browser trace, and correctness receipt.
- Test 1k, 5k, and 10k fixtures without embedding a layout implementation.
- `LEARNINGS.md` recording Cytoscape APIs/extensions used, events, batching, viewport behavior,
  renderer limits observed, measured costs, and integration seams.
- Keep application state outside React; React is optional lab composition only.
- Use author-driven numeric filenames. Run tests/build. Commit all lane changes.

Do not modify Cytoscape internals or unrelated packages.
