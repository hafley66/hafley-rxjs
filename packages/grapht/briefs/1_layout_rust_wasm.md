# Flash brief: Rust/Wasm worker layout adapter

Implement only the Rust/Wasm worker layout adapter in `packages/grapht/adapters/1_layout_grid_wasm/`.

Read `packages/grapht/README.md`, the root `AGENTS.md`, and
`/Users/chrishafley/projects/hafley-rxjs/packages/grapht/3_implementation_agnostic_bench_plan.md`.
Keep protocol compatibility isolated because the protocol lane is merging separately.

Requirements:

- Rust crate compiled for `wasm32-unknown-unknown` with browser loading through standards-based
  WebAssembly APIs or minimal wasm-bindgen glue where required.
- Run layout inside a Web Worker.
- Accept compact typed arrays and emit deterministic `grapht-geometry/0` artifacts.
- Record Wasm load, compile/instantiate, transfer, layout, serialization, and total phases.
- Shell-invokable JSONL adapter, deterministic tests, and an executable receipt.
- `LEARNINGS.md` covering the selected Rust crates, Wasm memory layout, JS/Wasm ownership,
  worker lifecycle, browser headers/capabilities, measured costs, and integration seams.
- Use author-driven numeric filenames.
- Run relevant Rust and TypeScript tests/builds. Commit all lane changes.

Do not implement a renderer or modify unrelated packages.
