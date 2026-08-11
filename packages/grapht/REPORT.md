# Grapht CanvasKit and Vello scenario handlers

Implements the exhaustive 32-key `BenchScenarioHandlers<State, Sample>` contract as headless
scenario reducers for the CanvasKit (JS) and Vello (Rust) renderers under `packages/grapht`.
11 required scenarios are fully reduced; the remaining 21 keys return a typed `unsupported`
sample. State reduction preserves the renderer instance for pass-through scenarios and
exposes `graph-replace` / `graph-dispose` explicitly.

## Commit

Single lane commit on `feature/grapht-flash-scenarios`, parent `74531bb`.

## Changed files

| File | Change |
| --- | --- |
| `adapters/3_render_canvaskit/9_scenarioTypes.ts` | `BenchScenario` vocabulary, argument shapes, `BenchScenarioHandlers` contract shape, `frameStats`, `measureUploadBytes` |
| `adapters/3_render_canvaskit/9_scenario.ts` | CanvasKit `ScenarioState` + `ScenarioSample`, all 32 handlers, `reduce` reducer, renderer replacement/disposal |
| `adapters/3_render_canvaskit/9_scenarioKeys.ts` | `SUPPORTED` list (11) and key re-exports |
| `adapters/3_render_canvaskit/9_scenario.test.ts` | deterministic `test.each` specs (47 tests) |
| `adapters/3_render_canvaskit/10_scenario_lab.ts` | headless browser lab driving the 11 supported scenarios |
| `adapters/3_render_canvaskit/11_scenario_index.html` | lab entry page |
| `adapters/3_render_canvaskit/12_scenario_shot.mjs` | Playwright screenshot driver (visual-validity gated) |
| `adapters/3_render_canvaskit/justfile` | `scenario-test`, `scenario-shot`, `scenario` recipes |
| `adapters/3_render_canvaskit/package.json` | `scenario:test`, `scenario:shot` scripts |
| `adapters/3_render_canvaskit/vite.config.ts` | second build input for the scenario lab |
| `adapters/5_render_vello_wgpu/src/scenario.rs` | Rust `ScenarioState` + `ScenarioSample`, all 32 handlers, `handle_scenario` |
| `adapters/5_render_vello_wgpu/src/bin/6_scenario_probe.rs` | native probe: `list`, per-scenario JSONL samples |
| `adapters/5_render_vello_wgpu/src/lib.rs` | `pub mod scenario` |
| `adapters/5_render_vello_wgpu/tests/1_scenario.rs` | deterministic Rust tests (9) |
| `adapters/5_render_vello_wgpu/justfile` | `scenario-*` recipes + `scenario-receipt` |
| `adapters/5_render_vello_wgpu/receipts/scenarios.receipt.jsonl` | native receipt over 11 supported + 1 unsupported |
| `results/scenario_screens/canvaskit-scenarios-1000.png` | headless screenshot |
| `results/scenario_screens/receipt.json` | CanvasKit scenario lab receipt |

Core files untouched: `src/*`, Cytoscape (`adapters/2_*`), Sigma (`adapters/4_*`).

## Commands

CanvasKit:

```bash
cd packages/grapht/adapters/3_render_canvaskit
pnpm exec tsc --noEmit -p tsconfig.json        # typecheck
pnpm exec vitest run 9_scenario.test.ts        # 47 tests pass
just scenario-test                              # vitest only
just scenario-shot 1000                         # headless screenshot + receipt (visual-gated)
```

Vello:

```bash
cd packages/grapht/adapters/5_render_vello_wgpu
cargo test --test 1_scenario                    # 9 tests pass
cargo test                                      # full suite unchanged
rustfmt --edition 2021 --check src/scenario.rs src/bin/6_scenario_probe.rs tests/1_scenario.rs src/lib.rs
just scenario-all                               # test + key list
just scenario-receipt                           # writes receipts/scenarios.receipt.jsonl
```

## Receipts

- `results/scenario_screens/receipt.json`: status `healthy`, 1024x768 SW surface flushed,
  `visualValidity.valid = true` (surface attached, node/edge draw counts match fixture,
  position span > 0). Screenshot PNG alongside.
- `adapters/5_render_vello_wgpu/receipts/scenarios.receipt.jsonl`: one JSON sample per
  supported scenario plus one unsupported key, from the native probe.
- CanvasKit sample shape: `latencyMs`, optional `frame {p50,p95,max,droppedFrames}`,
  `memory {jsHeapUsedBytes,wasmPages}`, `visibility {visibleNodeCount,visibleEdgeCount}`,
  `draw {drawCount}`, `uploadBytes`, `counters {nodeCount,edgeCount,visibleNodeCount,generation}`.
- Vello sample shape: same fields; frame stats and upload bytes computed on packed
  `Vec<[f32;2]>` positions + `Vec<[u32;2]>` edges, never per-element JS objects.

## Supported scenarios (11)

| key | state effect |
| --- | --- |
| `camera-pan` | per-frame camera translation |
| `camera-wheel-zoom` | anchored zoom factor from `deltaY` |
| `style-update` | node color rewrite |
| `position-update` | offset first `nodeCount` positions |
| `viewport-resize` | viewport width/height, renderer slot preserved |
| `group-collapse` | hide 100-node group slabs; visibility recounts edges |
| `group-expand` | restore group slabs |
| `layout-apply` | deterministic grid snap (10px spacing) |
| `position-animation` | frame stats + bounded p50/p95/max/dropped; upload bytes |
| `graph-replace` | bumps `generation`, dispose prior renderer + fresh instance (via reducer factory) |
| `graph-dispose` | `disposed=true`, renderer slot cleared, generation bump |

## Unsupported scenarios (21)

`camera-pinch-zoom`, `device-pixel-ratio-change`, `node-insert`, `node-delete`,
`edge-insert`, `edge-delete`, `visibility-hide`, `visibility-show`, `layout-run`,
`style-animation`, `node-click`, `box-select`, `node-hover`, `node-pick`, `graph-load`,
`graph-clear`, `graph-reload`, `labels-none`, `labels-visible`, `labels-fixed-count`,
`labels-dense`.

Each returns `{ counters: { unsupported: 1, ... } }`, `supported: false`, `phase:
"unsupported"`, and leaves state structurally unchanged.

## Core contract gaps

- `src/0_benchProtocol.ts` ships `BenchScenarioHandlers` as type-only with `Sample` as
  `unknown`. No shared `BenchSample`-style measurement record exists for scenario latency,
  frame p50/p95/max, dropped frames, memory, upload bytes, draw count, or visible counts;
  each adapter re-declares an adapter-local `ScenarioSample`. A shared schema belongs in the
  core package.
- The handler signature is `(state, args)`. `graph-replace` must construct a fresh renderer
  instance, which the pure reducer cannot: both adapters thread a renderer factory through
  their wrapper (`reduce` / `handle_scenario`). A core contract note is warranted.
- The scenario vocabulary (32 keys) is duplicated per adapter rather than imported from core
  because adapters do not depend on `@hafley66/grapht`. Consider exporting `BENCH_SCENARIOS`
  + argument shapes from core and importing them.
- `graph-live/dispose semantics` : disposal is represented by nulling the renderer slot and
  setting `disposed`; the contract has no explicit "peer is disposed" signal beyond the
  sample counters.
