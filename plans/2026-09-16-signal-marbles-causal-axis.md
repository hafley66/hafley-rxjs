# Signal marbles: a causal axis, a reveal, and notes

Status: **built**, except where a section below says otherwise. HEAD for the package was `a7b4c6b`
(`signal-marbles: the demo has an address`) when this plan was written; the redesign is on top of it.

Supersedes the question of the same date in `plans/2026-09-16-axis-options.md`; that file now records
the drawing the axis decision was made against.

## What the build changed in this plan

Seven things were decided differently, or turned out to be wrong, while building it. They are listed
here rather than edited silently into the text below, because the reasoning is the useful part.

1. **`frame` belongs to the column, not to the event.** The plan put `tick` and `frame` on every
   notification. Two events in one column are at the same moment by construction, so storing the time
   once per column is the honest shape and the axis stops needing a rule for which event's frame wins.
   The document is `{ columns: number[], lanes: [...] }`: `columns[tick]` is the virtual milliseconds
   at that column, a notification carries `tick` and no frame, and `frameAtTick` is the only reader.
2. **Events have ids and state their edges.** `keys#3` names an event (1-based, production order, lane
   ids forbid `#` so an id is splittable). A notification's `from` names the event that produced it; a
   lane's `born` names the column its subscription began on and the event that caused it. `marbleEdges`
   turns those into the edges a surface draws. This is what the fidelity bar below needed and what
   "names and edges" turned into.
3. **`each` is the operator, not a sibling.** The plan's D5 registered an inner by calling
   `lanes.each(outer, …)` next to the lane that consumed it, which subscribed the outer twice. The
   built form declares the output lane itself: `lanes.each("switched", outer, project, { op, name })`
   builds the real operator and returns the observable. That closes the plan's open question 3
   outright, and `lanes.through` — one subscription, shared — is what keeps lanes fed by one source on
   the same columns.
4. **`observeOn(asapScheduler)` over a synchronous burst is ONE turn, not three.** The measurement in
   "What I measured" below is wrong about that case: `observeOn` buffers while the source delivers
   synchronously and drains the whole buffer in a single scheduled action, so `of(1,2,3)` and
   `of(1,2,3).pipe(observeOn(asapScheduler))` are one column and two, not one and three. Assigned to
   its own turn each, the values are three turns: `of(1,2,3).pipe(concatMap(v => of(v).pipe(observeOn(asapScheduler))))`
   is four columns, all at 0ms. That is the demo that makes the point, and the test asserts it.
5. **The window cut and the teardown must happen inside `run()`'s callback.** `TestScheduler.run`
   calls its own `flush()` the moment the callback returns, and that `flush()` has no frame limit. A
   live `interval` left on the queue is then an infinite loop rather than a diagram — the first
   symptom was a suite that hung instead of failing. `drainVirtual` stops; the cut and the unsubscribe
   happen before the callback returns; `run()`'s flush then finds an empty queue.

6. **The axis was a gutter away from its own columns, and only a measurement found it.** The labels
   were absolutely positioned and the axis carried `padding-left: var(--mb-gutter)`; an abspos child
   measures from the padding box, so the padding moved nothing and every label sat 168px left of the
   column it named. Under that was a second one: `.mb-gutter` was `flex: 0 0 168px` with a padding and
   a border, and with the default content-box its box was 179px wide, so the strips began eleven
   pixels right of the axis even after the padding was a margin. Both are now invariants with tests
   that measure the laid-out DOM: a marble is within a pixel of its column's label, marbles sharing a
   column share an x, and the per-column marble count equals the document's events on that column.
   Reading a rendered picture was what found this; the arithmetic was self-consistent the whole time.
7. **A glyph is not a sentence.** `^` and `⌄` were legible to whoever wrote them and to nobody else.
   The surface now carries a legend naming all six kinds plus the break and the edge, and every marble
   has a `title` in words (`switchMap: unsubscribed at tick 20 (42ms) — switch dropped it before it
   finished`). The lesson generalises: anything the renderer draws as a shape needs one place that
   says what the shape means.

