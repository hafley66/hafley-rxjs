---
created: 2026-09-26
updated: 2026-09-26
type: bug
status: done
priority: high
---

# Scrolling a markdown doc gets stuck on grapht diagrams

Branch: `bug/the-gang-gets-stuck-on-a-diagram`

## Description
In the md viewer, a wheel over a grapht sequence diagram pans the camera instead of scrolling the doc. `adapters/2_render_cytoscape/6_graphRenderer.ts:330` `onWheel` calls `preventDefault` and `stopImmediatePropagation` on every wheel event, in the capture phase, from the moment the diagram mounts. The doc scroll stops as soon as the pointer crosses a diagram. See also `issues/camera-pan-bounds`.

## Want
| state | wheel over diagram | how to enter | how to leave |
| --- | --- | --- | --- |
| passive (default) | scrolls the doc; camera untouched | — | — |
| active | pans/zooms the camera (clamped per `camera-pan-bounds`) | right-click on the diagram, or the configured chord | Esc, click outside, pointer leaves, focus leaves |

- On hover or keyboard focus while passive, show a notice over the diagram, e.g. "Right-click for scroll zoom", with 50% transparency and legible contrast in dark and light themes.
- Render the notice text from the chord spec (e.g. `⌘ + wheel`, "right-click"), not a hard-coded string. No chord-to-text renderer exists today. `packages/xdom/src/5_chords.ts` has `parseChord`, `matchesChord` and `chord`, all keyboard only, and there is no `packages/inputs`. See `issues/shares-the-keyboard`.
- The active state is visible: outline or tint plus the notice "Esc to release".
- `contextmenu` in the active diagram does not open the OS menu.
- Only the renderer's camera changes on wheel when active. The page `scrollTop` changes only when passive.

## Seam
- grapht renderer option: `wheel: "always" | "armed"`. `"armed"` installs the wheel listener only while active. md passes `"armed"`; the grapht labs keep `"always"`.
- The active state lives in a signal per diagram host. Only one diagram can be active at a time across the doc.

## Acceptance Criteria
- [ ] Browser test: a wheel over a passive diagram changes the doc `scrollTop` and leaves the camera unchanged.
- [ ] Browser test: right-click, then wheel, changes the camera and leaves `scrollTop` unchanged. Esc then goes back to passive.
- [ ] Browser test: hover shows the notice, the text comes from the chord spec, and the computed opacity is 0.5.
- [ ] A chord-to-text function, with a table test over `⌘`, `Ctrl`, `Shift`, `Alt`, wheel and right-click.
