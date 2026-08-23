---
created: 2026-08-23
updated: 2026-08-23
type: task
assignee: terra
status: done
priority: normal
epic: sequence-adapters
labels: [sequence, collapse, terra-high]
collision: [sequence-board]
blocked_by: ['@sequence-board-projection']
lane: sequence-board
lane_seq: 3
commits:
- hash: fb04837
  summary: 'sequence: collapse groups and reconcile placements'
closed: 2026-08-23
closed_by: codex
---

# Project collapsed sequence groups

## Description

## Plan Reference

Section 9a of `plans/2026-08-23-d2-mermaid-sequence-adapters.md`.

## Acceptance Criteria

- [x] Collapsing retains the selected group frame and label.
- [x] Descendant rows are hidden or replaced by one summary row.
- [x] Following geometry moves upward by the measured collapsed delta.
- [x] The resulting viewBox height decreases by that delta.
- [x] Expanding restores the original geometry exactly.
- [x] Nested collapse order is deterministic.
- [x] Mermaid and D2 equivalent groups produce equivalent collapse receipts.

## Tests Run

- [x] Collapse geometry snapshots for both languages are recorded.

## Implementation Notes

Agent route: gpt-5.6-sol at high. Collapse projects immutable artifact and geometry into a new geometry record.

## Agent Runs

### 2026-08-23T20:35:23Z · @codex

Native gpt-5.6-terra at high reused as /root/sequence_local_documents from commit e9945d2. Explicit user routing overrides sol-high; coordinator retains issue tracker ownership.

## Comments

### 2026-08-23T20:43:57Z · @codex

Coordinator verification: pnpm test:sequence-collapse-placement passed 2 tests; Grapht typecheck and build passed; Biome source check and git show --check passed. Mutation proofs covered double collapse from child-plus-parent processing and cross-language collapse receipt equivalence.

## Resolution

### 2026-08-23T20:43:57Z · @codex

Acceptance criteria and focused validation passed.
