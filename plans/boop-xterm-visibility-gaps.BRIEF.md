# boop-xterm-visibility-gaps (tests only, sol6)

**Goal:** add browser tests to `packages/boop-xterm/src/6_turnVisibility.browser.test.ts` for three behaviours whose tests were deleted from instant in wave 2.

**Files:** only `packages/boop-xterm/src/6_turnVisibility.browser.test.ts`. Also `packages/boop-xterm/test/*` if a shared helper needs a new field.

## Cases
The source for each case is `git -C ~/projects/instant show a3f6729a:src/0_terminalTurnVisibility.test.ts`. Port its intent onto `createTurnVisibility` / `createBoopXtermPane` as they exist now.

| case | old test title |
| --- | --- |
| hidden pane: no scan while `paneVisible` is false; one scan after it turns true | "skips every scan while the viewport reports hidden, and scans again once it shows" |
| continuous output: capture polling keeps running while writes arrive faster than the write debounce | "polls through continuous output even when the write debounce never settles" |
| role change: the visible-turns output emits when a span keeps its id but changes role while the pointer row is unchanged | "emits when the same span identity changes role while the pointer row stays fixed" |

## Rules
- Use a real xterm via `test/1_realTerminal.ts` and the scripted transport in `test/0_endpointTransport.ts`. Do not build doubles of Terminal or the DOM.
- Use deterministic time: fake timers or TestScheduler, matching the file's existing cases.
- Prefer `toMatchInlineSnapshot`. Do not use `toBeDefined`.
- Do not add `.skip`, `.only`, `as any`, `as unknown as`, `as never`, or `@ts-*` comments.
- Do not change any file under `src/` other than the test file.
- **Product bug:** if a case fails because the package behaves wrongly, stop and report the failing case and output. Do not change product code.

## Validation
```
cd packages/boop-xterm && pnpm typecheck && pnpm exec vitest run -c vitest.browser.config.ts
```
All files must pass, with 3 new tests.

## Commit
Subject exactly: `test(boop-xterm): cover hidden, continuous-output, role-change visibility`
Receipt: status / sha / files / validation / next.
