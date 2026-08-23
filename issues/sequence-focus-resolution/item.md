---
created: 2026-08-23
updated: 2026-08-23
type: task
assignee: terra
status: done
priority: normal
epic: sequence-adapters
labels: [sequence, focus, terra-high]
collision: [packages-grapht-model]
blocked_by: ['@sequence-shared-artifact']
lane: sequence-model
lane_seq: 3
commits:
- hash: 7e48b1d
  summary: 'sequence: measure geometry and resolve focus'
closed: 2026-08-23
---

# Resolve sequence focus

## Description

## Plan Reference

Section 7 of `plans/2026-08-23-d2-mermaid-sequence-adapters.md`.

## Acceptance Criteria

- [x] Message focus returns both endpoint actors.
- [x] Self-message focus returns one actor once.
- [x] Activation focus returns its actor.
- [x] Nested message focus returns every containing group in parent order.
- [x] Actor focus returns that actor.
- [x] Missing occurrence focus returns empty actor and group arrays.
- [x] Mermaid and D2 equivalent fixture occurrences produce equivalent focus receipts.
- [x] The function performs no DOM reads or writes.

## Tests Run

- [x] Focus inline snapshots and DOM-free test result are recorded.

## Implementation Notes

Agent route: gpt-5.6-luna at xhigh. Focus is ephemeral view state over the current immutable artifact.

## Agent Runs

### 2026-08-23T20:09:42Z · @codex

Native gpt-5.6-terra at high reused as /root/sequence_local_documents from commit 44fb5eb. Explicit user routing applies; coordinator retains issue tracker ownership.

### 2026-08-23T20:23:28Z · @codex

Commit 7e48b1d. pnpm test:sequence-geometry-focus passed Terra and coordinator runs: 2 tests. Message, self-message, activation, nested groups, actor, missing, and cross-language focus receipts pass. Relation occurrenceId associates repeated message and activation relations with their source occurrence; focus performs no DOM operations.