Still open, and answered in the build rather than reserved: the initial reveal is `all` (a diagram in
a page is a picture), notes show on every revealed marble with the current column's emphasised, and
`each` reads the lane it was derived from instead of subscribing it again.

## The evidence for the fidelity bar

`mergeMap`, `switchMap`, `concatMap`, `exhaustMap`, `mergeScan`, `switchScan`, `expand`, and `groupBy`
are all captured by wrapping the observable a project returns and handing the wrapper to the real
operator — no operator is reimplemented, so cancellation, concurrency, and accumulation stay rxjs's
own behaviour. What a run records, measured rather than assumed:

```
mergeMap    inner#1..4      born t1/f10 from source#1  cause=v0     each ends complete
switchMap   req#1..4        born t1/f10 from source#1  cause=v0     1..3 end unsubscribe, #4 complete
mergeScan   inner#1..4      born t1/f10 from source#1  seed=0,2,4,6 each ends complete
switchScan  inner#1..4      born t1/f10 from source#1  seed=0,10,20,30  1..3 end unsubscribe
expand      expand#1..5     expand#2 born from expand#1#2 cause=a   parent chain is the recursion
groupBy     group#1..3      born t1/f10 from keys#1 (key a), t2 (key b), t4 (key c)
                            group#1 carries values from keys#1, keys#3, keys#6
```

Two limits the probe exposed and the build states rather than hides:

- `exhaustMap` starting no lane for a value that arrived while an inner ran is visible only as the
  absence of a lane. There is no event for a value that nothing handled.
- `expand` over a synchronous seed is one column, because recursion is not a queue boundary. The
  parent chain, not the axis, is what makes that diagram readable.

## What is wrong

1. **Ticks are invisible.** Two demos that differ in the most instructive way RxJS can differ record
   identically today.
2. **An inner stream's fate is invisible.** The `switchMap` demo is this package's own example and it
   does not show the thing `switchMap` does.
3. **The axis is the wrong axis, and the playhead is the wrong instrument.** A scrubber asks the
   reader to hunt along a line for something they cannot name. Nothing in reading a marble diagram
   requires scrubbing.
4. **Positional ASCII is a counting task.** A format whose correctness depends on me counting `-`
   characters is a format that will be wrong and look right.

## What I measured

Against the current `runMarbleDemo`:

```
of(1,2,3)                                → subscribe@0, next@0:1, next@0:2, next@0:3, complete@0
of(1,2,3).pipe(observeOn(asapScheduler)) → subscribe@0, next@0:1, next@0:2, next@0:3, complete@0
from(Promise.resolve(9))                 → subscribe@0, unsubscribe@10000        ← the value is gone
```

Rows 1 and 2 are one synchronous burst and three scheduler turns. Row 3 is worse than invisible:
`TestScheduler.run` cannot virtualize a microtask, so the promise resolves after `flush()` returns
and after this package closed its observers. The diagram reports a lane that produced nothing — a
**silent wrong answer**.

And a prototype of the tick capture in D4, since deleted, produced this:

```
of(1,2,3)                                tick 0        frame 0        next 1,2,3, complete
of(1,2,3).pipe(observeOn(asapScheduler)) ticks 1,2,3   frame 0        next 1,2,3, complete
interval(1000).pipe(take(3))             ticks 1,2,3   frames 1000,2000,3000
```

Same frames, different ticks. The loop that produced it is 11 lines, needs no cast, and every field it
touches is public.

## The model

### Two numbers, and neither is the whole truth

```
tick   the causal column: one turn of the scheduler, or one column an author wrote
frame  virtual milliseconds at that turn
```

Two ticks share a frame whenever something ran synchronously or on a microtask. That equality is the
information, and a document that stores both can be drawn honestly.

### The axis honours time up to a threshold (decided)

