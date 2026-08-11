# Vello/wgpu projection adapter learnings

## Boundary

`src/bin/1_protocol_adapter.rs` consumes a `grapht-bench/0` JSON request and external
`grapht-geometry/0` fixture files. It encodes the graph into a Vello `Scene`, emits JSONL
load and scene-encoding samples, and writes a receipt below `outputDirectory`. The binary
does not run a layout algorithm.

`src/lib.rs` is the reusable Rust/Wasm seam. `build_scene` retains graph geometry and
camera state in Rust, while the browser-facing exports expose WebGPU capability probing
and scene encoding. A future browser host can own canvas/surface handles and call the same
scene builder per frame.

## APIs and versions

- Vello `0.9` records fills and strokes into `Scene` and lowers the retained scene through
  its wgpu compute renderer.
- wgpu `29` exposes `Instance`, adapter/device requests, WebGPU on `wasm32-unknown-unknown`,
  and native backends. `DeviceDescriptor::default()` keeps the probe at baseline limits.
- The crate exports `browser_webgpu_supported` for an explicit WebGPU capability result.
- `2_gpu_probe` serializes no-adapter and device-request errors as capability failures.

## Probe facts

The original lab probe established two runtime facts that remain part of this adapter's
receipt contract:

- Headless Chromium exposed WebGPU through SwiftShader. The headless probe reached adapter
  and device creation with a software adapter.
- A visible Chromium window exposed a Metal-backed WebGPU adapter and device.

Those facts are environment observations, not compile-time guarantees. `2_gpu_probe` records
the adapter backend and device strings for the current machine, including an explicit failure
record when no adapter or device can be requested.

## Scene and lifecycle

The scene is rebuilt from stable node IDs, external positions, and edges. Camera pan and zoom
are represented as an `Affine` transform. Picking remains a host-side boundary over stable
entity IDs; Vello is the raster scene encoder, not the durable graph store. A browser host
must retain the WebGPU surface, device, renderer, and frame scheduler as disposable runtime
handles, and keep memory and long-task counters in the browser harness.
