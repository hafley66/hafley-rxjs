# @hafley66/grapht-render-pixijs

Reusable PixiJS projection for `@hafley66/grapht` geometry. `PixiProjection`
supports retained and particle node representations, WebGL and WebGPU renderer
selection, camera fitting, pan, zoom, picking, replacement, resizing, and disposal.

## Labs

- `labs/dom-cube.html`: eight `DOMContainer` popovers parented into the scene graph
  track the projected vertices of a rotating cube. `?heavy=1` restores the
  full-window 2x MSAA uncapped config. `e2e/3_dom_cube.spec.ts` asserts DOM-layer
  placement under `devicePixelRatio` 2 and records a main-thread time receipt at
  `receipts/generated/dom-cube.perf.json`.

- `labs/scene-grid.html`: the `@hafley66/scene` pipeline (`keyframes` -> `frames` -> `pixi()`)
  over 400 ids across three scenes; sprites are pooled by id, `kind: "card"` items render as
  `DOMContainer`. `e2e/4_scene_renderer.spec.ts` asserts mount, recycling by sprite identity,
  a kept id tweening between steps, and teardown on unsubscribe.

- `labs/scene-cube.html?n=<points>`: spinning cube as a constant `Scene` whose `Layout` is the
  rotation; `e2e/5_scene_cube.spec.ts` writes a frames-per-second receipt at 1k, 20k, 100k
  points to `receipts/generated/scene-cube.load.json`.

## Scene renderer

```ts
import { pixi } from "@hafley66/grapht-render-pixijs"
scene$.pipe(keyframes(layout), frames(tween(), raf$), pixi({ width: 800, height: 600 })(host)).subscribe()
```

`pixi(options)` returns a `@hafley66/scene` `Renderer`: subscribe mounts an `Application`
(frames arriving before `init` resolves are held and drawn once), `next` applies the diff
(exit -> pool, enter -> pooled sprite or `DOMContainer`, keep -> index walk over `pos`), and
unsubscribe destroys views, pool, texture, and app.

## Pixi v8 facts this package relies on

| fact | where |
|---|---|
| `resolution` without `autoDensity: true` leaves the canvas CSS size at device pixels, so a 2x display renders the scene at double size | `Application.init` options |
| the `DOMContainer` layer is appended inside the canvas's parent and translated by `canvas.getBoundingClientRect()`, so a parent offset from the viewport origin double-offsets every element | `pixi.js/lib/dom/CanvasObserver.mjs` `updateTranslation`, `ensureAttached` |
| `DOMContainer` elements get `transform: matrix(worldTransform)` each `postrender`; `will-change: transform` keeps that a composite instead of a repaint | `pixi.js/lib/dom/DOMPipe.mjs` `postrender` |
