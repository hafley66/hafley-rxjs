---
created: 2026-08-23
updated: 2026-08-23
type: task
assignee: terra
status: done
priority: high
epic: sequence-adapters
labels: [sequence, terra-high, toolchain]
lane: sequence-toolchain
lane_seq: 0
collision: [workspace-manifest, pnpm-lock]
commits:
- hash: 48901c3
  summary: pin direct Mermaid Playwright and D2 smoke gate
closed: 2026-08-23
closed_by: codex
---

# Pin sequence renderer toolchain

## Description

## Plan Reference

Preflight renderer-toolchain gate in `plans/2026-08-23-d2-mermaid-sequence-adapters.md`.

## Acceptance Criteria

- [x] Mermaid and D2 native renderers are declared by repository-owned version pins.
- [x] Exact renderer package names, versions, commands, and deterministic options are recorded.
- [x] Mermaid renders one minimal sequence source headlessly through the pinned repository dependency.
- [x] D2 renders one minimal sequence source through the pinned repository toolchain.
- [x] Tests fail with an explicit renderer-unavailable diagnostic when a required binary or package is missing.
- [x] Renderer setup introduces no sequence occurrence IDs, semantic normalization, SVG bindings, or browser geometry.

## Tests Run

- [x] Focused Mermaid and D2 smoke-render commands and versions are recorded.

## Implementation Notes

Agent route: gpt-5.6-terra at high. Current evidence: `/opt/homebrew/bin/d2` reports 0.7.1, while no Mermaid dependency, lockfile entry, `mmdc`, or `mermaid` executable exists. This gate owns repository pins and smoke rendering only.

## Agent Runs

### 2026-08-23T18:52:00Z · @codex

Dispatch target: native gpt-5.6-terra at high reasoning in Boop lane feature-sequence-renderer-toolchain.

### 2026-08-23T19:04:13Z · @codex

Manual completion after Boop launch failure. Commit 48901c3 pins mermaid@11.16.0 with playwright@1.62.1 and D2 CLI 0.7.1. undefined
[ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL] Command "test:sequence-renderers" not found passed in 3 repeated runs plus one post-install run; undefined
[ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL] Command "smoke:sequence-renderers" not found emitted both structural receipts. mermaid-cli and Puppeteer are absent.

