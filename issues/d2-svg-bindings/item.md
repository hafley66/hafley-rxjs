---
created: 2026-08-23
updated: 2026-08-23
type: task
assignee: terra
status: in-progress
priority: high
epic: sequence-adapters
labels: [sequence, d2, svg, terra-high]
collision: [packages-d2]
blocked_by: ['@d2-render-receipt', '@d2-local-document', '@sequence-occurrence-identity']
lane: sequence-d2
lane_seq: 3
---

# Recover D2 SVG bindings

## Description

## Plan Reference

D2 half of section 4 in `plans/2026-08-23-d2-mermaid-sequence-adapters.md`.

## Acceptance Criteria

- [ ] D2 binding recovery remains a language-specific implementation.
- [ ] Every expected fixture occurrence has the required binding roles.
- [ ] Repeated messages bind to distinct message lines and labels.
- [ ] Actor labels, shapes, and lifelines bind to the same actor occurrence.
- [ ] Nested group frames and labels bind to the correct group occurrence.
- [ ] Spans bind to their owning occurrence and actor.
- [ ] Insert-before revision tests preserve bindings for retained occurrences or report explicit ambiguity.
- [ ] Binding output contains no DOM element references.
- [ ] Decorated SVG validates as SVG and retains the native viewBox.

## Tests Run

- [ ] D2 binding snapshot and SVG validation commands are recorded.

## Implementation Notes

Agent route: gpt-5.6-sol at high. Bindings are immutable records keyed by occurrence, role, and ordinal.

## Agent Runs

### 2026-08-23T19:39:59Z · @codex

Native gpt-5.6-terra at high reused as /root/sequence_local_documents from commit f5f9a56. Explicit user routing overrides the original sol-high assignment. Coordinator retains issue tracker ownership.
