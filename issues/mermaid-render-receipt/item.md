---
created: 2026-08-23
updated: 2026-08-23
type: task
assignee: terra
status: open
priority: high
epic: sequence-adapters
labels: [sequence, terra-high, mermaid]
collision: [packages-mmd]
blocked_by: ['@sequence-fixtures']
lane: sequence-mermaid
lane_seq: 1
---

# Capture Mermaid native render receipts

## Description

## Plan Reference

Mermaid half of section 1 in `plans/2026-08-23-d2-mermaid-sequence-adapters.md`.

## Acceptance Criteria

- [ ] Mermaid native SVG files are checked artifacts.
- [ ] Structural element receipts are checked beside each SVG.
- [ ] Receipts record renderer version, source hash, SVG hash, and deterministic options.
- [ ] Every expected actor, message, group, activation, and note has at least one visually corresponding receipt element documented by a test.
- [ ] A revision inserting one earlier message has its own receipt.
- [ ] Tests report which native SVG identifiers remain stable across that revision.
- [ ] No SVG mutation or normalized binding occurs in this step.

## Tests Run

- [ ] Mermaid receipt snapshot command and result are recorded.

## Implementation Notes

Agent route: gpt-5.6-terra at high. One receipt belongs to one source hash, renderer version, theme, font set, and render option set.
