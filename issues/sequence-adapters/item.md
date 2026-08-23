---
created: 2026-08-23
updated: 2026-08-23
type: epic
owner: codex
status: open
priority: high
labels: [sequence, d2, mermaid]
---

# D2 and Mermaid sequence adapters

## Description

## Goal

Implement the dependency-ordered sequence adapter plan in `plans/2026-08-23-d2-mermaid-sequence-adapters.md` through isolated evidence gates.

## Issues

| Order | Issue | Agent | Blocked by |
| --- | --- | --- | --- |
| 0 | @sequence-fixtures | luna xhigh | none |
| 1a | @mermaid-render-receipt | terra high | @sequence-fixtures |
| 1b | @d2-render-receipt | terra high | @sequence-fixtures |
| 2a | @mermaid-local-document | sol high | @mermaid-render-receipt |
| 2b | @d2-local-document | sol high | @d2-render-receipt |
| 3 | @sequence-occurrence-identity | sol high | both local documents |
| 4a | @mermaid-svg-bindings | sol high | Mermaid receipt, Mermaid document, identity |
| 4b | @d2-svg-bindings | sol high | D2 receipt, D2 document, identity |
| 5 | @sequence-shared-artifact | terra high | both SVG binding issues |
| 6 | @sequence-browser-geometry | terra high | shared artifact |
| 7 | @sequence-focus-resolution | luna xhigh | shared artifact |
| 8 | @sequence-board-projection | sol high | browser geometry and focus |
| 9a | @sequence-group-collapse | sol high | board projection |
| 9b | @sequence-placement-reconciliation | sol high | board projection |
| gate | @sequence-package-gate | sol high | collapse and placement |

## Acceptance Criteria

- [ ] Every child issue passes `issuectl ready`.
- [ ] The final `issuectl dag` contains no open blocker cycle.
- [ ] Package dependency direction matches the written plan.
- [ ] Cross-package fixtures validate serialized outputs at package boundaries.
- [ ] Stop-condition evidence is recorded before any downstream type or package boundary changes.

## Tests Run

- [ ] `issuectl --json doctor`
- [ ] `issuectl --json dag`
- [ ] Package gates recorded by each child issue

## Implementation Notes

The written plan is authoritative for signatures, instance lifetimes, storage, uniqueness, and stop conditions. Existing reference branches are evidence sources and are not integration bases until their owning issue gate passes.

## Decisions

### 2026-08-23T18:52:00Z · @codex

Inserted @sequence-renderer-toolchain before @sequence-fixtures after the first Luna run proved renderer pins were absent. The canonical issuectl DAG supersedes the original table for this added prerequisite.
