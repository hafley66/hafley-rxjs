# @hafley66/signal-marbles

A marble diagram as a document: causal columns along `x`, named events, stated edges, and a reveal
that walks the turns.

> **Authorship attestation:** This README was written by Claude (AI). Every example below was run
> against the code in this package, and the screenshot at the bottom is produced by
> `src/6_marbleDiagram.browser.test.tsx`, but the prose has not been checked by a human.

## The one idea

A diagram has two numbers, and neither is the whole truth.

| | |
| --- | --- |
| **tick** | the causal column — one turn of the scheduler, or one column an author wrote |
| **frame** | the virtual milliseconds that column sits at |

Frames cannot tell two readings apart that a reader must be able to tell apart:

```
of(1, 2, 3)                       1 column    0ms    three values, one turn
of(1,2,3).pipe(concatMap(v => of(v).pipe(observeOn(asapScheduler))))
                                  4 columns   0ms    three turns, still no time
interval(1000).pipe(take(3))      4 columns   0ms, 1000ms, 2000ms, 3000ms
```

So the tick is document data. A producer records it or it does not exist, because no amount of
arithmetic over frames recovers it.

```
marbleDoc  ─┐
            ├─→  MarbleDoc  ─→  player (one reveal signal)  ─→  renderMarbles / <MarbleDiagram>
runMarbleDemo ┘
```

- **Two producers.** `marbleDoc` writes a document by hand; `runMarbleDemo` runs real RxJS on a
  virtual clock and records what happened. Neither knows the other exists.
- **One document.** `MarbleDoc` is columns of milliseconds plus lanes of notifications, each
  notification named (`keys#3`), each lane able to say what caused its subscription. zod validates
  the authored form at the boundary.
- **One reveal.** A player is a handful of signals plus a clock `Observable`. A surface reads the
  reveal and connects it; nothing else in the package subscribes.

## Install

```sh
pnpm add @hafley66/signal-marbles @hafley66/signals rxjs
```

```ts
import { createMarblePlayer, marbleDoc, renderMarbles } from "@hafley66/signal-marbles"
import "@hafley66/signal-marbles/marbles.css"

const doc = marbleDoc({
  title: "a debounce against a switch",
  lanes: [
    {
      id: "keys",
      label: "keys",
      events: [
        { tick: 1, value: "k" },
        { after: 2, value: "k" },
        { after: 2, value: "k" },
        { after: 1, ms: 300, value: "idle", note: "300ms of quiet — nothing in this gap" },
        { kind: "complete" },
      ],
    },
    {
      id: "debounced",
      label: "debounced",
      parent: "keys",
      events: [{ tick: 7, value: "request", note: "sent only because the gap was long enough" }],
    },
  ],
})

const host = document.querySelector("#host")
if (host instanceof HTMLElement) renderMarbles(createMarblePlayer(doc), host)
```

## Write it by hand

Nothing is aligned and nothing is counted. An author says which turn an event is on and what time it
cost; the columns are the document's clock, so an `ms` anywhere advances the time every lane shares.

| field | meaning |
| --- | --- |
| `tick` | the absolute column |
| `after` | columns after the previous event on this lane (default 1) |
| `ms` | the virtual milliseconds this column costs, as a gap since the previous one |
| `frame` | an absolute millisecond pin, for importing a runner-shaped document |
| `kind` | `next` (default) · `error` · `complete` · `subscribe` · `unsubscribe` · `truncate` |
| `value` | the text a `next` or an `error` carries |
| `note` | why it happened |
| `from` | the event that produced this one |

The document above yields ticks `1, 3, 5, 6, 7` and frames `1, 3, 5, 305, 306`: `after: 2` needs no
arithmetic at the call site, and the 300ms gap is the axis's own business. The first example ends at
`306` because the completion is one column after the 300ms gap.

Every field is validated and every reference resolved: an unknown kind, a misspelled field, a
backwards tick, a duplicate lane id, a `parent` or a `from` that names nothing, and a contradictory
`frame` pin all throw `MarbleDocumentError` naming the field.

