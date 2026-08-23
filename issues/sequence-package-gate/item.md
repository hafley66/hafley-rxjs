---
created: 2026-08-23
updated: 2026-08-23
type: task
assignee: sol
status: open
priority: high
epic: sequence-adapters
labels: [sequence, sol-high, package-gate]
collision: [packages-mmd, packages-d2, packages-grapht-model, sequence-board]
blocked_by: ['@sequence-group-collapse', '@sequence-placement-reconciliation']
lane: sequence-integration
lane_seq: 1
---

# Verify sequence package boundaries

## Description

## Plan Reference

Package gate of `plans/2026-08-23-d2-mermaid-sequence-adapters.md`.

## Acceptance Criteria

- [ ] Package dependency direction matches the dependency graph in the plan.
- [ ] `grapht-model` has no Mermaid, D2, DOM, React, browser, or renderer dependency.
- [ ] `mmd` and `d2` depend on `grapht-model` only after the shared artifact gate.
- [ ] Browser measurement and board code contain no language parser dependency.
- [ ] Every package uses author-driven numeric source prefixes.
- [ ] Cross-package fixtures validate serialized outputs at package boundaries.

## Tests Run

- [ ] Package builds, dependency checks, and cross-package fixture commands are recorded.

## Implementation Notes

Agent route: gpt-5.6-sol at high. This issue owns integration verification and boundary corrections only after both optional projection issues pass.
