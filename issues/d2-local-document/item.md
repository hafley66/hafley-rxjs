---
created: 2026-08-23
updated: 2026-08-23
type: task
assignee: terra
status: in-progress
priority: high
epic: sequence-adapters
labels: [sequence, d2, terra-high]
collision: [packages-d2]
blocked_by: ['@d2-render-receipt']
lane: sequence-d2
lane_seq: 2
---

# Build D2 local sequence document

## Description

## Plan Reference

D2 half of section 2 in `plans/2026-08-23-d2-mermaid-sequence-adapters.md`.

## Acceptance Criteria

- [ ] D2 parsing produces every expected actor, edge, group, span, and note in source order.
- [ ] Every parsed occurrence has a source span or an explicit diagnostic stating why the parser cannot supply one.
- [ ] Repeated messages remain two separate local nodes.
- [ ] Nested groups preserve their containment structure.
- [ ] Local document snapshots contain no shared `GraphEntity` or `SequenceOccurrence` types.
- [ ] Invalid-source fixtures produce deterministic diagnostics.

## Tests Run

- [ ] D2 parser snapshot command and result are recorded.

## Implementation Notes

Agent route: gpt-5.6-sol at high. Preserve language-owned forms and source-local identity. Do not claim cross-revision stability.

## Agent Runs

### 2026-08-23T19:19:51Z · @codex

Native gpt-5.6-terra at high dispatched as /root/sequence_local_documents in the existing Boop worktree. Explicit user routing overrides the original sol-high assignment. Coordinator retains issue tracker ownership.
