# boop-xterm-wave3-design (read-only design, sol6)

Goal: write ONE file `plans/boop-xterm-wave3.DESIGN.md` and commit it. Edit nothing else.

Read first, whole files:
- `plans/boop-xterm-lift.PLAN.md`
- `plans/boop-xterm-wave2.DESIGN.md`, including section 9. Its rulings bind wave 3.
- `plans/boop-xterm-lift-map.REPORT.md`, Tables B, C, D, E.
- `AGENTS.md`
- `~/projects/claude-research/skills/rxjs/SKILL.md`
- `~/projects/claude-research/skills/signals/SKILL.md`
- `packages/boop-xterm/src/*.ts`, as merged on main: `3_ports`, `4_*`, `5_*`, `6_turnVisibility`, `7_pane`.

## Subject (read only, in ~/projects/instant/src at main a3e9a6e0)

| wave-3 file (instant) | lines | `.subscribe(` |
| --- | --- | --- |
| 0_terminalDiagrams.ts | 871 | 3 |
| 1_terminalStructuredOverlay.ts | 119 | 1 |
| 0_turnDebugOverlay.ts | 269 | 1 |
| 1a2_terminalContextGutter.ts | 227 | 2 |
| 1a_terminalContextQueue.ts | 332 | 0 |
| 1b_terminalContextSync.ts | 273 | 0 |
| 1c_terminalHoverCheck.ts | 127 | 0 |
| 1d_terminalTurnMarks.ts | 166 | 2 |
| 1e_terminalForkMarks.ts | 59 | 0 |
| 1f_terminalForkRender.ts | 299 | 1 |
| 0_agentSquareVisual.ts | 158 | 0 |
| 1_agentSquaresMarks.ts | 30 | 0 |
| 1_agentSquaresModel.ts | 196 | 0 |
| 1_agentSquaresFeed.ts | 133 | 0 |
| 1_agentSquares.ts | 552 | 2 |
| 1_turnPanel.ts | 418 | 0 |
| graphics.ts | 95 | 0 |

Also read every call site in instant that constructs or calls these files, `terminal.ts` included.

## Law the design must satisfy
- **State and data** use `@hafley66/signals`:
  - `Signal(value)`, `Signal(source$, init)`, `Signal(() => derived)`, `signalMap`, `Signal<Event>()`.
  - Requests use `Endpoint`, `createQuery`, `createMutation`.
  - New ports extend `BoopXtermPorts` in `3_ports.ts` and follow its style. Use an `Endpoint` for a Tauri command and a `SignalSource`/`Signal` for host state.
  - Field names and casing copy the Rust/IPC names.
- **Subscriptions:** zero `.subscribe(` in package src (non-test). Each model returns an `effects: Observable<void>`. The host merges these into the pane's `effects`, the way `7_pane.ts` does.
  - Classes that subscribe in their constructor become functions.
  - The `this.subscription` fields in the 4 files above that still carry them go away: `0_turnDebugOverlay.ts`, `1_terminalStructuredOverlay.ts`, `1a2_terminalContextGutter.ts`, `1d_terminalTurnMarks.ts`.
- **No callbacks:** no function-typed callback parameters in public signatures. Every callback becomes an input signal or stream, an output `Signal<Event>`, or an `Endpoint`. List every one.
- **DOM:**
  - DOM elements are acquired and released inside a `new Observable` teardown, or through `finalize`.
  - Native listener callbacks live only inside `new Observable`.
  - Teardown is named `unsubscribe`.
- **No flags:** no boolean or generation flags for timing. Use operators (see wave-2 section 9, rulings 1-3).
- **Theming (user requirement: boop-xterm must be themeable):**
  - Every color, font, size and z-index the overlays paint comes from a CSS custom property named `--boop-xterm-<part>-<prop>`. The package ships a default for each in one `theme.css`.
  - Canvas and SVG paints read the resolved custom property. List each hard-coded value by file:line and give its property name.
  - xterm's own `ITheme` stays the consumer's to set.
- **Packaging:**
  - Name the package's `package.json` `exports` entries.
  - Pure functions stay pure and move unchanged.
- **What stays in instant:** name every piece of instant-only behaviour that stays behind, with a reason. Examples: favorites, tablepanels, BoopConversation (wave-2 ruling 7).

## Split
Group the files into at most 3 implementation lanes, 3a/3b/3c. Each lane must be under about 1500 source lines, own a disjoint set of files, and follow dependency order. Diagrams depend on `@hafley66/md`, so say which lane takes them.

## Document shape (in this order; tables and code fences, no prose paragraphs)
1. Type signatures: every exported symbol, current signature | proposed signature. Full TS, no ellipses.
2. Additions to `BoopXtermPorts`, each tied to the Rust command signature (file:line in `~/projects/instant/src-tauri/src`).
3. Pseudo-code bodies (comments only) for each reactive function: operators in order, plus where signals and queries sit.
4. Instance timelines per current class, then per proposed model: what starts it, what ends it. A marble diagram per stream.
5. Storage and sequence: every mutable field goes to a signal path, a `scan`, or is deleted. Give read/write order and uniqueness conditions.
6. Callback ledger: callback | file:line | replacement | direction.
7. Theme token table: token | default | file:line of the current hard-coded value.
8. Host composition: how `terminal.ts` wires the new models into `createBoopXtermPane` or next to it.
9. Lane split table: lane | files | lines | depends on.
10. Test plan: per model, case | input | expected | why it exists. Use a real xterm in vitest browser (`test/1_realTerminal.ts`); no doubles of xterm or the DOM.
11. Open questions, with file:line each.

## Stop on
Anything requiring a write outside the design file.

## Validation
`test -s plans/boop-xterm-wave3.DESIGN.md && git log -1 --format=%s`

## Commit
Subject exactly: `plans: boop-xterm wave 3 design`
Receipt: status / sha / files / validation / next.
