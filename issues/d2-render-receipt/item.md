---
created: 2026-08-23
updated: 2026-08-23
type: task
assignee: terra
status: open
priority: high
epic: sequence-adapters
labels: [sequence, terra-high, d2]
collision: [packages-d2]
blocked_by: ['@sequence-fixtures']
lane: sequence-d2
lane_seq: 1
---

# Capture D2 native render receipts

## Description

## Plan Reference

D2 half of section 1 in `plans/2026-08-23-d2-mermaid-sequence-adapters.md`.

## Acceptance Criteria

- [ ] D2 native SVG files are checked artifacts.
- [ ] Structural element receipts are checked beside each SVG.
- [ ] Receipts record renderer version, source hash, SVG hash, and deterministic options.
- [ ] Every expected actor, message, group, span, and note has at least one visually corresponding receipt element documented by a test.
- [ ] A revision inserting one earlier message has its own receipt.
- [ ] Tests report which native SVG identifiers remain stable across that revision.
- [ ] No SVG mutation or normalized binding occurs in this step.

## Tests Run

- [ ] D2 receipt snapshot command and result are recorded.

## Implementation Notes

Agent route: gpt-5.6-terra at high. One receipt belongs to one source hash, renderer version, theme, font set, and render option set.
