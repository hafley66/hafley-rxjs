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
- lane:cytoscape
blocked_by: ['@graphology-roundtrip-fixtures', '@port-attachment-snapshots', '@renderer-event-signals', '@renderer-capabilities']
size: M
lane: cytoscape
collision: [packages-grapht, adapter-cytoscape]
---

# Lower canonical frames into Cytoscape

## Description

## Definition of Done

- [ ] Cytoscape consumes canonical topology and resolved visual frames.
- [ ] Drag state persists through mouseout and renderer events.
- [ ] Nested compounds, labels, ports, multi-edges, and sticky inputs retain identity.
- [ ] Layout applies only to records declaring participation.
