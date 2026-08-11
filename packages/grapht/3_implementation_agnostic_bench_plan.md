# Implementation-agnostic graph benchmark plan

This plan assigns three independent implementation lanes around one
shell-level protocol. The harness measures processes and artifacts. JavaScript, workers,
Wasm, Rust, Cytoscape, Sigma, Vello, and future renderers remain replaceable adapters.

## 0. Protocol types

The protocol is JSON Lines on standard input and standard output. Diagnostics use standard
error. A non-zero exit status means that the adapter did not produce a valid result.

```ts
export type BenchOperation = "layout" | "render" | "interaction"

export type BenchInput = {
  protocol: "grapht-bench/0"
  runId: string
  fixture: string
  operation: BenchOperation
  input?: string
  outputDirectory: string
  parameters: Record<string, string | number | boolean>
}

export type BenchSample = {
  protocol: "grapht-bench/0"
  type: "sample"
  runId: string
  phase: string
  startedNs: number
  endedNs: number
  counters: Record<string, number>
}

export type BenchResult = {
  protocol: "grapht-bench/0"
  type: "result"
  runId: string
  implementation: string
  operation: BenchOperation
  artifact?: string
  artifactHash?: string
  counters: Record<string, number>
}

export type BenchError = {
  protocol: "grapht-bench/0"
  type: "error"
  runId: string
  message: string
}

export type BenchOutput = BenchSample | BenchResult | BenchError
```

Geometry crosses binary-oriented adapters as files referenced by JSONL records:

```ts
export type GeometryManifest = {
  protocol: "grapht-geometry/0"
  nodeIds: string
  positions: string
  edges: string
  nodeCount: number
  edgeCount: number
  scalar: "f32-le"
}
```

`nodeIds`, `positions`, and `edges` are paths relative to the manifest. Browser adapters may
load the same files as `ArrayBuffer`s and transfer their ownership to workers.

## 1. Process lifetime

One benchmark invocation has this sequence:

```text
harness writes one BenchInput
adapter validates protocol and fixture
adapter emits zero or more BenchSample records
adapter writes artifacts beneath outputDirectory
adapter emits exactly one terminal BenchResult or BenchError
adapter exits
harness records wall time, CPU time, peak RSS, output bytes, and exit status
```

Long-running applications emit `BenchSample` records to an append-only JSONL file. The same
collector accepts a pipe or a tailed file:

```bash
tail -F instant-grapht.jsonl | grapht-bench record
```

## 2. Storage and uniqueness

```text
fixtures/                         immutable benchmark inputs
expected/                         expected topology and geometry hashes
runs/<run-id>/request.json        normalized BenchInput
runs/<run-id>/events.jsonl        adapter output
runs/<run-id>/process.json        external process measurements
runs/<run-id>/artifacts/          geometry, images, traces, and receipts
```

- `runId` is unique per invocation.
- Fixture names address immutable fixture contents. A changed fixture receives a new hash.
- Artifact hashes use file bytes, independent of implementation names.
- The collector rejects output whose `runId` differs from the request.
- Timing records are observations and do not participate in correctness hashes.
- No adapter writes benchmark database state directly.

## 3. Protocol lane: fixtures and shell harness

The protocol lane owns the dependency root used by the other lanes.

### Files

```text
packages/grapht/
  justfile
  package.json
  src/
    0_benchProtocol.ts
    1_geometryProtocol.ts
  fixtures/
    0_grid_1k.json
    1_grid_5k.json
    2_grid_10k.json
  bin/
    grapht-bench
    grapht-fixtures
  tests/
    0_benchProtocol.test.ts
    1_shellPipeline.test.ts
```

### Work

1. Create the package without importing Cytoscape, React, Dockview, or a renderer.
2. Define protocol validators and JSONL parsing using the repository's existing schema style.
3. Generate deterministic graph fixtures from a seed.
4. Implement `grapht-fixtures emit <fixture>`.
5. Implement `grapht-bench run --adapter <command> --fixture <name>`.
6. Measure wall time, exit status, stdout bytes, and artifact bytes externally.
7. Implement `grapht-bench record` for stdin and tailed JSONL streams.
8. Preserve the raw request, output, diagnostics, and process measurements for every run.
9. Keep supported developer and CI invocations in the package `justfile`.

### Acceptance

```bash
grapht-fixtures emit grid-1k \
  | grapht-bench run --adapter grapht-adapter-identity

tail -F test-events.jsonl \
  | grapht-bench record --output test-results/tail-run
```

Tests snapshot the normalized request, output records, directory manifest, hashes, invalid
JSONL diagnostics, mismatched run IDs, adapter failure, and interrupted adapter cases.

## 4. Layout lane: worker and Wasm adapters

The layout lane consumes only the protocol and fixtures from lane 3.

### Files

```text
packages/grapht/adapters/
  0_layout_grid_js/
  1_layout_grid_worker/
  2_layout_grid_wasm/
```

Each directory exposes a shell command with the same stdin/stdout contract.

### Work

