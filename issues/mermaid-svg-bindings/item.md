---
created: 2026-08-23
updated: 2026-08-23
type: task
assignee: sol
status: open
priority: high
epic: sequence-adapters
labels: [sequence, sol-high, mermaid, svg]
collision: [packages-mmd]
blocked_by: ['@mermaid-render-receipt', '@mermaid-local-document', '@sequence-occurrence-identity']
lane: sequence-mermaid
lane_seq: 3
---

# Recover Mermaid SVG bindings

## Description

## Plan Reference

Mermaid half of section 4 in `plans/2026-08-23-d2-mermaid-sequence-adapters.md`.

## Acceptance Criteria

- [ ] Mermaid binding recovery remains a language-specific implementation.
- [ ] Every expected fixture occurrence has the required binding roles.
- [ ] Repeated messages bind to distinct message lines and labels.
- [ ] Actor labels, shapes, and lifelines bind to the same actor occurrence.
- [ ] Nested group frames and labels bind to the correct group occurrence.
- [ ] Activations bind to their owning occurrence and actor.
- [ ] Insert-before revision tests preserve bindings for retained occurrences or report explicit ambiguity.
- [ ] Binding output contains no DOM element references.
- [ ] Decorated SVG validates as SVG and retains the native viewBox.

## Tests Run

- [ ] Mermaid binding snapshot and SVG validation commands are recorded.

## Implementation Notes

Agent route: gpt-5.6-sol at high. Bindings are immutable records keyed by occurrence, role, and ordinal.
