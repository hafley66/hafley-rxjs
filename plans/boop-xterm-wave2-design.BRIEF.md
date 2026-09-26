# boop-xterm-wave2-design (read-only design, sol6)

Goal: write ONE file `plans/boop-xterm-wave2.DESIGN.md` and commit it. Edit nothing else.
Read first: `plans/boop-xterm-lift.PLAN.md`, `AGENTS.md`, `~/projects/claude-research/skills/rxjs/SKILL.md` (whole file),
and how `packages/boop-xterm/src` is shaped today.

## Subject (read only, in ~/projects/instant/src)
00a_terminalIntersection.ts, 00b_terminalLineAnchors.ts, 0_terminalTurnVisibility.ts, 0_terminalWheel.ts,
0_terminalPinnedSelection.ts, 0b_ompTurnBinding.ts, and every call site that constructs or calls them (terminal.ts etc.).

## Law the design must satisfy
- Zero `.subscribe(` in the package. Instances built by constructors that subscribe internally become functions
  that take Observables and return an Observable (or a record of Observables). Effects ride in `tap` inside the returned stream.
- Zero function-typed callback parameters in public signatures. Every current callback
  (`scrollTmux`, `activity`, `turns: () => Promise<BoopTurn[]>`, `ingest`, `onSessionBinding`, `copy`, `register(emit)`, `TurnLocator`, ...)
  becomes either an input Observable, an output Observable the host consumes, or a request/response pair of streams.
  List every one; none may be skipped.
- The port record: one exported type `BoopXtermPorts` naming every stream the host (instant) supplies, with field names
  and casing copied from the Rust/IPC names where the data crosses Tauri (see plans/boop-xterm-lift-map.REPORT.md Table B).
- Pure functions stay pure and move unchanged.

## Document shape (in this order; tables and code fences, no prose paragraphs)
1. Type signatures: every exported symbol, current signature | proposed signature. Full TS, no ellipses.
2. Pseudo-code bodies (comments only) for each reactive function: which operators, in what order, where `share`/`shareReplay` sit.
3. Instance timelines: for each current class, when it is created, what it holds, when it ends; then the same for the proposed stream
   (what subscription starts it, what completes/unsubscribes it). Marble diagram per stream.
4. Storage and sequence: every mutable field (`viewportRevision`, `settled`, subjects, `lifetime`) -> where that state lives after
   (scan/state in stream), read/write order, uniqueness conditions.
5. Callback ledger: callback | file:line | replacement stream | direction (host->pkg / pkg->host).
6. Host composition sketch: how instant's terminal.ts wires the ports and returns one stream up to main.ts.
7. Test plan: per function, the marble test (rxjs TestScheduler) cases: case | input marbles | expected marbles | why it exists.
8. Open questions: anything where the current behavior is ambiguous. file:line each.

## Stop on
Anything requiring a write outside the design file.

## Validation
`test -s plans/boop-xterm-wave2.DESIGN.md && git log -1 --format=%s`
## Commit
Subject exactly: `plans: boop-xterm wave 2 design`
Receipt: status / sha / files / validation / next.