One geometry, not a mode. Columns are *causal* — every turn gets its own column, so a burst and a
sequence are never the same picture — and the width between two columns is *proportional to the time
between them*, up to a cap. Past the cap the axis breaks and says how much time it skipped.

```
unitMs      = the smallest positive gap between consecutive columns in the document
pitch(gap)  = clamp(PITCH, (gap / unitMs) * PITCH, MAX_PITCH)
x(0)        = PAD ;  x(t+1) = x(t) + pitch(frame(t+1) - frame(t))
break(t)    = the gap exceeded MAX_PITCH, so draw a break mark carrying the real milliseconds
```

with `PITCH` one column (26px) and `MAX_PITCH` six of them.

| document | unitMs | what it draws |
| --- | --- | --- |
| `of(1,2,3)` vs `observeOn(asapScheduler)` | 1 (no positive gap) | one column per turn, gaps of 0 → the floor. **Different pictures**, which they are not today |
| `interval(1000).take(3)` | 1000 | four equal columns; the 1000ms is the label |
| keys at 1ms with a 300ms debounce | 1 | tight columns for the keys, then a break marked `+300ms` |
| a hot lane idle for ten seconds | 1ms (from the other lane) | one column plus a break, not a screen of nothing |

The axis never lies: every column prints the virtual milliseconds it sits at, so the reader knows
whether they are looking at 1ms of pitch or 6 columns of compressed silence.

### The playhead is a reveal, not a scrubber (decided)

A player hides what has not happened yet and shows events as it reaches them. Three states per
marble: **hidden**, **shown**, **current**. No dragging, no clicking a strip to seek. Starting from
`all` — a diagram in a page is a picture — stepping back to column 0 begins a run.

Controls: `◀` `▶` one column, `play` advancing the reveal on the clock, `all` showing everything.
`play` at the end restarts from column 0.

### An event can say why it happened (decided)

`note` joins the notification: `{ tick: 4, kind: "unsubscribe", note: "switchMap drops inner #1" }`.
Authored by hand, and written by the runner for the fates it observes (`inner #1 cancelled`,
`inner #2 completed`, `window closed`). Rendered under the marble, revealed with it, emphasized on
the current column.

## Decisions

**D1 — `tick` is document data.** A tick cannot be derived from frames: `of` and `asap` have identical
frames, identical ordering, and different ticks. Either the producer records it or it does not exist.
`MarbleNotification` gains `tick`; the schema version goes to `marbles/2`.

**D2 — authoring is structured, and nothing requires alignment.**

```ts
marbleDoc({
  title: "a debounce against a switch",
  lanes: [
    { id: "keys", label: "keys", events: [
      { tick: 1, value: "k" },
      { after: 2, value: "k" },
      { after: 2, value: "k" },
      { after: 1, ms: 300, value: "idle" },
      { kind: "complete" },
    ]},
    { id: "debounced", parent: "keys", events: [
      { tick: 7, value: "request", note: "300ms of quiet since the last key" },
      { kind: "complete" },
    ]},
  ],
})
```

| field | meaning |
| --- | --- |
| `tick` | absolute column |
| `after` | columns after the previous event on this lane (default 1) |
| `ms` | virtual time this event costs, as a gap since the previous event |
| `frame` | absolute milliseconds, for importing a runner-shaped document by hand |
| `kind` | `next` (default) · `error` · `complete` · `subscribe` · `unsubscribe` · `truncate` |
| `value` | the text a `next` or an `error` carries |
| `note` | why it happened |

`frame` defaults to `previous frame + (ticks advanced) × msPerTick`, `msPerTick` a lane option
(default 1). Zod validates the input, so a misspelled field fails at the call site.

**D3 — the notation stays and is defocused. (decided)** `parseMarbles`/`printMarbles` keep their tests
and their place; they stop being the front door. The README leads with `marbleDoc`, the demo authors
both diagrams with `marbleDoc`, and a model is asked for `{tick}` / `{after}`, not columns.

