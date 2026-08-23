---
created: 2026-08-23
updated: 2026-08-23
type: task
assignee: terra
status: done
priority: high
epic: sequence-adapters
labels: [sequence, board, terra-high]
collision: [sequence-board]
blocked_by: ['@sequence-browser-geometry', '@sequence-focus-resolution']
lane: sequence-board
lane_seq: 2
commits:
- hash: baec8eb
  summary: 'sequence: project artifacts onto board'
- hash: e9945d2
  summary: 'sequence: validate board binding provenance'
closed: 2026-08-23
---

# Project sequence artifact onto board

## Description

## Plan Reference

Section 8 of `plans/2026-08-23-d2-mermaid-sequence-adapters.md`.

## Acceptance Criteria

- [x] One Mermaid artifact and one D2 artifact mount through the same board API.
- [x] Actor labels remain visible after vertical camera movement.
- [x] Hovering a message activates both endpoint actor labels.
- [x] A horizontally offscreen endpoint appears in the focus overlay.
- [x] Activation hover activates its actor label.
- [x] Board replacement never mixes bindings from one render revision with geometry from another.
- [x] Unmount removes every board-owned listener.
- [x] Playwright JSON and PNG receipts pass for both languages.
- [x] Collapse and manual placement behavior are absent from this gate.

## Tests Run

- [x] Mermaid and D2 Playwright JSON and PNG receipt commands are recorded.

## Implementation Notes

Agent route: gpt-5.6-sol at high. One board instance belongs to one mounted viewport and replaces SVG plus geometry atomically.

## Agent Runs

### 2026-08-23T20:24:04Z · @codex

Native gpt-5.6-terra at high reused as /root/sequence_local_documents from commit 7e48b1d. Explicit user routing overrides sol-high; coordinator retains issue tracker ownership.

### 2026-08-23T20:34:33Z · @codex

Commits baec8eb and e9945d2. pnpm test:sequence-board passed Terra and coordinator runs: 2 files, 3 tests. JSON and PNG hashes pass for Mermaid and D2. Mutation tests prove rejected geometry, mutated binding receipts, and mismatched binding revisions preserve the prior markup/receipt; unmount removes pointerover and pointerout listeners.

