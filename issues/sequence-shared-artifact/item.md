---
created: 2026-08-23
updated: 2026-08-23
type: task
assignee: terra
status: done
priority: high
epic: sequence-adapters
labels: [sequence, terra-high, artifact]
collision: [packages-grapht-model]
blocked_by: ['@mermaid-svg-bindings', '@d2-svg-bindings']
lane: sequence-model
lane_seq: 2
commits:
- hash: 44fb5eb
  summary: 'sequence: build shared artifact'
closed: 2026-08-23
---

# Build shared sequence artifact

## Description

## Plan Reference

Section 5 of `plans/2026-08-23-d2-mermaid-sequence-adapters.md`.

## Acceptance Criteria

- [x] Mermaid and D2 adapters implement the same interface.
- [x] Equivalent fixtures produce the same occurrence kinds and relation topology.
- [x] All serialized outputs pass `grapht-sequence/0` runtime schemas.
- [x] Source, render, and binding revisions have separate IDs.
- [x] Renderer and adapter versions appear in receipts.
- [x] Cancellation prevents a superseded render from becoming the current artifact.
- [x] Package tests consume only public adapter exports.

## Tests Run

- [x] Cross-language artifact snapshots and cancellation test are recorded.

## Implementation Notes

Agent route: gpt-5.6-terra at high. Language-local documents remain outside the serialized shared artifact.

## Agent Runs

### 2026-08-23T19:55:21Z · @codex

Native gpt-5.6-terra at high reused as /root/sequence_local_documents from commit 57e2aea. Coordinator retains issue tracker ownership.

### 2026-08-23T20:09:09Z · @codex

Commit 44fb5eb. pnpm test:sequence-artifact passed Terra and coordinator runs: 4 tests. Bindings, local documents, identity, Grapht typecheck/build, Biome, and clean checks passed. Focused failures proved Mermaid deactivate caused cross-language topology drift and aborted older updates rejected; serialization now filters unbound occurrences and cancellation returns superseded.

