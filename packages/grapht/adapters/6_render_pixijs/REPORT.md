# Grapht PixiJS v8 renderer adapter

## TOC

1. Summary
2. Commands
3. Versions
4. Adapter layout
5. Scenario contract (conformance)
6. Scenario table
7. Test counts
8. Receipts
9. Measured results
10. Renderer and harness failures

## 1. Summary

A numbered PixiJS v8 renderer lane (`adapters/6_render_pixijs`) for the `grapht-bench/0`
contract. It drives one shared common JSON graph fixture (`grapht-render-fixture/0`,
`grid-1k`/`grid-5k`/`grid-10k`) through two renderer modes (WebGL, WebGPU) and two
node representations (retained `Container`/`Graphics`, and `ParticleContainer` with
edges as a single batched `MeshGeometry`). The renderer name, representation, node
count, and scenario are selected through the existing benchmark contract: URL query
params in the browser lab, `parameters` in the shell protocol adapter.

Canonical scenario types, the scenario union, handler types, measurement/result
schemas, and the shared runner come from `packages/grapht/src` (0_benchProtocol,
11_scenarios, 10_rendererFixture, 1_geometryProtocol). No scenario names, fixture
types, result types, runner logic, or measurement schemas are duplicated in this
adapter. Conformance is compile-time via `BenchScenarioHandlers<PixiScenarioState, ScenarioSample>`:
a missing scenario key is a type error.

## 2. Commands

| Step | Command |
| --- | --- |
| Generate common fixtures | `node packages/grapht/scripts/0_generate_renderer_fixture.mjs 1000 \| 5000 \| 10000` |
| Typecheck | `pnpm --dir packages/grapht/adapters/6_render_pixijs typecheck` |
| Unit tests | `pnpm --dir packages/grapht/adapters/6_render_pixijs test` |
| Browser tests (headless) | `pnpm exec --dir packages/grapht/adapters/6_render_pixijs playwright test -c playwright.config.ts` |
| Full lab (fixtures + browser) | `pnpm --dir packages/grapht/adapters/6_render_pixijs run lab` |
| Shell protocol adapter | `pnpm --dir packages/grapht/adapters/6_render_pixijs bench < grid-1k request JSONL>` |

`just` recipes (the only headed path is `headed-pixijs`):

| Recipe | Action |
| --- | --- |
| `just test-pixijs` | typecheck + vitest unit tests |
| `just browser-pixijs` | headless Playwright run, writes PNG + JSON receipts |
| `just receipt-pixijs` | shell-protocol receipt through the adapter |
| `just headed-pixijs` | headed Chromium run (behind explicit recipe only) |

## 3. Versions

| Component | Version |
| --- | --- |
| pixi.js | 8.19.0 |
| @playwright/test | 1.62.1 |
| vitest | 4.1.10 |
| vite | 8.2.1 |
| typescript | 7.0.2 |
| Node | v24.15.0 |
| pnpm | 11.10.0 |
| Chromium | Playwright 1.62.1 bundled build (headless, new headless shell) |

Backend: SwiftShader software WebGL is available; WebGPU adapter is not (see section 10).

## 4. Adapter layout

```
6_render_pixijs/
  src/1_fixture.ts          # load common grapht-render-fixture/0 JSON
  src/2_projection.ts       # PixiProjection: Application init, scene build, camera, render
  src/3_protocol_adapter.ts # grapht-bench/0 shell adapter (load/import results)
  src/4_browser_lab.ts      # browser lab: WebGPU probe, visual predicate, scenario run
  src/6_scenarios.ts        # canonical scenario handlers + state (conformance-bound)
  src/7_geometryMath.ts     # pure: edge batched triangles, camera fit/zoom/pan (unit-tested)
  tests/0_math.test.ts      # geometry/camera inline snapshots
  tests/1_conformance.test.ts
  e2e/0_scenarios.spec.ts   # WebGL retained + particles, PNG + JSON receipts
  e2e/1_webgpu.spec.ts      # WebGPU or blocked-with-evidence
  receipts/                 # PNG + machine-readable JSON receipts
  index.html, 3_style.css, vite/playwright/vitest/tsconfig config
```

Renderer backend actually obtained from Pixi is read from the live renderer instance
(`projection.actualBackend` via `instanceof WebGLRenderer`/`WebGPURenderer`) and
recorded in the receipt, not only the requested backend.

The continuous Pixi ticker is stopped after init (`app.ticker.stop()`). Frames are
only rendered when a scenario requires them (`projection.render()` on demand, and
per-step in the animation scenarios). Deterministic viewport 800x600, DPR 1, 1k
fixture, 4-frame warmup after first render, and the shared per-scenario
`BENCH_SCENARIO_CASES` counts.

