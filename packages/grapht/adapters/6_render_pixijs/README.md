# @hafley66/grapht-render-pixijs

PixiJS implementation of the `@hafley66/grapht` renderer protocol.

`PixiProjection` consumes shared `Geometry` and supports retained or particle nodes,
WebGL or WebGPU selection, camera fitting, pan, zoom, picking, graph replacement,
viewport resizing, pixel readback, and unsubscribe-driven disposal.

## Package boundary

- Graph types, geometry, fixtures, scenarios, and receipts belong to `@hafley66/grapht`.
- Sequence identity, bindings, artifacts, focus, placement, and sticky-stack algorithms
  belong to `@hafley66/grapht-model`.
- This package translates shared graph geometry and scenario operations into PixiJS.

## Verification

```sh
pnpm test
pnpm test:e2e
pnpm bench
pnpm receipt
```

## Archived labs

The removed DOM cube, scene comparison, graph canvas, Pixi ecosystem, Mermaid/D2,
and sticky-sequence labs remain available in Git commit `e32064d`. They are excluded
from the package tree so renderer implementation code cannot depend on lab-specific
state, parsing, geometry, or interaction paths.
