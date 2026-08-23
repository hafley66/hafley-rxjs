---
created: 2026-08-23
updated: 2026-08-23
type: task
assignee: sol
status: open
priority: normal
epic: sequence-adapters
labels: [sequence, sol-high, collapse]
collision: [sequence-board]
blocked_by: ['@sequence-board-projection']
lane: sequence-board
lane_seq: 3
---

# Project collapsed sequence groups

## Description

## Plan Reference

Section 9a of `plans/2026-08-23-d2-mermaid-sequence-adapters.md`.

## Acceptance Criteria

- [ ] Collapsing retains the selected group frame and label.
- [ ] Descendant rows are hidden or replaced by one summary row.
- [ ] Following geometry moves upward by the measured collapsed delta.
- [ ] The resulting viewBox height decreases by that delta.
- [ ] Expanding restores the original geometry exactly.
- [ ] Nested collapse order is deterministic.
- [ ] Mermaid and D2 equivalent groups produce equivalent collapse receipts.

## Tests Run

- [ ] Collapse geometry snapshots for both languages are recorded.

## Implementation Notes

Agent route: gpt-5.6-sol at high. Collapse projects immutable artifact and geometry into a new geometry record.
