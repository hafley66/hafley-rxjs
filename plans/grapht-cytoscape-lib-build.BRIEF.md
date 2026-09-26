# grapht-cytoscape-lib-build (sol6)

Goal: `@hafley66/grapht-render-cytoscape` publishes a built library. Today `package.json` exports `./index.ts` and
`./4_adapter.ts`, `files` omits them, and `vite build` builds the `index.html` demo app. `@hafley66/md`
(`packages/md/src/0b_SequenceDiagram.tsx:3`) imports `createCytoscapeGraphFrameResource` from it, so a registry install of md breaks.

## Files you own
`packages/grapht/adapters/2_render_cytoscape/{package.json,vite.config.ts,vite.lib.config.ts,tsconfig*.json}`, `pnpm-lock.yaml`.
Source `.ts` files: read only.

## Do
Copy the library build shape of `packages/grapht-model` (or `packages/d2`, whichever is closer; say which):
- `exports["."]` and `exports["./benchmark"]` -> `{ types: ./dist/<x>.d.ts, import: ./dist/<x>.js }`; `main`/`types` likewise.
- library build (vite lib mode + dts) for entries `index.ts` and `4_adapter.ts`, externals = every dependency and peer.
- keep the demo app build reachable under a separate script name (`build:app`); `build` becomes the library build.
- `3_style.css` stays shipped if index.ts imports it; check.

## Gates (receipt carries each output line)
1. `pnpm --filter @hafley66/grapht-render-cytoscape build` passes; `ls dist` shows index.js, index.d.ts, 4_adapter.js, 4_adapter.d.ts.
2. `pnpm release:check`
3. `cd packages/grapht/adapters/2_render_cytoscape && npm pack --dry-run` lists dist files and no `.ts` source other than `.d.ts`.
4. `pnpm --filter @hafley66/md build && pnpm --filter @hafley66/md test` pass.
5. `npx publint packages/grapht/adapters/2_render_cytoscape` prints no errors.

## Stop on
A source edit being needed, or the demo/bench scripts breaking with no config-only fix. Report and stop.

## Commit
Subject exactly: `build(grapht-render-cytoscape): ship a dist library build`
Receipt: status / sha / files / validation / next.
