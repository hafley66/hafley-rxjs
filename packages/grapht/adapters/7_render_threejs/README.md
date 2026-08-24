# @hafley66/grapht-render-threejs

Three.js implementation of the `@hafley66/grapht` renderer protocol.

`ThreeProjection` consumes shared `Geometry` and supports retained or instanced nodes,
WebGL or WebGPU selection, camera fitting, pan, zoom, picking, graph replacement,
viewport resizing, pixel readback, and disposal.

## Package boundary

- Graph types, geometry, fixtures, scenarios, and receipts belong to `@hafley66/grapht`.
- This package translates shared graph geometry and scenario operations into Three.js.

## Verification

```sh
pnpm test
pnpm test:e2e
pnpm bench
pnpm receipt
```

## Archived labs

The removed DOM cube and scene-renderer comparison labs remain available in Git commit
`e32064d`. The current tree contains the graph renderer implementation, benchmark harness,
conformance tests, and receipts.
