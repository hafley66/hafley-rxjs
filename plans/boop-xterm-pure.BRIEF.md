# boop-xterm-pure (wave 1a, sol6)

Goal: create package `packages/boop-xterm` (`@hafley66/boop-xterm`) holding the pure layer-0 files lifted from instant.
Plan: `plans/boop-xterm-lift.PLAN.md`. Read it. Read `AGENTS.md` and `~/projects/claude-research/skills/rxjs/SKILL.md`.

## Files you own
`packages/boop-xterm/**`, `pnpm-lock.yaml`. Nothing else in hafley-rxjs. Read-only: `~/projects/instant/**`.

## Scaffold
Copy the shape of `packages/md`: package.json (name `@hafley66/boop-xterm`, version `0.0.1`, same scripts,
`files`, `exports`, `prepack`), tsconfig.json, vite.config.ts, vitest.config.ts. Peer dep `@xterm/xterm` at the
version in `~/projects/instant/package.json`. Relative imports carry `.js` (see 0_RELEASING.md).
`pnpm release:check` must pass for the new package.

## Lift (copy source from instant; do not edit instant)
| new file | from ~/projects/instant/src |
| --- | --- |
| src/0_types.ts | `BoopTurn`, `VisibleTurn` (0_terminalTurnVisibility.ts), `LogicalLine` (00a_terminalIntersection.ts), `HarnessId` (harnessTypes.ts). Copy the type bodies verbatim, field names and casing unchanged. Types only. |
| src/0_termTokens.ts | termTokens.ts |
| src/0_termCell.ts | 0_termCell.ts |
| src/1_termWrapJoin.ts | termWrapJoin.ts |
| src/2_termBufferToken.ts | termBufferToken.ts |
| src/0_turnRegions.ts | 00_terminalTurnRegions.ts |
| src/0_fontGeometry.ts | 0_terminalFonts.ts |
| src/1_rowGeometry.ts | 0_terminalRowGeometry.ts |
| src/1_turnMatching.ts | 0a_terminalTurnMatching.ts |
| src/1_ompTurnBinding.ts | 0b_ompTurnBinding.ts |
| src/index.ts | re-exports every public symbol above |

Each instant `*.test.ts` beside a listed source moves to the matching `src/<new name>.test.ts`.
Function bodies stay byte-identical except import specifiers. Record the `it(`/`test(` count per test file
in instant and in the package; they must be equal.

## Gates (all in the receipt, with the command output line)
1. `pnpm --filter @hafley66/boop-xterm typecheck`
2. `pnpm --filter @hafley66/boop-xterm test`
3. `pnpm --filter @hafley66/boop-xterm build`
4. `rg -n '\.subscribe\(|firstValueFrom|lastValueFrom|as any|@ts-ignore|@ts-expect-error|\.skip\(|\.only\(|toBeDefined' packages/boop-xterm/src` prints nothing.
5. test-count table: instant file | count | package file | count.

## Stop on
A listed file importing something outside this list, a test that fails in instant too, or any need to edit outside owned paths. Report and stop.

## Commits
Scoped. First: `feat(boop-xterm): package scaffold`. Then one commit per lifted file group.
Receipt: status / sha / files / validation / next.
