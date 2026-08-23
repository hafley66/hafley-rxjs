---
created: 2026-08-23
updated: 2026-08-23
type: task
assignee: terra
status: done
priority: high
epic: sequence-adapters
labels: [sequence, terra-high, d2]
collision: [packages-d2]
blocked_by: ['@sequence-fixtures']
lane: sequence-d2
lane_seq: 1
commits:
- hash: 50e0f63
  summary: 'sequence: check native renderer receipts'
closed: 2026-08-23
---

# Capture D2 native render receipts

## Description

## Plan Reference

D2 half of section 1 in `plans/2026-08-23-d2-mermaid-sequence-adapters.md`.

## Acceptance Criteria

- [x] D2 native SVG files are checked artifacts.
- [x] Structural element receipts are checked beside each SVG.
- [x] Receipts record renderer version, source hash, SVG hash, and deterministic options.
- [x] Every expected actor, message, group, span, and note has at least one visually corresponding receipt element documented by a test.
- [x] A revision inserting one earlier message has its own receipt.
- [x] Tests report which native SVG identifiers remain stable across that revision.
- [x] No SVG mutation or normalized binding occurs in this step.

## Tests Run

- [x] D2 receipt snapshot command and result are recorded.

## Implementation Notes

Agent route: gpt-5.6-terra at high. One receipt belongs to one source hash, renderer version, theme, font set, and render option set.

## Agent Runs

### 2026-08-23T19:18:47Z · @codex

Commit 50e0f63. pnpm test:sequence-receipts passed three independent runs. D2 0.7.1 reproduced both checked SVG byte-for-byte and both 61/65-element receipt files. All expected visual concepts have receipt evidence. The inserted earlier message retained 0 native IDs because the native diagram-derived ID prefix changed.