## Write it as RxJS

`runMarbleDemo` records the turns a run actually took and, for a higher-order lane, the inner
subscriptions it started.

```ts
import { interval, take } from "rxjs"
import { runMarbleDemo } from "@hafley66/signal-marbles"

const { doc, diagnostics } = runMarbleDemo(
  lanes => {
    const outer = lanes.through("outer", interval(12).pipe(take(3)), { label: "interval(12)" })
    lanes.each("switched", outer, () => interval(6).pipe(take(3)), {
      op: "switch", name: "request", label: "switchMap", parent: "outer",
    })
    lanes.each("merged", outer, () => interval(6).pipe(take(3)), {
      op: "merge", name: "inner", label: "mergeMap", parent: "outer",
    })
  },
  { windowMs: 60, title: "switchMap drops the inner request, mergeMap keeps it" },
)
```

`lanes.through` is a lane read in the middle of a pipeline: **one** subscription, recorded once and
shared by everything derived from it, which is what keeps lanes fed by the same source on the same
columns. `lanes.lane` is a lane subscribed outright. `lanes.each` builds the real rxjs operator —
`op: "merge" | "switch" | "concat" | "exhaust" | "expand"` — and records one lane per inner
subscription, named (`request1`), labelled (`request #1`), born on the column its subscription began
on, with the event that caused it (`born.from`) and the value that was being handled.

The object form is sugar over the same thing:

```ts
runMarbleDemo({ outer, switched: outer.pipe(switchMap(() => inner)) }, { windowMs: 60, labels: { outer: "interval(12)" } })
```

It records one lane per subscription and cannot see inside a pipe; inner lanes need the build form.

### What the higher-order family looks like

| operator | what the run records |
| --- | --- |
| `mergeMap` | one inner lane per outer value, each ending `complete` |
| `switchMap` | the cancelled inner ends `unsubscribe` with the note *switch dropped it before it finished* |
| `concatMap` | an inner is born when the previous one finished, and its `born.from` is still the event that queued it |
| `exhaustMap` | a value that arrived while an inner ran starts no lane at all |
| `mergeScan` / `switchScan` | `seed` is written on each inner: the accumulator it was handed |
| `groupBy` | a lane per key, born on the column its key first appeared, every value carrying the `from` of the source event that routed it |
| `expand` | one lane per depth, `parent` and `born.from` following the event that spawned it |

That is recorded by wrapping the observable a project returns and handing the wrapper to the real
operator, so cancellation, concurrency, and accumulation stay rxjs's own behaviour.

### Bounds, and what a run could not capture

- `windowMs` (default 10000) and `maxColumns` (default 512) are safety bounds. A lane still running
  at either edge is cut and marked `truncate` — the harness stopped watching, which is not the same
  fact as an operator cancelling a subscription. No lane in such a document carries `unsubscribe`.
- A lane that produced nothing is reported instead of drawn: `runMarbleDemo` returns
  `{ doc, diagnostics }` and `readMarbleDemo(run)` throws them. The message is the honest one — the
  source is not on the virtual clock, or the window is too narrow. `TestScheduler` cannot virtualize
  a `Promise`, so a promise-backed lane is exactly the case that used to be a silent wrong answer.

## Read the notation, if you want it

The ASCII reader still exists and still round-trips; it is no longer the front door, because a format
whose correctness depends on counting `-` characters is a format that will be wrong and look right.

```
@title a key emitted before the subscription, and the column it stopped listening on
@legend k=key r=request

keys : -k-k-k-|
hot  : -k-^--k--!
```

| in a lane | means |
| --- | --- |
| `-` | one column |
| `a` | a value on this column, then the next column |
| `(ab)` | both on this column; the group costs one column, not one per symbol |
| `10ms`, `2s`, `1m` | one column that costs that much time, when the digit does not continue a word |
| `\|` | complete |
| `#` | error |
| `^` | subscribed here |
| `!` | unsubscribed here, costing no time |

