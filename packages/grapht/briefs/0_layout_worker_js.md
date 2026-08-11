# Flash brief: JavaScript worker layout adapter

Implement only the JavaScript worker layout adapter in `packages/grapht/adapters/0_layout_grid_worker/`.

Read `packages/grapht/README.md`, the root `AGENTS.md`, and the benchmark protocol plan at
`/Users/chrishafley/projects/hafley-rxjs/packages/grapht/3_implementation_agnostic_bench_plan.md`.
The protocol implementation may still be on another lane, so keep this adapter independently
testable and isolate protocol compatibility behind `0_protocol.ts`.

Requirements:

- Deterministic grid layout over compact node and edge inputs.
- Actual Web Worker execution, with transfer timing recorded separately from layout timing.
- Shell-invokable adapter boundary using JSONL stdin/stdout.
- Typed-array geometry artifact compatible with `grapht-geometry/0`.
- Deterministic tests and an executable receipt.
- `LEARNINGS.md` recording worker lifecycle, transfer ownership, measured costs, library/API
  usage, and integration seams.
- Use author-driven numeric filenames.
- Run relevant tests and build. Commit all lane changes with a focused commit message.

Do not implement a renderer or modify unrelated packages.
