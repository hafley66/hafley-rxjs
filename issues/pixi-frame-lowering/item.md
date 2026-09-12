---
created: 2026-08-25
updated: 2026-08-25
type: feature
assignee: terra-high
status: open
priority: high
epic: grapht-renderer-platform
labels:
- model:terra-high
- size:medium
- lane:pixi
blocked_by: ['@cytoscape-translate-browser']
size: M
lane: pixi
collision: [packages-grapht, adapter-pixijs]
---

# Lower canonical frames into Pixi

## Description

## Definition of Done

- [ ] Pixi consumes the same canonical topology and resolved visual frame as Cytoscape.
- [ ] Nodes, edges, labels, groups, and ports remain individually interactive.
- [ ] Pan and drag use frame-batched state without listener growth.
- [ ] No whole-SVG raster path is used for semantic diagrams.
