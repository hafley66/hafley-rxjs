---
created: 2026-08-23
updated: 2026-08-23
type: task
assignee: luna
status: in-progress
priority: high
epic: sequence-adapters
labels: [sequence, luna-xhigh, fixtures]
lane_seq: 0
collision: [sequence-fixtures]
lane: sequence-fixtures
---

# Create equivalent sequence fixtures

## Description

## Plan Reference

Section 0 of `plans/2026-08-23-d2-mermaid-sequence-adapters.md`.

## Acceptance Criteria

- [ ] One Mermaid source and one D2 source exist under a shared fixture directory.
- [ ] Both render successfully with the repository-pinned native renderer versions.
- [ ] The expectation documents contain the same occurrence keys for equivalent language concepts.
- [ ] Repeated messages have distinct fixture keys despite sharing labels and endpoints.
- [ ] Fixture sources and expectations pass inline or file snapshots.
- [ ] No normalized runtime entity IDs are selected in this step.

## Tests Run

- [ ] Fixture snapshot test command and result are recorded.

## Implementation Notes

Agent route: gpt-5.6-luna at xhigh. Preserve immutable fixture and revision-file lifetimes from the plan. Stop after fixture and renderer viability evidence. Do not create shared runtime entity IDs.

## Agent Runs

### 2026-08-23T18:44:24Z · @codex

Dispatched native gpt-5.6-luna at xhigh in .boop-worktrees/feature/sequence-fixtures. Boop 0.10 only parses low, medium, and high effort suffixes, so the native collaboration worker retains xhigh and registers its Codex session with Boop from the worktree.