`printMarbles` is the inverse, and `readMarbles(printMarbles(doc))` equals `doc` for anything the
notation can hold. `parseMarbles` returns `{ doc, diagnostics }` with the line each problem was on;
`readMarbles` throws them instead.

## The reveal

There is no scrubber, because a reveal is not a place you drag to. A player hides what has not
happened yet, shows the rest, and emphasises the column it stands on.

```ts
const player = createMarblePlayer(doc)

player.step(-1)          // one column back
player.step(1)           // one column forward
player.play()            // walk the turnst; at the end it restarts at column 0
player.revealAll()       // the picture again — what a diagram is until something walks it
player.revealAt(4)       // stand on one column
player.load(nextDoc)     // swap the document and show it whole
```

`revealed` is `number | "all"` and is the signal a surface reads: `"all"` shows everything, a number
shows through that column. `columns`, `playing`, `speed`, `rate`, `loop`, `laserViews`—`laneViews`,
`selected` and `hovered` are signals too, and intent is written back through the same signals. `rate`
is derived: the base rate walks the whole document in `PLAY_SECONDS`.

The clock is `marbleClock`, an `Observable` of column numbers with `playing`, `rate`, `position`,
`columns`, and `loop` as its inputs. It is handed to `Signal(observable, 0)`, so the reveal connects
when something reads it and is released when nothing does — a player nobody mounted does no work.

## The surface

`renderMarbles(player, host)` returns `{ unsubscribe }`: it decorates the element and releases it,
which is exactly an effect's contract. The React adapter is therefore the effect and nothing else.

```tsx
import { MarbleDiagram, useMarblePlayer } from "@hafley66/signal-marbles/react"

function Diagram({ doc }: { doc: MarbleDoc }) {
  return <MarbleDiagram player={useMarblePlayer(doc)} />
}
```

What a reader gets:

- **Columns are turns**, and the width between two of them is the time between them, up to a cap.
  Past the cap the axis breaks and the break carries the real milliseconds (`+300ms`); every column
  prints the milliseconds it sits at, so compression is marked rather than hidden.
- **A key, because a glyph is not a sentence.** The legend under the header names all six kinds —
  `value`, `error`, `complete`, `subscribed`, `unsubscribed`, `window closed` — the call bracket, the
  axis break, the edge, and the axis's own units (`t = turn, number = ms`), which are stated once
  there rather than repeated on every column. Hovering any marble then answers "what is this" in
  words: `switchMap: unsubscribed at tick 20 (42ms) — switch dropped it before it finished`.
- **A call has a span, and the bracket draws it.** `(` on the column a lane entered a state and `)`
  on the column it left it, on that lane's own row, so an inner's call sits bracketed inside the
  lane that lifted it. A call that nothing ended, and one the reveal has not reached the end of, are
  drawn without their closing bracket rather than with a `)` the document does not have.
- **Every marble has a name** (`keys#3`), a value, and — when a producer wrote one — the reason it
  happened. The note is drawn under its marble and revealed with it.
- **Edges are drawn** from the event that caused an event or a subscription to the thing it caused:
  a dashed curve for a birth, a solid one for value routing. An edge is hidden until both ends have
  happened, and emphasised while the reveal stands on it.
- **A column readout** says in words what the turn contains: `mergeMap value 1 merged#6 from inner2#3`,
  plus every lane that started on that column, with its cause and its seed.
- **A hidden marble is absent**, not faint: it is out of the accessibility tree until the reveal
  reaches it. Each lane also carries a text `aria-label`, and the whole document is in a `<details>`.

Three invariants hold the picture together, and `src/6_marbleDiagram.browser.test.tsx` measures all
three in a real browser rather than trusting the arithmetic:

1. **The layout abstraction is a track list.** `marbleTracks(axis)` returns the column tracks — the
   pad, one track per gap between columns, and the room past the last one — and the axis row and every
   lane strip are CSS grids over that one list (`--mb-tracks`). Column `tick` starts at grid line
   `tick + 2`, a marble is a grid item on that line, and a `translateX(-50%)` centres its own box on
   it. So a marble is on its column because the column *is* one, not because two pieces of arithmetic
   agreed; the surface holds no column position number beyond a stack offset. The axis reaches the
   same grid through a leading box that shares its width and box model with the lane gutters
   (`--mb-gutter`, `box-sizing: border-box`) — with the default content-box the axis sat eleven pixels
   left of the marbles it labels.
