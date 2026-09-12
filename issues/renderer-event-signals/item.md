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
- lane:runtime
blocked_by: ['@native-event-wrappers', '@interaction-state-reducer', '@grapht-source-layout']
size: M
lane: runtime
collision: [packages-grapht]
---

# Implement renderer event and interaction signals

## Description

## Definition of Done

- [ ] Cytoscape and Pixi native events lower into one typed interaction union.
- [ ] Interaction state is reduced through RxJS or repository signals.
- [ ] Intermediate subscriptions contain no side effects.
- [ ] Renderer switching unsubscribes the prior native event source.
- [ ] Stream topology uses `scan`, `switchScan`, `switchMap`, or bounded `mergeMap` according to lifetime and concurrency.
- [ ] Graph logic contains zero `tap` effect channels and zero public `void` returns.
