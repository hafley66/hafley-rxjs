---
created: 2026-08-25
updated: 2026-08-25
type: feature
assignee: terra-high
status: open
priority: normal
epic: grapht-renderer-platform
labels:
- model:terra-high
- size:medium
- lane:golden
blocked_by: ['@cytoscape-translate-browser', '@pixi-translate-browser', '@renderer-runtime-probes']
size: M
lane: golden
collision: [packages-grapht-golden]
---

# Build canonical renderer exercise app

## Description

## Definition of Done

- [ ] One app switches the same graph among Cytoscape and Pixi.
- [ ] Fixtures exercise nested groups, sticky labels, sequence geometry, directed and undirected multi-edges, self-edges, ports, movement, and selection.
- [ ] The app imports production adapters and contains no bespoke renderer path.
- [ ] Browser tests verify equivalent observable state across both renderers.
