# Rust/Wasm layout adapter learnings

- The crate has a bare WebAssembly ABI. It exports `alloc`, `reset_arena`, `layout`, and `positions_bytes`; no wasm-bindgen runtime is required.
- The worker uses `WebAssembly.instantiate(bytes)`, allocates compact typed arrays in linear memory, calls the exported layout function, copies positions out, and transfers the copied `Float32Array` back to the parent.
- The same worker module can be adapted to a browser Worker by replacing the Node file read with `fetch(url).then(response => response.arrayBuffer())`. The ABI and ownership sequence stay unchanged.
- The crate owns a bump allocator over wasm linear memory. `reset_arena` is called before every request. `Vec` used by degree calculation also uses this allocator, so host buffers must be copied out before resetting.
- `load`, `instantiate`, `transfer`, `layout`, `serialize`, and `total` are represented in the adapter result. Geometry bytes use the `grapht-geometry/0` manifest and little-endian typed-array files.
- `wasm32-unknown-unknown` is available in this checkout and builds with the release profile. The shell receipt runs through Node worker_threads and the standards WebAssembly API.
