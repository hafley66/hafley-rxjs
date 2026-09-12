---
created: 2026-08-25
updated: 2026-08-25
type: task
assignee: luna-xhigh
status: open
priority: high
epic: grapht-renderer-platform
labels:
- model:luna-xhigh
- size:small
- lane:runtime
blocked_by: ['@interaction-vocabulary', '@renderer-runtime-contract']
size: S
lane: runtime
collision: [packages-grapht]
---

# Wrap native renderer events as signals

## Description

## Definition of Done

- [ ] Cytoscape uses fromEventPattern.
- [ ] Pixi federated events expose the same event union.
- [ ] DOM uses fromEvent.
- [ ] Listener attach and detach counts match.
- [ ] Wrappers return Observables or Signals and contain no internal terminal subscriptions.
- [ ] Normalized values use `kind` discriminants without separate event/effect runtime categories.
