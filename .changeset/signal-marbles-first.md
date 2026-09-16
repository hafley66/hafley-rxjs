---
"@hafley66/signal-marbles": minor
---

New package: a marble diagram as a document, with two producers and one playhead.

A diagram is lanes × frames, and everything else is a view of it. Both producers emit the same
`MarbleDoc` — lanes of notifications on one integer clock, JSON, zod-validated at the boundary, with
the extent derived from the content.

- **Notation.** `readMarbles` reads `-a-b-(cd)-|`, RxJS's own conventional marble syntax with two
  deliberate changes: `(ab)` costs one frame rather than one per character, because in a drawing the
  parens are a shape and not a clock, and indentation carries the derivation instead of a separate
  declaration. `^` and `!` mark the window a lane was listened to, which is what a unidirectional
  diagram can show and a sequence diagram cannot.
- **Real RxJS.** `runMarbleDemo` takes a plain object of observables and runs it on a
  `TestScheduler`. Inside `run`, the async, interval, timeout, and animation-frame schedulers all
  delegate to the virtual clock, so `interval(1000)` written at module scope ticks in virtual
  milliseconds and ten virtual seconds of `interval(1)` costs about a millisecond of wall time. The
  window is a safety bound: a lane still running at the edge is cut and marked `unsubscribe` rather
  than completed, so an unbounded source says so on the diagram instead of hanging the process.
- **One playhead.** `marbleClock` is an Observable of frames from `playing`, `rate`, `position`,
  `duration`, and `loop`. The player hands it to `Signal(observable, 0)`, so the clock connects when
  something reads the playhead and releases when nothing does: a player nobody mounted does no work,
  and a seek is a signal write rather than a method call on a running timer.
- **Framework-free surface first.** `renderMarbles(player, host)` returns `{ stop }`, which is
  exactly an effect's contract, so `MarbleDiagram` is the effect and nothing else. Lanes indent by
  derivation, marbles sharing a frame stack, what the playhead reached is marked, what a subscription
  missed is dimmed, and every lane carries a written description for a reader who cannot see it.

Subscriptions live in `5_render.ts` and nowhere else in the package: a renderer is a boundary,
because it owns native nodes and has to release them.

Cut by decision: capturing a running application (that is a trace viewer, and `@hafley66/marbler` is
one), a markdown fence (`@hafley66/md` owns fences), and editing, folding, and zoom.
