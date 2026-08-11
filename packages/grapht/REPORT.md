# Grapht scenario lane report

Commit: this commit, recorded by the handoff as the lane commit.

## Changed files

- `packages/grapht/src/0_benchProtocol.ts`
- `packages/grapht/src/11_scenarios.ts`
- `packages/grapht/src/index.ts`
- `packages/grapht/tests/1_scenarios.test.ts`
- `packages/grapht/justfile`
- `packages/grapht/adapters/2_render_cytoscape/3_lab.ts`
- `packages/grapht/adapters/2_render_cytoscape/5_scenarios.ts`
- `packages/grapht/adapters/2_render_cytoscape/e2e/0_scenarios.spec.ts`
- `packages/grapht/adapters/2_render_cytoscape/playwright.config.ts`
- `packages/grapht/adapters/2_render_cytoscape/package.json`
- `packages/grapht/adapters/4_render_sigma/src/1_graphology.ts`
- `packages/grapht/adapters/4_render_sigma/src/2_projection.ts`
- `packages/grapht/adapters/4_render_sigma/src/4_browser_lab.ts`
- `packages/grapht/adapters/4_render_sigma/src/6_scenarios.ts`
- `packages/grapht/adapters/4_render_sigma/e2e/0_sigma_lab.spec.ts`
- `packages/grapht/adapters/4_render_sigma/e2e/1_scenarios.spec.ts`
- `packages/grapht/adapters/4_render_sigma/package.json`
- `pnpm-lock.yaml`

Playwright scenario snapshots were added or refreshed under both adapter `e2e/*-snapshots` directories. CanvasKit and Vello adapter files were not edited.

## Commands and receipts

- `pnpm install --frozen-lockfile --ignore-scripts`
- `pnpm --dir packages/grapht typecheck`
- `pnpm --dir packages/grapht exec vitest run tests/0_benchProtocol.test.ts tests/1_scenarios.test.ts`
- `pnpm --dir packages/grapht/adapters/2_render_cytoscape build`
- `pnpm --dir packages/grapht/adapters/2_render_cytoscape exec vitest run 5_lab.spec.ts`
- `pnpm --dir packages/grapht/adapters/4_render_sigma typecheck`
- `pnpm --dir packages/grapht/adapters/4_render_sigma exec vitest run -c vitest.config.ts`
- `pnpm exec playwright test -c playwright.config.ts` in `adapters/2_render_cytoscape`
- `pnpm exec playwright test -c playwright.config.ts` in `adapters/4_render_sigma`

The core deterministic run passed with 2 files and 32 tests. Cytoscape deterministic tests passed with 2 tests. Sigma deterministic tests passed with 2 tests. The Cytoscape scenario browser run passed with 1 test. The Sigma browser run passed with 4 tests covering `grid-1k`, `grid-5k`, and `grid-10k`, including the scenario test.

Browser `#receipt` JSON records one typed sample per case. Supported samples include operation latency, frame p50/p95/max, dropped-frame count, JS heap when exposed, uploaded-byte estimate, draw count when observable, and visible node/edge counts. Process RSS is `null` in page receipts because the page does not expose the renderer process tree. Draw count is `null` for both adapters because neither renderer exposes a stable draw counter through the current projection boundary.

Screenshots are taken only after `data-visual-valid="true"` is set from rendered canvas/WebGL preconditions. The focused tests pause the scenario reducer while taking the screenshot, then release it through `grapht-continue`.

## Supported scenarios

Both renderer handler maps implement these scenarios:

- `camera-pan`
- `camera-wheel-zoom`
- `style-update`
- `position-update`
- `viewport-resize` when a mounted renderer container is present
- `layout-apply`
- `position-animation`
- `graph-replace`
- `graph-dispose`

`group-collapse` and `group-expand` have explicit typed `unsupported` samples because the current Cytoscape and Sigma projections contain no group model.

## Unsupported scenarios

The following cases have explicit typed `unsupported` samples in both exhaustive handler maps:

- `camera-pinch-zoom`
- `device-pixel-ratio-change`
- `group-collapse`
- `group-expand`
- `node-insert`
- `node-delete`
- `edge-insert`
- `edge-delete`
- `visibility-hide`
- `visibility-show`
- `layout-run`
- `style-animation`
- `node-click`
- `box-select`
- `node-hover`
- `node-pick`
- `graph-load`
- `graph-clear`
- `graph-reload`
- `labels-none`
- `labels-visible`
- `labels-fixed-count`
- `labels-dense`

The shared JSON fixture generator writes the same `packages/grapht/.cache/render-fixtures/grid-<n>.json` bytes consumed by both browser adapters. The shared case table is `packages/grapht/src/11_scenarios.ts`.
