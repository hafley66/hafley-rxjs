# Signals instead of value and onChange

Controlled here is one signal you hold, and the grid writes back into it. A signal is both halves in
one object, so there is no pair to re-join and no default for the join to pick.

## The pair, and what it forces

A value prop beside an onChange prop is one state cell split across two arguments. Every consumer
has to re-join them, and the library has to pick a default for the join, which is where controlled
and uncontrolled come from.

```ts
// the pair
<Grid sortModel={sort} onSortModelChange={setSort} />

// one object
g.state.sort.$()
g.state.sort.$([{ field: "name", sort: "asc" }])
runWhenInView(g.state.sort.$, handle)
```

| you want | you do |
| --- | --- |
| the current value | `g.state.sort.$()` |
| to write it | `g.state.sort.$(model)` |
| to observe it | `runWhenInView(g.state.sort.$, handle)` |
| to own it entirely | hand your own signal in as `config.state` |
| to persist it | `sync`, which round-trips the whole state through the url |

Owning it entirely is controlled in both directions. Your write reaches the grid and the grid writes
what the user did back into the same object, so there is no third state to reconcile and no
`onSortModelChange` to pair with the value. See [GridState](/reference-grid-state).

## Why one deep signal rather than many

Exactly one `Signal<GridState>` exists per grid. The recursive proxy makes a nested path lazily on
first touch, so a wide grid holds one signal until something reads a sub-path.

```ts
g.state.colWidth.name.$(140)   // no signal existed for this path until now
```

A nested-path selector dedupes with `distinctShallow` by default, so writing one column's width does
not re-emit every other branch. That is the difference between a width drag costing a full pipeline
re-sort and costing one column, measured on [No layout algorithm](/why-no-solver).

## Why the view is computed signals rather than a subscription graph

Each stage of the chain is one computed, and a computed re-derives its dependency set on every run.
A branch that stops reading the group keys stops subscribing to them, with no dependency array to
keep correct by hand.

Reading a stage is calling it, which is why a unit case asserts the pipeline with no document, no
subscription, and no flush.

```ts
g.state.sort.$([{ field: "size", sort: "asc" }])
g.view.flat.$().map((it) => it.key)
```

## Where signals stop

A gesture is mostly declining to act, and a signal cannot decline to emit. Anything with a filter, a
deadline, or a pointer stream is plain RxJS: the drag operator in `src/6_gestures.ts`, the epics in
`src/7_epics.ts`, and the delegated event streams.

The seam between them is the epic signature, which takes an action stream and the state signal and
returns an action stream. See [Epics](/reference-epics).

## The consequence for slots

A slot may return a signal, so one cell can be live without the grid minting a signal per cell. The
renderer subscribes that node into the row's own subscription and replaces only what it inserted.
See [Slots that are signals](/cells-signal-slots).
