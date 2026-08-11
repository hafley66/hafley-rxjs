# Flash brief: Sigma renderer lab

Implement only the Sigma projection adapter in `packages/grapht/adapters/4_render_sigma/`.

Read `packages/grapht/README.md`, the root `AGENTS.md`, and
`/Users/chrishafley/projects/hafley-rxjs/packages/grapht/3_implementation_agnostic_bench_plan.md`.

Requirements:

- Use Sigma with Graphology and consume external `grapht-geometry/0` positions.
- Exercise graph import, WebGL initialization, first render, pan, zoom, picking/selection,
  camera readback, visible counts, and disposal.
- Produce JSONL samples, screenshot, browser trace, and correctness receipt.
- Test 1k, 5k, and 10k fixtures without embedding a layout implementation.
- `LEARNINGS.md` recording Sigma and Graphology APIs, reducers/programs/events, WebGL behavior,
  measured costs, renderer limits observed, and integration seams.
- Keep durable state outside React. Use author-driven numeric filenames.
- Run tests/build. Commit all lane changes.

Do not modify Sigma internals or unrelated packages.
