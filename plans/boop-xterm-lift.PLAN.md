# boop-xterm lift plan

Source maps: `plans/boop-xterm-lift-map.REPORT.md`, `plans/md-main-inventory.REPORT.md`.

## User rulings (2026-09-25)
- boop-xterm reaches boop only through a port record of Observables. Zero transport code in the package.
- `.subscribe(` count: 0 in `packages/boop-xterm` and `packages/md` (non-test). 1 in all of instant (`src/main.ts`).
  Baseline instant non-test: 74 in 34 files.
- instant rewires its imports and deletes each lifted original in the same wave.

## User ruling (2026-09-26)
- instant is stripped down to a composition of libraries as far as possible. Every feature lives in a package; instant keeps wiring, settings and app chrome.
- The group-chat panel (`instant/src/0_boopSelection.ts`, `1_boopSelection.tsx`) becomes a sub-feature of boop's messaging layer. Its closest homes are the Rust crate `hafley-rs/crates/boop-acp` (lane channels: acp, acpx, claude, terminal) plus `boop/src/cli/shout.rs`, and a TS package on the boop-xterm pattern that reads selection and sends shouts through Endpoints instead of shelling out.

## Waves (max 2 build-heavy lanes at once)

| wave | repo | lane | files |
| --- | --- | --- | --- |
| 1a | hafley-rxjs | feature/boop-xterm-pure | scaffold + Table C layer 0: termTokens, termCell, termBufferToken, termWrapJoin, turnRegions, turnMatching(+ompTurnBinding), rowGeometry, fontGeometry, 0_types |
| 1b | hafley-rxjs | feature/md-lift-instant | instant 0_markdownTree, 0_d2Preview, 0_diagramRenderCache, 0_svgViewport -> packages/md |
| 1c | instant | refactor/lift-wave-1 | rewire importers of 1a+1b to the packages, delete originals |
| 2 | hafley-rxjs, instant | layer 1 | viewport, lineAnchors, turnVisibility, wheel, pinnedSelection + first ports |
| 3 | hafley-rxjs, instant | layer 2 | overlays, context queue/sync/gutter, marks, fork render, agent squares, turnPanel, diagrams |
| 4 | hafley-rxjs, instant | layer 3 | terminal.ts -> 3_terminalView; instant main.ts holds the single subscribe |
| 5 | instant | refactor/one-subscribe | remaining non-closure subscribe sites (chrome, cdp, preview, stfuButton, ...) -> 1 |
| open | hafley-rxjs | wip/md-table-fit e54ee262 | WIP "item 6, handed off": needs the user's read before a lane finishes it |

## Anti-shortcut gates (every lane)
- `.subscribe(` count, plus `firstValueFrom|lastValueFrom|\.forEach\(` on streams, in non-test package src = 0.
- Port and public signatures take and return Observables; a function-typed callback parameter is a defect.
- Every moved test file moves with `git mv`; `it(`/`test(` count per moved file is equal before and after.
- No `as any`, `as unknown as`, `as never`, `@ts-ignore`, `@ts-expect-error`, `.skip`, `.only` added. No hand-built doubles of third-party classes (xterm Terminal etc.); use the real class in vitest browser.
- No `toBeDefined`. Snapshot assertions preferred.
