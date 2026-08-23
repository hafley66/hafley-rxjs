---
created: 2026-08-23
updated: 2026-08-23
type: task
assignee: terra
status: done
priority: normal
epic: sequence-adapters
labels: [sequence, placement, terra-high]
collision: [packages-grapht-model]
blocked_by: ['@sequence-board-projection']
lane: sequence-model
lane_seq: 4
commits:
- hash: fb04837
  summary: 'sequence: collapse groups and reconcile placements'
closed: 2026-08-23
closed_by: codex
---

# Reconcile manual sequence placements

## Description

## Plan Reference

Section 9b of `plans/2026-08-23-d2-mermaid-sequence-adapters.md`.

## Acceptance Criteria

- [x] Placements are stored as deltas from one named geometry revision.
- [x] Exact retained identity carries placement into the next revision.
- [x] Inserted and removed occurrences never inherit placement.
- [x] Ambiguous occurrences never inherit placement automatically.
- [x] Rebased placement records name the next geometry revision.
- [x] Reconciliation has fixtures for insert, reorder, rename, regroup, and remove.
- [x] Mermaid and D2 use the same reconciliation function.

## Tests Run

- [x] Placement reconciliation snapshots for every revision case are recorded.

## Implementation Notes

Agent route: gpt-5.6-sol at high. Reconciliation consumes the explicit identity receipt and never guesses through ambiguity.

## Agent Runs

### 2026-08-23T20:35:23Z · @codex

Native gpt-5.6-terra at high reused as /root/sequence_local_documents from commit e9945d2. Explicit user routing overrides sol-high; coordinator retains issue tracker ownership.

## Comments

### 2026-08-23T20:43:57Z · @codex

Coordinator verification: pnpm test:sequence-collapse-placement passed 2 tests; Grapht typecheck and build passed; Biome source check and git show --check passed. Mutation proof changed ambiguous carryover to not-retained, demonstrating ambiguity handling is observable.

## Resolution

### 2026-08-23T20:43:57Z · @codex

Acceptance criteria and focused validation passed.
