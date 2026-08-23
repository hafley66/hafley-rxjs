---
created: 2026-08-23
updated: 2026-08-23
type: task
assignee: terra
status: done
priority: high
epic: sequence-adapters
labels: [sequence, d2, terra-high]
collision: [packages-d2]
blocked_by: ['@d2-render-receipt']
lane: sequence-d2
lane_seq: 2
commits:
- hash: 114ddd0
  summary: 'sequence: add local source documents'
closed: 2026-08-23
---

# Build D2 local sequence document

## Description

## Plan Reference

D2 half of section 2 in `plans/2026-08-23-d2-mermaid-sequence-adapters.md`.

## Acceptance Criteria

- [x] D2 parsing produces every expected actor, edge, group, span, and note in source order.
- [x] Every parsed occurrence has a source span or an explicit diagnostic stating why the parser cannot supply one.
- [x] Repeated messages remain two separate local nodes.
- [x] Nested groups preserve their containment structure.
- [x] Local document snapshots contain no shared `GraphEntity` or `SequenceOccurrence` types.
- [x] Invalid-source fixtures produce deterministic diagnostics.

## Tests Run

- [x] D2 parser snapshot command and result are recorded.

## Implementation Notes

Agent route: gpt-5.6-sol at high. Preserve language-owned forms and source-local identity. Do not claim cross-revision stability.

## Agent Runs

### 2026-08-23T19:19:51Z · @codex

Native gpt-5.6-terra at high dispatched as /root/sequence_local_documents in the existing Boop worktree. Explicit user routing overrides the original sol-high assignment. Coordinator retains issue tracker ownership.

### 2026-08-23T19:29:16Z · @codex

Commit 114ddd0. pnpm test:sequence-local-documents passed three Terra runs and one coordinator run: 2 files, 4 tests each. d2 validate passed the fixture; D2 0.7.1 exposes no serialized AST API, so tested source forms produce a language-local document and unsupported forms produce deterministic diagnostics. Strict parser TypeScript and Biome passed.

