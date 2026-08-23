---
created: 2026-08-23
updated: 2026-08-23
type: task
assignee: terra
status: done
priority: high
epic: sequence-adapters
labels: [sequence, d2, svg, terra-high]
collision: [packages-d2]
blocked_by: ['@d2-render-receipt', '@d2-local-document', '@sequence-occurrence-identity']
lane: sequence-d2
lane_seq: 3
commits:
- hash: 57e2aea
  summary: 'sequence: recover native SVG bindings'
closed: 2026-08-23
---

# Recover D2 SVG bindings

## Description

## Plan Reference

D2 half of section 4 in `plans/2026-08-23-d2-mermaid-sequence-adapters.md`.

## Acceptance Criteria

- [x] D2 binding recovery remains a language-specific implementation.
- [x] Every expected fixture occurrence has the required binding roles.
- [x] Repeated messages bind to distinct message lines and labels.
- [x] Actor labels, shapes, and lifelines bind to the same actor occurrence.
- [x] Nested group frames and labels bind to the correct group occurrence.
- [x] Spans bind to their owning occurrence and actor.
- [x] Insert-before revision tests preserve bindings for retained occurrences or report explicit ambiguity.
- [x] Binding output contains no DOM element references.
- [x] Decorated SVG validates as SVG and retains the native viewBox.

## Tests Run

- [x] D2 binding snapshot and SVG validation commands are recorded.

## Implementation Notes

Agent route: gpt-5.6-sol at high. Bindings are immutable records keyed by occurrence, role, and ordinal.

## Agent Runs

### 2026-08-23T19:39:59Z · @codex

Native gpt-5.6-terra at high reused as /root/sequence_local_documents from commit f5f9a56. Explicit user routing overrides the original sol-high assignment. Coordinator retains issue tracker ownership.

### 2026-08-23T19:54:50Z · @codex

Commit 57e2aea. pnpm test:sequence-bindings passed three Terra runs and one coordinator run: 4 tests. Direct Playwright validates decorated XML and the retained native viewBox. Local documents, identity, receipts, Grapht typecheck/build, and Biome passed. A focused failure proved IDs were inserted after the slash in self-closing tags; insertion now occurs before the slash.