2. **A column is one x.** The tracks are the axis geometry, so a test can ask the document and the DOM
   the same question: the prefix sum of the tracks is where `marbleAxis` put the column, every strip
   measures the axis's own template, every marble is within a pixel of its own column's label, marbles
   sharing a column share an x, marbles per column equal the document's events per column, and no
   pitch is below one column or above the cap. No axis label overlaps its neighbour either, which is
   why the unit is stated once in the legend instead of on every label.
3. **An edge starts on the marble it came from.** The anchor is the drawn glyph's centre, measured
   against the same container the edge overlay is positioned from, so a value above a marble and a
   note below it cannot move where its edges attach. Both ends are asserted: an edge that lands a
   gutter to the right of its own event, or half a note's height above it, points at the wrong turn.

Subscriptions live in `5_render.ts` and nowhere else in the package: a renderer is a boundary,
because it owns nodes and has to release them.

## Theming

`--mb-*` variables, two cascade layers, no `!important`. Every layout number is a variable: the
renderer writes `--mb-tracks` from `marbleTracks(axis)` and `--mb-gutter` from the constant it
measures with, so a host that overrides either moves the strips and the axis together.

## Run

```sh
just dev                                        # http://127.0.0.1:5391/demo.html
pnpm --filter @hafley66/signal-marbles dev      # same thing, from the repository root
pnpm --filter @hafley66/signal-marbles test
pnpm --filter @hafley66/signal-marbles test:browser   # queued machine-wide by scripts/browser-queue.mjs
```

`src/9_demo.tsx` is the argument: one turn against three, `switchMap` against `mergeMap` with their
inner lanes, the scan forms with their seeds, `groupBy` with a lane per key, `expand` following its
recursion, and one document written by hand.

The demo also carries the docs shell's frame meter, pinned to the corner: `performanceReadout` and
`runWhenInView` from `@hafley66/docs-kit`, which is private and therefore a devDependency here. It
reports the frames the page actually painted, the worst one, how many ran long, a page-wide heap
estimate and the element count, sampled while the demo is on screen and dropped when it is not — so
"what does playing a diagram cost" is a number rather than an opinion. `runWhenInView` owns that
subscription, which is why this package still contains no `.subscribe(` outside the renderer.

## Screenshot

Generated and verified by `src/6_marbleDiagram.browser.test.tsx`.

![A marble diagram](./src/__screenshots__/6_marbleDiagram.browser.test.tsx/marble-diagram-chromium-darwin.png)

## Source

- `src/0_types.ts`: the document, its zod schema, the edges it states, and the column geometry
- `src/0_document.ts`: `marbleDoc`, the authored form and its validation
- `src/1_notation.ts`: the ASCII reader and printer
- `src/2_run.ts`: the virtual-clock runner, `drainVirtual`, and the higher-order registrar
- `src/3_clock.ts`: the reveal's producer
- `src/4_player.ts`: the signals a surface reads
- `src/5_render.ts`: the framework-free renderer
- `src/react.tsx`: `MarbleDiagram` and `useMarblePlayer`

## What is not built

| gap | why |
| --- | --- |
| capturing a running application | that is a trace viewer, and `@hafley66/marbler` is one. This package renders what a virtual clock did, or what someone wrote |
| a markdown fence | the hook is `marbleDoc`/`runMarbleDemo` and `@hafley66/md` owns fences; nothing here assumes a host |
| editing, folding, zoom | a diagram is a small document; `@hafley66/signal-grid` is the surface for large ones |
| live values on a marble | the document is JSON by design, so a value is the string it prints as |
| a lane an inner lane of an inner lane | a derived lane is subscribed once; chaining one higher-order lane into another would subscribe its source twice |
