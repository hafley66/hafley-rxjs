---
created: 2026-09-25
updated: 2026-09-25
type: feature
status: open
priority: normal
---

# md plugin: filesystem viewer for ls/tree-style code fences (imaginary trees, code-hike steps)

## Description

Owner 2026-09-25: a bespoke fence slot like marbles. A fence of ls / tree output (e.g. ```tree or ```ls, or plain text that parses as a tree) renders as an interactive file tree: expand/collapse, icons by extension, the tree need not exist on disk (imaginary filesystems in docs/plans). Code-hike style: a fence of successive tree states animates between them (files appear/move/disappear), same step model as the planned `steps` fence (shiki-magic-move + jsdiff).

Fits the plugin registry (packages/md/src/plugins, 035fcf75): `fsTreePlugin()` claims its fence languages; lazy-loaded renderer; colours/geometry via CSS custom properties. Candidate renderer: signal-grid tree or @hafley66/grid GridTree; parse `tree`, `ls -R`, `find`, and indented path lists.