1. Implement one deterministic grid algorithm in synchronous JavaScript.
2. Implement the identical algorithm in a JavaScript worker.
3. Implement the identical algorithm in Rust/Wasm running in a worker.
4. Emit the same `GeometryManifest` and typed-array files.
5. Record parse, transfer, layout, serialization, and total phase samples.
6. Keep browser worker orchestration inside the adapter.

### Acceptance

- All adapters produce identical node IDs, edge arrays, and position bytes.
- Repeated runs produce identical artifact hashes.
- Each adapter runs through `grapht-bench` without adapter-specific harness code.
- Worker adapters report transfer time separately from layout time.

## 5. Projection lane: Cytoscape interaction receipt

The projection lane consumes fixture and geometry artifacts. It does not invoke a layout implementation
directly.

### Files

```text
packages/grapht/adapters/
  3_render_cytoscape/
    index.html
    0_protocol.ts
    1_projection.ts
    2_lab.ts
    3_style.css
    4_lab.spec.ts
```

### Work

1. Load a fixture plus `GeometryManifest` generated by any layout adapter.
2. Project positions through Cytoscape's `preset` layout.
3. Keep Cytoscape responsible for rendering, viewport, selection, and graph interaction.
4. Record load, projection, first render, fit, pan, zoom, select, and dispose phases.
5. Produce a screenshot and browser trace artifact.
6. Record browser heap when exposed, DOM node count, frame samples, and long tasks.
7. Invoke the browser adapter through the same shell protocol.

### Acceptance

- The adapter renders geometry from each of the three Beep adapters without code changes.
- A scripted pan, zoom, and selection sequence completes at every fixture size.
- Output includes one terminal result, screenshot path, trace path, and measured counters.
- Correctness assertions use selected entity IDs, camera state, and artifact hashes.

## 5a. CanvasKit projection receipt

CanvasKit consumes the same fixture and `GeometryManifest` as Cytoscape. Its adapter owns
Skia/CanvasKit initialization, drawing, hit testing, and interaction translation behind the
same process protocol.

```text
packages/grapht/adapters/
  4_render_canvaskit/
    index.html
    0_protocol.ts
    1_scene.ts
    2_hitTest.ts
    3_lab.ts
    4_style.css
    5_lab.spec.ts
```

Record Wasm download bytes, compile and instantiate time, scene construction, first render,
pan, zoom, selection, disposal, browser heap, Wasm memory pages, frame samples, and long tasks.
Use CanvasKit's distributed Wasm artifact without modifying the benchmark protocol.

Acceptance uses the same scripted camera and selection sequence as the Cytoscape adapter and
emits the same terminal result, screenshot, trace, and correctness records.

## 5b. Sigma projection receipt

Sigma consumes the same fixture and `GeometryManifest` through Graphology. Its adapter owns
WebGL rendering, camera translation, picking, selection, and interaction events behind the
same process protocol.

```text
packages/grapht/adapters/
  5_render_sigma/
    index.html
    0_protocol.ts
    1_graphology.ts
    2_projection.ts
    3_lab.ts
    4_style.css
    5_lab.spec.ts
```

Record graph import, GPU initialization, first render, pan, zoom, selection, disposal, browser
heap, frame samples, long tasks, visible node and edge counts, and screenshot and trace paths.
The scripted camera and selection sequence matches Cytoscape and CanvasKit.

## 6. Integration matrix

The first matrix holds the renderer constant:

| Fixture | main JS layout | worker JS layout | worker Wasm layout |
|---|---:|---:|---:|
| grid-1k | Cytoscape | Cytoscape | Cytoscape |
| grid-5k | Cytoscape | Cytoscape | Cytoscape |
| grid-10k | Cytoscape | Cytoscape | Cytoscape |

The next matrix holds geometry constant and adds renderer adapters:

| Geometry | Cytoscape | CanvasKit | Sigma | Vello |
|---|---:|---:|---:|---:|
| grid-1k | planned | planned | planned | deferred |
| grid-5k | planned | planned | planned | deferred |
| grid-10k | planned | planned | planned | deferred |

## 7. Merge order

0. The protocol lane merges the protocol, fixtures, identity adapter, collector, and shell tests.
1. The layout lane rebases and adds the three layout adapters plus byte-equivalence tests.
2. The projection lane rebases and adds the Cytoscape adapter, interaction test, trace, and screenshot.
3. The CanvasKit projection rebases and adds its adapter, interaction test, trace, and screenshot.
4. The Sigma projection rebases and adds its adapter, interaction test, trace, and screenshot.
5. The coordinator runs the complete matrix and commits the generated run manifest.

Each lane remains independently reviewable. Generated benchmark runs stay out of package
source; checked receipts contain the normalized run manifest, relevant counters, hashes, and
selected screenshots.

## 8. Just recipes

The package `justfile` is the named interface over shell commands. Recipes compose executable
adapters and never import their implementations.

```bash
just fixtures
just bench grid-1k layout-grid-js
just compare-layouts grid-10k
just cytoscape grid-5k layout-grid-wasm
just canvaskit grid-5k layout-grid-wasm
just sigma grid-5k layout-grid-wasm
just matrix
just record path/to/events.jsonl
just tail path/to/live.jsonl
```

CI and agents invoke these recipes rather than reconstructing pipelines in prompts or workflow
files.
