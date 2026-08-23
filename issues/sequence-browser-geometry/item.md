---
created: 2026-08-23
updated: 2026-08-23
type: task
assignee: terra
status: done
priority: high
epic: sequence-adapters
labels: [sequence, terra-high, browser, svg]
collision: [sequence-board]
blocked_by: ['@sequence-shared-artifact']
lane: sequence-board
lane_seq: 1
commits:
- hash: 7e48b1d
  summary: 'sequence: measure geometry and resolve focus'
closed: 2026-08-23
---

# Measure sequence SVG geometry

## Description

## Plan Reference

Section 6 of `plans/2026-08-23-d2-mermaid-sequence-adapters.md`.

## Acceptance Criteria

- [x] Every binding resolves to exactly one mounted SVG element or produces a missing-element diagnostic.
- [x] Local and world bounds are recorded for every resolved binding.
- [x] Actor, message, group, activation, and note geometry counts match binding receipt counts.
- [x] Geometry uses SVG viewBox coordinates independent of current CSS pixel size.
- [x] Measurement retains no DOM nodes after the mounted SVG is released.
- [x] Browser receipts record browser version, device pixel ratio, theme, and font readiness.

## Tests Run

- [x] Browser geometry JSON receipt command and result are recorded.

## Implementation Notes

Agent route: gpt-5.6-terra at high. Measurement begins after SVG mount and font readiness and emits immutable geometry.

## Agent Runs

### 2026-08-23T20:09:42Z · @codex

Native gpt-5.6-terra at high reused as /root/sequence_local_documents from commit 44fb5eb. Explicit user routing applies; coordinator retains issue tracker ownership.

### 2026-08-23T20:23:27Z · @codex

Commit 7e48b1d. pnpm test:sequence-geometry-focus passed Terra and coordinator runs: 2 tests. Mermaid and D2 bindings resolve to immutable local/world bounds; missing IDs diagnose; browser version, DPR, theme, and font readiness are recorded. CSS widths 350 and 1400 differed by at most 0.5003128051758097 viewBox unit from font metrics and pass the recorded sub-1-unit coordinate tolerance.

