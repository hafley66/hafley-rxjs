---
created: 2026-08-23
updated: 2026-08-23
type: task
assignee: terra
status: done
priority: high
epic: sequence-adapters
labels: [sequence, identity, terra-high]
collision: [packages-grapht-model]
blocked_by: ['@mermaid-local-document', '@d2-local-document']
lane: sequence-model
lane_seq: 1
commits:
- hash: f5f9a56
  summary: 'sequence: add revision occurrence identity'
closed: 2026-08-23
---

# Define sequence occurrence identity

## Description

## Plan Reference

Section 3 of `plans/2026-08-23-d2-mermaid-sequence-adapters.md`.

## Acceptance Criteria

- [x] Every local semantic node lowers to one addressable occurrence.
- [x] Occurrence IDs are unique within a revision.
- [x] Relations reference existing occurrence IDs.
- [x] All six revision fixtures have inline identity receipts.
- [x] Repeated and reordered Mermaid messages produce explicit ambiguity records whenever available source data cannot select one prior occurrence.
- [x] D2 authored IDs remain stable when unrelated earlier statements are inserted.
- [x] Ambiguous matches never silently retain manual placement.
- [x] Matching results are deterministic across repeated runs.

## Tests Run

- [x] Six revision identity snapshots and repeated-run result are recorded.

## Implementation Notes

Agent route: gpt-5.6-sol at high. Occurrences belong to one source revision. A match receipt connects exactly two ordered revisions.

## Agent Runs

### 2026-08-23T19:29:54Z · @codex

Native gpt-5.6-terra at high reused as /root/sequence_local_documents from commit 114ddd0. Explicit user routing overrides the original sol-high assignment. Coordinator retains issue tracker ownership.

### 2026-08-23T19:39:25Z · @codex

Commit f5f9a56. pnpm test:sequence-identity passed three Terra runs and one coordinator run: 4 tests. Local-document tests, Grapht typecheck/build, six individual D2 validations, and clean checks passed. Six Mermaid and six D2 A-F fixtures have inline receipts. Full Grapht suite is 70/76; the same six shell-process failures reproduce at pre-identity commit 48901c3, where the suite is 66/72.

