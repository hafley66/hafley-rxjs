---
created: 2026-08-23
updated: 2026-08-23
type: task
assignee: terra
status: in-progress
priority: high
epic: sequence-adapters
labels: [sequence, terra-high, toolchain]
lane: sequence-toolchain
lane_seq: 0
collision: [workspace-manifest, pnpm-lock]
---

# Pin sequence renderer toolchain

## Description

## Plan Reference

Preflight renderer-toolchain gate in `plans/2026-08-23-d2-mermaid-sequence-adapters.md`.

## Acceptance Criteria

- [ ] Mermaid and D2 native renderers are declared by repository-owned version pins.
- [ ] Exact renderer package names, versions, commands, and deterministic options are recorded.
- [ ] Mermaid renders one minimal sequence source headlessly through the pinned repository dependency.
- [ ] D2 renders one minimal sequence source through the pinned repository toolchain.
- [ ] Tests fail with an explicit renderer-unavailable diagnostic when a required binary or package is missing.
- [ ] Renderer setup introduces no sequence occurrence IDs, semantic normalization, SVG bindings, or browser geometry.

## Tests Run

- [ ] Focused Mermaid and D2 smoke-render commands and versions are recorded.

## Implementation Notes

Agent route: gpt-5.6-terra at high. Current evidence: `/opt/homebrew/bin/d2` reports 0.7.1, while no Mermaid dependency, lockfile entry, `mmdc`, or `mermaid` executable exists. This gate owns repository pins and smoke rendering only.

## Agent Runs

### 2026-08-23T18:52:00Z · @codex

Dispatch target: native gpt-5.6-terra at high reasoning in Boop lane feature-sequence-renderer-toolchain.
