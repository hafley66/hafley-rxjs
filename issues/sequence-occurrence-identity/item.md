---
created: 2026-08-23
updated: 2026-08-23
type: task
assignee: terra
status: in-progress
priority: high
epic: sequence-adapters
labels: [sequence, identity, terra-high]
collision: [packages-grapht-model]
blocked_by: ['@mermaid-local-document', '@d2-local-document']
lane: sequence-model
lane_seq: 1
---

# Define sequence occurrence identity

## Description

## Plan Reference

Section 3 of `plans/2026-08-23-d2-mermaid-sequence-adapters.md`.

## Acceptance Criteria

- [ ] Every local semantic node lowers to one addressable occurrence.
- [ ] Occurrence IDs are unique within a revision.
- [ ] Relations reference existing occurrence IDs.
- [ ] All six revision fixtures have inline identity receipts.
- [ ] Repeated and reordered Mermaid messages produce explicit ambiguity records whenever available source data cannot select one prior occurrence.
- [ ] D2 authored IDs remain stable when unrelated earlier statements are inserted.
- [ ] Ambiguous matches never silently retain manual placement.
- [ ] Matching results are deterministic across repeated runs.

## Tests Run

- [ ] Six revision identity snapshots and repeated-run result are recorded.

## Implementation Notes

Agent route: gpt-5.6-sol at high. Occurrences belong to one source revision. A match receipt connects exactly two ordered revisions.

## Agent Runs

### 2026-08-23T19:29:54Z · @codex

Native gpt-5.6-terra at high reused as /root/sequence_local_documents from commit 114ddd0. Explicit user routing overrides the original sol-high assignment. Coordinator retains issue tracker ownership.
