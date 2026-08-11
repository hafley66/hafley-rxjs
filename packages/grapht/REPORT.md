PASS

# Vello Chromium lane report

Focused command:

`just chromium` from `packages/grapht/adapters/5_render_vello_wgpu`

Browser and renderer:

- Rust/WASM target `wasm32-unknown-unknown`
- Vello `0.9` with `wgpu 29`
- Headless Playwright Chromium using the system Chrome channel with WebGPU flags
- WebGPU canvas surface with an intermediate `Rgba8Unorm` target and `TextureBlitter`
- Fixture JSON crosses the WASM boundary once per load
- Camera, style, position, resize, layout, animation, replacement, and disposal operations use batched WASM methods
- Scenario execution has no React or DOM reconciliation path

Validation:

- Exact shared fixture: `/common-fixtures/grid-1000.json`
- Fixture bytes and SHA-256 are recorded in the receipt
- Visual validity is checked before the screenshot from canvas pixel data and scene counters
- Receipt records `1000` nodes and `1936` edges
- Required scenarios are supported; remaining typed samples are recorded as `unsupported`
- Browser test passed

Saved artifacts:

- [PNG](/Users/chrishafley/projects/hafley-rxjs/.boop-worktrees/feature/grapht-vello-chromium/packages/grapht/adapters/5_render_vello_wgpu/receipts/chromium/vello-chromium.png)
- [Receipt](/Users/chrishafley/projects/hafley-rxjs/.boop-worktrees/feature/grapht-vello-chromium/packages/grapht/adapters/5_render_vello_wgpu/receipts/chromium/vello-chromium.receipt.json)
