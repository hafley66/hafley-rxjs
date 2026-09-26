# boop-xterm wave 3b: context queue, sync, gutter, hover, marks, forks (sol6)

**Goal:** implement lane 3b from design section 9 in `packages/boop-xterm`.

**Owned sources to port** (instant `~/projects/instant/src` at main): `1a_terminalContextQueue.ts`, `1b_terminalContextSync.ts`, `1a2_terminalContextGutter.ts`, `1c_terminalHoverCheck.ts`, `1d_terminalTurnMarks.ts`, `1e_terminalForkMarks.ts`, `1f_terminalForkRender.ts`. Also `promptQuote.ts:12-18` `bracketedPaste` (section 12, ruling 1).

**Owned package files:**
- new boop-xterm src files for the sources above
- the 3b tokens in `theme.css`: context, gutter, marks and fork. If 3a also created `theme.css`, the planner merges them.
- the `3_ports.ts` fields for comments/annotations/forks/upsert/delete/sent, `boop_mux_exit_copy_mode`, `write_pty`, `inlineStructuredSelectors`, `forkLivePane`, `tabName` and `sessionIds`
- `PaneIdentity.graphics` (section 12, ruling 1)
- the Rust IPC names and casing from design section 2, copied exactly

**Models:** `contextQueueStream`, `contextGutterStream`, `contextSyncStream`, `hoverCheckStream`, `turnMarksStream` and `forkRenderStream`. `menuRequested` and `selectionWritten` are Signal events. Instant's fork menu and `runFork` stay in instant.

**Instant tests to port:** `1a_terminalContextQueue.test.ts` and `.dom.test.ts` (8), `1b_terminalContextSync.test.ts` (13), `1a2_terminalContextGutter.test.ts` (5), `1c_terminalHoverCheck.test.ts` (5), `1d_terminalTurnMarks.test.ts` (4), `1e_terminalForkMarks.test.ts` (5), `1f_terminalForkRender.test.ts` (25).

## Read first, whole files
- `plans/boop-xterm-wave3.DESIGN.md`. Section 12 overrides sections 1-11.
- `plans/boop-xterm-wave2.DESIGN.md` section 9
- `plans/boop-xterm-lift.PLAN.md` anti-shortcut gates
- `AGENTS.md`
- `~/projects/claude-research/skills/rxjs/SKILL.md`
- `~/projects/claude-research/skills/signals/SKILL.md`
- `packages/boop-xterm/src/3_ports.ts`, `6_turnVisibility.ts`, `7_pane.ts`, and `test/*`

## Setup
`pnpm --filter "@hafley66/boop-xterm^..." build` before any test. Tests import built `@hafley66/signals`. Do not alias source paths.

## Law
- **Subscriptions:** zero `.subscribe(`, `firstValueFrom`, `lastValueFrom` in non-test package src. Each model returns `effects: Observable<void>`.
- **Callbacks:** no function-typed parameters in public signatures. Native listener callbacks live only inside `new Observable`, and teardown is named `unsubscribe`.
- **No flags:** no boolean or generation flags for timing. State is a Signal path, a `scan`, or closure state inside one `defer`.
- **Theme:** every color, font, size and z-index you paint reads a `--boop-xterm-*` token from design section 7. Add those tokens with concrete defaults to `packages/boop-xterm/src/theme.css` (create it if absent) and export it as `"./theme.css"`.
- **Tests:** browser tests use a real xterm via `test/1_realTerminal.ts` and real DOM. Endpoints are scripted through `test/0_endpointTransport.ts`. No doubles of Terminal, the DOM or ResizeObserver. No `vi.mock` of package code.
- **Assertions:** prefer inline snapshots; never `toBeDefined`.
- **Forbidden:** `as any`, `as unknown as`, `as never`, `@ts-*` comments, `.skip`, `.only`.
- **Test parity:** for every instant test file of an owned source, each `it(`/`test(` title is ported, or listed in the receipt with a reason.
- **Scope:** do not edit instant, `7_pane.ts`, or files owned by the other lane. Do not publish.

## Stop on
- A needed edit outside owned files.
- A design contradiction.
- A product behaviour that cannot be kept.

Report with file:line.

## Validation
`cd packages/boop-xterm && pnpm typecheck && pnpm test && pnpm exec vitest run -c vitest.browser.config.ts && pnpm build`
Plus: `rg -c "\.subscribe\(" packages/boop-xterm/src -g "!*.test.ts" -g "!test/**"` prints nothing. Delete `src/__screenshots__` before committing.

Receipt: status / sha / files / validation / test parity table (instant file | titles | ported | missing+reason) / next.

## Commit
Scoped commits as you go. Final subject exactly: `feat(boop-xterm): wave 3b context queue, sync, gutter, marks, forks`
