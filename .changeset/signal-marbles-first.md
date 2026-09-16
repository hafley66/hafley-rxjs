---
"@hafley66/signal-marbles": minor
---

New package: a marble diagram as a document, with two producers, causal columns, and one reveal.

A diagram carries two numbers, and neither is the whole truth: **tick** is the causal column — one
turn of the scheduler, or one column an author wrote — and **frame** is the virtual milliseconds that
column sits at. Frames cannot tell `of(1, 2, 3)` (one turn) from the same values given a scheduler
turn each (three turns, all at 0ms), and no arithmetic over frames recovers the difference, so the
column is document data.

- **By hand, with nothing aligned.** `marbleDoc` takes lanes of `{ tick | after, ms, kind, value,
  note, from }` and builds the column clock: `after: 2` needs no arithmetic at the call site, and an
  `ms` gap anywhere advances the time every lane shares. Every field is validated and every reference
  resolved — an unknown kind, a misspelled field, a backwards tick, a duplicate lane id, a `parent` or
  a `from` that names nothing, and a contradictory `frame` pin all throw `MarbleDocumentError` naming
  the field.
- **Real RxJS, one column per turn.** `runMarbleDemo` drains the `TestScheduler` one action per
  column, so a queue turn is a column even when no time passed. `lanes.through` is a lane read in the
  middle of a pipeline — one subscription, shared — and `lanes.each` builds the real higher-order
  operator (`merge`, `switch`, `concat`, `exhaust`, `expand`) while recording **one lane per inner
  subscription**: its name, its label, the column it was born on, the event that caused it, the
  accumulator it was handed, and its fate. `switchMap` cancelling an inner is an `unsubscribe` with a
  note on that inner's own lane; a `mergeScan` inner carries the seed it received; a `groupBy` key
  gets a lane opened on the column its key first appeared, with every value saying which source event
  routed it there.
- **A window is not a cancellation.** `truncate` is a sixth kind: the harness stopped watching. Lanes
  are cut at `windowMs`/`maxColumns` and never record `unsubscribe`, so the operator fates stay
  unambiguous. A lane that produced nothing is reported rather than drawn as if it were true:
  `runMarbleDemo` returns `{ doc, diagnostics }` and `readMarbleDemo` throws them — a `Promise` is not
  on the virtual clock, and that used to be a silent wrong answer.
- **Events carry a name, an origin, and a reason.** `keys#3` names an event; `from` says which event
  produced it; `note` says why it happened, written by hand or by the runner for a fate it observed.
  `marbleEdges` turns those into the edges a surface draws.
- **The reveal replaces the scrubber.** `revealed` is `number | "all"`: hidden, shown, current. `step`
  is one column, `play` walks the turns and restarts at column 0 from the end, `revealAll` puts the
  picture back. Nothing seeks, because a reveal is not a place you drag to.
- **The axis honours time up to a threshold.** Columns are causal and the width between two of them is
  the time between them, up to a cap; past the cap the axis breaks and the break carries the real
  milliseconds. Every column prints the milliseconds it sits at. `marbleTracks` turns that geometry
  into CSS grid tracks — one list that the axis row and every lane strip are laid out over — so a
  marble is on its turn because the turn *is* a track, and the surface holds no column position number.
- **Framework-free surface first.** `renderMarbles(player, host)` returns `{ unsubscribe }` — an
  effect's contract, so `MarbleDiagram` is the effect and nothing else. The surface draws the notes
  with their marbles, the edges between causes and their consequences, and a column readout that says
  in words what the current turn contains.

The notation reader (`readMarbles`/`printMarbles`) stays and still round-trips, but it is no longer
the front door: it is now column-based, and a format whose correctness depends on counting `-`
characters is a format that will be wrong and look right.

Subscriptions live in `5_render.ts` and nowhere else in the package: a renderer is a boundary, because
it owns native nodes and has to release them.

Cut by decision: capturing a running application (that is a trace viewer, and `@hafley66/marbler` is
one), a markdown fence (`@hafley66/md` owns fences), and editing, folding, and zoom.
