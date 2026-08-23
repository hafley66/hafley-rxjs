---
created: 2026-08-23
updated: 2026-08-23
type: task
assignee: sol
status: open
priority: normal
epic: sequence-adapters
labels: [sequence, sol-high, placement]
collision: [packages-grapht-model]
blocked_by: ['@sequence-board-projection']
lane: sequence-model
lane_seq: 4
---

# Reconcile manual sequence placements

## Description

## Plan Reference

Section 9b of `plans/2026-08-23-d2-mermaid-sequence-adapters.md`.

## Acceptance Criteria

- [ ] Placements are stored as deltas from one named geometry revision.
- [ ] Exact retained identity carries placement into the next revision.
- [ ] Inserted and removed occurrences never inherit placement.
- [ ] Ambiguous occurrences never inherit placement automatically.
- [ ] Rebased placement records name the next geometry revision.
- [ ] Reconciliation has fixtures for insert, reorder, rename, regroup, and remove.
- [ ] Mermaid and D2 use the same reconciliation function.

## Tests Run

- [ ] Placement reconciliation snapshots for every revision case are recorded.

## Implementation Notes

Agent route: gpt-5.6-sol at high. Reconciliation consumes the explicit identity receipt and never guesses through ambiguity.
