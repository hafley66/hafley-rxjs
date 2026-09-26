---
created: 2026-09-26
updated: 2026-09-26
type: chore
status: open
priority: high
---

# boop-xterm: no `Map`; host state is one Signal read by path, not 32 leaf signals

Branch: `chore/the-gang-drops-the-map`

## Description
User rulings (2026-09-26):
- No JS `Map`, in type positions or at runtime. `Set` is allowed.
- `@hafley66/signals` is a proxy-path tool: one `Signal<State>` whose nested paths are signals (`state.turnDebugEnabled.$()`). A record of many separate leaf `Signal(...)`s is the defect.

## Current
| item | count | where |
| --- | --- | --- |
| `Map` sites (`new Map`, `Map<`, `ReadonlyMap<`), non-test | 42 | `1_turnMatching.ts` 6, `8b_contextGutter.ts` 5, `5_lineAnchors.ts` 5, `8f_forkRender.ts` 4, `8g` 3, `8e` 3, `9_view` 2, `8k` 2, `8j` 2, `3_ports` 2, `2_agentSquaresMarks` 2, 1 each in `8i`, `8c`, `4_forkMarks`, `2_turnLocate`, `2_contextSyncPure`, `2_agentSquaresModel` |
| `Signal<`/`SignalSource<` leaf fields on `BoopXtermPorts` | 32 | `3_ports.ts` |
| hosts that build 32 leaves | instant `src/terminal.ts:~720-750`, `src/0_terminalPaneVisibility.test.ts:~30-60`, `src/test/0_endpointTransport.ts` | e.g. `turnDebugEnabled: Signal(false)`, `turnTags: Signal<ReadonlyMap<…>>(new Map())`, `favoriteSources: Signal<ReadonlySet<string>>(new Set())` |

## Want
- `BoopXtermPorts` = `{ state: Signal<BoopXtermHostState>; …endpoints }`, where `BoopXtermHostState` is one plain object type: `{ paneVisible: boolean; paneClosed: boolean; harness: HarnessId | null; tabSessionIds: string[]; inlineDiagrams: boolean; diagramInference: DiagramInference; turnDebugEnabled: boolean; agentSquaresEnabled: boolean; squaresOptions: SquaresOptions; favoriteSources: Set<string>; turnTags: Record<string, string[]>; forkLivePane: boolean; tabName: string; sessionIds: string[]; … }`.
- Reads inside the package are paths: `ports.state.turnDebugEnabled.$`, `ports.state.squaresOptions.mode.$()`.
- Event-only signals (`scanRequested`, `selectionClear`) stay as events on the same state (`state.scanRequested`), or become one `events: Signal<HostEvent>`; pick the one the signals skill documents.
- Every `Map` becomes a `Record<string, T>` (plain object keyed by the id string) or an array, whichever the call site indexes by. `elementsByBufferRow: Map<number, …>` becomes `Record<number, …>`.
- The host (instant) builds one object literal, and the test transport does too. No per-field `Signal(...)` calls.

## Acceptance Criteria
- [ ] `rg '\bMap\b' packages/boop-xterm/src --glob '!*test*'` = 0 (excluding `SourceMap`-like words), and the same for instant `src/`.
- [ ] `BoopXtermPorts` has 1 state signal; `rg 'Signal\(' instant/src/terminal.ts` counts only that one for ports.
- [ ] Existing boop-xterm unit and browser suites pass. Instant tsc + vitest pass.
- [ ] Mechanical renames through `extract rename`, where a symbol is renamed.