**D4 — the runner counts real ticks.** `run()` drains its queue with no seam, but the loop is 12 lines
and every field it touches is public (`scheduler.actions`, `action.execute`, `scheduler.frame`,
`scheduler.hotObservables[].setup()`). So: inside `run()`'s callback, subscribe the lanes, then drain
one action per tick with a copy of that loop. `run()`'s own `flush()` then finds an empty queue.
Measured above.

**D5 — an inner subscription is a lane.** A registrar form, because inner lanes are discovered during
the run and a static record cannot name them:

```ts
runMarbleDemo(lanes => {
  const outer = interval(12).pipe(take(3))
  lanes("outer", outer, { label: "interval(12)" })
  lanes.each(outer, () => interval(4).pipe(take(3)), { name: "inner", parent: "outer" })
})
```

`each` registers `inner#1`, `inner#2`, … as each subscription begins, and records that
subscription's own fate: cancelled → `unsubscribe`, finished → `complete`, threw → `error`. Each is
noted, so the diagram says *which* one and *why*. The object form stays as sugar over the registrar.

**D6 — a harness's window is not an operator's cancellation.** A sixth kind, `truncate`: the diagram
stopped watching. Cut lanes never record `unsubscribe`, so the three operator fates stay unambiguous.

**D7 — a run reports what it could not capture.** `runMarbleDemo` returns `{ doc, diagnostics }`,
`readMarbleDemo` throws them, mirroring `parseMarbles`/`readMarbles`. First diagnostic: *lane `x` never
emitted and was still subscribed when the clock stopped — a Promise or a real timer is not on the
virtual clock.* Second: a lane past `MAX_LANE_NOTIFICATIONS` is told to narrow the window rather than
becoming a 10,000-column diagram silently.

**D8 — the playhead is a reveal point.** `player.revealed: Signal<number | "all">` replaces
`position`/`frame` as the thing a surface reads. Hidden / shown / current. `play` at the end restarts
at 0. Pointer scrubbing is removed; clicking a lane still selects it.

**D9 — the axis is `x(t+1) = x(t) + clamp(PITCH, gap / unitMs × PITCH, MAX_PITCH)`**, with a break
mark past the cap. One geometry, no mode toggle.

**D10 — the internals are contained and pinned.** `drainVirtual(scheduler, { maxFrames, onTick })` is
the only code touching `actions`/`execute`, and a test asserts a suite of demos produces the frames a
plain `run()` produced before this change. An rxjs bump fails that test instead of quietly
mis-numbering ticks.

**D11 — `note` is document data.** It is the "why", it belongs to the event, and it is the difference
between a diagram that displays and a diagram that explains.

**D12 — `<details>` shows the document, not the ASCII.** It is the thing that can be pasted back into
code, and it is the compatibility record. Low stakes, two lines either way.

## Work

Each phase leaves the package green.

1. **`0_types.ts`** — `tick` and `note` on notifications, `truncate` on the union, `ticks`/`frames`
   extents, `tickAxis`, `frameAtTick`, `axisPitches(doc)` for D9, normalization sorting by tick.
   `MARBLES_VERSION` → `marbles/2`. Acceptance: two ticks sharing a frame give two columns, both at
   the same frame; a gap past the cap yields a break.
2. **`0_document.ts`** (new) — `marbleDoc(input)`, the D2 cursor, zod input schema. Acceptance: the
   D2 example yields ticks `1,3,5,6,7` and frames `1,3,5,305,306`; `after: 2` needs no arithmetic; an
   unknown kind or a backwards tick is an error naming the field.
3. **`1_notation.ts`** — the parser assigns ticks as well as frames (a column per character, `Nms` one
   tick and N frames, `!` no advance); the printer prints both. Acceptance: existing round-trips hold.
