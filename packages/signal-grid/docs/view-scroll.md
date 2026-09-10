# Scroll position as state

Read where the grid is scrolled to, and move it there yourself, through the same signal.

<GridDemo id="scroll-position" />

## The viewport source

The viewport is a `GridSource<Viewport>` holding the box the window is computed from.

```ts
const viewport = Signal<Viewport>({ top: 0, left: 0, width: 900, height: 420 })
const g = grid<Row>({ ...config, viewport })

viewport.top.$(rowIndex * rowHeight)
```

Writing the top is the whole of "scroll to row nine hundred", because the window is derived from the
box and the renderer follows the plan.

## Reading it back

```ts
g.state.$()             // the grid's own state
g.view.plan.$().offsetTop
g.view.plan.$().centerTotal
```

`offsetTop` is the translate applied to the windowed run, and `centerTotal` is the height of the
scroll spacer standing in for everything not rendered. Both reach the DOM as custom properties
written by `src/9_css.ts`.

## Restoring a position

Because the box is a signal you own, persisting it is persisting a value. Nothing in the grid stores
it, and nothing has to be told a restore happened.

```ts
viewport.$(JSON.parse(sessionStorage.getItem("files-viewport") ?? "{}"))
```

## The scroll intent

The scroll box raises `viewport.scroll` as an intent, which is what
`pageOnScrollNearEnd` in `src/7_epics.ts` listens to for infinite mode. Subscribing to `g.intent$`
yourself gives you the same events with no epic in between. See
[Intents, changes, effects](/reference-actions).

## What carries no route

The scroll box and the run box are deliberately routeless. A routed element between the grid and its
rows would lengthen every cell's composed chain into one that no path template declares, and
delegation matches the whole chain rather than a prefix.
