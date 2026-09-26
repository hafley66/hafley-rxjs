---
created: 2026-09-26
updated: 2026-09-26
type: feature
status: open
priority: normal
---

# Expose turn and pane facts as DOM attributes for user stylesheets

## Description

## Want
Every DOM fact boop-xterm knows is exposed as attributes and CSS custom properties, so a user stylesheet can restyle the TUI they already use. Armored Core 3 and Persona 5 themes already exist as proofs.

## Facts to expose
| element | attributes |
| --- | --- |
| pane host | `data-harness`, `data-session`, `data-mouse-mode`, `data-scanning`, `data-visible` |
| turn span overlay | `data-turn-id`, `data-role` (user/assistant/tool), `data-confidence`, `data-harness`, `data-turn` |
| region | `data-region-kind` (table/list/heading/code/diagram) |
| row band | `--boop-xterm-row-top`, `--boop-xterm-row-height` per turn, for backgrounds and gutters |

## Renderer constraint
xterm's WebGL and canvas renderers paint glyph cells to a canvas, so CSS cannot restyle text per cell. Two routes:
- styling goes on overlay layers aligned to rows (turn bands, gutters, borders), which works with any renderer;
- xterm's DOM renderer allows per-row CSS but is slower.

The card picks the overlay route by default, and records whether a DOM-renderer opt-in is wanted.

## Acceptance Criteria
- [ ] A turn-band overlay layer paints one element per visible turn span with the attributes above.
- [ ] Every attribute is documented in the package README with a sample user stylesheet.
- [ ] Browser test: a stylesheet selecting `[data-role="assistant"]` changes the computed style of that band.
