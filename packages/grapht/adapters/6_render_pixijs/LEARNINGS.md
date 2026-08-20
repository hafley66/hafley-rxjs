# PixiJS projection adapter learnings

1. [DOMContainer lab receipt](#domcontainer-lab-receipt)
2. [Pixi v8 facts verified against 8.19.0](#pixi-v8-facts-verified-against-8190)
3. [Measuring render cost under Playwright](#measuring-render-cost-under-playwright)
4. [Official performance guidance](#official-performance-guidance)
5. [Consequences for the graph renderer](#consequences-for-the-graph-renderer)
6. [Sources](#sources)

## DOMContainer lab receipt

`labs/dom-cube.html` + `e2e/3_dom_cube.spec.ts` (2026-08-20). Eight HTML popovers
parented into the scene graph via `DOMContainer` track the projected vertices of a
rotating cube; `dc.scale.set(p)` with `p = CAM / (CAM - z)` makes far text smaller.

| config | canvas | ticker | frames / 4 s | fps |
|---|---|---|---|---|
| heavy (`?heavy=1`) | full window, `resolution: devicePixelRatio`, MSAA | uncapped | 22 | 5.5 |
| light | 800x600, `resolution: 1`, no MSAA, `powerPreference: "low-power"` | `maxFPS = 30` | 109 | 27.25 |

Viewport 1400x900 at `deviceScaleFactor: 2`, headless Chromium, `--use-angle=swiftshader`.
Script time was the same in both (~0.05 s per 4 s); the cost was raster.

## Pixi v8 facts verified against 8.19.0

| fact | where in `pixi.js` |
|---|---|
| `resolution` without `autoDensity: true` leaves the canvas CSS size equal to its device-pixel size; on a 2x display the scene renders at double size and the DOM layer gets `scale(2, 2)` | `Application.init` options |
| `DOMContainer` exists: `new DOMContainer({ element, anchor })`, rendered by `DOMPipe` | `lib/dom/DOMContainer.d.ts`, `lib/dom/DOMPipe.mjs` |
| The DOM layer is one absolutely positioned `div` appended to the canvas's parent and translated by `canvas.getBoundingClientRect().left/top`; a parent offset from the viewport origin double-offsets every element | `lib/dom/CanvasObserver.mjs` `updateTranslation`, `ensureAttached` |
| Each `DOMContainer` element gets `transform: matrix(worldTransform)` on every `postrender`; `will-change: transform` keeps that a composite rather than a repaint | `lib/dom/DOMPipe.mjs` `postrender` |
| `HTMLText` rasterizes HTML to a texture through SVG `foreignObject`; no live DOM, re-uploads on change | `lib/scene/text-html/HTMLText.d.ts` |
| `ticker.FPS` is derived from the last tick's elapsed time and does not reflect `maxFPS` skips; count frames yourself | `lib/ticker/Ticker` |

## Measuring render cost under Playwright

| signal | behaviour | use |
|---|---|---|
| CDP `Performance.getMetrics` `TaskDuration` | counts renderer-process main-thread time. With in-process SwiftShader GL the raster lands here (heavy config saturated 5.0 s of 5 s). With `--use-angle=swiftshader` the raster moves to the GPU process and `TaskDuration` misses it (heavy 0.05 s) | receipt only |
| frames rendered per window (page-side counter) | survives both GL configurations; heavy 5.5 fps vs light 27 fps | the assertion |
| `LayoutCount`, `RecalcStyleCount` | DOM cost of `DOMContainer` transforms and text writes; `will-change` cut layouts 150 -> 33 per 5 s, recalcs unchanged | receipt |
| headed Chromium + `Tracing.start` with `disabled-by-default-gpu.service` | real GPU timing | not wired yet |

## Official performance guidance

From the PixiJS 8.x Performance Tips guide, v8 launch post, and ParticleContainer post.

| area | guidance |
|---|---|
| sprites | spritesheets; batches hold up to 16 textures depending on hardware; fastest path |
| Graphics | best when not modified per frame; under 100 points batch like sprites; hundreds of complex Graphics are slow, use sprite textures instead |
| text | changing text every frame costs a canvas draw plus GPU upload; BitmapText for dynamic text; lower `resolution` to save memory |
| culling | off by default; `cullable`, `cullArea`, `cullableChildren` when GPU-bound |
| masks | rect (scissor) > Graphics (stencil) > sprite mask; hundreds of masks hurt |
| filters, blend modes | break batches; set `filterArea`; group identical blend modes; `filters = null` to release |
| events | `interactiveChildren = false` on leaf containers; explicit `hitArea` rectangles |
| ParticleContainer | particles share texture, skip the scene graph; declare static vs dynamic properties; 1M particles at 60 fps vs 200k sprites |
| render pipeline | v8 updates only changed elements and reuses instruction sets when the graph is unchanged |
| known issues | `Container.destroy()` slow on crowded containers (#10345); render-group `onRender` fires twice (#10432); Graphics at huge counts (#10521) |

## Consequences for the graph renderer

| guidance | decision for `PixiProjection` and the keyed renderer |
|---|---|
| sprites batch, Graphics do not | nodes are sprites off one circle/rect atlas with `tint`; never one Graphics per node |
| Graphics rebuild is the per-frame cost | edges as one Graphics rebuilt only on diff or tween frames, or a `Mesh` from `7_geometryMath.ts` `edgeTriangles` |
| text per frame is an upload | labels: BitmapText far, `DOMContainer` near focus; never retexture per tick |
| culling manual | `cullable = true` on the node layer, `cullArea` = camera rect |
| `destroy()` slow | exit sets recycle into a sprite pool keyed by id instead of destroy |
| ParticleContainer | far level-of-detail tier: `position` dynamic, everything else static |
| DOM layer origin | the canvas parent sits at `left: 0; top: 0`; offsets go on an inner wrapper |
| `resolution` + `autoDensity` travel together | always both, and pick `resolution: 1` for labs |
| `ticker.maxFPS` | cap at 30 for static scenes, 60 for tweens; report frames counted, not `ticker.FPS` |

## Sources

- https://pixijs.com/8.x/guides/concepts/performance-tips
- https://pixijs.com/blog/pixi-v8-launches
- https://pixijs.com/blog/particlecontainer-v8
- https://pixijs.com/8.x/guides/components/scene-objects/particle-container
- https://pixijs.com/8.x/guides/migrations/v8
- https://www.richardfu.net/optimizing-rendering-with-pixijs-v8-a-deep-dive-into-the-new-culling-api/
- https://github.com/pixijs/pixijs/discussions/10521
- https://github.com/pixijs/pixijs/issues/10345
- https://github.com/pixijs/pixijs/issues/10432
