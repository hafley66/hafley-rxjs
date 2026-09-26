---
created: 2026-09-26
updated: 2026-09-26
type: bug
status: open
priority: high
---

# Wheel pans the grapht camera off the drawing with no bound

Branch: `bug/the-gang-scrolls-into-the-void`

## Description
In instant's md viewer, a single trackpad wheel gesture over an inline sequence diagram pans the whole drawing out of the box. Nothing brings it back. The page also stops scrolling while the pointer is over the diagram.

## Current path
| step | where | today |
| --- | --- | --- |
| wheel captured | `adapters/2_render_cytoscape/6_graphRenderer.ts:330` `onWheel` | `preventDefault` + `stopImmediatePropagation` on every event, capture phase |
| direct move | `src/lib/1_wheelCamera.ts:28` | `x - dx`, `y - dy`, the full delta applied, no clamp |
| coast | `src/lib/2_wheelMomentum.ts:23-45` | velocity capped at ±2 × `strength`, tail up to `decayMs` (85) px per axis for `maxDurationMs` (500) |
| apply | `6_graphRenderer.ts:325`, `:338` | `cy.viewport({ pan })`, no bound check |

A trackpad fling sends dozens of events. Each one applies its full delta and resets the coast, so the camera drifts without limit.

## Want
- The camera cannot pan past the drawing bounds by more than 50% of the host viewport on either axis. The drawing bounds are the rendered frame's bbox in model space, times `scale`.
- The clamp runs after every camera change: wheel, coast, drag and zoom.
- At the clamp edge, the wheel event falls through to the page (no `preventDefault`), so the doc keeps scrolling.
- Zoom has a floor: the drawing is never smaller than it is at fit.

## Design sketch
- Add a pure `clampCamera(camera, bounds, viewport, slack = 0.5): GraphCamera` in `src/lib/1_wheelCamera.ts`. It clamps `x` so that `bounds.x*scale + x <= viewport.width*(1+slack)` and `(bounds.x+bounds.width)*scale + x >= -viewport.width*slack`, and does the same for `y`.
- `WheelMomentum.push` and `step` take bounds and return the clamped camera. `step` stops the coast when the clamp changes the result.
- `onWheel` computes the clamped camera. When it equals the current camera, it returns without calling `preventDefault`.
- cytoscape drag panning goes through the same clamp via `cy.on("viewport")`, or `cy.userPanningEnabled(false)` plus an owned drag.

## Acceptance Criteria
- [ ] Unit test with a step trace: a fling of 40 events with deltaY 120 stops at the edge. At most 50% of the viewport is empty.
- [ ] Unit test: zoom out cannot go below the fit scale.
- [ ] Browser test: a wheel over the diagram at its edge scrolls the host page (`scrollTop` changes).
- [ ] Browser test in the md `MarkdownBody` harness with the ryi serve discussion doc (`hafley-rs/plans/2026-09-26-ryi-serve-memory-and-contracts.DISCUSSION.md`). After a fling, the node canvas bbox still intersects the host.