Node representations exercised where the API permits: retained uses one `Graphics`
per node (circle) plus a `Graphics` for edges; particles uses `ParticleContainer`
with one `Particle` per node plus one batched `Mesh` built from a single
`MeshGeometry` of edge quads.

## 5. Scenario contract (conformance)

`createPixiScenarioHandlers()` is typed as `BenchScenarioHandlers<PixiScenarioState, ScenarioSample>`
with `satisfies`-equivalent exhaustive object. `tests/1_conformance.test.ts` asserts
the handlers object has exactly the 33 canonical keys (no missing, no extras) and
drives all `BENCH_SCENARIO_CASES` through the shared `reduceBenchScenarioCases`
runner, producing one deterministic sample per key with an inline snapshot.

Unsupported scenarios use the canonical typed `ScenarioSample` variant
(`support: "unsupported"`, `reason: string`), never an omitted key or a custom string.

## 6. Scenario table

14 supported, 18 unsupported.

| Supported | Unsupported (reason) |
| --- | --- |
| camera-pan | device-pixel-ratio-change (browser-owned) |
| camera-wheel-zoom | group-collapse (no compound-node model) |
| camera-pinch-zoom | group-expand (no compound-node model) |
| style-update | node-insert (outside initial slice) |
| position-update | node-delete (outside initial slice) |
| viewport-resize | edge-insert (outside initial slice) |
| layout-apply | edge-delete (outside initial slice) |
| position-animation | visibility-hide (outside initial slice) |
| style-animation | visibility-show (outside initial slice) |
| node-click | layout-run (no layout engine) |
| node-hover | box-select (outside initial slice) |
| node-pick | graph-load (setup) |
| graph-replace | graph-clear (outside initial slice) |
| graph-dispose | graph-reload (outside initial slice) |
| | labels-none / labels-visible / labels-fixed-count / labels-dense (no text labels) |

Culling and construction/first-render have no dedicated canonical keys; first render
is exercised in the lab before scenario run, and per-scenario `visibleNodeCount` /
`visibleEdgeCount` are recorded on every sample.

## 7. Test counts

| Suite | Files | Tests | Result |
| --- | --- | --- | --- |
| Unit (vitest) | 2 | 11 | pass |
| Browser (Playwright) | 2 | 4 | pass |

## 8. Receipts

PNG (visual) and JSON (machine-readable) receipts under
`packages/grapht/adapters/6_render_pixijs/receipts/`:

| Receipt | Status | Actual backend |
| --- | --- | --- |
| `webgl-retained.png` / `.receipt.json` | healthy | webgl |
| `webgl-particles.png` / `.receipt.json` | healthy | webgl |
| `webgpu-retained.png` / `.receipt.json` | webgpu-unavailable | n/a (WebGL evidence retained) |
| `webgpu-particles.png` / `.receipt.json` | webgpu-unavailable | n/a (WebGL evidence retained) |

The shell adapter additionally writes `receipts/generated/pixijs-<fixture>.receipt.json`
(ignored by git).

## 9. Measured results

Deterministic visual predicate on `grid-1k` (800x600 viewport, DPR 1): non-background
pixel counts from a corner-sampled background, plus node/edge counts per sample.

| Representation | total pixels | non-background | valid |
| --- | --- | --- | --- |
| retained | 305,809 | 169,519 | true |
| particles | 297,025 | 290,023 | true |

Scenario counts for both WebGL runs: 14 supported, 18 unsupported. Per-scenario
latency and frame stats are in the committed JSON receipts (the shared runner records
`operationLatencyMs`, `frameP50/P95/max`, `droppedFrames`, visible counts).

## 10. Renderer and harness failures

WebGPU is unavailable in the Playwright Chromium build on this machine:
`navigator.requestAdapter()` returns `null` even with
`--enable-unsafe-swiftshader --enable-webgpu-developer-features --use-angle=swiftshader`.
No adapter is therefore detected (no `GPUAdapter` is produced to report vendor or
device - the probe records `webgpuProbe.adapter = null`,
`reason = "requestAdapter returned null"`).

Per the contract, the webgpu runs are reported as `webgpu-unavailable` (blocked) with
the probe data, and WebGL evidence is retained (a WebGL projection renders into
`#webgl-evidence` and the screenshots capture it). PixiJS is never silently labeled
as WebGPU; the actual backend is read from the live renderer and compared against the
request. If Pixi ever produced a non-WebGPU backend for a WebGPU request, the run is
reported blocked rather than mislabeled.
