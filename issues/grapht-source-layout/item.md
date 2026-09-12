---
created: 2026-08-25
updated: 2026-08-25
type: chore
assignee: luna-xhigh
status: open
priority: high
epic: grapht-renderer-platform
labels:
- model:luna-xhigh
- size:small
size: S
lane: source-layout
collision: [packages-grapht, package-grapht-exports]
---

# Categorize Grapht source and tests

## Description

## Goal

Replace the flat 38-file implementation directory with four dependency-ordered source categories while preserving public exports and behavior. Leave only src/index.ts and src/browser.ts at the source root. Mirror source categories in tests.

## Target source map

- src/0_bench/: 0_protocol, 1_geometryProtocol, 2_fixtures, 3_hash, 4_process, 5_bench, 6_record, 7_identity, 8_cli, 9_fixturesCli, 10_rendererFixture, 11_scenarios, 12_shake, 13_visualValidity.
- src/1_sequence/: 0_identity, 1_svgBinding, 2_artifact, 3_geometry, 4_focus, 5_collapse, 6_placement.
- src/2_graph/: 0_frame, 1_fitCamera, 2_geometryScope, 3_sealedSvgArtifact, 4_svgGeometry, 5_translateGeometry, 6_stackGroupHeaders, 7_operatorTypes, 8_filesystemGraph, 9_operators, 10_renderer, 11_cytoscape-fcose.d.ts, 12_layout.
- src/3_contracts/: 0_graphology, 1_rendererCapabilities, 2_rendererRuntime, 3_visualPort.
- src/index.ts: public package barrel only.
- src/browser.ts: browser subpath barrel only.

## Test map

- tests/0_bench mirrors bench tests.
- tests/1_sequence mirrors sequence tests.
- tests/2_graph mirrors graph tests.
- tests/3_integration contains shell pipeline, lane parity, package gate, and graph pipeline tests whose scope crosses source categories.

## Constraints

- Mechanical moves and import rewrites only. No API, type, behavior, vocabulary, or formatting redesign.
- Preserve @hafley66/grapht and @hafley66/grapht/browser exports. Update package browser export to dist/browser.js and dist/browser.d.ts.
- Update adapters, tests, configs, scripts, and aliases that use direct source paths.
- Keep author-driven numbering inside every category.
- Do not edit the existing dirty renderer and golden-app implementation files except import path rewrites required by moves.
- Use git mv. Commit source moves, test moves, and reference/config updates as separate checkpoints.

## Definition of Done

- [ ] src root contains exactly index.ts, browser.ts, and the four numbered directories.
- [ ] Every implementation and test file belongs to one named category.
- [ ] rg finds zero imports of removed flat source paths.
- [ ] Package build, typecheck, tests, issuectl doctor, and git diff --check pass.
- [ ] Public export names and package subpath names are unchanged.