4. **`2_run.ts`** — `drainVirtual`, ticks, the registrar, `lanes.each` with notes, `truncate`,
   `{ doc, diagnostics }`. Acceptance: the D4 and D5 tables, the Promise diagnostic, a window cut that
   is `truncate` and not `unsubscribe`.
5. **`3_clock.ts` + `4_player.ts`** — `revealed` as the playhead, `all` as a state, replay at the end,
   step by column, no seek. Acceptance: the clock's scheduler-driven tests move from frames to columns;
   `play` at the end starts at 0; `revealed` never exceeds the column count.
6. **`5_render.ts` + `marbles.css`** — the D9 geometry with break marks, hidden/shown/current,
   notes, the four terminal glyphs, the controls, the document in `<details>`. Acceptance: a hidden
   marble is absent from the accessibility tree until revealed; a break carries its real ms; four
   terminals draw four glyphs; a note renders with its marble.
7. **`9_demo.tsx`, README, changeset** — the demo becomes the argument: `of` against
   `observeOn(asapScheduler)` (one column against three), `switchMap` against `mergeMap` with inner
   lanes ending `unsubscribe` against `complete`, and a note on every other marble saying why.

## Acceptance, as commands

```sh
pnpm --filter @hafley66/signal-marbles receipts
pnpm --filter @hafley66/signal-marbles test:browser
pnpm release:check
```

Named tests the change is not done without:

- `of(1,2,3)` is one turn and `observeOn(asapScheduler)` is three, both at frame 0.
- `interval(1000).take(3)` is three turns at frames 1000, 2000, 3000, and the axis draws four equal
  columns with those labels.
- a document with a 1ms gap and a 300ms gap draws one break, carrying `300ms`.
- a `switchMap` inner ends `unsubscribe`, a `mergeMap` inner ends `complete`, a throwing inner ends
  `error` — in one test, one source, with three notes.
- a window cut is `truncate`; no lane in that document carries `unsubscribe`.
- a Promise-backed lane yields a diagnostic that says why.
- `marbleDoc` positions by `after` and by `ms` with no arithmetic in the test.
- revealing is progressive: a marble after the reveal point is hidden, and the same one at it is
  current.
- `play` at the end restarts at column 0.
- the four terminals render four distinct glyphs.

## Risks

- **rxjs internals.** Four fields are public today and marked for removal in v8. The prototype shows
  the loop works and needs no cast, and it stays in one function with one pinning test — but the
  coupling is real and it is the honest cost of D4. If v8 moves these fields, `drainVirtual` is the
  one file to rewrite.
- **Authored ticks and scheduler ticks are not the same animal** — one is a step a person chose, the
  other a turn the machine took. Both are "a causal column"; the README has to say so plainly or the
  axis teaches something subtly false.
- **A tick per action makes wide documents.** `interval(1)` over a ten-second window is 10,000 columns.
  The extract is right and unusable; D7's cap is the guard, and the honest answer at that size remains
  `@hafley66/marbler`.
- **`lanes.each(outer, …)` subscribes the outer a second time.** Harmless for a cold source, wrong for
  a stateful one. Document it, or make `each` read a lane the registrar already holds.
- **Notes are free text and will be used for paragraphs.** A hard cap on rendered length, and the full
  text on hover, or the diagram becomes a document with a diagram in it.

## Not in this plan

Live capture of a running application, a markdown fence, editing, folding, zoom, and sharing a
document with `@hafley66/marbler`'s event model.

## Decided, and still open

Decided on 2026-09-16: the notation stays and is defocused (D3); the axis honours time up to a
threshold with a break past it (D9); the playhead is a reveal rather than a scrubber and events carry
notes (D8, D11).

Still open, and both are small:

1. **The initial reveal state.** `all` (a diagram in a page is a picture, and stepping back to column 0
   starts a run) or `0` (the explainer is the default and the whole picture has to be asked for).
2. **Whether a note shows on every revealed marble or only on the current column.** Every one teaches
   more and clutters more; the current one alone stays readable and hides the argument until you walk
   to it.
