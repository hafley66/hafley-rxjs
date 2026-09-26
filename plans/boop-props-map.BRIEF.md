# boop-props-map (read-only inventory, sol6)

Goal: write ONE file `plans/boop-props-map.REPORT.md` and commit it. Edit nothing else.

## Question
How does ~/projects/instant turn boop (the agent store / CLI / Rust commands) into the props and state its UI reads?
The user wants that layer extracted out of instant. This lane maps it; it moves nothing.

## Inspect (read only)
- ~/projects/instant/src/generated/native.ts: every command whose name starts `boop_`, `squares_`, `harness_`, or that
  src-tauri implements in `0_boop.rs`, `1_squares.rs`, `0_harness_store.rs`, `0_tmux.rs`. Also Tauri events (`listen(`) carrying boop data.
- Every instant src file calling those (commandEndpoint, invoke, native helpers, listen), and every file importing those files,
  transitively, up to the component/terminal code that renders the value.
- ~/projects/hafley-rxjs/plans/boop-xterm-lift-map.REPORT.md Table B and plans/boop-xterm-wave2.DESIGN.md (already-planned ports).
- ~/projects/hafley-rxjs/packages/boop-adapters (existing boop projections) and packages/signals (Endpoint/createQuery).

## Report shape (tables, no prose paragraphs)
A. command/event | Rust fn file:line | TS I type | TS O type | callers (file:line)
B. boop state holder in instant (caches, signals, stores, module-level vars) | file:line | holds | written by | read by
C. derived value | file:line | inputs (A/B rows) | pure? (y/n)
D. UI consumer | file:line | prop/field read | source row (A/B/C) | rendering tech (xterm overlay / React / DOM)
E. `.subscribe(` / callback / Promise sites in this layer | file:line | what it drives
F. overlap: rows already covered by boop-xterm wave-2 ports | rows covered by boop-adapters | rows covered by neither
G. instant-only coupling that blocks extraction (settings, tab registry, reactdock, localStorage keys) | file:line
Section H: commands you ran and output line counts.

## Validation
`test -s plans/boop-props-map.REPORT.md && git log -1 --format=%s`
## Commit
Subject exactly: `plans: boop props map report`
Receipt: status / sha / files / validation / next.
