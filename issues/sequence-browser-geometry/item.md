---
created: 2026-08-23
updated: 2026-08-23
type: task
assignee: terra
status: open
priority: high
epic: sequence-adapters
labels: [sequence, terra-high, browser, svg]
collision: [sequence-board]
blocked_by: ['@sequence-shared-artifact']
lane: sequence-board
lane_seq: 1
---

# Measure sequence SVG geometry

## Description

## Plan Reference

Section 6 of `plans/2026-08-23-d2-mermaid-sequence-adapters.md`.

## Acceptance Criteria

- [ ] Every binding resolves to exactly one mounted SVG element or produces a missing-element diagnostic.
- [ ] Local and world bounds are recorded for every resolved binding.
- [ ] Actor, message, group, activation, and note geometry counts match binding receipt counts.
- [ ] Geometry uses SVG viewBox coordinates independent of current CSS pixel size.
- [ ] Measurement retains no DOM nodes after the mounted SVG is released.
- [ ] Browser receipts record browser version, device pixel ratio, theme, and font readiness.

## Tests Run

- [ ] Browser geometry JSON receipt command and result are recorded.

## Implementation Notes

Agent route: gpt-5.6-terra at high. Measurement begins after SVG mount and font readiness and emits immutable geometry.
