# boop-xterm-lift-map (read-only inventory, sol6)

Goal: write ONE file, `plans/boop-xterm-lift-map.REPORT.md`, and commit it in this lane. Edit nothing else.

## Context
~/projects/instant (TS + Tauri app) holds an xterm.js-based terminal UI (turn regions, overlays, fork marks,
context gutter, pinned selection, wheel, hover, row geometry, etc.; see instant/src/*terminal*, *turn*, *fork*, termCell, termTokens).
Target: lift that UI whole into hafley-rxjs as a new package `packages/boop-xterm`, a cousin of the Rust crates
boop-harness and boop-mux in ~/projects/hafley-rs/crates. This lane only MAPS the lift. It moves nothing.

## Inspect (read only in ~/projects/instant and ~/projects/hafley-rs; never write there)
1. Every file in instant/src and instant/packages that imports `@xterm/*` or `xterm`, plus the transitive
   closure of instant-local modules they import. Build the import graph with a tool
   (`npx madge --json` or `npx dependency-cruiser`), do not eyeball it.
2. For each file in the closure: its imports that are instant-only (Tauri `@tauri-apps/*`, instant state.ts/core.ts/main.ts,
   IPC, DOM chrome) versus pure (xterm, rxjs, @hafley66/*).
3. Tests beside those files (*.test.ts, *.dom.test.ts) and e2e specs in instant/e2e* that exercise them.
4. Boundary with boop: which files read boop data (turns, forks, lanes, agents) and through what transport
   (Tauri invoke, HTTP, websocket, file). Name the Rust side endpoint (file:line in instant/src-tauri or hafley-rs).
5. hafley-rxjs conventions a new package must follow: read packages/md/package.json, tsconfig, vite.config.ts,
   vitest configs, and AGENTS.md (subscribe law, `unsubscribe` naming, numeric file prefixes).

## Report shape (tables, no prose paragraphs)
Table A: instant file | lines (wc -l) | xterm-direct? | instant-only imports | pure imports | test files
Table B: instant-only seam | files using it | what the seam carries (types/calls)
Table C: proposed boop-xterm file (numeric-prefixed, dependency order) | source instant file(s)
Table D: `.subscribe(` call sites in the closure | file:line (these violate the library law once lifted)
Table E: instant call sites that would import @hafley66/boop-xterm after the lift | file:line
Section F: exact commands you ran for the graph, and their output line counts.

## Stop on
Anything requiring a write outside the report.

## Validation
`test -s plans/boop-xterm-lift-map.REPORT.md && git log -1 --format=%s`

## Commit
Subject exactly: `docs(tasks): boop-xterm lift map report`
Receipt to parent: status / sha / files / validation / next.
