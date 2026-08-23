---
created: 2026-08-23
updated: 2026-08-23
type: task
assignee: terra
status: done
priority: high
epic: sequence-adapters
labels: [sequence, terra-high, mermaid]
collision: [packages-mmd]
blocked_by: ['@sequence-fixtures']
lane: sequence-mermaid
lane_seq: 1
commits:
- hash: 50e0f63
  summary: 'sequence: check native renderer receipts'
closed: 2026-08-23
---

# Capture Mermaid native render receipts

## Description

## Plan Reference

Mermaid half of section 1 in `plans/2026-08-23-d2-mermaid-sequence-adapters.md`.

## Acceptance Criteria

- [x] Mermaid native SVG files are checked artifacts.
- [x] Structural element receipts are checked beside each SVG.
- [x] Receipts record renderer version, source hash, SVG hash, and deterministic options.
- [x] Every expected actor, message, group, activation, and note has at least one visually corresponding receipt element documented by a test.
- [x] A revision inserting one earlier message has its own receipt.
- [x] Tests report which native SVG identifiers remain stable across that revision.
- [x] No SVG mutation or normalized binding occurs in this step.

## Tests Run

- [x] Mermaid receipt snapshot command and result are recorded.

## Implementation Notes

Agent route: gpt-5.6-terra at high. One receipt belongs to one source hash, renderer version, theme, font set, and render option set.

## Agent Runs

### 2026-08-23T19:18:33Z · @codex

Commit 50e0f63. pnpm test:sequence-receipts passed three independent runs. Mermaid 11.16.0 through Playwright 1.62.1 reproduced both checked SVG byte-for-byte and both 98/100-element receipt files. All expected visual concepts have receipt evidence. The inserted earlier message retained 18 native IDs.
