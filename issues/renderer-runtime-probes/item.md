---
created: 2026-08-25
updated: 2026-08-25
type: task
assignee: luna-xhigh
status: open
priority: normal
epic: grapht-renderer-platform
labels:
- model:luna-xhigh
- size:small
- lane:golden
blocked_by: ['@cytoscape-frame-lowering', '@pixi-frame-lowering', '@renderer-event-signals']
size: S
lane: golden
collision: [packages-grapht-golden]
---

# Add renderer runtime probes

## Description

## Definition of Done

- [ ] Probe listener count, terminal subscriptions, geometry recomputes, visual creation, and frame duration.
- [ ] Hover causes zero geometry recomputes.
- [ ] Viewport pan creates zero canonical visuals.
- [ ] Renderer switch unsubscribes the prior resource once.
