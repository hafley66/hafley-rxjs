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
- lane:geometry
blocked_by: ['@visual-port-contract', '@interaction-vocabulary', '@grapht-source-layout']
size: M
lane: geometry
collision: [packages-grapht-model]
---

# Resolve attached visual geometry and ports

## Description

## Definition of Done

- [ ] Moving a node moves attached labels, ports, children, incident edge endpoints, and edge labels.
- [ ] Nested groups and group labels translate as one visual subtree.
- [ ] PortLocation union resolves deterministic position and orientation.
- [ ] Non-participating sequence roots remain sealed from generic layout.
