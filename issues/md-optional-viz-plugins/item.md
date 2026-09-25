---
created: 2026-09-24
updated: 2026-09-24
type: feature
reporter: owner
status: untriaged
priority: normal
provenance: other
provenance_detail: claude session 8869876b
source_ref: claude:8869876b/md-plugins
---

# md: optional peer-dep plugins for marbles, scrollycoding, shiki, mdx, state-machine animation

## Description

@hafley66/md exports plugins, each behind an optional peer dependency and loaded lazily only when a fence/component needs it: marble diagrams (@hafley66/marbler / signal-marbles fences), scrollycoding / code-over-time (Code Hike), a fence of git diff patches rendered as a code block evolving step by step, shiki highlighting, MDX components, state-machine visualization + animation. Missing peer = fence renders as plain code. Plan: plans/2026-09-24-md-references-and-plugins.md
