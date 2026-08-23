---
created: 2026-08-23
updated: 2026-08-23
type: task
assignee: terra
status: in-progress
priority: high
epic: sequence-adapters
labels: [sequence, package-gate, terra-high]
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

## Agent Runs

### 2026-08-23T20:44:57Z · @codex

Native gpt-5.6-terra at high reused as /root/sequence_local_documents from commit fb04837. Explicit user routing overrides the original sol-high route; coordinator retains tracker ownership and validation.
