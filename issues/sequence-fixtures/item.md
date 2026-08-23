---
created: 2026-08-23
updated: 2026-08-23
type: task
assignee: luna
status: done
priority: high
epic: sequence-adapters
labels: [sequence, luna-xhigh, fixtures]
lane_seq: 0
collision: [sequence-fixtures]
lane: sequence-fixtures
blocked_by: ['@sequence-renderer-toolchain']
commits:
- hash: 500d019
  summary: 'sequence: add equivalent renderer fixtures'
closed: 2026-08-23
---

# Create equivalent sequence fixtures

## Description

## Plan Reference

Section 0 of `plans/2026-08-23-d2-mermaid-sequence-adapters.md`.

## Acceptance Criteria

- [x] One Mermaid source and one D2 source exist under a shared fixture directory.
- [x] Both render successfully with the repository-pinned native renderer versions.
- [x] The expectation documents contain the same occurrence keys for equivalent language concepts.
- [x] Repeated messages have distinct fixture keys despite sharing labels and endpoints.
- [x] Fixture sources and expectations pass inline or file snapshots.
- [x] No normalized runtime entity IDs are selected in this step.

## Tests Run

- [x] Fixture snapshot test command and result are recorded.

## Implementation Notes

Agent route: gpt-5.6-luna at xhigh. Preserve immutable fixture and revision-file lifetimes from the plan. Stop after fixture and renderer viability evidence. Do not create shared runtime entity IDs.

## Agent Runs

### 2026-08-23T18:44:24Z · @codex

Dispatched native gpt-5.6-luna at xhigh in .boop-worktrees/feature/sequence-fixtures. Boop 0.10 only parses low, medium, and high effort suffixes, so the native collaboration worker retains xhigh and registers its Codex session with Boop from the worktree.

### 2026-08-23T18:51:32Z · @codex

Luna xhigh stop condition: d2 exists only at /opt/homebrew/bin/d2 version 0.7.1; no Mermaid dependency appears in package.json, workspace manifests, or pnpm-lock.yaml; neither mmdc nor mermaid exists on PATH. Worktree remained clean and no commit was created.

### 2026-08-23T19:04:13Z · @codex

Manual continuation on top of renderer commit 48901c3 after @sequence-renderer-toolchain passed.

### 2026-08-23T19:10:11Z · @codex

Commit 500d019. pnpm test:sequence-fixtures passed three independent runs: 2 tests per run. Pinned output: Mermaid 11.16.0 via Playwright 1.62.1 at viewBox 701x534; D2 0.7.1 at viewBox 704x911. Both exceed the 320px initial viewport. Occurrence expectations contain 11 shared fixture keys and no runtime normalized entity IDs.



