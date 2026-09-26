# md-lift-instant (wave 1b, sol6)

Goal: move 4 instant modules into `packages/md` and export them.
Plan: `plans/boop-xterm-lift.PLAN.md`. Source row: `plans/md-main-inventory.REPORT.md` Table C.
Read `AGENTS.md` and `~/projects/claude-research/skills/rxjs/SKILL.md`.

## Files you own
`packages/md/src/**` new files listed below, `packages/md/src/index.ts`, `packages/md/package.json` (exports only),
`packages/md/README.md` (one API line each). Read-only: `~/projects/instant/**`.

## Lift
| new file | from ~/projects/instant/src | note |
| --- | --- | --- |
| src/lib/0_markdownTree.ts | 0_markdownTree.ts | uses md's own `parseMdSections`; import it relatively |
| src/lib/0_svgViewport.ts | 0_svgViewport.ts | instant re-exports md viewport helpers here; merge into md's existing viewport module if one exists, else new file. Report which. |
| src/lib/0_diagramRenderCache.ts | 0_diagramRenderCache.ts | |
| src/lib/1_d2Preview.ts | 0_d2Preview.ts | |

Each beside-test moves too (`0_markdownTree` has none: write one snapshot test over a fixture with 3 heading levels).
Function bodies byte-identical except import specifiers. If a module takes a function-typed callback parameter,
keep it as-is this wave and list it in the receipt under `callbacks:` (file:line). Do not redesign.

## Gates (receipt carries each output line)
1. `pnpm --filter @hafley66/md typecheck`
2. `pnpm --filter @hafley66/md test`
3. `pnpm --filter @hafley66/md build`
4. `rg -n '\.subscribe\(|firstValueFrom|lastValueFrom|as any|@ts-ignore|@ts-expect-error|\.skip\(|\.only\(|toBeDefined' <the new files>` prints nothing.
5. test-count table: instant file | count | md file | count.

## Stop on
Name collision with an existing md export, any edit outside owned paths, a failing pre-existing md test. Report and stop.

## Commits
One per module: `feat(md): lift <name> from instant`.
Receipt: status / sha / files / validation / next.
