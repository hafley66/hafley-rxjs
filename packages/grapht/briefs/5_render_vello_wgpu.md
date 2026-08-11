# Flash brief: Vello/wgpu renderer lab

Implement only the Vello/wgpu projection adapter in `packages/grapht/adapters/5_render_vello_wgpu/`.

Read `packages/grapht/README.md`, the root `AGENTS.md`, and
`/Users/chrishafley/projects/hafley-rxjs/packages/grapht/3_implementation_agnostic_bench_plan.md`.

Requirements:

- Use Rust Vello through wgpu/WebGPU and compile the browser target to Wasm.
- Consume a graph fixture plus external `grapht-geometry/0` positions.
- Exercise scene construction, first render, camera pan/zoom, picking/selection boundary,
  device/surface lifecycle, and disposal.
- Record Wasm load, adapter/device request, pipeline initialization, scene encoding, render,
  memory, frame samples, and long tasks.
- Produce JSONL samples, screenshot, browser trace, and correctness receipt for feasible fixture
  sizes; record explicit capability failures rather than silently skipping them.
- `LEARNINGS.md` recording Vello/wgpu APIs and versions, WebGPU limits, scene encoding, Wasm
  boundary, measured costs, and integration seams.
- Use author-driven numeric filenames. Run Rust and browser tests/builds. Commit all lane changes.

Do not modify Vello/wgpu or unrelated packages.
