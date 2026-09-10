# Slots that are signals

Give one cell live content that repaints on its own, without the grid holding a signal for every
cell on the screen.

<GridDemo id="signal-slot" />

## Return a signal

```ts
const ticking = Signal("first")
const slots: Slots<Row> = { cell: () => ticking }

render(grid<Row>({ ...config, slots }), root)
ticking.$("second")   // one text node rewritten
```

`mount` in `src/10_render.ts` subscribes the returned signal into the row's own `Subscription`,
inserts at a comment anchor, and replaces only what the previous emission inserted. A resize handle
appended after the slot content therefore survives every update.

## Why the row does not re-render

A row rebuilds its cells only when its data, its column run, or its editing flag moved. A signal
emission is none of those, so the update reaches one text node and stops.

The subscription is owned by the row record, so a recycled row cannot keep writing into a node that
now belongs to a different row. That ownership is what makes this safe under virtualization.

## One shared source, many derived cells

The panel above drives every cell from a single tick and derives a per-cell value from it, which is
the shape to copy for latency readouts, countdowns, and progress.

```ts
const now = Signal(Date.now())
const slots: Slots<Row> = {
  cell: (it) => Signal(() => format(now.$() - it.data.startedAt)),
}
```

One producer, one subscription per visible cell, and no signal at all for a cell that scrolled out
of the window.

## The reference case in the library

`checkboxColumn` in `src/5_columns.ts` builds a header slot returning a signal that reads the flat
view and the selection record and answers one of three glyphs. It is the select-all toggle, and it
is live for the same reason your cell is.

## When not to use it

A value that changes with `GridState` needs no slot signal at all, because the row already rebuilds
on a state change. Reach for this when the source of change is outside the grid.
