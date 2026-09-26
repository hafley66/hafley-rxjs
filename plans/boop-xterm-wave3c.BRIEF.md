# boop-xterm wave 3c: squares stream, turn panel, structured and debug overlays, view composition (sol6)

**Goal:** implement lane 3c from design section 9 in `packages/boop-xterm`, and compose every wave 3 model into `9_view.ts`.

## Step 0: renumber
Lanes 3a and 3b collided on model letters. Rename with `extract move`, which repairs specifiers:
- `8a_diagramOverlay.ts` becomes `8g_diagramOverlay.ts`
- `8b_graphicsOverlay.ts` becomes `8h_graphicsOverlay.ts`

Rename their test files to match. Commit this step alone.

## Owned sources to port
From instant `~/projects/instant/src` at main:
- `1_agentSquares.ts` (552 lines): `agentSquaresStream`, with the signature in design section 12, ruling 5
- `1_turnPanel.ts` (418 lines): `turnPanelStream`. Its peer dependencies follow section 12, ruling 9.
- `1_terminalStructuredOverlay.ts` (119 lines): `structuredOverlayStream`
- `0_turnDebugOverlay.ts` (269 lines): `turnDebugOverlayStream`. `turnHue` is already in `0_turnHue.ts`; import it.

**Ports you add:** `squares_watch`, `squares_unwatch`, `"squares-update"`, `turnDebugEnabled`, `agentSquaresEnabled`, `squaresOptions`, `favoriteSources` and `structuredOverlayEnabled`. Names and types are in design section 2.

## Composition, new file `9_view.ts`
```ts
export function createBoopXtermView(term, host, identity: PaneIdentity, ports: BoopXtermPorts): BoopXtermView
```
- It builds `createBoopXtermPane` (wave 2, unchanged), then every wave 3 model in dependency order.
- It returns each model by name, plus one `effects` that merges them all.
- `paneClosed` drives the final `squares_unwatch` through `concatMap` before `effects` completes (design section 8).
- The graphics overlay stays separate: the host builds it only for graphics tabs.
- Export from `index.ts`.
- `7_pane.ts` stays unedited, unless a type export is missing. In that case report it and add only that export.

## Instant tests to port
- `0_turnDebugOverlay.test.ts` (8)
- `1_terminalStructuredOverlay.test.ts` (2)
- these 5 titles from `1_agentSquaresModel.test.ts`, which lane 3a deferred to you:
  - "scrolls an overflowing recent block from the gutter wheel"
  - "lets the wheel pass through when the recent block fits"
  - "draws nothing while the pointer is inside, then the newest frame once"
  - "keeps the hold while either presence stays, and paints when both go"
  - "keeps the wheel live during the hold, repainting the held frame"

Add a `9_view.browser.test.ts` with at least these cases:
- **Connect/disconnect:** subscribing to `effects` connects every model. After unsubscribing, the host has no leftover child nodes and every scripted watch has a matching unwatch.
- **Session retarget:** unwatch old, watch new; only new-session frames paint.
- **Theme override:** set `--boop-xterm-*` tokens on the host; computed styles of the squares, the panel and a diagram use the overrides.

## Read first, whole files
- `plans/boop-xterm-wave3.DESIGN.md`. Section 12 overrides sections 1-11.
- `plans/boop-xterm-wave2.DESIGN.md` section 9
- `plans/boop-xterm-lift.PLAN.md` anti-shortcut gates
- `AGENTS.md`
- `~/projects/claude-research/skills/rxjs/SKILL.md`
- `~/projects/claude-research/skills/signals/SKILL.md`
- every `packages/boop-xterm/src/8*_*.ts`, plus `3_ports.ts`, `7_pane.ts` and `test/*`

## Setup
`pnpm --filter "@hafley66/boop-xterm^..." build`, then `pnpm --filter @hafley66/grapht-render-cytoscape build`, before any test. Do not alias source paths.

## Law
- **Subscriptions:** zero `.subscribe(`, `firstValueFrom`, `lastValueFrom` in non-test package src. Each model returns `effects: Observable<void>`.
- **Callbacks:** no function-typed parameters in public signatures. Native listener callbacks live only inside `new Observable`, and teardown is named `unsubscribe`. `ResizeObserver` is created inside `new Observable`.
- **No flags:** no boolean or generation flags for timing. State is a Signal path, a `scan`, or closure state inside one `defer`.
- **Theme:** every color, font, size and z-index painted reads a `--boop-xterm-*` token from design section 7. Add missing tokens with concrete defaults to `src/theme.css` inside a `:root` block. Do not use instant app variables such as `--accent` or `--panel-bg`.
- **Tests:** real xterm via `test/1_realTerminal.ts`, real DOM, real ResizeObserver, real React. Endpoints are scripted through `test/0_endpointTransport.ts`. Do not build doubles of Terminal, the DOM, React, Streamdown, Mermaid or ResizeObserver, and do not use `vi.mock` or `vi.stubGlobal` on product or third-party code.
- **Assertions:** prefer inline snapshots; never `toBeDefined`.
- **Forbidden:** `as any`, `as unknown as`, `as never`, `@ts-*` comments, `.skip`, `.only`.
- **Scope:** owned files are `packages/boop-xterm/**`, plus `pnpm-lock.yaml`, written only by `pnpm install`. Do not edit instant. Do not publish.

## Stop on
- A needed edit outside the owned files.
- A design contradiction.
- A product behaviour that cannot be kept.

Report with file:line.

## Validation
`cd packages/boop-xterm && pnpm typecheck && pnpm test && pnpm exec vitest run -c vitest.browser.config.ts && pnpm build`
Plus: `rg -c "\.subscribe\(|firstValueFrom|lastValueFrom" packages/boop-xterm/src -g "!*.test.ts" -g "!test/**"` prints nothing. Delete `src/__screenshots__` before committing.

## Commit
Scoped commits as you go. Final subject exactly: `feat(boop-xterm): wave 3c squares, turn panel, overlays, view`

Receipt: status / sha / files / validation / test parity table (instant file | titles | ported | missing+reason) / next.
