---
created: 2026-08-25
updated: 2026-08-25
type: epic
owner: codex
status: open
priority: high
labels: [grapht, graphology, rxjs]
---

# Graph topology and renderer signal platform

## Description

## Goal

Implement the accepted plan in packages/grapht/5_renderer_signal_integration_plan.md using Graphology for topology and Grapht traits for hierarchy, visuals, ports, geometry, sticky behavior, and renderer lowering.

## Execution graph

| Phase | Issue | Assignment | Size |
| --- | --- | --- | --- |
| 0 | @graphology-contract | Sol high | L |
| 0 | @visual-port-contract | Sol high | L |
| 0 | @renderer-runtime-contract | Sol high | L |
| 0 | @renderer-capabilities | Sol high | L |
| 1 | @interaction-vocabulary | Luna xhigh | S |
| 1 | @graphology-adapter | Terra high | M |
| 2 | @graphology-roundtrip-fixtures | Luna xhigh | S |
| 2 | @native-event-wrappers | Luna xhigh | S |
| 2 | @interaction-state-reducer | Luna xhigh | S |
| 2 | @resolved-visual-frame | Terra high | M |
| 3 | @renderer-event-signals | Terra high | M |
| 3 | @port-attachment-snapshots | Luna xhigh | S |
| 4 | @cytoscape-frame-lowering | Terra high | M |
| 5 | @cytoscape-translate-browser | Luna xhigh | S |
| 6 | @pixi-frame-lowering | Terra high | M |
| 7 | @pixi-translate-browser | Luna xhigh | S |
| 7 | @renderer-runtime-probes | Luna xhigh | S |
| 8 | @renderer-golden-app | Terra high | M |

## Definition of Done

- [ ] Research contracts are reviewed before implementation cards start.
- [ ] Cytoscape, Sigma, and Pixi consume the same canonical graph and visual frame.
- [ ] Runtime state follows RxJS and signal conventions with unsubscribe as the lifecycle verb.
- [ ] Golden tests cover movement, attachment, sticky labels, renderer switching, and runtime probes.
