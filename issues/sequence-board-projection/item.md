---
created: 2026-08-23
updated: 2026-08-23
type: task
assignee: sol
status: open
priority: high
epic: sequence-adapters
labels: [sequence, sol-high, board]
collision: [sequence-board]
blocked_by: ['@sequence-browser-geometry', '@sequence-focus-resolution']
lane: sequence-board
lane_seq: 2
---

# Project sequence artifact onto board

## Description

## Plan Reference

Section 8 of `plans/2026-08-23-d2-mermaid-sequence-adapters.md`.

## Acceptance Criteria

- [ ] One Mermaid artifact and one D2 artifact mount through the same board API.
- [ ] Actor labels remain visible after vertical camera movement.
- [ ] Hovering a message activates both endpoint actor labels.
- [ ] A horizontally offscreen endpoint appears in the focus overlay.
- [ ] Activation hover activates its actor label.
- [ ] Board replacement never mixes bindings from one render revision with geometry from another.
- [ ] Unmount removes every board-owned listener.
- [ ] Playwright JSON and PNG receipts pass for both languages.
- [ ] Collapse and manual placement behavior are absent from this gate.

## Tests Run

- [ ] Mermaid and D2 Playwright JSON and PNG receipt commands are recorded.

## Implementation Notes

Agent route: gpt-5.6-sol at high. One board instance belongs to one mounted viewport and replaces SVG plus geometry atomically.
