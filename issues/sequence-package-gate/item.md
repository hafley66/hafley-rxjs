---
created: 2026-08-23
updated: 2026-08-23
type: task
assignee: terra
status: done
priority: high
epic: sequence-adapters
labels: [sequence, package-gate, terra-high]
collision: [packages-mmd, packages-d2, packages-grapht-model, sequence-board]
blocked_by: ['@sequence-group-collapse', '@sequence-placement-reconciliation']
lane: sequence-integration
lane_seq: 1
commits:
- hash: 1a12e4b
  summary: 'sequence: gate language package boundaries'
- hash: df67406
  summary: 'sequence: harden package gate receipts'
closed: 2026-08-23
closed_by: codex
---

# Verify sequence package boundaries

## Description

## Plan Reference

Package gate of `plans/2026-08-23-d2-mermaid-sequence-adapters.md`.

## Acceptance Criteria

- [x] Package dependency direction matches the dependency graph in the plan.
- [x] `grapht-model` has no Mermaid, D2, DOM, React, browser, or renderer dependency.
- [x] `mmd` and `d2` depend on `grapht-model` only after the shared artifact gate.
- [x] Browser measurement and board code contain no language parser dependency.
- [x] Every package uses author-driven numeric source prefixes.
- [x] Cross-package fixtures validate serialized outputs at package boundaries.

## Tests Run

- [x] Package builds, dependency checks, and cross-package fixture commands are recorded.

## Implementation Notes

Agent route: gpt-5.6-sol at high. This issue owns integration verification and boundary corrections only after both optional projection issues pass.

## Agent Runs

### 2026-08-23T20:44:57Z · @codex

Native gpt-5.6-terra at high reused as /root/sequence_local_documents from commit fb04837. Explicit user routing overrides the original sol-high route; coordinator retains tracker ownership and validation.

## Comments

### 2026-08-23T21:06:50Z · @codex

Coordinator review: dependency direction and compatibility re-exports inspected; focused package gate passed 3 tests; grapht-model, mmd, d2, and grapht build/typecheck pairs passed; full sequence matrix passed 30 tests. Proven regressions: a mutated artifact label passed the summary-only snapshot, then failed against the full serialized snapshot; absent dist outputs failed public package resolution, then passed after ordered package builds. Coordinator repeated the absent-dist probe, restored all outputs, and confirmed a clean worktree.

## Resolution

### 2026-08-23T21:06:51Z · @codex

All package-boundary criteria and clean-checkout validation passed.
