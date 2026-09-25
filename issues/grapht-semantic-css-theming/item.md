---
created: 2026-09-24
updated: 2026-09-24
type: feature
reporter: owner
status: untriaged
priority: normal
provenance: other
provenance_detail: claude session 8869876b
source_ref: claude:8869876b/grapht-theming
---

# grapht: common styling and theming through semantic CSS custom properties

## Description

One shared stylesheet for grapht renderers (board, cytoscape, sequence, marbles). Every color, stroke, font, spacing and state (hover/selected/active/dim) is a semantic custom property (--grapht-node-bg, --grapht-edge-stroke, --grapht-focus, ...), light-dark() aware, overridable by any ancestor. Renderer JS sets data attributes/classes only; it never computes colors. Consumers theme by setting variables, not by passing JS theme objects.
