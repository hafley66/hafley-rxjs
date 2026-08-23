---
created: 2026-08-23
updated: 2026-08-23
type: task
assignee: terra
status: in-progress
priority: high
epic: sequence-adapters
labels: [sequence, terra-high, artifact]
collision: [packages-grapht-model]
blocked_by: ['@mermaid-svg-bindings', '@d2-svg-bindings']
lane: sequence-model
lane_seq: 2
---

# Build shared sequence artifact

## Description

## Plan Reference

Section 5 of `plans/2026-08-23-d2-mermaid-sequence-adapters.md`.

## Acceptance Criteria

- [ ] Mermaid and D2 adapters implement the same interface.
- [ ] Equivalent fixtures produce the same occurrence kinds and relation topology.
- [ ] All serialized outputs pass `grapht-sequence/0` runtime schemas.
- [ ] Source, render, and binding revisions have separate IDs.
- [ ] Renderer and adapter versions appear in receipts.
- [ ] Cancellation prevents a superseded render from becoming the current artifact.
- [ ] Package tests consume only public adapter exports.

## Tests Run

- [ ] Cross-language artifact snapshots and cancellation test are recorded.

## Implementation Notes

Agent route: gpt-5.6-terra at high. Language-local documents remain outside the serialized shared artifact.

## Agent Runs

### 2026-08-23T19:55:21Z · @codex

Native gpt-5.6-terra at high reused as /root/sequence_local_documents from commit 57e2aea. Coordinator retains issue tracker ownership.
