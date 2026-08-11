# Grapht baseline receipts

Source: committed adapter receipts on 2026-08-11. Layout timings are one receipt run (`n = 1`), so they are smoke measurements rather than benchmark distributions.

## Layout receipt

| implementation | nodes | edges | parse ms | spawn ms | load ms | instantiate ms | transfer ms | layout ms | serialize ms | total ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| JavaScript worker | 1,000 | 1,500 | 3.839 | 1.842 | | | 31.359 | 1.176 | 4.086 | 41.509 |
| Rust/Wasm worker | 1,000 | 1,500 | 1.627 | 0.845 | 0.345 | 0.264 | 17.173 | 0.232 | 1.574 | 21.518 |

| comparison | ratio |
| --- | ---: |
| total time, JS / Wasm | 1.93x |
| layout time, JS / Wasm | 5.07x |
| transfer time, JS / Wasm | 1.83x |

Both layout adapters emitted artifact hash `007b52f8c529c6dff05a6f0d294776e4a6847a6d4181cf4fcd8564998e9fd7d1` for their receipt fixture.

## Renderer receipt coverage

| implementation | fixtures | protocol receipt | deterministic tests | browser build | browser screenshot/trace | measured timing distribution |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| Cytoscape | 1k, 5k, 10k | yes | 2 | yes | SVG and JSON trace | absent |
| CanvasKit | 1k, 5k, 10k | yes | 2 | yes | SVG and JSON trace | absent |
| Sigma | 1k, 5k, 10k | yes | 2 | yes | Playwright PNG and trace | absent |
| Vello/WGPU | 1k, 5k, 10k | yes | 1 | native and Wasm checks | capability probe | absent |

## Missing benchmark dataset

The current renderer receipts prove protocol execution, fixture ingestion, interaction paths, artifact creation, and build viability. They do not yet record repeated frame time, first-render latency, interaction latency, GPU time, peak memory, visible element count, or percentile distributions. A renderer ranking cannot be derived from the current receipts.

## Files

- Layout worker receipt: `adapters/0_layout_grid_worker/scripts/receipt.json`
- Layout Wasm receipt: `adapters/1_layout_grid_wasm/scripts/receipt.json`
- Sigma receipt declaration: `adapters/4_render_sigma/receipts/0_sigma_protocol.receipt.json`
- Vello receipt declaration: `adapters/5_render_vello_wgpu/receipts/0_vello_protocol.receipt.json`
- D2 chart: `results/0_baseline_receipts.d2`
