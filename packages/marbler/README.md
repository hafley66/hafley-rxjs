# @hafley66/marbler

Signal-driven marble, sequence, and HTTP-style network visualization built on
`@hafley66/grid` and `@hafley66/signals`.

The tabular columns use DOM rows. The waterfall uses one device-pixel-ratio
aware canvas. Its scroll renderer visits only rows intersecting the current
viewport, so phase count does not change the DOM node count.

## Run

```sh
pnpm --filter @hafley66/marbler dev
```

## Build

```sh
pnpm --filter @hafley66/marbler build
pnpm --filter @hafley66/marbler test:browser
```

## Screenshots

Generated and verified by `src/2_Marbler.browser.test.tsx` at 1440 × 900.

![Network grid](./src/__screenshots__/2_Marbler.browser.test.tsx/0_network-grid-chromium-darwin.png)

![Selected event details](./src/__screenshots__/2_Marbler.browser.test.tsx/1_event-details-chromium-darwin.png)

## Retained renderer benchmark

- [10-second PixiJS receipt](./benchmarks/0_pixi-retained-10s.md)
- `src/2_PixiRetained.browser.test.ts` is the executable benchmark.

## Source

- `src/0_types.ts`: zod schemas and event types
- `src/1_model.ts`: signals and `createGrid` model
- `src/1a_WaterfallCanvas.tsx`: viewport-clipped canvas waterfall renderer
- `src/2_Marbler.tsx`: React grid, waterfall, and details renderer
- `src/2_marbler.css`: Network-panel presentation
- `src/3_main.tsx`: executable fixture application
