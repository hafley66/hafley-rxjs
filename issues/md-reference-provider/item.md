---
created: 2026-09-24
updated: 2026-09-24
type: feature
reporter: owner
status: untriaged
priority: normal
provenance: other
provenance_detail: claude session 8869876b
source_ref: claude:8869876b/md-reference-provider
---

# md: generic batched reference provider (signal in, resolutions out), decoupled from instant/boop

## Description

Rendered markdown finds reference-looking spans (paths, file:line, symbols, turn ids like #202/S145) and asks a host-supplied resolver in batches. md defines the contract only; instant/boop implement it. Plan: plans/2026-09-24-md-references-and-plugins.md
