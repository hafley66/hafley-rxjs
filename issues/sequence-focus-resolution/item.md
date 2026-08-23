---
created: 2026-08-23
updated: 2026-08-23
type: task
assignee: terra
status: in-progress
priority: normal
epic: sequence-adapters
labels: [sequence, focus, terra-high]
collision: [packages-grapht-model]
blocked_by: ['@sequence-shared-artifact']
lane: sequence-model
lane_seq: 3
---

# Resolve sequence focus

## Description

## Plan Reference

Section 7 of `plans/2026-08-23-d2-mermaid-sequence-adapters.md`.

## Acceptance Criteria

- [ ] Message focus returns both endpoint actors.
- [ ] Self-message focus returns one actor once.
- [ ] Activation focus returns its actor.
- [ ] Nested message focus returns every containing group in parent order.
- [ ] Actor focus returns that actor.
- [ ] Missing occurrence focus returns empty actor and group arrays.
- [ ] Mermaid and D2 equivalent fixture occurrences produce equivalent focus receipts.
- [ ] The function performs no DOM reads or writes.

## Tests Run

- [ ] Focus inline snapshots and DOM-free test result are recorded.

## Implementation Notes

Agent route: gpt-5.6-luna at xhigh. Focus is ephemeral view state over the current immutable artifact.

## Agent Runs

### 2026-08-23T20:09:42Z · @codex

Native gpt-5.6-terra at high reused as /root/sequence_local_documents from commit 44fb5eb. Explicit user routing applies; coordinator retains issue tracker ownership.
