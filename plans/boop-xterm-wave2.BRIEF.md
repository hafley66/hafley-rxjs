# boop-xterm-wave2 (sol6): layer-1 models on signals endpoints

Implement `plans/boop-xterm-wave2.DESIGN.md` in `packages/boop-xterm`. Section 9 (coordinator rulings) overrides
anything above it. Read also `~/projects/claude-research/skills/signals/SKILL.md`, `~/projects/claude-research/skills/rxjs/SKILL.md`, `AGENTS.md`.

## Files you own
`packages/boop-xterm/**`, `pnpm-lock.yaml`. Read only: `~/projects/instant/**`, `packages/signals/**`, `packages/xdom/**`.
Stop and report if `@hafley66/signals` lacks something the design needs; do not edit signals.

## New files (numeric order = dependency order)
| file | from instant | shape |
| --- | --- | --- |
| src/1_ompTurnBinding.ts (+test) | 0b_ompTurnBinding.ts | pure, byte-identical body |
| src/2_turnLocate.ts (+test) | pure functions of 0_terminalTurnVisibility.ts (selectProjectionTurns, tmuxConfirms, dropTmuxStatusRow, terminalInputRegion, dropTerminalInputRows, locateVisibleTurns, extendTo, attachTurnRegions) | pure, byte-identical bodies; move their existing tests |
| src/2_pinnedSelectionPure.ts (+test) | pure functions of 0_terminalPinnedSelection.ts | pure, byte-identical |
| src/2_wheelReduce.ts (+test) | reduceTerminalWheel + types from 0_terminalWheel.ts | pure, byte-identical |
| src/3_ports.ts | — | `BoopXtermPorts`, `PaneIdentity`, `PaneRuntimeState` per design §1 as amended by §9 |
| src/4_viewport.ts | XtermViewportAdapter | `viewportStream` |
| src/4_paneSession.ts | NativeTmuxPane | `paneSessionStream` (createQuery) |
| src/5_lineAnchors.ts | TerminalLineAnchors | `lineAnchorsStream` |
| src/5_wheel.ts | TerminalWheelRouter | `wheelStream` |
| src/5_pinnedSelection.ts | TerminalPinnedSelection | `pinnedSelectionStream` |
| src/6_turnVisibility.ts | TerminalTurnVisibilityV2 | `turnVisibilityStream`, pure `turnAtPoint`, `regionAtPoint` |
| src/7_pane.ts | — | `createBoopXtermPane` composing the above; one `effects` |

Every design §7 test case becomes a test: rxjs `TestScheduler` marble tests for streams, with a test
`EndpointTransport` (serializable request -> scripted response observable). Browser tests (vitest browser, real
`@xterm/xterm` Terminal) for viewport, wheel, pinned selection DOM behavior. No `vi.mock` of package code.

## Gates (receipt carries each output line)
1. `pnpm --filter @hafley66/boop-xterm typecheck`, `test`, `build` pass. Browser tests: `vitest --config vitest.browser.config.ts run` (add the config, copy md's).
2. `rg -n '\.subscribe\(|firstValueFrom|lastValueFrom|new (Behavior|Replay)?Subject|as any|@ts-ignore|@ts-expect-error|\.skip\(|\.only\(|toBeDefined|vi\.mock' packages/boop-xterm/src -g '!*.test.*'` prints nothing; the same without the test exclusion prints no `.skip(`/`.only(`/`toBeDefined`/`vi.mock`.
3. Function-typed params in exported signatures: `rg -n 'export function' packages/boop-xterm/src` table in receipt; any param typed `(...) => ...` must be pure-helper input only (none expected).
4. Pure moves: `diff` of each pure body vs instant source ignoring import lines prints nothing; test counts equal.
5. Design §7 table: case | test name | file:line. Every row present.

## Stop on
A design case that cannot be expressed without a Subject or `.subscribe`, a missing signals capability, or a design
contradiction. Report file:line + the design row. Do not improvise around it.

## Commits
One per new file group in the order of the table. First subject exactly: `feat(boop-xterm): pure layer-1 helpers`. Last: `feat(boop-xterm): createBoopXtermPane`.
Receipt: status / sha / files / validation / next.
