# boop-xterm wave 3a: diagrams, graphics, square pure models (sol6)

**Goal:** implement lane 3a from design section 9 in `packages/boop-xterm`, plus the `@hafley66/md` rendering move from section 12, ruling 2.

**Owned sources to port** (instant `~/projects/instant/src` at main): `0_terminalDiagrams.ts`, `graphics.ts`, `0_agentSquareVisual.ts`, `1_agentSquaresMarks.ts`, `1_agentSquaresModel.ts`, `1_agentSquaresFeed.ts`. The last two are pure and wire types only; the watcher lifecycle belongs to 3c.

**Owned package files:**
- new boop-xterm src files for the sources above
- `packages/boop-xterm/src/theme.css` (diagram, graphics and squares tokens)
- `packages/boop-xterm/package.json` (exports, peer dependencies)
- `packages/md/src/lib/*` for the Mermaid loader and `renderDiagram$`, plus md's index exports
- the `3_ports.ts` fields `inlineDiagrams` and `diagramInference`

**Models:** `diagramOverlayStream` and `graphicsOverlayStream`.

**Instant tests to port:** `0_terminalDiagrams.test.ts` (38), `1_agentSquaresModel.test.ts` (14), `1_agentSquaresFeed.test.ts` (1).

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
Scoped commits as you go. Final subject exactly: `feat(boop-xterm): wave 3a diagrams, graphics, square models`
