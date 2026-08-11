# Worker layout adapter learnings

- The shell boundary is one `grapht-bench/0` JSON object per invocation and JSONL samples followed by one terminal result. Diagnostics stay on stderr.
- `worker_threads` provides the same transfer-list ownership model as a browser Web Worker. The edge buffer is transferred to the worker and the position buffer is transferred back. The adapter keeps a copy of edge bytes for the geometry artifact.
- `spawn`, `transfer`, `layout`, and `serialize` are separate sample phases. The transfer sample reports the round-trip remainder after the worker-reported layout duration.
- Geometry artifacts use `nodeIds.txt`, little-endian `positions.f32`, little-endian `edges.u32`, and a `grapht-geometry/0` manifest. Hashes are over file bytes.
- The layout order is stable: descending undirected degree followed by ascending node index. Equal input and parameters therefore produce equal position bytes.
- The Node shell is the local receipt implementation. Browser integration can replace `node:worker_threads` with a browser Worker while retaining `2_layout.ts`, `1_geometry.ts`, and the JSONL protocol shapes.
